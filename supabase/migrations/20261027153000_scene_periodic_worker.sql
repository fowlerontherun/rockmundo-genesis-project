-- A single guarded and idempotent periodic worker for live City Scene.
-- This migration does NOT register a cron job (separate operator activation).
-- Reward payout function is intentionally NEVER called by this worker.
begin;
create or replace function private.scene_run_verified_tick(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
set statement_timeout='45s'
as $$
declare
  v_cycles integer:=0;
  v_gigs jsonb;
  v_recordings jsonb;
  v_rehearsals jsonb;
  v_milestones integer:=0;
  v_entitlements integer:=0;
  v_enabled boolean:=false;
  v_scoring boolean:=false;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'City Scene batch size must be 1 to 100';
  end if;

  select r.cycle_generation_enabled,r.scoring_enabled
    into v_enabled,v_scoring
  from public.scene_rollout_controls r
  where singleton is true;

  if v_enabled is not true or v_scoring is not true then
    return jsonb_build_object(
      'disabled',true,'cycles_created',0,'events_processed',0,
      'contributions_inserted',0,'milestones_unlocked',0
    );
  end if;

  -- Never run overlapping periodic ticks. Per-source cursor locks also
  -- guarantee idempotent event processing if an operator invokes an RPC.
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:periodic-tick'));

  v_cycles:=private.reconcile_city_scene_cycles(now(),null);
  v_gigs:=private.process_scene_verified_gig_batch(p_limit);
  v_recordings:=private.process_scene_completed_recording_batch(p_limit);
  v_rehearsals:=private.process_scene_verified_rehearsal_batch(p_limit);
  v_milestones:=private.reconcile_scene_milestones(null);

  -- Policies are disabled during pilot. Future entitlements remain pending
  -- until independently approved wallet-payout processing is enabled.
  v_entitlements:=private.reconcile_scene_reward_entitlements(null);

  return jsonb_build_object(
    'disabled',false,
    'cycles_created',v_cycles,
    'sources',jsonb_build_object(
      'gigs',v_gigs,
      'recordings',v_recordings,
      'rehearsals',v_rehearsals
    ),
    'events_processed',
       coalesce((v_gigs->>'events_processed')::integer,0)
      +coalesce((v_recordings->>'events_processed')::integer,0)
      +coalesce((v_rehearsals->>'events_processed')::integer,0),
    'contributions_inserted',
       coalesce((v_gigs->>'contributions_inserted')::integer,0)
      +coalesce((v_recordings->>'contributions_inserted')::integer,0)
      +coalesce((v_rehearsals->>'contributions_inserted')::integer,0),
    'milestones_unlocked',v_milestones,
    'pending_entitlements_created',v_entitlements,
    'backlog_pending',
      coalesce((v_gigs->>'backlog_pending')::boolean,false)
      or coalesce((v_recordings->>'backlog_pending')::boolean,false)
      or coalesce((v_rehearsals->>'backlog_pending')::boolean,false)
  );
end;
$$;
revoke all on function private.scene_run_verified_tick(integer)
  from public,anon,authenticated;
grant execute on function private.scene_run_verified_tick(integer)
  to service_role;
commit;