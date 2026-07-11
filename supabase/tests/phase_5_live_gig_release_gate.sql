-- Phase 5 PR 11 Live Gig beta release gate harness.
-- Run after a clean `supabase db reset` with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_5_live_gig_release_gate.sql
BEGIN;

DO $$
DECLARE
  v_claim_oid oid;
  v_search_path text;
  v_replay_policies text[];
  v_replay_checks int;
BEGIN
  IF to_regclass('public.gigs') IS NULL THEN RAISE EXCEPTION 'missing public.gigs'; END IF;
  IF to_regclass('public.gig_outcomes') IS NULL THEN RAISE EXCEPTION 'missing public.gig_outcomes'; END IF;
  IF to_regclass('public.gig_song_performances') IS NULL THEN RAISE EXCEPTION 'missing public.gig_song_performances'; END IF;
  IF to_regclass('public.gig_viewer_replays') IS NULL THEN RAISE EXCEPTION 'missing public.gig_viewer_replays'; END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gigs' AND column_name='result_ready_at';
  IF NOT FOUND THEN RAISE EXCEPTION 'gigs.result_ready_at is required'; END IF;

  PERFORM 1 FROM pg_constraint WHERE conname = 'gig_song_performances_outcome_position_unique';
  IF NOT FOUND THEN RAISE EXCEPTION 'gig song position uniqueness constraint is required'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='start_gig_authoritative';
  IF NOT FOUND THEN RAISE EXCEPTION 'start_gig_authoritative RPC is required'; END IF;
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='claim_gig_completion';
  IF NOT FOUND THEN RAISE EXCEPTION 'claim_gig_completion RPC is required'; END IF;

  SELECT p.oid, array_to_string(p.proconfig, ',') INTO v_claim_oid, v_search_path
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='claim_gig_viewer_replay_generation'
    AND pg_get_function_identity_arguments(p.oid) = 'p_gig_id uuid, p_outcome_id uuid, p_viewer_version integer';
  IF v_claim_oid IS NULL THEN RAISE EXCEPTION 'claim_gig_viewer_replay_generation(uuid,uuid,integer) RPC is required'; END IF;
  IF COALESCE(v_search_path,'') NOT LIKE '%search_path=public, pg_temp%' THEN RAISE EXCEPTION 'claim RPC must pin search_path to public, pg_temp; got %', v_search_path; END IF;
  IF has_function_privilege('anon', v_claim_oid, 'EXECUTE') THEN RAISE EXCEPTION 'anon must not execute replay claim RPC'; END IF;
  IF has_function_privilege('authenticated', v_claim_oid, 'EXECUTE') THEN RAISE EXCEPTION 'authenticated must not execute replay claim RPC'; END IF;
  IF NOT has_function_privilege('service_role', v_claim_oid, 'EXECUTE') THEN RAISE EXCEPTION 'service_role must execute replay claim RPC'; END IF;

  SELECT array_agg(policyname ORDER BY policyname) INTO v_replay_policies
  FROM pg_policies WHERE schemaname='public' AND tablename='gig_viewer_replays';
  IF NOT (v_replay_policies @> ARRAY[
    'gig_viewer_replays_select_matches_outcome_visibility',
    'gig_viewer_replays_deny_insert',
    'gig_viewer_replays_deny_update',
    'gig_viewer_replays_deny_delete'
  ]) THEN RAISE EXCEPTION 'replay RLS policies missing: %', v_replay_policies; END IF;

  PERFORM 1 FROM pg_indexes WHERE schemaname='public' AND tablename='gig_viewer_replays' AND indexname='gig_viewer_replays_one_ready_per_gig_viewer';
  IF NOT FOUND THEN RAISE EXCEPTION 'one ready replay per gig/viewer index missing'; END IF;

  SELECT count(*) INTO v_replay_checks FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND t.relname='gig_viewer_replays' AND c.contype='c';
  IF v_replay_checks < 3 THEN RAISE EXCEPTION 'replay payload/status/version constraints are incomplete'; END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gig_viewer_replays' AND column_name IN ('generation_status','event_payload','viewer_version','event_schema_version','claimed_at','generation_attempts') GROUP BY table_name HAVING count(*) = 6;
  IF NOT FOUND THEN RAISE EXCEPTION 'replay generation columns are incomplete'; END IF;

  RAISE NOTICE 'Phase 5 release gate schema/RLS/RPC checks passed. Fixture-level progression and RLS checks require seeded data in future expansion.';
END $$;

ROLLBACK;
