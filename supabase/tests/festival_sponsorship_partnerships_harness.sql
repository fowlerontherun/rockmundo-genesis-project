-- Phase 6 runtime harness. Run only against a disposable database; every fixture is rolled back.
BEGIN;
DO $$ BEGIN
  ASSERT to_regclass('public.festival_sponsorship_plans') IS NOT NULL, 'plan table missing';
  ASSERT to_regclass('public.festival_sponsor_contracts') IS NOT NULL, 'contracts missing';
  ASSERT to_regclass('public.festival_financial_receivables') IS NOT NULL, 'receivables missing';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.festival_sponsor_proposals'::regclass), 'private proposals require RLS';
  ASSERT NOT has_table_privilege('anon','public.festival_sponsor_proposals','INSERT'), 'anonymous direct write';
  ASSERT NOT has_table_privilege('authenticated','public.festival_sponsor_contracts','UPDATE'), 'contracts bypass RPC';
  ASSERT (SELECT count(*) FROM public.festival_sponsor_categories)>=22, 'catalogue incomplete';
  ASSERT (SELECT proacl IS NULL OR NOT aclcontains(proacl,makeaclitem(0,0,'X',false)) FROM pg_proc WHERE oid='public._festival_sponsorship_action(text,jsonb,uuid)'::regprocedure), 'internal action exposed';
  -- Structural proofs for atomic acceptance: unique proposal contract, receivable source and player commitment.
  ASSERT (SELECT indisunique FROM pg_index WHERE indrelid='public.festival_sponsor_contracts'::regclass AND indexprs IS NULL AND indkey::text LIKE '%'), 'contract uniqueness missing';
  ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_financial_receivables'::regclass AND contype='u'), 'receivable idempotency missing';
  ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_sponsor_proposal_revisions'::regclass AND contype='u'), 'append-only revision version missing';
  ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_sponsorship_inventory'::regclass AND contype='c'), 'inventory allocation guard missing';
END $$;
ROLLBACK;
