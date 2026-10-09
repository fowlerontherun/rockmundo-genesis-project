-- Make humorous random-event skill XP atomic and idempotent across worker retries.
create table if not exists public.random_event_skill_xp_grants (
  player_event_id uuid primary key references public.player_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_slug text not null,
  xp_awarded integer not null check (xp_awarded between 100 and 500),
  created_at timestamptz not null default now()
);

alter table public.random_event_skill_xp_grants enable row level security;
revoke all on public.random_event_skill_xp_grants from public, anon, authenticated;
grant select, insert on public.random_event_skill_xp_grants to service_role;

create or replace function public.grant_random_event_skill_xp(p_player_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_profile_id uuid;
  v_skill record;
  v_previous record;
  v_max integer;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_award integer;
begin
  -- Serialise retries for the same event. The grant and skill update commit together.
  select pe.id, pe.profile_id, pe.user_id, pe.target_skill_slug, pe.status,
         re.awards_random_skill_xp, re.skill_xp_min, re.skill_xp_max
  into v_event
  from public.player_events pe
  join public.random_events re on re.id = pe.event_id
  where pe.id = p_player_event_id
  for update of pe;

  if not found or not coalesce(v_event.awards_random_skill_xp, false) then
    return null;
  end if;

  select skill_slug, xp_awarded into v_previous
  from public.random_event_skill_xp_grants
  where player_event_id = p_player_event_id;

  if found then
    return jsonb_build_object('skill_slug', v_previous.skill_slug, 'skill_xp', v_previous.xp_awarded);
  end if;

  if v_event.status <> 'awaiting_outcome' then
    return null;
  end if;

  v_profile_id := v_event.profile_id;
  if v_profile_id is null then
    select id into v_profile_id from public.profiles
    where user_id = v_event.user_id order by created_at limit 1;
  end if;
  if v_profile_id is null then return null; end if;

  -- Pick the recorded skill first, falling back to another learned non-maxed one.
  select sp.id, sp.skill_slug, sp.current_level, sp.current_xp, sp.required_xp
  into v_skill
  from public.skill_progress sp
  join public.skill_definitions sd on sd.slug::text = sp.skill_slug
  where sp.profile_id = v_profile_id
    and sp.current_level >= 1
    and sp.current_level < public.progression_skill_max_level(sp.skill_slug)
  order by (sp.skill_slug = v_event.target_skill_slug) desc, random()
  limit 1
  for update of sp;

  if not found then return null; end if;

  v_max := public.progression_skill_max_level(v_skill.skill_slug);
  v_award := floor(random() * (
    least(500, greatest(100, coalesce(v_event.skill_xp_max, 500))) -
    least(500, greatest(100, coalesce(v_event.skill_xp_min, 100))) + 1
  ))::integer + least(500, greatest(100, coalesce(v_event.skill_xp_min, 100)));

  v_level := v_skill.current_level;
  v_xp := greatest(0, coalesce(v_skill.current_xp, 0)) + v_award;
  v_required := public.progression_skill_required_xp(v_level);

  while v_level < v_max and v_xp >= v_required loop
    v_xp := v_xp - v_required;
    v_level := v_level + 1;
    if v_level < v_max then
      v_required := public.progression_skill_required_xp(v_level);
    end if;
  end loop;

  if v_level >= v_max then
    v_xp := 0;
    v_required := 0;
  end if;

  update public.skill_progress
  set current_level = v_level,
      current_xp = v_xp,
      required_xp = v_required,
      last_practiced_at = now()
  where id = v_skill.id;

  insert into public.random_event_skill_xp_grants
    (player_event_id, profile_id, skill_slug, xp_awarded)
  values (p_player_event_id, v_profile_id, v_skill.skill_slug, v_award);

  return jsonb_build_object('skill_slug', v_skill.skill_slug, 'skill_xp', v_award);
end;
$$;

revoke all on function public.grant_random_event_skill_xp(uuid) from public, anon, authenticated;
grant execute on function public.grant_random_event_skill_xp(uuid) to service_role;
