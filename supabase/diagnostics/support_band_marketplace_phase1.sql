-- Support Band Marketplace Phase 1 deployment diagnostics.
-- Read-only: safe to run in Supabase SQL editor after applying migrations.

WITH expected_tables(name) AS (
  VALUES
    ('band_support_preferences'),
    ('band_support_availability'),
    ('gig_support_slots')
)
SELECT
  'table' AS object_type,
  e.name AS object_name,
  (to_regclass('public.' || e.name) IS NOT NULL) AS present
FROM expected_tables e

UNION ALL

SELECT
  'function' AS object_type,
  p.proname AS object_name,
  true AS present
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_band_support_preferences',
    'add_band_support_availability',
    'find_available_support_bands'
  )

UNION ALL

SELECT
  'index' AS object_type,
  i.indexname AS object_name,
  true AS present
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.indexname IN (
    'band_support_availability_lookup_idx',
    'band_support_availability_band_idx',
    'gig_support_slots_one_confirmed_per_gig_uidx',
    'gig_support_slots_band_status_idx'
  )
ORDER BY object_type, object_name;

-- Confirm RLS is enabled on all three new tables.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'band_support_preferences',
    'band_support_availability',
    'gig_support_slots'
  )
ORDER BY c.relname;

-- Review policies installed for the feature.
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'band_support_preferences',
    'band_support_availability',
    'gig_support_slots'
  )
ORDER BY tablename, policyname;

-- Confirm the one-confirmed-support-per-gig partial unique index definition.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'gig_support_slots_one_confirmed_per_gig_uidx';
