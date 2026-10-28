-- Immutable-in-meaning historic City Scene mural gallery. Rows remain
-- authoritative: invalidated contributions and revoked milestones are not
-- presented as completed. Historical progress may be reconciled within the
-- usual source grace window without exposing player/event data.
-- Read-only. No new table, scoring, cron, policy or XP changes.
begin;

create or replace function public.get_city_scene_poster_archive(
  p_city_id uuid,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_archive jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_limit is null
    or p_limit < 1 or p_limit > 24 then
    raise exception 'INVALID_SCENE_ARCHIVE_QUERY' using errcode='22023';
  end if;

  with months as (
    select c.id,c.city_id,c.starts_at,c.ends_at,c.target_total,
      c.art_version,c.theme_slug
    from public.scene_challenge_cycles c
    where c.city_id=p_city_id
      and c.cadence='monthly'
      and c.ends_at <= now()
      and c.status in ('completed','expired')
    order by c.starts_at desc,c.id desc
    limit p_limit
  ), historic as (
    select m.id,m.starts_at,m.target_total,m.art_version,m.theme_slug,
      private.scene_capped_cycle_points(m.id) as points,
      coalesce((
        select jsonb_agg(sm.percent_threshold order by sm.percent_threshold)
        from public.scene_milestones sm
        where sm.cycle_id=m.id and sm.revoked_at is null
      ),'[]'::jsonb) as milestones
    from months m
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cycle_id',h.id,
      'month_start',h.starts_at,
      'art_version',h.art_version,
      'theme_slug',h.theme_slug,
      'target_total',h.target_total,
      'earned_points',h.points,
      'milestones',h.milestones
    )
    order by h.starts_at desc,h.id desc
  ),'[]'::jsonb) into v_archive
  from historic h;

  return jsonb_build_object('city_id',p_city_id,'posters',v_archive);
end;
$$;

revoke all on function public.get_city_scene_poster_archive(uuid,integer)
  from public, anon;
grant execute on function public.get_city_scene_poster_archive(uuid,integer)
  to authenticated,service_role;
commit;
