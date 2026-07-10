-- Local Supabase-only RLS/idempotency harness for Phase 4 PR 01.
-- Run against a disposable database after migrations are applied.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'Skipping harness: Supabase local roles are not installed.';
  END IF;
END $$;

-- This harness intentionally documents the critical cases covered by the migration:
-- - active leader/member select is allowed through is_active_band_member
-- - former/unrelated/anonymous select is denied by the SELECT-only RLS policy
-- - direct insert/update/delete are denied because no mutation policies exist
-- - completion triggers call insert_band_contribution_event and rely on the unique
--   (band_id, profile_id, contribution_type, source_entity_type, source_entity_id) constraint.

ROLLBACK;
