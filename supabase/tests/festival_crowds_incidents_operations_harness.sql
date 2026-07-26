\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE missing text[]; public_definition text;
BEGIN
 SELECT array_agg(name) INTO missing FROM unnest(ARRAY['festival_runtime_crowds','festival_runtime_stage_crowds','festival_runtime_crowd_movements','festival_runtime_weather','festival_runtime_incidents','festival_runtime_incident_actions','festival_runtime_incident_outcomes','festival_runtime_staff_outcomes','festival_runtime_supplier_outcomes','festival_runtime_sponsor_activations','festival_runtime_vendor_sales','festival_runtime_revenue_postings','festival_runtime_outcome_snapshots']) name WHERE to_regclass('public.'||name) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'missing Phase 8B tables: %',missing; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'festival_runtime_%' AND c.relname IN('festival_runtime_crowds','festival_runtime_stage_crowds','festival_runtime_incidents','festival_runtime_vendor_sales') AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'runtime operational RLS missing'; END IF;
 SELECT pg_get_functiondef('public.get_public_festival_live_experience(text)'::regprocedure) INTO public_definition;
 IF public_definition ~* 'private_operational_details|staff_outcomes|response_department' THEN RAISE EXCEPTION 'public experience leaks private operations'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_runtime_stage_crowds'::regclass AND pg_get_constraintdef(oid)~'current_crowd <= stage_capacity') THEN RAISE EXCEPTION 'stage capacity invariant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_runtime_vendor_sales'::regclass AND pg_get_constraintdef(oid)~'units_sold.*waste_units.*remaining_stock.*opening_stock') THEN RAISE EXCEPTION 'stock conservation invariant missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='festival_runtime_revenue_postings' AND indexdef LIKE '%UNIQUE%posting_key%') THEN RAISE EXCEPTION 'exactly-once revenue key missing'; END IF;
 IF has_function_privilege('authenticated','public.process_due_festival_runtime_jobs(uuid,integer)','EXECUTE') THEN RAISE EXCEPTION 'normal client can process runtime jobs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='finalise_festival_runtime_outcomes') THEN RAISE EXCEPTION 'final snapshot RPC missing'; END IF;
END$$;
-- Full fixture scenarios exercise deterministic replay, clashes, weather pressure,
-- authority, recovery, staff/supplier outcomes and lifecycle completion in CI after
-- the Phase 8A London fixture has prepared a runtime. This structural gate remains
-- safe to run against any freshly migrated database.
ROLLBACK;
