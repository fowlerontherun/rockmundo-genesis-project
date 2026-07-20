-- Festival admin catalogue warning-array contract harness.
-- Run with: supabase db reset && psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_admin_catalogue_warning_arrays_harness.sql
-- Verifies the SQL construction used by admin_festival_catalogue() returns dense arrays.

BEGIN;
CREATE SCHEMA IF NOT EXISTS test_festival_admin_catalogue_warnings;
CREATE OR REPLACE FUNCTION test_festival_admin_catalogue_warnings.assert_jsonb_eq(label text, actual jsonb, expected jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'assertion failed: %, expected %, got %', label, expected, actual;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION test_festival_admin_catalogue_warnings.assert_true(label text, actual boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'assertion failed: %', label;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION test_festival_admin_catalogue_warnings.warning_array(has_edition boolean, has_stage boolean, legacy_mappings integer)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(jsonb_agg(w.warning), '[]'::jsonb)
  FROM (VALUES
    (CASE WHEN NOT has_edition THEN jsonb_build_object('code','brand_without_edition','severity','blocker','message','Brand has no canonical edition') END),
    (CASE WHEN has_edition AND NOT has_stage THEN jsonb_build_object('code','edition_without_stages','severity','warning','message','Selected edition has no edition-scoped stages') END),
    (CASE WHEN legacy_mappings > 1 THEN jsonb_build_object('code','duplicate_legacy_mapping','severity','warning','message','Multiple legacy mappings need review') END)
  ) AS w(warning)
  WHERE w.warning IS NOT NULL
$$;

DO $$
DECLARE
  no_warnings jsonb;
  one_warning jsonb;
  multiple_warnings jsonb;
  function_sql text;
BEGIN
  no_warnings := test_festival_admin_catalogue_warnings.warning_array(true, true, 0);
  one_warning := test_festival_admin_catalogue_warnings.warning_array(true, false, 0);
  multiple_warnings := test_festival_admin_catalogue_warnings.warning_array(true, false, 2);

  PERFORM test_festival_admin_catalogue_warnings.assert_jsonb_eq('no warnings returns empty array', no_warnings, '[]'::jsonb);
  PERFORM test_festival_admin_catalogue_warnings.assert_jsonb_eq('one warning returns one dense object', one_warning, jsonb_build_array(jsonb_build_object('code','edition_without_stages','severity','warning','message','Selected edition has no edition-scoped stages')));
  PERFORM test_festival_admin_catalogue_warnings.assert_jsonb_eq('multiple warnings returns dense objects', multiple_warnings, jsonb_build_array(jsonb_build_object('code','edition_without_stages','severity','warning','message','Selected edition has no edition-scoped stages'), jsonb_build_object('code','duplicate_legacy_mapping','severity','warning','message','Multiple legacy mappings need review')));

  PERFORM test_festival_admin_catalogue_warnings.assert_true('no warnings result is not null', no_warnings IS NOT NULL);
  PERFORM test_festival_admin_catalogue_warnings.assert_true('one warning has no null elements', NOT one_warning @> '[null]'::jsonb);
  PERFORM test_festival_admin_catalogue_warnings.assert_true('multiple warnings has no null elements', NOT multiple_warnings @> '[null]'::jsonb);

  SELECT pg_get_functiondef('public.admin_festival_catalogue()'::regprocedure) INTO function_sql;
  PERFORM test_festival_admin_catalogue_warnings.assert_true('catalogue filters null warning rows', position('WHERE w.warning IS NOT NULL' in function_sql) > 0 OR position('FILTER (WHERE w.warning IS NOT NULL)' in function_sql) > 0);
  PERFORM test_festival_admin_catalogue_warnings.assert_true('catalogue uses jsonb_agg for warning rows', position('jsonb_agg(w.warning)' in function_sql) > 0);
  PERFORM test_festival_admin_catalogue_warnings.assert_true('catalogue defaults empty warning collections to []', position('''[]''::jsonb' in function_sql) > 0);
END $$;

ROLLBACK;
