-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_stabilisation_harness.sql
DO $$
BEGIN
  IF to_regclass('public.festival_operation_migration_issues') IS NULL THEN RAISE EXCEPTION 'migration issues table missing'; END IF;
  IF to_regprocedure('public.resolve_festival_stage_legacy_domain(uuid)') IS NULL THEN RAISE EXCEPTION 'stage legacy resolver missing'; END IF;
  IF to_regprocedure('public.enforce_festival_stage_slot_consistency()') IS NULL THEN RAISE EXCEPTION 'slot consistency trigger function missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.festival_expense_ledger'::regclass AND a.attname='currency_code' AND pg_get_expr(d.adbin,d.adrelid) LIKE '%USD%') THEN RAISE EXCEPTION 'ledger currency must not default to USD'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='festival_expense_ledger_category_check') THEN RAISE EXCEPTION 'ledger category check missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='festival_stage_slot_consistency_trg') THEN RAISE EXCEPTION 'slot consistency trigger missing'; END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.resolve_festival_stage_edition(uuid)') IS NULL THEN RAISE EXCEPTION 'canonical stage edition resolver missing'; END IF;
  IF to_regprocedure('public.festival_settlement_report(uuid)') IS NULL THEN RAISE EXCEPTION 'safe settlement report RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='festival_edition_settlement_readiness') THEN RAISE EXCEPTION 'settlement readiness projection missing'; END IF;
END $$;
