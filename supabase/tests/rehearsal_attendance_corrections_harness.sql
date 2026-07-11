-- Phase 4 PR 09 deterministic verification harness for rehearsal attendance corrections.
-- Run against a reset local database: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rehearsal_attendance_corrections_harness.sql

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.band_rehearsal_participants') IS NULL THEN
    RAISE EXCEPTION 'band_rehearsal_participants missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.band_rehearsal_participants'::regclass AND attname = 'finalised_by_profile_id') THEN
    RAISE EXCEPTION 'finalised_by_profile_id missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.band_rehearsal_participants'::regclass AND attname = 'finalised_at') THEN
    RAISE EXCEPTION 'finalised_at missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_rehearsal_attendance_correction_resolution_eligibility') THEN
    RAISE EXCEPTION 'eligibility RPC missing';
  END IF;
END $$;

-- Static/privacy assertions: sensitive reason/note text must stay off audit and notification metadata by convention.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname IN ('request_rehearsal_attendance_correction','resolve_rehearsal_attendance_correction')
      AND pg_get_functiondef(oid) ~ 'request_reason.*social_action_audit_log|resolution_note.*band_contribution_events'
  ) THEN
    RAISE EXCEPTION 'private correction text appears to be copied into audit/contribution metadata';
  END IF;
END $$;

SELECT has_function_privilege('authenticated', 'public.request_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') AS request_rpc_granted,
       has_function_privilege('authenticated', 'public.resolve_rehearsal_attendance_correction(uuid,text,text)', 'EXECUTE') AS resolve_rpc_granted,
       has_function_privilege('authenticated', 'public.get_rehearsal_attendance_correction_resolution_eligibility(uuid)', 'EXECUTE') AS eligibility_rpc_granted,
       has_function_privilege('authenticated', 'public.get_rehearsal_attendance_correction_resolution_eligibilities(uuid)', 'EXECUTE') AS eligibility_list_rpc_granted;

ROLLBACK;
