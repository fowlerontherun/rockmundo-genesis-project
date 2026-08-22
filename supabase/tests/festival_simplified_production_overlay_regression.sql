-- Certify the post-bootstrap Festival production-parity overlay on a disposable DB.
\ir ../reconciliation/festival/20260822_simplified_festival_company_settlement_schema.sql
\ir ../reconciliation/festival/20260822_simplified_festival_company_effects.sql
\ir ../reconciliation/festival/20260822_simplified_festival_results_api.sql

DO $$
DECLARE
  result_rls boolean;
  trigger_deferred boolean;
  trigger_initially_deferred boolean;
  run_config text[];
BEGIN
  IF to_regclass('public.festival_simplified_edition_results') IS NULL THEN
    RAISE EXCEPTION 'festival_simplified_edition_results is missing';
  END IF;

  SELECT relrowsecurity INTO result_rls
  FROM pg_class
  WHERE oid = 'public.festival_simplified_edition_results'::regclass;
  IF result_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'festival_simplified_edition_results must have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.festival_simplified_edition_results'::regclass
  ) THEN
    RAISE EXCEPTION 'simplified Festival results must not expose direct row policies';
  END IF;

  SELECT tgdeferrable, tginitdeferred
  INTO trigger_deferred, trigger_initially_deferred
  FROM pg_trigger
  WHERE tgrelid = 'public.festival_runtime_completion_digests'::regclass
    AND tgname = 'festival_auto_settle_simplified_runtime'
    AND NOT tgisinternal;

  IF trigger_deferred IS NOT TRUE OR trigger_initially_deferred IS NOT TRUE THEN
    RAISE EXCEPTION 'simplified Festival result finalisation trigger must be deferred';
  END IF;

  IF to_regprocedure('public._complete_simplified_festival_settlement(uuid)') IS NULL
     OR to_regprocedure('public.get_public_festival_edition_history(uuid)') IS NULL
     OR to_regprocedure('public.get_festival_edition_results(uuid,uuid)') IS NULL
     OR to_regprocedure('public._apply_simplified_festival_company_effects(uuid)') IS NULL THEN
    RAISE EXCEPTION 'simplified Festival Results boundary is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_simplified_edition_results'
      AND column_name = 'settlement_applied_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_simplified_edition_results'
      AND column_name = 'company_transaction_id'
  ) THEN
    RAISE EXCEPTION 'simplified Festival company settlement audit columns are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.festival_simplified_edition_results'::regclass
      AND tgname = 'festival_apply_simplified_company_effects'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'automatic simplified Festival company settlement trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_company_transactions_simplified_festival_result'
  ) THEN
    RAISE EXCEPTION 'simplified Festival company settlement idempotency index is missing';
  END IF;

  IF has_function_privilege('anon', 'public._complete_simplified_festival_settlement(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._complete_simplified_festival_settlement(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._festival_auto_settle_simplified_runtime()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._festival_auto_settle_simplified_runtime()', 'EXECUTE')
     OR has_function_privilege('anon', 'public._apply_simplified_festival_company_effects(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._apply_simplified_festival_company_effects(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._festival_apply_simplified_company_effects_trigger()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._festival_apply_simplified_company_effects_trigger()', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal simplified Festival settlement helpers are exposed';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_public_festival_edition_history(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_festival_edition_results(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_festival_edition_results(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Festival Results RPC privileges are incorrect';
  END IF;

  IF position('totalRevenueMinor' in pg_get_functiondef('public.get_public_festival_edition_history(uuid)'::regprocedure)) > 0
     OR position('netProfitMinor' in pg_get_functiondef('public.get_public_festival_edition_history(uuid)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'public Festival history leaks private financial values';
  END IF;

  IF position('netProfitMinor' in pg_get_functiondef('public.get_festival_edition_results(uuid,uuid)'::regprocedure)) = 0
     OR position('companyImpact' in pg_get_functiondef('public.get_festival_edition_results(uuid,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'owner Festival Results RPC omits financial/company impact';
  END IF;

  IF to_regprocedure('public._run_simplified_festival_edition_v1(uuid,uuid,integer,uuid)') IS NOT NULL THEN
    SELECT proconfig INTO run_config
    FROM pg_proc
    WHERE oid = 'public._run_simplified_festival_edition_v1(uuid,uuid,integer,uuid)'::regprocedure;
    IF NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(run_config, ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%extensions%'
    ) THEN
      RAISE EXCEPTION 'simplified Festival v1 Run function cannot resolve pgcrypto';
    END IF;
  END IF;
END;
$$;
