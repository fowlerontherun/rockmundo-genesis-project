-- Detect verified source events that settle behind the forward-only cursor.
-- A bounded, resumable seven-day sweep uses existing trusted ingesters; it
-- cannot award a source event twice. Rollout is OFF by default.
begin;

create table public.scene_source_replay_controls (
  singleton boolean primary key default true check(singleton is true),
  enabled boolean not null default false,
  scan_interval interval not null default interval '1 hour'
    check (scan_interval between interval '15 minutes' and interval '24 hours'),
  updated_at timestamptz not null default now()
);
insert into public.scene_source_replay_controls(singleton,enabled)
values(true,false) on conflict(singleton) do nothing;
alter table public.scene_source_replay_controls enable row level security;
revoke all on public.scene_source_replay_controls from public,anon,authenticated;
grant all on public.scene_source_replay_controls to service_role;

create table public.scene_source_replay_cursors (
  source_key text primary key
    check (source_key in ('verified_gig','completed_recording','verified_rehearsal')),
  cursor_at timestamptz not null,
  cursor_id uuid not null default '00000000-0000-0000-0000-000000000000',
  next_scan_at timestamptz not null default now(),
  last_sweep_at timestamptz,
  events_rechecked bigint not null default 0,
  contributions_recovered bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.scene_source_replay_cursors enable row level security;
revoke all on public.scene_source_replay_cursors from public,anon,authenticated;
grant all on public.scene_source_replay_cursors to service_role;

create index if not exists idx_scene_replay_gig_completed
  on public.gig_outcomes(completed_at,id) where completed_at is not null;
create index if not exists idx_scene_replay_rehearsal_completed
  on public.band_rehearsals(completed_at,id)
  where completed_at is not null and status='completed';
create index if not exists idx_scene_replay_recording_completed
  on public.recording_sessions(completed_at,id)
  where completed_at is not null and status='completed';

create or replace function private.scene_replay_recent_verified_sources(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_controls public.scene_source_replay_controls%rowtype;
  v_cur public.scene_source_replay_cursors%rowtype;
  v_source text;
  v_action text;
  v_evt record;
  v_cutoff timestamptz:=now()-interval '15 minutes';
  v_floor timestamptz:=now()-interval '7 days';
  v_checked integer:=0;
  v_credited integer:=0;
  v_source_checked integer;
  v_source_credited integer;
  v_backlog boolean:=false;
  v_source_backlog boolean;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'SCENE_REPLAY_INVALID_BATCH_SIZE';
  end if;
  select * into v_controls
    from public.scene_source_replay_controls where singleton is true;
  if not found or v_controls.enabled is not true or
     not exists(select 1 from public.scene_rollout_controls
                where singleton and scoring_enabled is true) then
    return jsonb_build_object('disabled',true,'events_rechecked',0,
      'contributions_recovered',0,'backlog_pending',false);
  end if;

  -- Only one replay operation may hold this lock. The main cron tick
  -- owns a separate advisory lock but uses this same protected function.
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:recent-source-replay'));

  foreach v_source in array array[
    'verified_gig','completed_recording','verified_rehearsal'
  ] loop
    v_action:=case v_source
      when 'verified_gig' then 'gig:verified_performance'
      when 'completed_recording' then 'recording:completed'
      else 'rehearsal:completed' end;
    if not exists (
      select 1 from public.scene_source_controls
      where action_type=v_action and enabled=true
    ) or not exists(
      select 1 from public.scene_challenge_templates t
      join public.scene_challenge_objectives o on o.template_id=t.id
      join public.scene_challenge_cycles c on c.id=o.cycle_id
      where t.enabled and o.status in ('active','completed')
        and c.status in ('active','completed','expired')
        and c.ends_at > v_floor
        and coalesce(o.source_health_snapshot->>'scoring_enabled','false')='true'
        and (t.action_type=v_action or
          (c.cadence='monthly' and t.action_type='scene:verified_community'
            and exists(select 1 from public.scene_source_controls monthly
             where monthly.action_type='scene:verified_community'
               and monthly.enabled=true)))
    ) then continue; end if;

    insert into public.scene_source_replay_cursors(source_key,cursor_at,cursor_id)
    values(v_source,v_floor,'00000000-0000-0000-0000-000000000000')
    on conflict(source_key) do nothing;
    select * into strict v_cur from public.scene_source_replay_cursors
      where source_key=v_source for update;
    if v_cur.next_scan_at>now() then continue; end if;

    v_source_checked:=0;
    v_source_credited:=0;
    v_source_backlog:=false;
    -- Read p_limit+1 events. The extra event tells us whether the sweep
    -- has more rows without an additional full-table count.
    for v_evt in
      select e.id,e.event_at from (
        select go.id,go.completed_at as event_at
        from public.gig_outcomes go
        join public.gigs g on g.id=go.gig_id
        where v_source='verified_gig'
          and g.status='completed' and g.cancelled_at is null
        union all
        select s.id,s.completed_at
        from public.recording_sessions s
        where v_source='completed_recording' and s.status='completed'
        union all
        select r.id,r.completed_at
        from public.band_rehearsals r
        where v_source='verified_rehearsal' and r.status='completed'
      ) e
      where e.event_at>v_floor and e.event_at<=v_cutoff
        and (e.event_at,e.id)>(v_cur.cursor_at,v_cur.cursor_id)
      order by e.event_at,e.id
      limit p_limit+1
    loop
      if v_source_checked>=p_limit then
        v_source_backlog:=true;
        exit;
      end if;
      v_source_checked:=v_source_checked+1;
      v_source_credited:=v_source_credited+
        case v_source
        when 'verified_gig' then private.ingest_scene_verified_gig(v_evt.id)
        when 'completed_recording' then private.ingest_scene_completed_recording(v_evt.id)
        else private.ingest_scene_verified_rehearsal(v_evt.id)
        end;
      v_cur.cursor_at:=v_evt.event_at;
      v_cur.cursor_id:=v_evt.id;
    end loop;

    -- Every pass has a hard upper bound. On completion reset to the
    -- rolling seven-day window, with a one-hour cooldown between sweeps.
    update public.scene_source_replay_cursors
      set cursor_at=case when v_source_backlog then v_cur.cursor_at else v_floor end,
          cursor_id=case when v_source_backlog then v_cur.cursor_id
                         else '00000000-0000-0000-0000-000000000000'::uuid end,
          next_scan_at=case when v_source_backlog then now()
                            else now()+v_controls.scan_interval end,
          last_sweep_at=case when v_source_backlog then last_sweep_at else now() end,
          events_rechecked=events_rechecked+v_source_checked,
          contributions_recovered=contributions_recovered+v_source_credited,
          updated_at=now()
      where source_key=v_source;
    v_checked:=v_checked+v_source_checked;
    v_credited:=v_credited+v_source_credited;
    v_backlog:=v_backlog or v_source_backlog;
  end loop;

  return jsonb_build_object('disabled',false,
    'events_rechecked',v_checked,
    'contributions_recovered',v_credited,
    'backlog_pending',v_backlog);
end;
$$;
revoke all on function private.scene_replay_recent_verified_sources(integer)
  from public,anon,authenticated;
grant execute on function private.scene_replay_recent_verified_sources(integer)
  to service_role;

-- Extend the existing cron worker, preserving all existing guards and
-- reconciliation. It remains safe while replay_controls.enabled=false.
create or replace function private.scene_run_verified_tick(
  p_limit integer default 50
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
set statement_timeout='45s'
as $$
declare
  v_cycles integer:=0;
  v_gigs jsonb;
  v_recordings jsonb;
  v_rehearsals jsonb;
  v_replay jsonb;
  v_milestones integer:=0;
  v_entitlements integer:=0;
  v_enabled boolean:=false;
  v_scoring boolean:=false;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'City Scene batch size must be 1 to 100';
  end if;
  select r.cycle_generation_enabled,r.scoring_enabled into v_enabled,v_scoring
    from public.scene_rollout_controls r where singleton is true;
  if v_enabled is not true or v_scoring is not true then
    return jsonb_build_object('disabled',true,'cycles_created',0,
      'events_processed',0,'contributions_inserted',0,'milestones_unlocked',0);
  end if;
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:periodic-tick'));

  v_cycles:=private.reconcile_city_scene_cycles(now(),null);
  v_gigs:=private.process_scene_verified_gig_batch(p_limit);
  v_recordings:=private.process_scene_completed_recording_batch(p_limit);
  v_rehearsals:=private.process_scene_verified_rehearsal_batch(p_limit);
  v_replay:=private.scene_replay_recent_verified_sources(p_limit);
  v_milestones:=private.reconcile_scene_milestones(null);
  v_entitlements:=private.reconcile_scene_reward_entitlements(null);

  return jsonb_build_object(
    'disabled',false,'cycles_created',v_cycles,
    'sources',jsonb_build_object(
      'gigs',v_gigs,'recordings',v_recordings,'rehearsals',v_rehearsals,
      'late_event_replay',v_replay
    ),
    'events_processed',
      coalesce((v_gigs->>'events_processed')::integer,0)
      +coalesce((v_recordings->>'events_processed')::integer,0)
      +coalesce((v_rehearsals->>'events_processed')::integer,0),
    'contributions_inserted',
      coalesce((v_gigs->>'contributions_inserted')::integer,0)
      +coalesce((v_recordings->>'contributions_inserted')::integer,0)
      +coalesce((v_rehearsals->>'contributions_inserted')::integer,0)
      +coalesce((v_replay->>'contributions_recovered')::integer,0),
    'milestones_unlocked',v_milestones,
    'pending_entitlements_created',v_entitlements,
    'backlog_pending',
      coalesce((v_gigs->>'backlog_pending')::boolean,false)
      or coalesce((v_recordings->>'backlog_pending')::boolean,false)
      or coalesce((v_rehearsals->>'backlog_pending')::boolean,false)
      or coalesce((v_replay->>'backlog_pending')::boolean,false)
  );
end;
$$;
revoke all on function private.scene_run_verified_tick(integer)
  from public,anon,authenticated;
grant execute on function private.scene_run_verified_tick(integer)
  to service_role;
commit;