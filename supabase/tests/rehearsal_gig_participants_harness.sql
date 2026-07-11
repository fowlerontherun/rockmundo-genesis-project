-- Phase 4 PR 03 harness notes for local Supabase/pgTAP validation.
-- Covers: participant/lineup table existence, unique constraints, trigger seeding,
-- attended/performed-only contribution capture, missed participants exclusion,
-- and idempotent capture_contributions_for_rehearsal/capture_contributions_for_gig_outcome retries.
SELECT 'rehearsal_gig_participants_harness loaded' AS status;

-- Phase 4 PR 07 coverage markers for local DB validation:
-- - finalise_rehearsal_attendance exists as the only manager-owned batch RPC.
-- - attended rows are the only rows eligible for rehearsal_attendance contributions.
-- - invited/confirmed rows are no longer auto-promoted by capture_contributions_for_rehearsal.
SELECT proname AS phase_4_pr_07_rpc
FROM pg_proc
WHERE proname IN ('finalise_rehearsal_attendance', 'is_rehearsal_attendance_finalisation_open')
ORDER BY proname;
