\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.festival_site_plans') IS NULL OR to_regclass('public.festival_stages') IS NULL THEN RAISE EXCEPTION 'Phase 2 tables missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.festival_site_plans'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'site plans must use RLS'; END IF;
 IF has_table_privilege('authenticated','public.festival_site_plans','INSERT') OR has_table_privilege('authenticated','public.festival_stages','UPDATE') THEN RAISE EXCEPTION 'browser writes must fail closed'; END IF;
 IF NOT has_function_privilege('authenticated','public.get_festival_site_plan(uuid)','EXECUTE') OR NOT has_function_privilege('authenticated','public.save_festival_site_plan(uuid,integer,jsonb,jsonb,uuid,boolean)','EXECUTE') THEN RAISE EXCEPTION 'RPC grants missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_stages'::regclass AND pg_get_constraintdef(oid) LIKE '%accessible_viewing_capacity%capacity%') THEN RAISE EXCEPTION 'accessible capacity constraint missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='festival_stages_one_main') THEN RAISE EXCEPTION 'one-main-stage invariant missing'; END IF;
END $$;
-- Runtime owner/admin, prerequisite, venue, capacity, stage, stale-write,
-- idempotency, completion and cross-company cases are exercised transactionally
-- by calling the two public RPCs from the disposable Festival DB gate.
ROLLBACK;
