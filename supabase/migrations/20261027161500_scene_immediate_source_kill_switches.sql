-- Real-time independent controls for active City Scene source processors.
-- Prevents stale objective snapshots from accepting disabled sources; the
-- queue cursor must also stay put so processing can resume after re-enabling.
-- The monthly campaign requires both the specific event source and the
-- shared scene:verified_community source gate. No reward policy changes.
begin;

-- ingest guard for recording:completed
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
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='recording:completed' and enabled is true)
  then return 0; end if;
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
    and p.deleted_at is null and p.is_active is true;
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
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
  ) then return 0; end if;

  -- Credit the city recorded on the completed studio session, not the
  -- player's location at later processing time. Daily affiliation prevents
  -- travel from doubling a day's city credit.
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
        or (c.cadence = 'monthly' and t.action_type = 'scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
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

-- batch guard for recording:completed
create or replace function private.process_scene_completed_recording_batch(
  p_limit integer default 50
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_cursor public.scene_processor_cursors%rowtype;
  v_event record;
  v_count integer := 0;
  v_credits integer := 0;
  v_backlog boolean;
  v_cutoff timestamptz := now() - interval '15 minutes';
begin
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='recording:completed' and enabled is true)
  then return jsonb_build_object('disabled',true,'events_processed',0,'contributions_inserted',0,'backlog_pending',false); end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  -- A template flag alone is insufficient. Never discard events while source
  -- health checks are disabled or while there are no compatible cycles.
  if not exists (
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id = t.id
    join public.scene_challenge_cycles c on c.id = o.cycle_id
    where t.enabled and (t.action_type='recording:completed' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
      and o.status in ('active','completed')
      and c.status in ('active','completed','expired')
      and c.ends_at >= now() - interval '7 days'
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
  ) then
    return jsonb_build_object('disabled',true, 'events_processed',0,
      'contributions_inserted',0,'backlog_pending',false);
  end if;

  insert into public.scene_processor_cursors
    (source_key,last_applied_at,last_source_id)
  values ('completed_recording',now()-interval '7 days',
          '00000000-0000-0000-0000-000000000000'::uuid)
  on conflict(source_key) do nothing;

  select * into strict v_cursor
  from public.scene_processor_cursors
  where source_key = 'completed_recording'
  for update;

  -- updated_at advances when the authoritative recording is finalised.
  -- Reprocessing subsequent updates is safe due to ledger event deduplication.
  for v_event in
    select s.id, s.updated_at
    from public.recording_sessions s
    where s.status='completed'
      and s.completed_at is not null and s.updated_at is not null
      and (s.updated_at,s.id) >
        (v_cursor.last_applied_at,v_cursor.last_source_id)
      and s.updated_at <= v_cutoff
    order by s.updated_at,s.id
    limit p_limit
  loop
    v_credits := v_credits +
      private.ingest_scene_completed_recording(v_event.id);
    v_count := v_count + 1;
    v_cursor.last_applied_at := v_event.updated_at;
    v_cursor.last_source_id := v_event.id;
  end loop;

  update public.scene_processor_cursors
  set last_applied_at = v_cursor.last_applied_at,
      last_source_id = v_cursor.last_source_id,
      processed_events = processed_events + v_count,
      updated_at = now()
  where source_key = 'completed_recording';

  select exists(
    select 1 from public.recording_sessions s
    where s.status='completed'
      and s.completed_at is not null and s.updated_at is not null
      and (s.updated_at,s.id) >
        (v_cursor.last_applied_at,v_cursor.last_source_id)
      and s.updated_at <= v_cutoff
  ) into v_backlog;

  return jsonb_build_object(
    'disabled',false,
    'events_processed',v_count,
    'contributions_inserted',v_credits,
    'backlog_pending',v_backlog,
    'cursor_at',v_cursor.last_applied_at
  );
end;
$$;

-- preview guard for recording:completed
create or replace function private.preview_scene_completed_recording_batch(p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_at timestamptz;
  v_id uuid;
  v_total integer;
  v_cutoff timestamptz := now() - interval '15 minutes';
begin
  -- Rechecks are inside readiness query; preview remains read-only.
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;
  select last_applied_at,last_source_id into v_at,v_id
    from public.scene_processor_cursors
    where source_key='completed_recording';
  if v_at is null then
    v_at := now()-interval '7 days';
    v_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  select count(*)::int into v_total from (
    select 1 from public.recording_sessions s
    where s.status='completed'
      and s.completed_at is not null and s.updated_at is not null
      and (s.updated_at,s.id)>(v_at,v_id)
      and s.updated_at <= v_cutoff
    order by s.updated_at,s.id limit p_limit+1
  ) bounded;

  return jsonb_build_object(
    'candidate_sessions',least(v_total,p_limit),
    'backlog_pending',v_total>p_limit,
    'cursor_at',v_at,
    'settled_before',v_cutoff,
    'source_ready',exists(
      select 1 from public.scene_challenge_templates t
      join public.scene_challenge_objectives o on o.template_id=t.id
      join public.scene_challenge_cycles c on c.id=o.cycle_id
      where t.enabled and (t.action_type='recording:completed' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
        and exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
      and exists (select 1 from public.scene_source_controls where action_type='recording:completed' and enabled is true)
      and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at >= now()-interval '7 days'
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
    )
  );
end;
$$;

-- ingest guard for gig:verified_performance
create or replace function private.ingest_scene_verified_gig(p_outcome_id uuid)
returns integer language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_gig record;
  v_actor record;
  v_obj record;
  v_affiliation uuid;
  v_points int;
  v_cap int;
  v_credited int := 0;
begin
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='gig:verified_performance' and enabled is true)
  then return 0; end if;
  if p_outcome_id is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:gig:'||p_outcome_id::text));

  select go.id as outcome_id, go.gig_id, go.completed_at, go.band_id,
    g.status as gig_status, g.cancelled_at, g.band_id as booked_band_id,
    v.city_id
  into v_gig
  from public.gig_outcomes go
  join public.gigs g on g.id=go.gig_id
  join public.venues v on v.id=g.venue_id
  where go.id=p_outcome_id;

  if not found or v_gig.city_id is null
    or v_gig.completed_at is null
    or v_gig.completed_at > now()
    or v_gig.completed_at < now()-interval '7 days'
    or v_gig.gig_status <> 'completed'
    or v_gig.cancelled_at is not null
    or v_gig.booked_band_id is distinct from v_gig.band_id
  then return 0; end if;

  -- A performed_at timestamp and completed-gig outcome are both mandatory.
  if not exists (
    select 1 from public.gig_performers gp
    where gp.gig_id=v_gig.gig_id
      and gp.lineup_status='performed'
      and gp.performed_at is not null
      and gp.performed_at <= v_gig.completed_at
      and gp.band_id=v_gig.band_id
  ) then return 0; end if;

  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id=c.id
    join public.scene_challenge_templates t on t.id=o.template_id
    where c.city_id=v_gig.city_id
      and c.starts_at<=v_gig.completed_at and c.ends_at>v_gig.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
      and (t.action_type='gig:verified_performance'
        or (c.cadence='monthly' and t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
  ) then return 0; end if;

  for v_actor in
    select distinct on (p.user_id)
      p.user_id as account_id,p.id as profile_id
    from public.gig_performers gp
    join public.profiles p on p.id=gp.profile_id
    where gp.gig_id=v_gig.gig_id
      and gp.band_id=v_gig.band_id
      and gp.lineup_status='performed'
      and gp.performed_at is not null
      and gp.performed_at<=v_gig.completed_at
      and p.user_id is not null and p.deleted_at is null
    order by p.user_id,p.id
  loop
    perform pg_advisory_xact_lock(hashtext(
      'rockmundo:scene:acct:'||v_actor.account_id::text||':'||
      (v_gig.completed_at at time zone 'UTC')::date::text
    ));

    insert into public.scene_daily_affiliations(account_id,date_utc,city_id,profile_id)
    values(v_actor.account_id,(v_gig.completed_at at time zone 'UTC')::date,
      v_gig.city_id,v_actor.profile_id)
    on conflict(account_id,date_utc) do nothing;

    select city_id into v_affiliation
    from public.scene_daily_affiliations
    where account_id=v_actor.account_id
      and date_utc=(v_gig.completed_at at time zone 'UTC')::date;
    if v_affiliation is distinct from v_gig.city_id then continue; end if;

    for v_obj in
      select o.id as objective_id,c.id as cycle_id,c.cadence
      from public.scene_challenge_cycles c
      join public.scene_challenge_objectives o on o.cycle_id=c.id
      join public.scene_challenge_templates t on t.id=o.template_id
      where c.city_id=v_gig.city_id
        and c.starts_at<=v_gig.completed_at and c.ends_at>v_gig.completed_at
        and c.status in ('active','completed','expired')
        and o.status in ('active','completed') and t.enabled
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
        and (t.action_type='gig:verified_performance'
          or (c.cadence='monthly' and t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
      order by c.starts_at,c.cadence,o.id
    loop
      v_cap := case v_obj.cadence when 'daily' then 5 when 'weekly' then 10 else 25 end;
      perform pg_advisory_xact_lock(hashtext(
        'rockmundo:scene:cycle:'||v_actor.account_id::text||':'||v_obj.cycle_id::text
      ));

      if exists (
        select 1 from public.scene_contributions sc
        where sc.objective_id=v_obj.objective_id
          and sc.account_id=v_actor.account_id
          and sc.source_type='verified_gig_performance'
          and sc.source_event_id=p_outcome_id::text
      ) then continue; end if;

      select coalesce(sum(sc.points),0)::int into v_points
      from public.scene_contributions sc
      join public.scene_challenge_objectives o on o.id=sc.objective_id
      where o.cycle_id=v_obj.cycle_id and sc.account_id=v_actor.account_id
        and sc.invalidated_at is null;
      if v_points>=v_cap then continue; end if;

      insert into public.scene_contributions(
        objective_id,account_id,profile_id,band_id,city_id,
        source_type,source_event_id,source_completed_at,points
      ) values(
        v_obj.objective_id,v_actor.account_id,v_actor.profile_id,
        v_gig.band_id,v_gig.city_id,'verified_gig_performance',
        p_outcome_id::text,v_gig.completed_at,1
      )
      on conflict(objective_id,source_type,source_event_id,account_id)
      do nothing;
      if found then v_credited:=v_credited+1; end if;
    end loop;
  end loop;
  return v_credited;
end;
$$;

-- batch guard for gig:verified_performance
create or replace function private.process_scene_verified_gig_batch(p_limit integer default 50)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_cursor public.scene_processor_cursors%rowtype;
  v_event record;
  v_count integer:=0;
  v_credits integer:=0;
  v_backlog boolean:=false;
  v_cutoff timestamptz:=now()-interval '15 minutes';
begin
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='gig:verified_performance' and enabled is true)
  then return jsonb_build_object('disabled',true,'events_processed',0,'contributions_inserted',0,'backlog_pending',false); end if;
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  if not exists(
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id=t.id
    join public.scene_challenge_cycles c on c.id=o.cycle_id
    where t.enabled
      and (t.action_type='gig:verified_performance' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
      and o.status in ('active','completed')
      and c.status in ('active','completed','expired')
      and c.ends_at>=now()-interval '7 days'
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
  ) then return jsonb_build_object('disabled',true,'events_processed',0,
      'contributions_inserted',0,'backlog_pending',false);
  end if;

  insert into public.scene_processor_cursors(source_key,last_applied_at,last_source_id)
  values('verified_gig',now()-interval '7 days',
     '00000000-0000-0000-0000-000000000000'::uuid)
  on conflict(source_key) do nothing;

  select * into strict v_cursor from public.scene_processor_cursors
  where source_key='verified_gig' for update;

  for v_event in
    select go.id,go.completed_at
    from public.gig_outcomes go
    join public.gigs g on g.id=go.gig_id
    where go.completed_at is not null
      and go.completed_at<=v_cutoff
      and g.status='completed' and g.cancelled_at is null
      and (go.completed_at,go.id)>
        (v_cursor.last_applied_at,v_cursor.last_source_id)
    order by go.completed_at,go.id limit p_limit
  loop
    v_credits:=v_credits+private.ingest_scene_verified_gig(v_event.id);
    v_count:=v_count+1;
    v_cursor.last_applied_at:=v_event.completed_at;
    v_cursor.last_source_id:=v_event.id;
  end loop;

  update public.scene_processor_cursors
  set last_applied_at=v_cursor.last_applied_at,
      last_source_id=v_cursor.last_source_id,
      processed_events=processed_events+v_count,
      updated_at=now()
  where source_key='verified_gig';

  select exists(
    select 1 from public.gig_outcomes go
    join public.gigs g on g.id=go.gig_id
    where go.completed_at is not null
      and go.completed_at<=v_cutoff
      and g.status='completed' and g.cancelled_at is null
      and (go.completed_at,go.id)>
        (v_cursor.last_applied_at,v_cursor.last_source_id)
  ) into v_backlog;

  return jsonb_build_object('disabled',false,
      'events_processed',v_count,
      'contributions_inserted',v_credits,
      'backlog_pending',v_backlog,
      'cursor_at',v_cursor.last_applied_at);
end;
$$;

-- preview guard for gig:verified_performance
create or replace function private.preview_scene_verified_gig_batch(p_limit integer default 50)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_at timestamptz;
  v_id uuid;
  v_count integer;
  v_cutoff timestamptz:=now()-interval '15 minutes';
begin
  -- Rechecks are inside readiness query; preview remains read-only.
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  select last_applied_at,last_source_id into v_at,v_id
  from public.scene_processor_cursors where source_key='verified_gig';
  if v_at is null then
    v_at:=now()-interval '7 days';
    v_id:='00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  select count(*)::int into v_count from (
    select 1 from public.gig_outcomes go
    join public.gigs g on g.id=go.gig_id
    where go.completed_at is not null
      and go.completed_at<=v_cutoff
      and g.status='completed' and g.cancelled_at is null
      and (go.completed_at,go.id)>(v_at,v_id)
    order by go.completed_at,go.id limit p_limit+1
  ) bounded;

  return jsonb_build_object(
    'candidate_sessions',least(v_count,p_limit),
    'backlog_pending',v_count>p_limit,
    'cursor_at',v_at,
    'settled_before',v_cutoff,
    'source_ready',exists(
      select 1 from public.scene_challenge_templates t
      join public.scene_challenge_objectives o on o.template_id=t.id
      join public.scene_challenge_cycles c on c.id=o.cycle_id
      where t.enabled
        and (t.action_type='gig:verified_performance' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
        and exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
      and exists (select 1 from public.scene_source_controls where action_type='gig:verified_performance' and enabled is true)
      and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at>=now()-interval '7 days'
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
    ));
end;
$$;

-- ingest guard for rehearsal:completed
create or replace function private.ingest_scene_verified_rehearsal(p_rehearsal_id uuid)
returns integer language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_rehearsal record;
  v_obj record;
  v_affiliation uuid;
  v_points integer;
  v_cap integer;
  v_credited integer:=0;
begin
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='rehearsal:completed' and enabled is true)
  then return 0; end if;
  if p_rehearsal_id is null then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:rehearsal:'||p_rehearsal_id::text));

  select r.id,r.band_id,r.payment_profile_id,r.completed_at,
    rr.city_id,p.user_id as account_id,p.is_active,p.deleted_at
    into v_rehearsal
  from public.band_rehearsals r
  join public.rehearsal_rooms rr on rr.id=r.rehearsal_room_id
  join public.profiles p on p.id=r.payment_profile_id
  where r.id=p_rehearsal_id
    and r.status='completed'
    and r.completed_at is not null
    and r.scheduled_end is not null
    and r.completed_at >= r.scheduled_end
    and r.completed_at <= now()
    and r.completed_at >= now()-interval '7 days'
    and r.xp_earned > 0
    and rr.city_id is not null
    and p.user_id is not null
    and p.is_active is true and p.deleted_at is null
    and exists(
      select 1 from public.band_members bm
      where bm.band_id=r.band_id and bm.profile_id=r.payment_profile_id
        and coalesce(bm.member_status,'active')='active'
    );
  if not found then return 0; end if;

  if not exists (
    select 1 from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id=c.id
    join public.scene_challenge_templates t on t.id=o.template_id
    where c.city_id=v_rehearsal.city_id
      and c.starts_at<=v_rehearsal.completed_at and c.ends_at>v_rehearsal.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
      and (t.action_type='rehearsal:completed'
        or (c.cadence='monthly' and t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
  ) then return 0; end if;

  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:acct:'||
    v_rehearsal.account_id::text||':'||
    (v_rehearsal.completed_at at time zone 'UTC')::date::text));

  insert into public.scene_daily_affiliations(account_id,date_utc,city_id,profile_id)
  values(v_rehearsal.account_id,(v_rehearsal.completed_at at time zone 'UTC')::date,
    v_rehearsal.city_id,v_rehearsal.payment_profile_id)
  on conflict(account_id,date_utc) do nothing;

  select city_id into v_affiliation from public.scene_daily_affiliations
  where account_id=v_rehearsal.account_id
    and date_utc=(v_rehearsal.completed_at at time zone 'UTC')::date;
  if v_affiliation is distinct from v_rehearsal.city_id then return 0; end if;

  for v_obj in
    select o.id objective_id,c.id cycle_id,c.cadence
    from public.scene_challenge_cycles c
    join public.scene_challenge_objectives o on o.cycle_id=c.id
    join public.scene_challenge_templates t on t.id=o.template_id
    where c.city_id=v_rehearsal.city_id
      and c.starts_at<=v_rehearsal.completed_at and c.ends_at>v_rehearsal.completed_at
      and c.status in ('active','completed','expired')
      and o.status in ('active','completed') and t.enabled
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
      and (t.action_type='rehearsal:completed'
        or (c.cadence='monthly' and t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
    order by c.starts_at,c.cadence,o.id
  loop
    v_cap:=case v_obj.cadence when 'daily' then 5 when 'weekly' then 10 else 25 end;
    perform pg_advisory_xact_lock(hashtext('rockmundo:scene:cycle:'||
      v_rehearsal.account_id::text||':'||v_obj.cycle_id::text));

    if exists(
      select 1 from public.scene_contributions
      where objective_id=v_obj.objective_id and account_id=v_rehearsal.account_id
        and source_type='verified_rehearsal'
        and source_event_id=p_rehearsal_id::text
    ) then continue; end if;

    select coalesce(sum(sc.points),0)::int into v_points
    from public.scene_contributions sc
    join public.scene_challenge_objectives o on o.id=sc.objective_id
    where o.cycle_id=v_obj.cycle_id and sc.account_id=v_rehearsal.account_id
      and sc.invalidated_at is null;
    if v_points>=v_cap then continue; end if;

    insert into public.scene_contributions(
      objective_id,account_id,profile_id,band_id,city_id,
      source_type,source_event_id,source_completed_at,points
    ) values (
      v_obj.objective_id,v_rehearsal.account_id,v_rehearsal.payment_profile_id,
      v_rehearsal.band_id,v_rehearsal.city_id,'verified_rehearsal',
      p_rehearsal_id::text,v_rehearsal.completed_at,1
    ) on conflict(objective_id,source_type,source_event_id,account_id)
      do nothing;
    if found then v_credited:=v_credited+1; end if;
  end loop;
  return v_credited;
end;
$$;

-- batch guard for rehearsal:completed
create or replace function private.process_scene_verified_rehearsal_batch(p_limit integer default 50)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_cursor public.scene_processor_cursors%rowtype;
  v_event record;
  v_count integer:=0;
  v_credits integer:=0;
  v_backlog boolean:=false;
  v_cutoff timestamptz:=now()-interval '15 minutes';
begin
  if not exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
    or not exists (select 1 from public.scene_source_controls where action_type='rehearsal:completed' and enabled is true)
  then return jsonb_build_object('disabled',true,'events_processed',0,'contributions_inserted',0,'backlog_pending',false); end if;
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;
  if not exists (
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id=t.id
    join public.scene_challenge_cycles c on c.id=o.cycle_id
    where t.enabled and (t.action_type='rehearsal:completed' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
      and o.status in ('active','completed')
      and c.status in ('active','completed','expired')
      and c.ends_at>=now()-interval '7 days'
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
  ) then return jsonb_build_object('disabled',true,
    'events_processed',0,'contributions_inserted',0,'backlog_pending',false);
  end if;

  insert into public.scene_processor_cursors(source_key,last_applied_at,last_source_id)
  values('verified_rehearsal',now()-interval '7 days',
    '00000000-0000-0000-0000-000000000000'::uuid)
  on conflict(source_key) do nothing;

  select * into strict v_cursor from public.scene_processor_cursors
  where source_key='verified_rehearsal' for update;

  for v_event in
    select r.id,r.completed_at
    from public.band_rehearsals r
    where r.status='completed'
      and r.completed_at is not null and r.completed_at<=v_cutoff
      and (r.completed_at,r.id)>(v_cursor.last_applied_at,v_cursor.last_source_id)
    order by r.completed_at,r.id limit p_limit
  loop
    v_credits:=v_credits+private.ingest_scene_verified_rehearsal(v_event.id);
    v_count:=v_count+1;
    v_cursor.last_applied_at:=v_event.completed_at;
    v_cursor.last_source_id:=v_event.id;
  end loop;

  update public.scene_processor_cursors
  set last_applied_at=v_cursor.last_applied_at,
      last_source_id=v_cursor.last_source_id,
      processed_events=processed_events+v_count,
      updated_at=now()
  where source_key='verified_rehearsal';

  select exists(
    select 1 from public.band_rehearsals r
    where r.status='completed'
      and r.completed_at is not null and r.completed_at<=v_cutoff
      and (r.completed_at,r.id)>(v_cursor.last_applied_at,v_cursor.last_source_id)
  ) into v_backlog;

  return jsonb_build_object('disabled',false,'events_processed',v_count,
    'contributions_inserted',v_credits,'backlog_pending',v_backlog,
    'cursor_at',v_cursor.last_applied_at);
end;
$$;

-- preview guard for rehearsal:completed
create or replace function private.preview_scene_verified_rehearsal_batch(p_limit integer default 50)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_at timestamptz;
  v_id uuid;
  v_count integer;
  v_cutoff timestamptz:=now()-interval '15 minutes';
begin
  -- Rechecks are inside readiness query; preview remains read-only.
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;
  select last_applied_at,last_source_id into v_at,v_id
  from public.scene_processor_cursors where source_key='verified_rehearsal';
  if v_at is null then
    v_at:=now()-interval '7 days';
    v_id:='00000000-0000-0000-0000-000000000000'::uuid;
  end if;
  select count(*)::int into v_count from (
    select 1 from public.band_rehearsals r
    where r.status='completed' and r.completed_at is not null
      and r.completed_at<=v_cutoff and (r.completed_at,r.id)>(v_at,v_id)
    order by r.completed_at,r.id limit p_limit+1
  ) candidates;
  return jsonb_build_object('candidate_sessions',least(v_count,p_limit),
    'backlog_pending',v_count>p_limit,'cursor_at',v_at,
    'settled_before',v_cutoff,'source_ready',exists(
      select 1 from public.scene_challenge_templates t
      join public.scene_challenge_objectives o on o.template_id=t.id
      join public.scene_challenge_cycles c on c.id=o.cycle_id
      where t.enabled and (t.action_type='rehearsal:completed' or (t.action_type='scene:verified_community' and exists(select 1 from public.scene_source_controls monthly_ctrl where monthly_ctrl.action_type='scene:verified_community' and monthly_ctrl.enabled is true)))
        and exists (select 1 from public.scene_rollout_controls where singleton is true and scoring_enabled is true)
      and exists (select 1 from public.scene_source_controls where action_type='rehearsal:completed' and enabled is true)
      and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at>=now()-interval '7 days'
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
    ));
end;
$$;

commit;
