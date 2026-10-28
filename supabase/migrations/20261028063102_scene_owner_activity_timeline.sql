-- Owner-only, read-only City Music Scene contribution history.
-- One row is a credit to a particular cadence/objective; the same verified
-- action may credit more than one cadence. No source IDs, profile IDs,
-- account IDs, band IDs, reward records or financial records are returned.
-- Never activates reward policies, payouts, scoring or a scheduled job.
begin;

create or replace function public.get_my_city_scene_activity(
  p_city_id uuid,
  p_limit integer default 60
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_activity jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_city_id is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_SCENE_ACTIVITY_QUERY' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cycle_id', e.cycle_id,
        'cadence', e.cadence,
        'action_type', e.source_type,
        'points', e.points,
        'completed_at', e.source_completed_at
      )
      order by e.source_completed_at desc, e.id desc
    ),
    '[]'::jsonb
  )
  into v_activity
  from (
    select sc.id, cyc.id as cycle_id, cyc.cadence,
      sc.source_type, sc.points, sc.source_completed_at
    from public.scene_contributions sc
    join public.scene_challenge_objectives obj on obj.id = sc.objective_id
    join public.scene_challenge_cycles cyc on cyc.id = obj.cycle_id
    where sc.account_id = (select auth.uid())
      and sc.city_id = p_city_id
      and cyc.city_id = p_city_id
      and sc.invalidated_at is null
    order by sc.source_completed_at desc, sc.id desc
    limit p_limit
  ) e;

  return v_activity;
end;
$$;

revoke all on function public.get_my_city_scene_activity(uuid, integer)
  from public, anon;
grant execute on function public.get_my_city_scene_activity(uuid, integer)
  to authenticated, service_role;

commit;
