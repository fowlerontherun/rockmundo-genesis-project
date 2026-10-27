-- Durable, ordered processing cursor for verifiably finalised jam events.
-- One database transaction: all event credits + cursor advance commit together.
-- No cron, no rewards. Templates and objective health remain OFF by default.
begin;

create table public.scene_processor_cursors (
  source_key text primary key check (source_key in ('verified_jam')),
  last_applied_at timestamptz not null,
  last_source_id uuid not null,
  processed_events bigint not null default 0 check (processed_events >= 0),
  updated_at timestamptz not null default now()
);

alter table public.scene_processor_cursors enable row level security;
revoke all on public.scene_processor_cursors from public, anon, authenticated;
grant all on public.scene_processor_cursors to service_role;

create or replace function private.process_scene_verified_jam_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_cursor public.scene_processor_cursors%rowtype;
  v_event record;
  v_count integer := 0;
  v_credits integer := 0;
  v_backlog boolean := false;
  v_cutoff timestamptz := now() - interval '15 minutes';
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  -- Do not consume source events while every compatible template is disabled.
  if not exists (
    select 1 from public.scene_challenge_templates t
    join public.scene_challenge_objectives o on o.template_id = t.id
    join public.scene_challenge_cycles cycle on cycle.id = o.cycle_id
    where t.enabled is true
      and t.action_type in ('jam:verified_collaboration', 'scene:verified_community')
      and o.status in ('active','completed')
      and cycle.status in ('active','completed','expired')
      and cycle.ends_at >= now() - interval '7 days'
      and coalesce(o.source_health_snapshot->>'scoring_enabled','false') = 'true'
  ) then
    return jsonb_build_object('events_processed', 0, 'contributions_inserted', 0,
      'backlog_pending', false, 'disabled', true);
  end if;

  insert into public.scene_processor_cursors(source_key, last_applied_at, last_source_id)
  values ('verified_jam', now() - interval '7 days',
          '00000000-0000-0000-0000-000000000000'::uuid)
  on conflict (source_key) do nothing;

  -- Database row lock serialises simultaneous processor invocations.
  select * into strict v_cursor from public.scene_processor_cursors
  where source_key = 'verified_jam'
  for update;

  for v_event in
    select f.session_id, f.applied_at
    from public.jam_session_finalizations f
    where (f.applied_at, f.session_id) >
      (v_cursor.last_applied_at, v_cursor.last_source_id)
      and f.applied_at <= v_cutoff
    order by f.applied_at, f.session_id
    limit p_limit
  loop
    -- Ingest checks final session state, resolved slot participation, same
    -- city and account eligibility. Non-qualifying records consume the cursor
    -- without points, avoiding permanent retry of bad/old source records.
    v_credits := v_credits +
      private.ingest_scene_verified_jam(v_event.session_id);
    v_count := v_count + 1;
    v_cursor.last_applied_at := v_event.applied_at;
    v_cursor.last_source_id := v_event.session_id;
  end loop;

  update public.scene_processor_cursors
  set last_applied_at = v_cursor.last_applied_at,
      last_source_id = v_cursor.last_source_id,
      processed_events = processed_events + v_count,
      updated_at = now()
  where source_key = 'verified_jam';

  select exists (
    select 1 from public.jam_session_finalizations f
    where (f.applied_at, f.session_id) >
      (v_cursor.last_applied_at, v_cursor.last_source_id)
      and f.applied_at <= v_cutoff
  ) into v_backlog;

  return jsonb_build_object(
    'events_processed', v_count,
    'contributions_inserted', v_credits,
    'backlog_pending', v_backlog,
    'disabled', false,
    'cursor_at', v_cursor.last_applied_at
  );
end;
$$;

revoke all on function private.process_scene_verified_jam_batch(integer)
  from public, anon, authenticated;
grant execute on function private.process_scene_verified_jam_batch(integer)
  to service_role;

create or replace function public.scene_process_verified_jam_batch(p_limit integer default 50)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.process_scene_verified_jam_batch(p_limit);
$$;

revoke all on function public.scene_process_verified_jam_batch(integer)
  from public, anon, authenticated;
grant execute on function public.scene_process_verified_jam_batch(integer)
  to service_role;
commit;