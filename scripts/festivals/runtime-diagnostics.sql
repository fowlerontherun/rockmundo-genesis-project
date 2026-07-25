\pset pager off
\pset tuples_only on
\pset format unaligned
SET ROLE service_role;
SELECT jsonb_build_object(
  'festivalTestRunsExists',to_regclass('festival_test.runs') IS NOT NULL,
  'cleanupFunctionExists',to_regprocedure('festival_test.cleanup_run(text)') IS NOT NULL,
  'foundingFunctionExists',to_regprocedure('public.found_festival_company(text,text,text,text)') IS NOT NULL,
  'migrationStatus',CASE WHEN to_regclass('festival_test.runs') IS NOT NULL AND to_regprocedure('festival_test.cleanup_run(text)') IS NOT NULL THEN 'runtime-migrations-present' ELSE 'runtime-migrations-incomplete' END,
  'tables',jsonb_build_object(
    'companies',to_regclass('public.companies') IS NOT NULL,
    'festivalCompanies',to_regclass('public.festival_companies') IS NOT NULL,
    'foundingRequests',to_regclass('public.festival_company_founding_requests') IS NOT NULL,
    'auditLog',to_regclass('public.festival_company_audit_log') IS NOT NULL,
    'financialTransactions',to_regclass('public.financial_transactions') IS NOT NULL,
    'ledgerEntries',to_regclass('public.financial_ledger_entries') IS NOT NULL
  )
)::text AS festival_runtime_diagnostic;

-- Generate top-level statements so their rows are visible. Each statement is guarded
-- independently and therefore remains useful on a partially migrated database.
SELECT CASE WHEN to_regclass('festival_test.runs') IS NULL
 THEN $$SELECT '{"latestRunStates":[],"note":"festival_test.runs missing"}'::jsonb::text AS latest_run_states$$
 ELSE $$SELECT jsonb_build_object('latestRunStates',coalesce(jsonb_agg(jsonb_build_object(
   'runId',run_id,'mode',mode,'reachedPause',reached_pause_at IS NOT NULL,
   'secondStarted',second_started_at IS NOT NULL,'released',release_after_lock,
   'unexpired',expires_at>now()) ORDER BY created_at DESC),'[]'::jsonb))::text
 FROM (SELECT * FROM festival_test.runs ORDER BY created_at DESC LIMIT 10) r$$ END
\gexec

SELECT CASE WHEN to_regclass('public.festival_company_founding_requests') IS NULL
 THEN $$SELECT '{"runtimeFixtureCounts":{"foundingRequests":null},"note":"founding requests table missing"}'::jsonb::text$$
 ELSE $$SELECT jsonb_build_object('runtimeFixtureCounts',jsonb_build_object(
   'foundingRequests',count(*) FILTER (WHERE idempotency_key LIKE 'runtime-%' OR idempotency_key LIKE 'frt-%'),
   'succeeded',count(*) FILTER (WHERE (idempotency_key LIKE 'runtime-%' OR idempotency_key LIKE 'frt-%') AND status='succeeded')))::text
 FROM public.festival_company_founding_requests$$ END
\gexec

SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
 THEN $$SELECT '{"migrationVersions":[],"note":"migration history missing"}'::jsonb::text$$
 ELSE $$SELECT jsonb_build_object('migrationVersions',coalesce(jsonb_agg(version ORDER BY version DESC),'[]'::jsonb))::text FROM (SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10) m$$ END
\gexec
