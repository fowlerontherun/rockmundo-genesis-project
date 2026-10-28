-- City Scene band recognition: leader-consented, read-only rankings.
-- Authoritative scores are derived from valid contributions; individual
-- members, event IDs, payouts and private profiles are never returned.
begin;

create table public.scene_band_leaderboard_opt_ins (
  band_id uuid not null references public.bands(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  enabled boolean not null default false,
  updated_by_account uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (band_id, city_id)
);
create index scene_band_leaderboard_opt_ins_city_enabled
  on public.scene_band_leaderboard_opt_ins(city_id)
  where enabled is true;
alter table public.scene_band_leaderboard_opt_ins enable row level security;
revoke all on public.scene_band_leaderboard_opt_ins from public, anon, authenticated;
grant all on public.scene_band_leaderboard_opt_ins to service_role;

create or replace function public.set_my_scene_band_leaderboard_opt_in(
  p_city_id uuid,
  p_band_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_account uuid := (select auth.uid());
begin
  if v_account is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_band_id is null or p_enabled is null then
    raise exception 'INVALID_SCENE_BAND_QUERY' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.bands b
    join public.profiles leader on leader.id=b.leader_id
    where b.id=p_band_id and b.status='active'
      and leader.user_id=v_account
      and leader.is_active is true and leader.deleted_at is null
  ) then
    raise exception 'BAND_LEADER_REQUIRED' using errcode='42501';
  end if;

  if p_enabled and not exists (
    select 1 from public.scene_contributions sc
    where sc.band_id=p_band_id and sc.city_id=p_city_id
      and sc.invalidated_at is null
  ) then
    raise exception 'VERIFIED_BAND_ACTIVITY_REQUIRED' using errcode='42501';
  end if;

  insert into public.scene_band_leaderboard_opt_ins
    (band_id, city_id, enabled, updated_by_account, updated_at)
  values(p_band_id,p_city_id,p_enabled,v_account,now())
  on conflict (band_id,city_id) do update
  set enabled=excluded.enabled,
      updated_by_account=excluded.updated_by_account,
      updated_at=now();
  return p_enabled;
end;
$$;
revoke all on function public.set_my_scene_band_leaderboard_opt_in(uuid,uuid,boolean)
  from public, anon;
grant execute on function public.set_my_scene_band_leaderboard_opt_in(uuid,uuid,boolean)
  to authenticated,service_role;

create or replace function public.get_city_scene_band_supporters(
  p_city_id uuid,
  p_cadence text default 'weekly',
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_account uuid := (select auth.uid());
  v_cycle uuid;
  v_rows jsonb := '[]'::jsonb;
  v_manageable jsonb := '[]'::jsonb;
begin
  if v_account is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_cadence is null
    or p_cadence not in ('daily','weekly','monthly')
    or p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'INVALID_SCENE_BAND_QUERY' using errcode='22023';
  end if;

  -- Only the authenticated leader sees IDs required to manage their bands.
  select coalesce(jsonb_agg(
    jsonb_build_object('band_id',mine.id, 'band_name',mine.name,
      'enabled',mine.enabled)
    order by mine.name, mine.id
  ), '[]'::jsonb)
  into v_manageable
  from (
    select b.id,b.name,coalesce(opt.enabled,false) as enabled
    from public.bands b
    join public.profiles leader on leader.id=b.leader_id
    left join public.scene_band_leaderboard_opt_ins opt
      on opt.band_id=b.id and opt.city_id=p_city_id
    where leader.user_id=v_account
      and leader.is_active is true and leader.deleted_at is null
      and b.status='active'
      and exists (
        select 1 from public.scene_contributions sc
        where sc.band_id=b.id and sc.city_id=p_city_id
          and sc.invalidated_at is null
      )
    order by b.name,b.id
    limit 20
  ) mine;

  select cycle.id into v_cycle
  from public.scene_challenge_cycles cycle
  where cycle.city_id=p_city_id and cycle.cadence=p_cadence
    and cycle.starts_at<=now() and cycle.ends_at>now()
    and cycle.status in ('active','completed')
  order by cycle.starts_at desc,cycle.id
  limit 1;

  if v_cycle is not null then
    with eligible as (
      select sc.band_id, b.name,
        sum(sc.points)::integer as points,
        count(distinct (sc.source_type,sc.source_event_id))::integer as verified_events,
        min(sc.source_completed_at) as earliest_credit
      from public.scene_contributions sc
      join public.scene_challenge_objectives ob on ob.id=sc.objective_id
      join public.scene_band_leaderboard_opt_ins opt
        on opt.band_id=sc.band_id and opt.city_id=p_city_id and opt.enabled is true
      join public.bands b on b.id=opt.band_id and b.status='active'
      join public.profiles leader on leader.id=b.leader_id
        and leader.is_active is true and leader.deleted_at is null
      where ob.cycle_id=v_cycle and sc.city_id=p_city_id
        and sc.invalidated_at is null and sc.band_id is not null
      group by sc.band_id,b.name
    ), ranked as (
      select row_number() over (
        order by e.points desc,e.earliest_credit asc,e.band_id asc
      ) as rank,e.name,e.points,e.verified_events
      from eligible e
    )
    select coalesce(jsonb_agg(
      jsonb_build_object('rank',r.rank,'band_name',r.name,
        'points',r.points,'verified_events',r.verified_events)
      order by r.rank
    ),'[]'::jsonb) into v_rows
    from (select * from ranked where rank<=p_limit) r;
  end if;

  return jsonb_build_object(
    'city_id',p_city_id,'cadence',p_cadence,
    'entries',v_rows,'my_bands',v_manageable
  );
end;
$$;
revoke all on function public.get_city_scene_band_supporters(uuid,text,integer)
  from public, anon;
grant execute on function public.get_city_scene_band_supporters(uuid,text,integer)
  to authenticated,service_role;
commit;
