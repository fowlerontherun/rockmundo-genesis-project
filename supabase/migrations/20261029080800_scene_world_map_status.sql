-- World map: publicly confirmed City Scene milestones only.
-- The mural's confirmed 25/50/75/100% checkpoints are already public on
-- the board. Never export raw points, accounts, identities or action events.
begin;

create or replace function public.get_world_city_scene_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_snapshot jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  with ranked as (
    select c.id, c.city_id, c.cadence, c.ends_at,
      row_number() over (
        partition by c.city_id
        order by case c.cadence when 'monthly' then 0 else 1 end,
          c.starts_at desc, c.id
      ) as preference
    from public.scene_challenge_cycles c
    where c.cadence in ('weekly','monthly')
      and c.status = 'active'
      and c.starts_at <= now()
      and c.ends_at > now()
  ),
  active as (
    select ranked.id, ranked.city_id, ranked.cadence, ranked.ends_at
    from ranked
    where preference = 1
    order by city_id
    limit 200
  ),
  confirmed as (
    select a.city_id, a.cadence, a.ends_at,
      coalesce(max(m.percent_threshold) filter (
        where m.revoked_at is null
          and m.percent_threshold in (25,50,75,100)
      ),0)::integer as confirmed_stage
    from active a
    left join public.scene_milestones m on m.cycle_id = a.id
    group by a.city_id,a.cadence,a.ends_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'city_id',confirmed.city_id,
    'cadence',confirmed.cadence,
    'ends_at',confirmed.ends_at,
    'confirmed_stage',confirmed.confirmed_stage
  ) order by confirmed.city_id),'[]'::jsonb)
  into v_snapshot
  from confirmed;

  return jsonb_build_object('cities',v_snapshot);
end;
$$;

revoke all on function public.get_world_city_scene_status()
  from public,anon;
grant execute on function public.get_world_city_scene_status()
  to authenticated,service_role;
commit;
