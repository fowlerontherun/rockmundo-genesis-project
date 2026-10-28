-- Historic daily/weekly City Scene Legacy. Public city-level aggregates only:
-- no player, profile, band, source event or payout fields.
-- Completed cycles are reevaluated from the capped authoritative ledger so
-- later source revocations cannot leave falsely completed permanent records.
begin;

create or replace function public.get_city_scene_legacy(
  p_city_id uuid,
  p_cadence text default 'weekly',
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_history jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_city_id is null
    or p_cadence is null or p_cadence not in ('daily','weekly')
    or p_limit is null or p_limit < 1 or p_limit > 24 then
    raise exception 'INVALID_SCENE_LEGACY_QUERY' using errcode = '22023';
  end if;

  with history as (
    select c.id, c.starts_at, c.ends_at, c.target_total
    from public.scene_challenge_cycles c
    where c.city_id = p_city_id
      and c.cadence = p_cadence
      and c.ends_at <= now()
      and c.status in ('completed','expired')
    order by c.starts_at desc, c.id desc
    limit p_limit
  ), confirmed as (
    select h.id,h.starts_at,h.ends_at,h.target_total,
      private.scene_capped_cycle_points(h.id) as earned_points,
      coalesce((
        select jsonb_agg(sm.percent_threshold order by sm.percent_threshold)
        from public.scene_milestones sm
        where sm.cycle_id=h.id and sm.revoked_at is null
          and sm.percent_threshold in (25,50,75,100)
      ), '[]'::jsonb) as milestones
    from history h
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cycle_id', h.id,
      'starts_at', h.starts_at,
      'ends_at', h.ends_at,
      'target_total', h.target_total,
      'earned_points', h.earned_points,
      'milestones', h.milestones
    )
    order by h.starts_at desc,h.id desc
  ),'[]'::jsonb) into v_history
  from confirmed h;

  return jsonb_build_object(
    'city_id',p_city_id,
    'cadence',p_cadence,
    'cycles',v_history
  );
end;
$$;
revoke all on function public.get_city_scene_legacy(uuid,text,integer)
  from public,anon;
grant execute on function public.get_city_scene_legacy(uuid,text,integer)
  to authenticated,service_role;
commit;
