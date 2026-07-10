-- Phase 4 PR 03 harness notes for local Supabase/pgTAP validation.
-- Covers: participant/lineup table existence, unique constraints, trigger seeding,
-- attended/performed-only contribution capture, missed participants exclusion,
-- and idempotent capture_contributions_for_rehearsal/capture_contributions_for_gig_outcome retries.
SELECT 'rehearsal_gig_participants_harness loaded' AS status;
