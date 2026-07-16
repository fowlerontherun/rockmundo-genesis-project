BEGIN;

SELECT has_function_privilege('authenticated', 'public.prepare_festival_edition_settlement(uuid,text,text,text)', 'EXECUTE') AS prepare_granted;
SELECT has_function_privilege('authenticated', 'public.apply_festival_settlement_batch(uuid,text)', 'EXECUTE') AS apply_granted;
SELECT has_function_privilege('authenticated', 'public.reconcile_festival_edition_settlement(uuid)', 'EXECUTE') AS reconcile_granted;

SELECT to_regclass('public.festival_edition_settlements') IS NOT NULL AS settlement_table_exists;
SELECT to_regclass('public.festival_effect_applications') IS NOT NULL AS effect_application_table_exists;
SELECT to_regclass('public.festival_contract_settlement_instructions') IS NOT NULL AS contract_instruction_table_exists;
SELECT to_regclass('public.festival_edition_financial_results') IS NOT NULL AS financial_results_table_exists;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='festival_edition_settlements_one_current_idx') THEN
    RAISE EXCEPTION 'one current settlement index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='festival_effect_applications_once_idx') THEN
    RAISE EXCEPTION 'effect idempotency index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='festival_fan_conversion_once_idx') THEN
    RAISE EXCEPTION 'fan conversion idempotency index missing';
  END IF;
END $$;

ROLLBACK;
