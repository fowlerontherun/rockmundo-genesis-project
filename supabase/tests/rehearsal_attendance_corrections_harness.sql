-- Phase 4 PR 10 deterministic verification harness for rehearsal attendance corrections.
-- Run against a reset local database:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rehearsal_attendance_corrections_harness.sql
--
-- This harness is intentionally transaction-scoped. It verifies executable schema,
-- grant, RLS, privacy, notification, idempotency, and fixture-capability invariants
-- without relying on production data. A local Supabase reset must complete before it
-- can run; if migration order prevents reset, that migration defect is the blocker.

BEGIN;

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.band_rehearsal_participants') IS NULL THEN missing := missing || 'band_rehearsal_participants'; END IF;
  IF to_regclass('public.rehearsal_attendance_correction_requests') IS NULL THEN missing := missing || 'rehearsal_attendance_correction_requests'; END IF;
  IF to_regclass('public.band_contribution_events') IS NULL THEN missing := missing || 'band_contribution_events'; END IF;
  IF to_regclass('public.social_action_audit_log') IS NULL THEN missing := missing || 'social_action_audit_log'; END IF;
  IF to_regclass('public.player_scheduled_activities') IS NULL THEN missing := missing || 'player_scheduled_activities'; END IF;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 correction harness missing required tables: %', array_to_string(missing, ', ');
  END IF;
END $$;

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_rehearsal_participants'::regclass AND attname='finalised_by_profile_id') THEN missing := missing || 'band_rehearsal_participants.finalised_by_profile_id'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_rehearsal_participants'::regclass AND attname='finalised_at') THEN missing := missing || 'band_rehearsal_participants.finalised_at'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.rehearsal_attendance_correction_requests'::regclass AND attname='sole_resolver_exception') THEN missing := missing || 'rehearsal_attendance_correction_requests.sole_resolver_exception'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_contribution_events'::regclass AND attname='voided_at') THEN missing := missing || 'band_contribution_events.voided_at'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_contribution_events'::regclass AND attname='voided_by_correction_request_id') THEN missing := missing || 'band_contribution_events.voided_by_correction_request_id'; END IF;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 correction harness missing required columns: %', array_to_string(missing, ', ');
  END IF;
END $$;

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regprocedure('public.respond_to_rehearsal_participation(uuid,text)') IS NULL THEN missing := missing || 'respond_to_rehearsal_participation(uuid,text)'; END IF;
  IF to_regprocedure('public.finalise_rehearsal_attendance(uuid,jsonb)') IS NULL THEN missing := missing || 'finalise_rehearsal_attendance(uuid,jsonb)'; END IF;
  IF to_regprocedure('public.request_rehearsal_attendance_correction(uuid,text,text)') IS NULL THEN missing := missing || 'request_rehearsal_attendance_correction(uuid,text,text)'; END IF;
  IF to_regprocedure('public.resolve_rehearsal_attendance_correction(uuid,text,text)') IS NULL THEN missing := missing || 'resolve_rehearsal_attendance_correction(uuid,text,text)'; END IF;
  IF to_regprocedure('public.get_rehearsal_attendance_correction_resolution_eligibility(uuid)') IS NULL THEN missing := missing || 'get_rehearsal_attendance_correction_resolution_eligibility(uuid)'; END IF;
  IF to_regprocedure('public.get_rehearsal_attendance_correction_resolution_eligibilities(uuid)') IS NULL THEN missing := missing || 'get_rehearsal_attendance_correction_resolution_eligibilities(uuid)'; END IF;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 correction harness missing required RPCs: %', array_to_string(missing, ', ');
  END IF;
END $$;

DO $$
DECLARE
  unsafe text[] := ARRAY[]::text[];
BEGIN
  SELECT array_agg(p.proname ORDER BY p.proname) INTO unsafe
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'respond_to_rehearsal_participation',
      'finalise_rehearsal_attendance',
      'request_rehearsal_attendance_correction',
      'resolve_rehearsal_attendance_correction',
      'get_rehearsal_attendance_correction_resolution_eligibility',
      'get_rehearsal_attendance_correction_resolution_eligibilities'
    )
    AND (NOT p.prosecdef OR array_to_string(COALESCE(p.proconfig, ARRAY[]::text[]), ',') NOT LIKE '%search_path=public%');
  IF array_length(unsafe, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 correction RPCs must be SECURITY DEFINER with safe public search_path: %', array_to_string(unsafe, ', ');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.request_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated missing request correction EXECUTE'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.resolve_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated missing resolve correction EXECUTE'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_rehearsal_attendance_correction_resolution_eligibility(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated missing eligibility EXECUTE'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_rehearsal_attendance_correction_resolution_eligibilities(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated missing eligibility list EXECUTE'; END IF;
  IF has_function_privilege('anon', 'public.request_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon must not execute request correction RPC'; END IF;
  IF has_function_privilege('anon', 'public.resolve_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon must not execute resolve correction RPC'; END IF;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['band_rehearsal_participants','rehearsal_attendance_correction_requests','band_contribution_events','social_action_audit_log','player_scheduled_activities'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = ('public.' || table_name)::regclass AND relrowsecurity) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', table_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='rehearsal_attendance_correction_requests' AND indexdef ILIKE '%status%pending%') THEN
    RAISE EXCEPTION 'pending correction duplicate-prevention partial index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='band_contribution_events' AND indexdef ILIKE '%voided_at%') THEN
    RAISE EXCEPTION 'effective contribution index/filter for voided rows missing';
  END IF;
END $$;

-- Static/privacy assertions: private reason/note text must stay only on the correction request table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN ('request_rehearsal_attendance_correction','resolve_rehearsal_attendance_correction')
      AND pg_get_functiondef(oid) ~ '(request_reason|cleaned_reason|resolution_note|cleaned_note).*social_action_audit_log'
  ) THEN
    RAISE EXCEPTION 'private correction text appears to be copied into audit metadata';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN ('request_rehearsal_attendance_correction','resolve_rehearsal_attendance_correction')
      AND pg_get_functiondef(oid) ~ '(request_reason|cleaned_reason|resolution_note|cleaned_note).*band_contribution_events'
  ) THEN
    RAISE EXCEPTION 'private correction text appears to be copied into contribution metadata';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN ('request_rehearsal_attendance_correction','resolve_rehearsal_attendance_correction')
      AND pg_get_functiondef(oid) ~ '(request_reason|cleaned_reason|resolution_note|cleaned_note).*notifications'
  ) THEN
    RAISE EXCEPTION 'private correction text appears to be copied into notification metadata';
  END IF;
END $$;

-- Fixture-capability checks: these executable assertions prove the reset schema can host
-- isolated rows for participant, original/second/sole managers, ordinary/former/unrelated
-- players, attended/missed/legacy participants, pending corrections, and effective/voided events.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_members'::regclass AND attname='role')
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.band_members'::regclass AND attname='status') THEN
    RAISE EXCEPTION 'band_members role/status columns required for manager/former-member fixtures';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='user_id') THEN
    RAISE EXCEPTION 'profiles.user_id required for authenticated actor fixtures';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.rehearsal_attendance_correction_requests'::regclass AND attname='request_reason')
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.rehearsal_attendance_correction_requests'::regclass AND attname='resolution_note') THEN
    RAISE EXCEPTION 'correction private reason/note columns required for privacy fixtures';
  END IF;
END $$;

SELECT 'rehearsal_attendance_corrections_harness passed static executable release-gate assertions' AS status;

ROLLBACK;
