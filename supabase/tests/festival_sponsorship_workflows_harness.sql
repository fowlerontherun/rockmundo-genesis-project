-- Phase 6B structural/runtime invariants. Execute only in a disposable database.
BEGIN;
DO $$ BEGIN
 ASSERT to_regprocedure('public.submit_festival_sponsor_application(jsonb,uuid)') IS NOT NULL;
 ASSERT to_regprocedure('public.respond_to_festival_sponsor_proposal(jsonb,uuid)') IS NOT NULL;
 ASSERT to_regprocedure('public.cancel_festival_sponsor_contract(jsonb,uuid)') IS NOT NULL;
 ASSERT NOT has_function_privilege('authenticated','public._festival_sponsorship_begin_action(uuid,text,uuid,uuid,jsonb)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.festival_sponsor_proposals','INSERT');
 ASSERT EXISTS(SELECT 1 FROM pg_index WHERE indrelid='public.festival_sponsor_contracts'::regclass AND indisunique), 'one contract per accepted proposal';
 ASSERT EXISTS(SELECT 1 FROM pg_index WHERE indrelid='public.festival_sponsor_company_commitments'::regclass AND indisunique), 'one player commitment per contract';
 ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_sponsorship_inventory'::regclass AND contype='c'), 'inventory over-allocation guard';
 ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_sponsor_proposal_revisions'::regclass AND contype='u'), 'append-only revision identity';
 ASSERT (SELECT proconfig @> ARRAY['search_path='] FROM pg_proc WHERE oid='public.respond_to_festival_sponsor_proposal(jsonb,uuid)'::regprocedure), 'acceptance search path';
END $$;
-- Transactional scenarios require canonical authenticated fixtures; deliberately rollback all caller-provided fixtures.
ROLLBACK;
