-- Ordered, replay-safe studio recording reconciliation.
-- Same transactional cursor pattern as verified jams. No cron/payout activation.
begin;

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
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  -- A template flag alone is insufficient. Never discard events while source
  -- health checks are disabled or while there are no compatible cycles.
  if not exists (
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id = t.id
    join public.scene_challenge_cycles c on c.id = o.cycle_id
    where t.enabled and t.action_type in
      ('recording:completed', 'scene:verified_community')
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
revoke all on function private.process_scene_completed_recording_batch(integer)
  from public, anon, authenticated;
grant execute on function private.process_scene_completed_recording_batch(integer)
  to service_role;

create or replace function public.scene_process_completed_recording_batch(p_limit integer default 50)
returns jsonb
language sql security invoker
set search_path = pg_catalog, public, private
as $$ select private.process_scene_completed_recording_batch(p_limit); $$;
revoke all on function public.scene_process_completed_recording_batch(integer)
  from public, anon, authenticated;
grant execute on function public.scene_process_completed_recording_batch(integer) to service_role;

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
      where t.enabled and t.action_type in
        ('recording:completed','scene:verified_community')
        and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at >= now()-interval '7 days'
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
    )
  );
end;
$$;
revoke all on function private.preview_scene_completed_recording_batch(integer)
  from public, anon, authenticated;
grant execute on function private.preview_scene_completed_recording_batch(integer)
  to service_role;

create or replace function public.scene_preview_completed_recording_batch(p_limit integer default 50)
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public, private
as $$ select private.preview_scene_completed_recording_batch(p_limit); $$;
revoke all on function public.scene_preview_completed_recording_batch(integer)
  from public, anon, authenticated;
grant execute on function public.scene_preview_completed_recording_batch(integer) to service_role;
commit;