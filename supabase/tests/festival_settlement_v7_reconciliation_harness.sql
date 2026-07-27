\set ON_ERROR_STOP on
BEGIN;
DO $fixture$
DECLARE definition text; final_gate text; required text;
BEGIN
 IF to_regclass('public.festival_settlement_reconciliation_reports') IS NULL THEN RAISE EXCEPTION 'reconciliation report table missing'; END IF;
 IF to_regprocedure('public._festival_settlement_reconciliation_v7(uuid,boolean)') IS NULL THEN RAISE EXCEPTION 'reconciliation engine missing'; END IF;
 IF to_regprocedure('public.diagnose_festival_settlements(boolean)') IS NULL THEN RAISE EXCEPTION 'historical diagnostic API missing'; END IF;
 SELECT pg_get_functiondef('public._festival_settlement_reconciliation_v7(uuid,boolean)'::regprocedure) INTO definition;
 FOREACH required IN ARRAY ARRAY['festival_settlement_duplicate_obligation','festival_settlement_currency_mismatch',
  'festival_settlement_payable_evidence_missing','festival_settlement_negative_calculation','festival_contract_invalid',
  'festival_royalty_reconciliation_failed','festival_tax_reconciliation_failed','festival_band_split_invalid',
  'festival_settlement_totals_mismatch','festival_receipt_or_ledger_reconciliation_failed'] LOOP
  IF position(required IN definition)=0 THEN RAISE EXCEPTION 'reconciliation omits %',required; END IF;
 END LOOP;
 SELECT pg_get_functiondef('public._festival_assert_reconciled_v7()'::regprocedure) INTO final_gate;
 IF final_gate !~ 'review_snapshot_id IS NULL' OR final_gate !~ 'final_snapshot_id IS NULL'
  OR final_gate !~ 'festival_settlement_effect_receipts' OR final_gate !~ 'calculation_digest IS NULL'
 THEN RAISE EXCEPTION 'finalisation verification is incomplete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='festival_settlement_reconciliation_gate_v7' AND tgenabled<>'D')
 THEN RAISE EXCEPTION 'calculated/finalised reconciliation gate missing'; END IF;
 IF has_table_privilege('authenticated','public.festival_settlement_reconciliation_reports','INSERT')
 THEN RAISE EXCEPTION 'reconciliation reports permit untrusted writes'; END IF;
END $fixture$;
ROLLBACK;
