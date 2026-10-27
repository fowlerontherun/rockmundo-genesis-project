-- City Scene: trusted recorded-studio work as a second source.
-- Stage only. All source templates and reward policies remain disabled.
begin;

alter table public.scene_processor_cursors
  drop constraint if exists scene_processor_cursors_source_key_check;
alter table public.scene_processor_cursors
  add constraint scene_processor_cursors_source_key_check
  check (source_key in ('verified_jam','completed_recording'));

-- Replace two dormant, currently-unverifiable invitations with real music
-- activities. A separate post-review rollout explicitly enables templates.
update public.scene_challenge_templates
set action_type = 'recording:completed',
    title = 'Record Your Next Track',
    description = 'Finish a verified studio recording session in your city.',
    art_theme = 'record-store',
    version = version + 1
where slug = 'daily-release-party' and enabled is false;

update public.scene_challenge_templates
set action_type = 'recording:completed',
    title = 'Local Studio Sessions',
    description = 'Help local musicians finish real studio sessions this week.',
    art_theme = 'studio-tape',
    version = version + 1
where slug = 'weekly-scene-dinner' and enabled is false;

create or replace function private.ingest_scene_completed_recording(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_session public.recording_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_obj record;
  v_affiliation uuid;
  v_points integer;
  v_cap integer;
  v_credited integer := 0;
begin
  if p_session_id is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:recording:' || p_session_id::text));

  select * into v_session
  from public.recording_sessions s
  where s.id = p_session_id and s.status = 'completed';
  if not found or v_session.city_id is null
    or v_session.profile_id is null
    or v_session.user_id is null
    or v_session.completed_at is null
    or v_session.completed_at > now()
    or v_session.completed_at < now() - interval '7 days'
    or v_session.scheduled_end is null
    or v_session.completed_at < v_session.scheduled_end
    or v_session.xp_awards is null
    or jsonb_typeof(v_session.xp_awards) is distinct from 'object'
    or v_session.xp_awards = '{}'::jsonb
  then return 0; end if;

  select * into v_profile
  from public.profiles p
  where p.id = v_session.profile_id and p.user_id = v_session.user_id
    and p.deleted_at is null and p.is_active is true
    and p.current_city_id = v_session.city_id;
  if not found then return 0; end if;

  -- Verify the recording owner is a member of the assigned band. Personal
  -- recordings are allowed; do not invent a band from the current profile.
  if v_session.band_id is not null and not exists (
    select 1 from public.band_members bm
    where bm.band_id = v_session.band_id
      and bm.profile_id = v_profile.id
      and coalesce(bm.member_status, 'active') = 'active'
  ) then return 0; end if;

  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id = c.id
    join public.scene_challenge_templates t on t.id = o.template_id
    where c.city_id = v_session.city_id
      and c.starts_at <= v_session.completed_at and c.ends_at > v_session.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled is true
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false') = 'true'
      and (t.action_type = 'recording:completed'
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community'))
  ) then return 0; end if;

  -- Serialise the player's daily affiliation and preserve it during travel.
  perform pg_advisory_xact_lock(hashtext(
    'rockmundo:scene:acct:' || v_profile.user_id::text || ':' ||
    (v_session.completed_at at time zone 'UTC')::date::text
  ));

  insert into public.scene_daily_affiliations(account_id,date_utc,city_id,profile_id)
  values (v_profile.user_id,(v_session.completed_at at time zone 'UTC')::date,
          v_session.city_id,v_profile.id)
  on conflict (account_id,date_utc) do nothing;

  select city_id into v_affiliation
  from public.scene_daily_affiliations
  where account_id = v_profile.user_id
    and date_utc = (v_session.completed_at at time zone 'UTC')::date;

  if v_affiliation is distinct from v_session.city_id then return 0; end if;

  for v_obj in
    select o.id as objective_id, c.id as cycle_id, c.cadence
    from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id = c.id
    join public.scene_challenge_templates t on t.id = o.template_id
    where c.city_id = v_session.city_id
      and c.starts_at <= v_session.completed_at and c.ends_at > v_session.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed')
      and t.enabled is true
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false') = 'true'
      and (t.action_type = 'recording:completed'
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community'))
    order by c.starts_at, c.cadence, o.id
  loop
    v_cap := case v_obj.cadence when 'daily' then 5 when 'weekly' then 10 else 25 end;
    perform pg_advisory_xact_lock(hashtext(
      'rockmundo:scene:cycle:' || v_profile.user_id::text || ':' || v_obj.cycle_id::text
    ));

    if exists (
      select 1 from public.scene_contributions sc
      where sc.objective_id = v_obj.objective_id
        and sc.account_id = v_profile.user_id
        and sc.source_type = 'completed_recording'
        and sc.source_event_id = p_session_id::text
    ) then continue; end if;

    select coalesce(sum(sc.points),0)::int into v_points
    from public.scene_contributions sc
    join public.scene_challenge_objectives o on o.id = sc.objective_id
    where o.cycle_id = v_obj.cycle_id
      and sc.account_id = v_profile.user_id
      and sc.invalidated_at is null;
    if v_points >= v_cap then continue; end if;

    insert into public.scene_contributions(
      objective_id,account_id,profile_id,band_id,city_id,
      source_type,source_event_id,source_completed_at,points
    )
    values (
      v_obj.objective_id, v_profile.user_id, v_profile.id,
      v_session.band_id, v_session.city_id, 'completed_recording',
      p_session_id::text, v_session.completed_at, 1
    )
    on conflict (objective_id,source_type,source_event_id,account_id)
    do nothing;
    if found then v_credited := v_credited + 1; end if;
  end loop;
  return v_credited;
end;
$$;
revoke all on function private.ingest_scene_completed_recording(uuid)
  from public, anon, authenticated;
grant execute on function private.ingest_scene_completed_recording(uuid) to service_role;

create or replace function public.scene_ingest_completed_recording(p_session_id uuid)
returns integer
language sql security invoker
set search_path = pg_catalog, public, private
as $$ select private.ingest_scene_completed_recording(p_session_id); $$;
revoke all on function public.scene_ingest_completed_recording(uuid)
  from public, anon, authenticated;
grant execute on function public.scene_ingest_completed_recording(uuid) to service_role;

commit;