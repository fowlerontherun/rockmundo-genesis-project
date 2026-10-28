-- City Scene account-scoped opt-in leaderboard.
-- NEVER expose non-consenting identities, private profile data, blocked or
-- muted accounts. Existing contribution scoring and reward policies unchanged.
begin;

create table public.scene_leaderboard_opt_ins (
  account_id uuid not null references auth.users(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (account_id, city_id)
);
create index scene_leaderboard_opt_ins_enabled_city
  on public.scene_leaderboard_opt_ins(city_id)
  where enabled is true;
alter table public.scene_leaderboard_opt_ins enable row level security;
revoke all on public.scene_leaderboard_opt_ins from public,anon,authenticated;
grant all on public.scene_leaderboard_opt_ins to service_role;

-- Deliberately no direct browser table policies. Caller identity is always
-- auth.uid(), not any supplied account/profile ID. A player's opt-in must be
-- backed by their own verified scene credit and existing public privacy flags.
create or replace function public.set_my_scene_leaderboard_opt_in(
  p_city_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_account uuid := (select auth.uid());
  v_profile uuid;
begin
  if v_account is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_enabled is null then
    raise exception 'INVALID_SCENE_LEADERBOARD_QUERY' using errcode='22023';
  end if;

  if not p_enabled then
    update public.scene_leaderboard_opt_ins
    set enabled=false, updated_at=now()
    where account_id=v_account and city_id=p_city_id;
    return false;
  end if;

  select sc.profile_id into v_profile
  from public.scene_contributions sc
  join public.profiles p on p.id=sc.profile_id
  join public.profile_privacy_settings privacy
    on privacy.profile_id=p.id
  where sc.account_id=v_account
    and sc.city_id=p_city_id
    and sc.invalidated_at is null
    and p.user_id=v_account
    and p.is_active is true and p.deleted_at is null
    and privacy.profile_visibility='public'
    and privacy.activity_visibility='public'
    and not exists (
      select 1 from public.player_profiles pp
      where pp.profile_id=p.id
        and (pp.visibility <> 'public' or pp.show_activity is not true)
    )
  order by sc.source_completed_at desc,sc.id desc
  limit 1;

  if v_profile is null then
    raise exception 'SCENE_PUBLIC_PROFILE_REQUIRED' using errcode='42501';
  end if;

  insert into public.scene_leaderboard_opt_ins
    (account_id,city_id,profile_id,enabled,updated_at)
  values (v_account,p_city_id,v_profile,true,now())
  on conflict(account_id,city_id) do update
  set profile_id=excluded.profile_id,enabled=true,updated_at=now();
  return true;
end;
$$;
revoke all on function public.set_my_scene_leaderboard_opt_in(uuid,boolean)
  from public,anon;
grant execute on function public.set_my_scene_leaderboard_opt_in(uuid,boolean)
  to authenticated,service_role;

-- Opt-in members only. Blocks and mutes are evaluated for the requesting
-- account, not the currently selected character, to prevent alt-account leaks.
-- Ranks are contiguous among actually visible accounts (hidden rows do
-- not disclose an unseen participant by leaving a gap).
create or replace function public.get_city_scene_leaderboard(
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
  v_viewer uuid := (select auth.uid());
  v_cycle uuid;
  v_rows jsonb := '[]'::jsonb;
  v_opted_in boolean;
begin
  if v_viewer is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_cadence is null
    or p_cadence not in ('daily','weekly','monthly')
    or p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'INVALID_SCENE_LEADERBOARD_QUERY' using errcode='22023';
  end if;

  select enabled into v_opted_in
  from public.scene_leaderboard_opt_ins
  where account_id=v_viewer and city_id=p_city_id;

  select c.id into v_cycle
  from public.scene_challenge_cycles c
  where c.city_id=p_city_id and c.cadence=p_cadence
    and c.starts_at<=now() and c.ends_at>now()
    and c.status in ('active','completed')
  order by c.starts_at desc,c.id
  limit 1;

  if v_cycle is not null then
    with eligible as (
      select sc.account_id, opt.profile_id,
        coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.username),''),'Musician') as display_name,
        sum(sc.points)::integer as points,
        count(distinct (sc.source_type,sc.source_event_id))::integer as verified_actions,
        min(sc.source_completed_at) as first_credited_at
      from public.scene_contributions sc
      join public.scene_challenge_objectives objective on objective.id=sc.objective_id
      join public.scene_leaderboard_opt_ins opt
        on opt.account_id=sc.account_id and opt.city_id=p_city_id and opt.enabled is true
      join public.profiles p
        on p.id=opt.profile_id and p.user_id=opt.account_id
        and p.is_active is true and p.deleted_at is null
      join public.profile_privacy_settings privacy
        on privacy.profile_id=p.id
        and privacy.profile_visibility='public'
        and privacy.activity_visibility='public'
      where objective.cycle_id=v_cycle
        and sc.city_id=p_city_id
        and sc.invalidated_at is null
        and not exists (
          select 1 from public.player_profiles pp
          where pp.profile_id=p.id
            and (pp.visibility <> 'public' or pp.show_activity is not true)
        )
        and not exists (
          select 1
          from public.player_blocks block
          join public.profiles blocker on blocker.id=block.blocker_id
          join public.profiles blocked on blocked.id=block.blocked_id
          where block.removed_at is null
            and (
              (blocker.user_id=v_viewer and blocked.user_id=opt.account_id)
              or (blocked.user_id=v_viewer and blocker.user_id=opt.account_id)
            )
        )
        and not exists (
          select 1
          from public.profile_mutes mute
          join public.profiles viewer_profile on viewer_profile.id=mute.viewer_profile_id
          join public.profiles muted_profile on muted_profile.id=mute.target_profile_id
          where mute.removed_at is null
            and (mute.mute_until is null or mute.mute_until > now())
            and viewer_profile.user_id=v_viewer
            and muted_profile.user_id=opt.account_id
        )
      group by sc.account_id,opt.profile_id,p.display_name,p.username
    ), ranked as (
      select row_number() over (
        order by eligible.points desc,eligible.first_credited_at asc,eligible.account_id asc
      ) as rank, eligible.display_name,eligible.points,eligible.verified_actions,
        (eligible.account_id=v_viewer) as is_me
      from eligible
    )
    select coalesce(jsonb_agg(
      jsonb_build_object('rank',r.rank,'display_name',r.display_name,
        'points',r.points,'verified_actions',r.verified_actions,'is_me',r.is_me)
      order by r.rank
    ),'[]'::jsonb) into v_rows
    from (select * from ranked where rank <= p_limit) r;
  end if;

  return jsonb_build_object(
    'city_id',p_city_id,
    'cadence',p_cadence,
    'my_opted_in',coalesce(v_opted_in,false),
    'entries',v_rows
  );
end;
$$;
revoke all on function public.get_city_scene_leaderboard(uuid,text,integer)
  from public,anon;
grant execute on function public.get_city_scene_leaderboard(uuid,text,integer)
  to authenticated,service_role;
commit;
