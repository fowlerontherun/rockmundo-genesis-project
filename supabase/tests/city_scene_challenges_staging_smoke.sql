-- City Scene Challenges: staging-only permission and schema smoke checks.
-- Run AFTER applying all scene migrations. Read-only assertions, no fixtures
-- or state changes. Manual use; must not be connected to production cron.
do $$
declare
  v_table text;
  v_function text;
begin
  foreach v_table in array array[
    'scene_challenge_templates', 'scene_challenge_cycles',
    'scene_challenge_objectives', 'scene_daily_affiliations',
    'scene_contributions', 'scene_milestones', 'scene_reward_claims',
    'scene_processor_cursors', 'scene_reward_policies',
    'scene_reward_payout_controls', 'scene_reward_grant_receipts',
    'scene_rollout_controls', 'scene_source_controls'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Scene table missing: %', v_table;
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table
        and c.relrowsecurity is true
    ) then
      raise exception 'RLS disabled for scene table %', v_table;
    end if;

    if has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE')
      or has_table_privilege('anon', 'public.' || v_table, 'SELECT')
    then
      raise exception 'Unsafe public scene table grant: %', v_table;
    end if;
  end loop;

  foreach v_function in array array[
    'public.scene_reconcile_cycles(timestamp with time zone,uuid)',
    'public.scene_ingest_social_activity(uuid)',
    'public.scene_ingest_verified_jam(uuid)',
    'public.scene_reconcile_milestones(uuid)',
    'public.scene_process_verified_jam_batch(integer)',
    'public.scene_preview_verified_jam_batch(integer)',
    'public.scene_reconcile_reward_entitlements(uuid)',
    'public.scene_ingest_completed_recording(uuid)',
    'public.scene_process_completed_recording_batch(integer)',
    'public.scene_preview_completed_recording_batch(integer)',
    'public.scene_ingest_verified_gig(uuid)',
    'public.scene_process_verified_gig_batch(integer)',
    'public.scene_preview_verified_gig_batch(integer)',
    'public.scene_ingest_verified_rehearsal(uuid)',
    'public.scene_process_verified_rehearsal_batch(integer)',
    'public.scene_preview_verified_rehearsal_batch(integer)',
    'public.scene_grant_earned_xp(integer)'
  ] loop
    if to_regprocedure(v_function) is null then
      raise exception 'Scene server RPC missing: %', v_function;
    end if;
    if has_function_privilege('authenticated', v_function, 'EXECUTE')
      or has_function_privilege('anon', v_function, 'EXECUTE')
    then
      raise exception 'Player can invoke privileged scene RPC: %', v_function;
    end if;
    if not has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'Service role cannot invoke scene RPC: %', v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'public.get_city_scene_board(uuid)',
    'public.get_my_city_scene_progress(uuid)',
    'public.get_my_scene_reward_history(uuid,integer)'
  ] loop
    if to_regprocedure(v_function) is null
      or not has_function_privilege('authenticated', v_function, 'EXECUTE')
      or has_function_privilege('anon', v_function, 'EXECUTE')
    then
      raise exception 'Player scene read RPC grant problem: %', v_function;
    end if;
  end loop;

  if exists(select 1 from public.scene_challenge_templates where enabled)
  then raise exception 'Unexpected active templates before reviewed rollout';
  end if;

  if exists(select 1 from public.scene_reward_policies where enabled)
  then raise exception 'Unexpected active reward policies before reviewed rollout';
  end if;

  if (select count(distinct action_type) from public.scene_challenge_templates
      where cadence='daily' and action_type in
        ('rehearsal:completed','recording:completed','gig:verified_performance')
        and enabled=false
     ) < 3 then
    raise exception 'Daily verified music source catalogue is incomplete';
  end if;

  if (select count(distinct action_type) from public.scene_challenge_templates
      where cadence='weekly' and action_type in
        ('rehearsal:completed','recording:completed','gig:verified_performance')
        and enabled=false
     ) < 3 then
    raise exception 'Weekly verified music source catalogue is incomplete';
  end if;

  if exists (
    select 1 from public.scene_reward_payout_controls
    where payouts_enabled is true
  ) then
    raise exception 'Unexpected XP payout enablement in staging smoke';
  end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'Unexpected XP receipts before reviewed rollout';
  end if;

  if exists (
    select 1 from public.scene_rollout_controls
    where cycle_generation_enabled or scoring_enabled
  ) or exists(select 1 from public.scene_source_controls where enabled)
  then raise exception 'City scene rollout unexpectedly enabled before pilot';
  end if;

  if exists(select 1 from public.scene_contributions)
  then raise exception 'Unexpected contributions before reviewed rollout';
  end if;

  raise notice 'City Scene permission and schema smoke checks passed.';
end $$;
