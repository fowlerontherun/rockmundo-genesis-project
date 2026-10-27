-- Server-only, idempotent milestone recognition. No rewards, news or money.
begin;
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
  select cycle.id, threshold.percent_threshold, cycle.art_version
  from public.scene_challenge_cycles cycle
  cross join (values (25), (50), (75), (100)) threshold(percent_threshold)
  cross join lateral (
    select coalesce(sum(contribution.points), 0) as earned
    from public.scene_contributions contribution
    join public.scene_challenge_objectives objective
      on objective.id = contribution.objective_id
    where objective.cycle_id = cycle.id
      and contribution.invalidated_at is null
  ) progress
  where cycle.status in ('active', 'completed')
    and (p_city_id is null or cycle.city_id = p_city_id)
    and progress.earned * 100 >=
      cycle.target_total * threshold.percent_threshold
  on conflict (cycle_id, percent_threshold) do nothing;

  get diagnostics v_inserted = row_count;

  update public.scene_challenge_cycles cycle
     set status = 'completed'
   where cycle.status = 'active'
     and (p_city_id is null or cycle.city_id = p_city_id)
     and exists (
       select 1 from public.scene_milestones m
       where m.cycle_id = cycle.id and m.percent_threshold = 100
     );

  return v_inserted;
end;
$$;

revoke all on function private.reconcile_scene_milestones(uuid)
  from public, anon, authenticated;
grant execute on function private.reconcile_scene_milestones(uuid)
  to service_role;

create or replace function public.scene_reconcile_milestones(p_city_id uuid default null)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.reconcile_scene_milestones(p_city_id);
$$;
revoke all on function public.scene_reconcile_milestones(uuid)
  from public, anon, authenticated;
grant execute on function public.scene_reconcile_milestones(uuid)
  to service_role;
commit;