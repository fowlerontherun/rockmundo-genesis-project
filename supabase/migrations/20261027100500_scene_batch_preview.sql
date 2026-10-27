-- Read-only queue diagnostics used by dry-run mode. The preview matches
-- the transactional worker's cursor order and 15-minute settling window.
begin;
create or replace function private.preview_scene_verified_jam_batch(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_last_time timestamptz;
  v_last_id uuid;
  v_count integer;
  v_cutoff timestamptz := now() - interval '15 minutes';
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Batch limit must be 1 to 100';
  end if;

  select last_applied_at, last_source_id into v_last_time, v_last_id
  from public.scene_processor_cursors
  where source_key = 'verified_jam';

  if v_last_time is null then
    v_last_time := now() - interval '7 days';
    v_last_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  select count(*)::integer into v_count from (
    select 1 from public.jam_session_finalizations f
    where (f.applied_at, f.session_id) > (v_last_time, v_last_id)
      and f.applied_at <= v_cutoff
    order by f.applied_at, f.session_id
    limit p_limit + 1
  ) bounded;

  return jsonb_build_object(
    'candidate_sessions', least(v_count, p_limit),
    'backlog_pending', v_count > p_limit,
    'cursor_at', v_last_time,
    'settled_before', v_cutoff,
    'scoring_templates_enabled', exists (
      select 1 from public.scene_challenge_templates t
      where t.enabled is true
        and t.action_type in ('jam:verified_collaboration', 'scene:verified_community')
    )
  );
end;
$$;
revoke all on function private.preview_scene_verified_jam_batch(integer)
  from public, anon, authenticated;
grant execute on function private.preview_scene_verified_jam_batch(integer)
  to service_role;

create or replace function public.scene_preview_verified_jam_batch(p_limit integer default 50)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.preview_scene_verified_jam_batch(p_limit);
$$;
revoke all on function public.scene_preview_verified_jam_batch(integer)
  from public, anon, authenticated;
grant execute on function public.scene_preview_verified_jam_batch(integer)
  to service_role;
commit;