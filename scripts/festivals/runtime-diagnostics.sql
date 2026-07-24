\pset pager off
\pset tuples_only off
\pset format aligned
SET ROLE service_role;
DO $$
DECLARE
  item record;
BEGIN
  RAISE NOTICE 'festival runtime diagnostics begin';
  IF to_regclass('festival_test.runs') IS NULL THEN
    RAISE NOTICE 'festival_test.runs table missing - migration incomplete';
  ELSE
    RAISE NOTICE 'festival_test.runs table present';
  END IF;
  IF to_regprocedure('festival_test.cleanup_run(text)') IS NULL THEN
    RAISE NOTICE 'festival_test.cleanup_run(text) function missing - migration incomplete';
  ELSE
    RAISE NOTICE 'festival_test.cleanup_run(text) function present';
  END IF;
  IF to_regprocedure('public.found_festival_company(text,text,text,text)') IS NULL THEN
    RAISE NOTICE 'public.found_festival_company(text,text,text,text) function missing - migration incomplete';
  ELSE
    RAISE NOTICE 'public.found_festival_company(text,text,text,text) function present';
  END IF;
  FOR item IN SELECT unnest(ARRAY[
    'public.companies','public.festival_companies','public.company_shareholders',
    'public.festival_company_founding_requests','public.festival_company_audit_log',
    'public.financial_transactions','public.financial_ledger_entries','public.company_transactions'
  ]) AS rel
  LOOP
    IF to_regclass(item.rel) IS NULL THEN
      RAISE NOTICE '% table missing - migration incomplete', item.rel;
    ELSE
      RAISE NOTICE '% table present', item.rel;
    END IF;
  END LOOP;
END $$;
DO $$
BEGIN
  IF to_regclass('festival_test.runs') IS NOT NULL THEN
    EXECUTE 'SELECT run_id, mode, pause_after_lock, fail_after_extension, fail_after_debit, reached_pause_at IS NOT NULL AS reached_pause, second_started_at IS NOT NULL AS second_started, release_after_lock, expires_at > now() AS unexpired FROM festival_test.runs ORDER BY created_at DESC LIMIT 10';
  END IF;
END $$;
