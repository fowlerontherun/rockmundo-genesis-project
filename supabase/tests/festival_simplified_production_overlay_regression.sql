-- Certify the post-bootstrap Festival production-parity overlay on a disposable DB.
\ir ../reconciliation/festival/20260822_simplified_festival_company_settlement_schema.sql
\ir ../reconciliation/festival/20260822_simplified_festival_company_effects.sql
\ir ../reconciliation/festival/20260822_simplified_festival_results_api.sql
\ir ../reconciliation/festival/20260822_festival_owner_functional_hotfixes.sql
\ir ../reconciliation/festival/20260822_festival_upgrade_cadence_rebalance.sql

DO $$
DECLARE
  result_rls boolean;
  trigger_deferred boolean;
  trigger_initially_deferred boolean;
  run_config text[];
  annual_plan_config text[];
  artist_begin_config text[];
  request_status_check text;
  annual_plan_definition text;
  upgrade_state_definition text;
  legacy_upgrade_window_definition text;
  canonical_upgrade_window_definition text;
  plan_next record;
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

  SELECT proconfig, pg_get_functiondef(oid)
  INTO annual_plan_config, annual_plan_definition
  FROM pg_proc
  WHERE oid = 'public.save_festival_edition_annual_plan(uuid,uuid,integer,jsonb,uuid)'::regprocedure;

  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(annual_plan_config, ARRAY[]::text[])) cfg
    WHERE cfg LIKE 'search_path=%extensions%'
  ) THEN
    RAISE EXCEPTION 'Festival annual Plan save cannot resolve pgcrypto';
  END IF;
  IF position('v_city_id' in annual_plan_definition) = 0
     OR position('city_id = v_city_id' in annual_plan_definition) = 0 THEN
    RAISE EXCEPTION 'Festival annual Plan save does not disambiguate city_id';
  END IF;

  SELECT proconfig INTO artist_begin_config
  FROM pg_proc
  WHERE oid = 'public._festival_artist_begin(uuid,text,text,uuid,uuid,jsonb)'::regprocedure;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(artist_begin_config, ARRAY[]::text[])) cfg
    WHERE cfg LIKE 'search_path=%extensions%'
  ) THEN
    RAISE EXCEPTION 'Festival artist idempotency helper cannot resolve pgcrypto';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO request_status_check
  FROM pg_constraint
  WHERE conrelid = 'public.festival_artist_plan_requests'::regclass
    AND conname = 'festival_artist_plan_requests_status_check';
  IF request_status_check IS NULL
     OR position('processing' in request_status_check) = 0
     OR position('succeeded' in request_status_check) = 0
     OR position('completed' in request_status_check) = 0 THEN
    RAISE EXCEPTION 'Festival artist request ledger rejects an active terminal status';
  END IF;

  FOR plan_next IN
    SELECT p.oid, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'plan_next_festival_edition'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(plan_next.proconfig, ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%extensions%'
    ) THEN
      RAISE EXCEPTION 'Festival plan-next overload % cannot resolve pgcrypto', plan_next.oid::regprocedure;
    END IF;
  END LOOP;

  SELECT pg_get_functiondef('public._festival_upgrade_state(uuid)'::regprocedure)
  INTO upgrade_state_definition;
  IF position('_festival_projection_currency' in upgrade_state_definition) = 0
     OR position('''currencyCode'', ''USD''' in upgrade_state_definition) > 0 THEN
    RAISE EXCEPTION 'Festival upgrades do not use the Festival home-city currency';
  END IF;

  SELECT pg_get_functiondef('public._festival_upgrade_window(uuid)'::regprocedure)
  INTO legacy_upgrade_window_definition;
  SELECT pg_get_functiondef('public._festival_upgrade_purchase_window(uuid,timestamptz)'::regprocedure)
  INTO canonical_upgrade_window_definition;

  IF position('''limit'', 20' in legacy_upgrade_window_definition) = 0
     OR position('used >= 20' in legacy_upgrade_window_definition) = 0
     OR position('''limit'', 20' in canonical_upgrade_window_definition) = 0
     OR position('used >= 20' in canonical_upgrade_window_definition) = 0
     OR position('interval ''30 days''' in legacy_upgrade_window_definition) = 0
     OR position('interval ''30 days''' in canonical_upgrade_window_definition) = 0 THEN
    RAISE EXCEPTION 'Festival upgrade cadence is not 20 purchases per rolling 30 days';
  END IF;
END;
$$;