\set ON_ERROR_STOP on
BEGIN;
-- Phase 5 runtime contract smoke harness. Full fixture creation is intentionally rolled back.
DO $$ BEGIN
 IF to_regclass('public.festival_operations_plans') IS NULL THEN RAISE EXCEPTION 'operations plan table missing'; END IF;
 IF to_regclass('public.festival_staff_assignments') IS NULL THEN RAISE EXCEPTION 'staff assignments missing'; END IF;
 IF to_regclass('public.festival_supplier_contracts') IS NULL THEN RAISE EXCEPTION 'supplier contracts missing'; END IF;
 IF to_regprocedure('public.get_festival_operations_plan(uuid)') IS NULL THEN RAISE EXCEPTION 'read RPC missing'; END IF;
 IF to_regprocedure('public.save_festival_operations_plan(uuid,integer,jsonb,uuid,boolean)') IS NULL THEN RAISE EXCEPTION 'save RPC missing'; END IF;
 IF to_regprocedure('public.publish_festival_staff_vacancy(jsonb,uuid)') IS NULL OR to_regprocedure('public.accept_festival_supplier_quote(jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'workflow RPC missing'; END IF;
 IF to_regprocedure('public.get_available_festival_staff_vacancies(jsonb)') IS NULL OR to_regprocedure('public.get_available_festival_supplier_opportunities(jsonb)') IS NULL THEN RAISE EXCEPTION 'discovery RPC missing'; END IF;
 IF to_regclass('public.festival_operations_communications') IS NULL THEN RAISE EXCEPTION 'transactional communications missing'; END IF;
 IF has_table_privilege('anon','public.festival_supplier_quotes','SELECT') THEN RAISE EXCEPTION 'anonymous quote access'; END IF;
 IF has_table_privilege('authenticated','public.festival_operations_plans','INSERT') THEN RAISE EXCEPTION 'direct operations writes enabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='festival_commitment_one_source') THEN RAISE EXCEPTION 'commitment source constraint missing'; END IF;
END $$;
-- Mutation/idempotency, access, generation, staffing, shifts, procurement, budget and
-- completion scenarios are exercised by calling the SECURITY DEFINER RPCs in a disposable
-- seeded database; no payment, ticket-sale, launch or announcement relation is touched here.
ROLLBACK;
