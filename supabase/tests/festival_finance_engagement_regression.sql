-- Apply and certify the Sep 3 Festival settlement parity extensions.
\ir ../reconciliation/festival/20260903_festival_finance_engagement_authority.sql
\ir ../reconciliation/festival/20260903_festival_finance_engagement_results_api.sql

DO $$
DECLARE
  v_finance_rls boolean;
  v_engagement_rls boolean;
  v_finance_unique text;
  v_public_definition text;
  v_owner_definition text;
  v_c8_trigger_name text;
  v_owner_trigger_name text;
BEGIN
  IF to_regclass('public.festival_simplified_finance_ledger') IS NULL
     OR to_regclass('public.festival_owner_engagement_applications') IS NULL THEN
    RAISE EXCEPTION 'Festival settlement reconciliation tables are missing';
  END IF;

  SELECT relrowsecurity INTO v_finance_rls
  FROM pg_class WHERE oid='public.festival_simplified_finance_ledger'::regclass;
  SELECT relrowsecurity INTO v_engagement_rls
  FROM pg_class WHERE oid='public.festival_owner_engagement_applications'::regclass;
  IF v_finance_rls IS NOT TRUE OR v_engagement_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'Festival finance/engagement reconciliation tables must have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid IN (
      'public.festival_simplified_finance_ledger'::regclass,
      'public.festival_owner_engagement_applications'::regclass
    )
  ) THEN
    RAISE EXCEPTION 'Festival settlement reconciliation tables must not expose direct browser policies';
  END IF;

  IF to_regprocedure('public._freeze_simplified_festival_finance_ledger(uuid)') IS NULL
     OR to_regprocedure('public._try_finalise_festival_owner_engagement(uuid)') IS NULL
     OR to_regprocedure('public._festival_finalise_owner_engagement_on_attendance_terminal()') IS NULL THEN
    RAISE EXCEPTION 'Festival settlement reconciliation helpers are incomplete';
  END IF;

  IF has_function_privilege('anon','public._freeze_simplified_festival_finance_ledger(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public._freeze_simplified_festival_finance_ledger(uuid)','EXECUTE')
     OR has_function_privilege('anon','public._try_finalise_festival_owner_engagement(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public._try_finalise_festival_owner_engagement(uuid)','EXECUTE')
     OR has_function_privilege('anon','public._festival_finalise_owner_engagement_on_attendance_terminal()','EXECUTE')
     OR has_function_privilege('authenticated','public._festival_finalise_owner_engagement_on_attendance_terminal()','EXECUTE') THEN
    RAISE EXCEPTION 'Internal Festival finance/engagement helpers are exposed to browser roles';
  END IF;

  IF NOT has_function_privilege('authenticated','public.get_festival_edition_results(uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.get_festival_edition_results(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Owner Festival Results privilege boundary is incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='festival_simplified_edition_results'
      AND column_name='finance_ledger_frozen_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='festival_simplified_edition_results'
      AND column_name='engagement_finalised_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='festival_simplified_edition_results'
      AND column_name='real_attendance_signal'
  ) THEN
    RAISE EXCEPTION 'Festival result finance/engagement evidence columns are missing';
  END IF;

  SELECT indexdef INTO v_finance_unique
  FROM pg_indexes
  WHERE schemaname='public'
    AND tablename='festival_simplified_finance_ledger'
    AND indexdef ILIKE '%UNIQUE%festival_result_id%line_key%'
  LIMIT 1;
  IF v_finance_unique IS NULL THEN
    RAISE EXCEPTION 'Festival finance ledger does not enforce one line per result/key';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.festival_player_attendance'::regclass
      AND tgname='zz_festival_finalise_owner_engagement'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Festival attendee terminal-state progression trigger is missing';
  END IF;

  SELECT tgname INTO v_c8_trigger_name
  FROM pg_trigger
  WHERE tgrelid='public.festival_player_attendance'::regclass
    AND tgname='festival_c8_settle_on_attendance_exit'
    AND NOT tgisinternal;
  SELECT tgname INTO v_owner_trigger_name
  FROM pg_trigger
  WHERE tgrelid='public.festival_player_attendance'::regclass
    AND tgname='zz_festival_finalise_owner_engagement'
    AND NOT tgisinternal;
  IF v_c8_trigger_name IS NULL OR v_owner_trigger_name IS NULL
     OR v_c8_trigger_name >= v_owner_trigger_name THEN
    RAISE EXCEPTION 'Festival owner engagement must finalise after C8 attendee settlement';
  END IF;

  v_public_definition:=pg_get_functiondef('public.get_public_festival_edition_history(uuid)'::regprocedure);
  v_owner_definition:=pg_get_functiondef('public.get_festival_edition_results(uuid,uuid)'::regprocedure);

  IF position('financials' in v_public_definition)>0
     OR position('ticketRevenueMinor' in v_public_definition)>0
     OR position('netProfitMinor' in v_public_definition)>0
     OR position('balanceBeforeMinor' in v_public_definition)>0 THEN
    RAISE EXCEPTION 'Public Festival history leaks private financial settlement values';
  END IF;

  IF position('ledgerReconciled' in v_owner_definition)=0
     OR position('engagementReputationBonus' in v_owner_definition)=0
     OR position('realAttendance' in v_owner_definition)=0 THEN
    RAISE EXCEPTION 'Owner Festival Results omit finance/real-attendance settlement evidence';
  END IF;

  IF position('ticketCountUsed' in pg_get_functiondef('public._try_finalise_festival_owner_engagement(uuid)'::regprocedure))=0
     OR position("'ticketCountUsed',false" in replace(pg_get_functiondef('public._try_finalise_festival_owner_engagement(uuid)'::regprocedure),' ',''))=0 THEN
    RAISE EXCEPTION 'Festival real-attendance progression does not explicitly exclude raw ticket count';
  END IF;
END;
$$;
