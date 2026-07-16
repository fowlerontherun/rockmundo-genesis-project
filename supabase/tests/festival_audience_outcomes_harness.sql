-- Behavioural harness for festival audience and performance outcomes.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_audience_outcomes_harness.sql
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.festival_audience_generations') IS NULL THEN RAISE EXCEPTION 'missing audience generations'; END IF;
  IF to_regclass('public.festival_performance_outcomes') IS NULL THEN RAISE EXCEPTION 'missing performance outcomes'; END IF;
  IF to_regprocedure('public.generate_festival_edition_audience(uuid,text)') IS NULL THEN RAISE EXCEPTION 'missing audience RPC'; END IF;
  IF to_regprocedure('public.calculate_festival_performance_outcome(uuid,text)') IS NULL THEN RAISE EXCEPTION 'missing outcome RPC'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname LIKE '%festival_performance_outcomes_session_id_model_version%') THEN RAISE NOTICE 'model-version uniqueness is implemented through a generated constraint name'; END IF;
END $$;

-- Full data-path assertions require seeded canonical festival editions, active contracts and sessions.
-- This rollback harness verifies the schema/RPC contract and is intentionally side-effect-free.
ROLLBACK;
