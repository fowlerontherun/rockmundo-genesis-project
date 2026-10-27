-- Correct late-arriving verified events and retract invalidated mural states.
-- Events may settle up to seven days after cycle end. Existing history is
-- preserved; revoked milestones have a timestamp instead of being deleted.
-- No reward policies or payout settings are changed.
begin;

alter table public.scene_milestones
  add column if not exists revoked_at timestamptz;

create index if not exists scene_milestones_active_cycle
  on public.scene_milestones(cycle_id,percent_threshold)
  where revoked_at is null;

create or replace function private.reconcile_scene_milestones(p_city_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_changed integer := 0;
  v_rows integer := 0;
begin
  -- Reconciliation is also performed after a cycle expires: a valid event
  -- completed before the deadline may be finalised up to 15 minutes later.
  -- Seven days matches the ingestion and pending-reward grace windows.
  with eligible as (
    select c.id, c.art_version, c.target_total,
      private.scene_capped_cycle_points(c.id) as earned
    from public.scene_challenge_cycles c
    where c.status in ('active','completed','expired')
      and c.ends_at > now() - interval '7 days'
      and (p_city_id is null or c.city_id=p_city_id)
  )
  insert into public.scene_milestones(cycle_id,percent_threshold,art_version,revoked_at)
  select e.id, marker.threshold, e.art_version, null
  from eligible e cross join (values (25),(50),(75),(100)) marker(threshold)
  where e.earned * 100 >= e.target_total * marker.threshold
  on conflict(cycle_id,percent_threshold) do update
    set revoked_at=null
    where public.scene_milestones.revoked_at is not null;
  get diagnostics v_changed=row_count;

  -- A source event may subsequently be marked invalid. Hide milestones
  -- that no longer meet their authoritative capped score, preserving
  -- historical milestone records as evidence of the correction.
  update public.scene_milestones m
  set revoked_at=now()
  from public.scene_challenge_cycles c
  where c.id=m.cycle_id
    and c.status in ('active','completed','expired')
    and c.ends_at > now()-interval '7 days'
    and (p_city_id is null or c.city_id=p_city_id)
    and m.revoked_at is null
    and private.scene_capped_cycle_points(c.id)*100
      < c.target_total*m.percent_threshold;
  get diagnostics v_rows=row_count;
  v_changed:=v_changed+v_rows;

  update public.scene_challenge_objectives obj
  set status=case when (
      select coalesce(sum(sc.points),0)
      from public.scene_contributions sc
      where sc.objective_id=obj.id and sc.invalidated_at is null
    ) >= obj.target_points then 'completed' else 'active' end
  where obj.status in ('active','completed')
    and exists(
      select 1 from public.scene_challenge_cycles c
      where c.id=obj.cycle_id
        and c.status in ('active','completed','expired')
        and c.ends_at>now()-interval '7 days'
        and (p_city_id is null or c.city_id=p_city_id)
    );

  -- A past event can now complete an expired cycle, but an invalidated
  -- contribution can also restore the cycle to active/expired as appropriate.
  update public.scene_challenge_cycles c
  set status=case
      when private.scene_capped_cycle_points(c.id)>=c.target_total then 'completed'
      when c.ends_at<=now() then 'expired'
      else 'active'
    end
  where c.status in ('active','completed','expired')
    and c.ends_at>now()-interval '7 days'
    and (p_city_id is null or c.city_id=p_city_id)
    and c.status is distinct from case
      when private.scene_capped_cycle_points(c.id)>=c.target_total then 'completed'
      when c.ends_at<=now() then 'expired'
      else 'active'
    end;

  return v_changed;
end;
$$;
revoke all on function private.reconcile_scene_milestones(uuid)
  from public,anon,authenticated;
grant execute on function private.reconcile_scene_milestones(uuid)
  to service_role;

-- Only currently valid, server-confirmed mural milestones reach players.
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
            where sm.cycle_id = cc.id and sm.revoked_at is null
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
revoke all on function public.get_city_scene_board(uuid)
  from public, anon;
grant execute on function public.get_city_scene_board(uuid)
  to authenticated,service_role;
commit;
