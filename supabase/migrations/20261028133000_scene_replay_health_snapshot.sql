-- Read-only, service-only observability for bounded City Scene source replay.
-- No player identifiers, award mutations, extra cron, or XP policy changes.
begin;
create or replace function private.scene_replay_health_snapshot(
  p_stale_after_minutes integer default 30
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_enabled boolean:=false;
  v_scoring_enabled boolean:=false;
  v_expected integer:=3;
  v_sources integer:=0;
  v_pending integer:=0;
  v_stale integer:=0;
  v_rechecked bigint:=0;
  v_recovered bigint:=0;
  v_stats jsonb:='[]'::jsonb;
  v_status text;
begin
  if p_stale_after_minutes is null
    or p_stale_after_minutes < 15 or p_stale_after_minutes > 180
  then raise exception 'SCENE_REPLAY_HEALTH_STALE_LIMIT_INVALID'; end if;

  select coalesce(enabled,false) into v_enabled
  from public.scene_source_replay_controls where singleton=true;
  select coalesce(scoring_enabled,false) into v_scoring_enabled
  from public.scene_rollout_controls where singleton=true;

  select count(*)::integer,
         count(*) filter (where next_scan_at<=now())::integer,
         count(*) filter (
           where next_scan_at < now()-make_interval(mins=>p_stale_after_minutes)
         )::integer,
         coalesce(sum(events_rechecked),0)::bigint,
         coalesce(sum(contributions_recovered),0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object(
           'source',source_key,
           'last_sweep_at',last_sweep_at,
           'next_scan_at',next_scan_at,
           'events_rechecked',events_rechecked,
           'contributions_recovered',contributions_recovered,
           'pending',next_scan_at<=now(),
           'stale',next_scan_at<now()-make_interval(mins=>p_stale_after_minutes)
         ) order by source_key),'[]'::jsonb)
  into v_sources,v_pending,v_stale,v_rechecked,v_recovered,v_stats
  from public.scene_source_replay_cursors;

  v_status:=case
    when not v_enabled then 'disabled'
    when not v_scoring_enabled then 'scoring_disabled'
    when v_sources<v_expected then 'waiting_initial_sweep'
    when v_stale>0 then 'stalled'
    else 'healthy'
  end;

  return jsonb_build_object(
    'status',v_status,
    'needs_attention',v_status in ('stalled','waiting_initial_sweep'),
    'replay_enabled',v_enabled,
    'scoring_enabled',v_scoring_enabled,
    'sources_expected',v_expected,
    'sources_seen',v_sources,
    'sources_pending',v_pending,
    'sources_stale',v_stale,
    'events_rechecked_total',v_rechecked,
    'contributions_recovered_total',v_recovered,
    'checked_at',now(),
    'sources',v_stats
  );
end;
$$;
revoke all on function private.scene_replay_health_snapshot(integer)
  from public,anon,authenticated;
grant execute on function private.scene_replay_health_snapshot(integer)
  to service_role;
commit;
