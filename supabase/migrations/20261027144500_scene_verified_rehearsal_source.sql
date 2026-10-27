-- Adds a verified band-rehearsal contribution source to City Scene Challenges.
-- Credits only the paying band member of a completed, XP-producing rehearsal.
-- Invitation/RSVP is NOT treated as participation. Templates stay disabled.
begin;

alter table public.scene_processor_cursors
  drop constraint if exists scene_processor_cursors_source_key_check;
alter table public.scene_processor_cursors
  add constraint scene_processor_cursors_source_key_check
  check (source_key in ('verified_jam','completed_recording','verified_gig','verified_rehearsal'));

update public.scene_challenge_templates
set action_type='rehearsal:completed',
    title='Rehearse With Your Band',
    description='Complete a real band rehearsal at a city rehearsal room.',
    art_theme='rehearsal-room', version=version+1
where slug='daily-band-meeting' and enabled=false;

update public.scene_challenge_templates
set action_type='rehearsal:completed',
    title='Keep The Scene Practising',
    description='Complete verified local band rehearsals this week.',
    art_theme='rehearsal-room', version=version+1
where slug='weekly-open-jam' and enabled=false;

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
        or (c.cadence='monthly' and t.action_type='scene:verified_community'))
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
        or (c.cadence='monthly' and t.action_type='scene:verified_community'))
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
revoke all on function private.ingest_scene_verified_rehearsal(uuid)
  from public,anon,authenticated;
grant execute on function private.ingest_scene_verified_rehearsal(uuid) to service_role;

create or replace function public.scene_ingest_verified_rehearsal(p_rehearsal_id uuid)
returns integer language sql security invoker
set search_path=pg_catalog,public,private
as $$ select private.ingest_scene_verified_rehearsal(p_rehearsal_id); $$;
revoke all on function public.scene_ingest_verified_rehearsal(uuid)
  from public,anon,authenticated;
grant execute on function public.scene_ingest_verified_rehearsal(uuid) to service_role;

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
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;
  if not exists (
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id=t.id
    join public.scene_challenge_cycles c on c.id=o.cycle_id
    where t.enabled and t.action_type in ('rehearsal:completed','scene:verified_community')
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
revoke all on function private.process_scene_verified_rehearsal_batch(integer)
  from public,anon,authenticated;
grant execute on function private.process_scene_verified_rehearsal_batch(integer)
  to service_role;

create or replace function public.scene_process_verified_rehearsal_batch(p_limit integer default 50)
returns jsonb language sql security invoker
set search_path=pg_catalog,public,private
as $$ select private.process_scene_verified_rehearsal_batch(p_limit); $$;
revoke all on function public.scene_process_verified_rehearsal_batch(integer)
  from public,anon,authenticated;
grant execute on function public.scene_process_verified_rehearsal_batch(integer) to service_role;

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
      where t.enabled and t.action_type in ('rehearsal:completed','scene:verified_community')
        and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at>=now()-interval '7 days'
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
    ));
end;
$$;
revoke all on function private.preview_scene_verified_rehearsal_batch(integer)
  from public,anon,authenticated;
grant execute on function private.preview_scene_verified_rehearsal_batch(integer)
  to service_role;

create or replace function public.scene_preview_verified_rehearsal_batch(p_limit integer default 50)
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public,private
as $$ select private.preview_scene_verified_rehearsal_batch(p_limit); $$;
revoke all on function public.scene_preview_verified_rehearsal_batch(integer)
  from public,anon,authenticated;
grant execute on function public.scene_preview_verified_rehearsal_batch(integer) to service_role;
commit;