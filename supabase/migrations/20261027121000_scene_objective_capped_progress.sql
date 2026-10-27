-- Aggregate challenge score with per-objective caps. Verified contributions
-- still exist in the underlying ledger for personal history, but city success
-- requires the combined progress of all distinct objectives.
-- This migration is additive and does not activate templates or payouts.
begin;

create or replace function private.scene_capped_cycle_points(p_cycle_id uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(sum(
    least(obj.target_points, coalesce((
      select sum(sc.points)
      from public.scene_contributions sc
      where sc.objective_id = obj.id and sc.invalidated_at is null
    ), 0))
  ), 0)::integer
  from public.scene_challenge_objectives obj
  where obj.cycle_id = p_cycle_id
    and obj.status in ('active','completed');
$$;

revoke all on function private.scene_capped_cycle_points(uuid)
  from public, anon, authenticated;
grant execute on function private.scene_capped_cycle_points(uuid) to service_role;

create or replace function public.get_city_scene_board(p_city_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'city_id', c.id,
    'city_name', c.name,
    'cycles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cc.id,
          'cadence', cc.cadence,
          'starts_at', cc.starts_at,
          'ends_at', cc.ends_at,
          'target_total', cc.target_total,
          'earned_points', coalesce((
            select private.scene_capped_cycle_points(cc.id)
          ), 0),
          'theme_slug', cc.theme_slug,
          'milestones', coalesce((
            select jsonb_agg(sm.percent_threshold order by sm.percent_threshold)
            from public.scene_milestones sm
            where sm.cycle_id = cc.id
          ), '[]'::jsonb),
          'objectives', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', ob.id,
              'title', t.title,
              'description', t.description,
              'action_type', t.action_type,
              'target_points', ob.target_points,
              'earned_points', coalesce((
                select least(ob.target_points, coalesce(sum(sc2.points), 0))
                from public.scene_contributions sc2
                where sc2.objective_id = ob.id and sc2.invalidated_at is null
              ), 0),
              'status', ob.status
            ) order by t.slug)
            from public.scene_challenge_objectives ob
            join public.scene_challenge_templates t on t.id = ob.template_id
            where ob.cycle_id = cc.id
          ), '[]'::jsonb)
        )
        order by case cc.cadence when 'daily' then 1 when 'weekly' then 2 else 3 end
      )
      from public.scene_challenge_cycles cc
      where cc.city_id = c.id
        and cc.starts_at <= now() and cc.ends_at > now()
        and cc.status in ('active', 'completed')
    ), '[]'::jsonb)
  )
  from public.cities c
  where c.id = p_city_id
    and (select auth.uid()) is not null;
$$;

create or replace function private.reconcile_scene_milestones(p_city_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.scene_milestones
    (cycle_id, percent_threshold, art_version)
  select c.id, threshold.percent_threshold, c.art_version
  from public.scene_challenge_cycles c
  cross join (values (25), (50), (75), (100)) threshold(percent_threshold)
  cross join lateral (select private.scene_capped_cycle_points(c.id) as earned) progress
  where c.status in ('active', 'completed')
    and (p_city_id is null or c.city_id = p_city_id)
    and progress.earned * 100 >=
      c.target_total * threshold.percent_threshold
  on conflict (cycle_id, percent_threshold) do nothing;

  get diagnostics v_inserted = row_count;

  -- Projection state follows actual objective progress, including reversals.
  update public.scene_challenge_objectives obj
     set status = case when (
       select coalesce(sum(sc.points),0)
       from public.scene_contributions sc
       where sc.objective_id = obj.id and sc.invalidated_at is null
     ) >= obj.target_points then 'completed' else 'active' end
   where obj.status in ('active','completed')
     and exists(
       select 1 from public.scene_challenge_cycles cyc
       where cyc.id = obj.cycle_id
         and cyc.status in ('active','completed')
         and (p_city_id is null or cyc.city_id = p_city_id)
     );

  update public.scene_challenge_cycles c
     set status = 'completed'
   where c.status = 'active'
     and (p_city_id is null or c.city_id = p_city_id)
     and private.scene_capped_cycle_points(c.id) >= c.target_total;

  return v_inserted;
end;
$$;

create or replace function private.reconcile_scene_reward_entitlements(
  p_city_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.scene_reward_claims (
    account_id, profile_id, cycle_id, reward_key,
    status, reward_kind, reward_amount
  )
  select earned.account_id, earned.profile_id,
    earned.cycle_id, policy.reward_key,
    'pending', policy.reward_kind, policy.reward_amount
  from (
    select cycle.id as cycle_id, cycle.cadence,
      cycle.city_id, cycle.target_total,
      contribution.account_id,
      (array_agg(contribution.profile_id
        order by contribution.source_completed_at, contribution.profile_id))[1]
          as profile_id,
      sum(contribution.points)::integer as earned_points,
      private.scene_capped_cycle_points(cycle.id) as city_points
    from public.scene_challenge_cycles cycle
    join public.scene_challenge_objectives objective
      on objective.cycle_id = cycle.id
    join public.scene_contributions contribution
      on contribution.objective_id = objective.id
    where cycle.ends_at <= now()
      and cycle.status in ('expired','completed')
      and contribution.invalidated_at is null
      and (p_city_id is null or cycle.city_id = p_city_id)
    group by cycle.id, cycle.cadence, cycle.city_id, cycle.target_total,
      contribution.account_id
  ) earned
  join public.scene_reward_policies policy
    on policy.cadence = earned.cadence and policy.enabled is true
    and earned.earned_points >= policy.min_personal_points
    and (policy.requires_city_success is false
      or earned.city_points >= earned.target_total)
  on conflict(account_id, cycle_id, reward_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
commit;
