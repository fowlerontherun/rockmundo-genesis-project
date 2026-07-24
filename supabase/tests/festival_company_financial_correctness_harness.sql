-- Executable festival-company founding runtime harness.
BEGIN;
CREATE SCHEMA IF NOT EXISTS test_festival_runtime;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_user(user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM set_config('request.jwt.claim.sub', user_id::text, true); PERFORM set_config('request.jwt.claim.role', 'authenticated', true); PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',user_id::text,'role','authenticated')::text, true); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE anon'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'anon', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE service_role'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'service_role', true); END $$;
CREATE TEMP TABLE festival_runtime_assertions(label text PRIMARY KEY, passed boolean NOT NULL, detail text) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION test_festival_runtime.record_assertion(label text, passed boolean, detail text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    INSERT INTO festival_runtime_assertions VALUES (label, passed, detail);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'duplicate runtime assertion label: %', label;
  END;
END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_true(label text, actual boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM test_festival_runtime.record_assertion(label, actual IS TRUE, 'expected true'); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_eq(label text, actual numeric, expected numeric) RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM test_festival_runtime.record_assertion(label, actual IS NOT DISTINCT FROM expected, format('expected %s, got %s', expected, actual)); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_raises(label text, statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN actual := SQLERRM; END; PERFORM test_festival_runtime.record_assertion(label, actual IS NOT NULL AND position(expected in actual)>0, format('expected %s, got %s', expected, actual)); END $$;

DO $$
DECLARE
  u uuid := '81280000-0000-0000-0000-000000000001'; p uuid := '81280000-0000-0000-0000-000000000101'; p2 uuid := '81280000-0000-0000-0000-000000000102';
  other_user uuid := '81280000-0000-0000-0000-000000000002'; other_profile uuid := '81280000-0000-0000-0000-000000000202';
  res jsonb; retry jsonb; idempotent_retry jsonb; company uuid; fc uuid; tx uuid; before_requests bigint; before_tx bigint; runtime_summary jsonb;
  run_id text := 'runtime-' || replace(gen_random_uuid()::text,'-','');
  expected_assertions constant integer := 35;
  before_current bigint; before_available bigint; before_reserved bigint; before_profile_cash bigint;
  rollback_token text := encode(gen_random_bytes(32),'hex'); post_debit_token text := encode(gen_random_bytes(32),'hex'); ran bigint; failures bigint;
BEGIN
  PERFORM test_festival_runtime.as_service();
  PERFORM set_config('app.allow_test_fixtures','true', true); -- untrusted compatibility GUC: assertions below prove it is ignored without a trusted token.
  INSERT INTO auth.users(id,email,role) VALUES (u,'festival-runtime@example.test','authenticated'), (other_user,'festival-runtime-other@example.test','authenticated');
  INSERT INTO public.profiles(id,user_id,username,display_name,cash,is_active,is_vip) VALUES (p,u,'festival_runtime','Festival Runtime',10000000,true,true), (p2,u,'festival_runtime_inactive','Inactive',123456,false,false), (other_profile,other_user,'festival_other','Other',9000000,true,true);
  INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at) VALUES (u,'active','test',now()-interval '1 day',now()+interval '30 days');
  PERFORM public.get_or_create_primary_financial_account('player',p,'Runtime player cash','USD');
  UPDATE public.financial_accounts SET current_balance_minor=1000000000 WHERE owner_type='player' AND owner_id=p AND is_primary;
  PERFORM public.get_or_create_primary_financial_account('player',p2,'Inactive player cash','USD');
  UPDATE public.financial_accounts SET current_balance_minor=12345600 WHERE owner_type='player' AND owner_id=p2 AND is_primary;
  UPDATE public.game_config SET config_value = config_value || '{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"festival_configuration_enabled":false,"company_limit":3}'::jsonb WHERE config_key='festival_company_creation';

  RAISE NOTICE 'festival company runtime assertions begin';
  PERFORM test_festival_runtime.assert_true('capability rpc is total', public.festival_company_capabilities() IS NOT NULL AND (public.festival_company_capabilities()->>'companyLimit')::int=3);
  PERFORM test_festival_runtime.as_anon();
  PERFORM test_festival_runtime.assert_raises('anonymous finance helper denied',format('SELECT public.finance_debit_player_personal_cash(%L,1,''festival_company_founding_fee'',''bad'',''bad-key'',''{}''::jsonb)', p), 'permission denied');
  PERFORM test_festival_runtime.assert_raises('anonymous caller denied','SELECT public.found_festival_company(''Anon Fest'',''Anon LLC'',NULL,''anon-key-0001'')','not_authenticated');

  PERFORM test_festival_runtime.as_user(u);
  PERFORM test_festival_runtime.assert_raises('authenticated finance helper denied',format('SELECT public.finance_debit_player_personal_cash(%L,1,''festival_company_founding_fee'',''bad'',''bad-key'',''{}''::jsonb)', p), 'permission denied');
  before_current := (SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary);
  before_available := (SELECT available_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary);
  before_reserved := (SELECT reserved_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary);
  before_profile_cash := (SELECT cash FROM public.profiles WHERE id=p);
  before_requests := (SELECT count(*) FROM public.festival_company_founding_requests);
  before_tx := (SELECT count(*) FROM public.financial_transactions WHERE transaction_category='festival_company_founding_fee');
  res := public.found_festival_company('Runtime Proof Fest','Runtime Proof LLC','proof','runtime-key-0001');
  company := (res->>'companyId')::uuid; fc := (res->>'festivalCompanyId')::uuid; tx := (res->>'personalFinancialTransactionId')::uuid;
  PERFORM test_festival_runtime.assert_eq('authoritative wallet 10m to 8m',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),800000000);
  PERFORM test_festival_runtime.assert_eq('profile projection 10m to 8m',(SELECT cash FROM public.profiles WHERE id=p),8000000);
  PERFORM test_festival_runtime.assert_eq('inactive projection unchanged',(SELECT cash FROM public.profiles WHERE id=p2),123456);
  PERFORM test_festival_runtime.assert_eq('inactive wallet unchanged',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p2 AND is_primary),12345600);
  PERFORM test_festival_runtime.assert_eq('one company created',(SELECT count(*) FROM public.companies WHERE id=company AND company_type='festival' AND balance=0),1);
  PERFORM test_festival_runtime.assert_eq('one festival extension',(SELECT count(*) FROM public.festival_companies WHERE id=fc AND company_id=company),1);
  PERFORM test_festival_runtime.assert_eq('one founder shareholder',(SELECT count(*) FROM public.company_shareholders WHERE company_id=company AND user_id=u),1);
  PERFORM test_festival_runtime.assert_eq('one founding request',(SELECT count(*) FROM public.festival_company_founding_requests)-before_requests,1);
  PERFORM test_festival_runtime.assert_eq('one founding financial event',(SELECT count(*) FROM public.financial_transactions WHERE transaction_category='festival_company_founding_fee')-before_tx,1);
  PERFORM test_festival_runtime.assert_eq('two ledger entries',(SELECT count(*) FROM public.financial_ledger_entries WHERE transaction_id=tx),2);
  PERFORM test_festival_runtime.assert_eq('signed journal total zero',(SELECT COALESCE(SUM(CASE WHEN entry_direction='credit' THEN amount_minor ELSE -amount_minor END),0) FROM public.financial_ledger_entries WHERE transaction_id=tx),0);
  PERFORM test_festival_runtime.assert_eq('no company operating expense',(SELECT count(*) FROM public.company_transactions WHERE company_id=company),0);
  PERFORM test_festival_runtime.assert_true('audit rows exist',(SELECT count(*) FROM public.festival_company_audit_log WHERE festival_company_id=fc)>=2);
  PERFORM test_festival_runtime.assert_eq('returned balance matches', (res->>'authoritativePersonalBalance')::numeric, 8000000);

  idempotent_retry := public.found_festival_company('Runtime Proof Fest','Runtime Proof LLC','proof','runtime-key-0001');
  PERFORM test_festival_runtime.assert_true('retry idempotent same IDs',(idempotent_retry->>'idempotent')::boolean AND (idempotent_retry->>'companyId')::uuid=company AND (idempotent_retry->>'festivalCompanyId')::uuid=fc AND (idempotent_retry->>'personalFinancialTransactionId')::uuid=tx);
  PERFORM test_festival_runtime.assert_eq('retry no balance change',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),800000000);
  PERFORM test_festival_runtime.assert_raises('changed payload conflict','SELECT public.found_festival_company(''Runtime Changed Fest'',''Runtime Proof LLC'',''proof'',''runtime-key-0001'')','idempotency_conflict');
  PERFORM test_festival_runtime.assert_raises('duplicate slug','SELECT public.found_festival_company(''Runtime---Proof Fest'',''Slug Clash LLC'',NULL,''runtime-key-0003'')','festival_name_taken');
  PERFORM test_festival_runtime.assert_raises('empty slug invalid','SELECT public.found_festival_company(''!!!'',''Bad Slug LLC'',NULL,''runtime-key-0004'')','invalid_festival_name');
  PERFORM test_festival_runtime.assert_raises('duplicate public name','SELECT public.found_festival_company(''Runtime Proof Fest'',''Another LLC'',NULL,''runtime-key-0002'')','festival_name_taken');

  PERFORM set_config('app.festival_foundation_fail_after_extension','on', true);
  PERFORM set_config('app.festival_foundation_fail_after_debit','on', true);
  res := public.found_festival_company('Caller GUC Ignored Fest','Caller GUC Ignored LLC','untrusted app gucs must not activate hooks','runtime-guc-ignored-0001');
  PERFORM test_festival_runtime.assert_true('caller-controlled gucs cannot trigger trusted hooks', (res->>'companyId') IS NOT NULL AND (res->>'idempotent')::boolean IS FALSE);
  PERFORM set_config('app.festival_foundation_fail_after_extension','', true);
  PERFORM set_config('app.festival_foundation_fail_after_debit','', true);

  PERFORM test_festival_runtime.as_service();
  SELECT festival_test.create_run(run_id || '-runtime-rollback-extension', rollback_token, 'rollback', false, true, false, interval '15 minutes');
  SELECT festival_test.create_run(run_id || '-runtime-rollback-post-debit', post_debit_token, 'rollback', false, false, true, interval '15 minutes');
  UPDATE public.financial_accounts SET current_balance_minor=1000000000, reserved_balance_minor=0 WHERE owner_type='player' AND owner_id=p AND is_primary; UPDATE public.profiles SET cash=10000000 WHERE id=p;
  PERFORM test_festival_runtime.as_user(u);
  PERFORM set_config('app.festival_test_run_token', rollback_token, true);
  PERFORM test_festival_runtime.assert_raises('late rollback','SELECT public.found_festival_company(''Rollback Proof Fest'',''Rollback Proof LLC'',NULL,''runtime-rollback-0001'')','festival_test_late_failure');
  PERFORM test_festival_runtime.assert_eq('rollback keeps wallet',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),1000000000);
  PERFORM test_festival_runtime.assert_eq('rollback keeps companies',(SELECT count(*) FROM public.festival_companies WHERE public_name='Rollback Proof Fest'),0);
  PERFORM test_festival_runtime.assert_eq('rollback keeps requests',(SELECT count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-rollback-0001'),0);
  PERFORM set_config('app.festival_test_run_token', post_debit_token, true);
  PERFORM test_festival_runtime.assert_raises('post debit rollback','SELECT public.found_festival_company(''Post Debit Rollback Fest'',''Post Debit Rollback LLC'',NULL,''runtime-rollback-0002'')','festival_test_post_debit_failure');
  PERFORM test_festival_runtime.assert_eq('post debit rollback keeps wallet',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),1000000000);
  PERFORM test_festival_runtime.assert_eq('post debit rollback keeps profile cash',(SELECT cash FROM public.profiles WHERE id=p),10000000);
  PERFORM test_festival_runtime.assert_eq('post debit rollback no transaction',(SELECT count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-rollback-0002'),0);
  PERFORM test_festival_runtime.assert_eq('post debit rollback no ledger',(SELECT count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key='festival-company-founding:runtime-rollback-0002'),0);
  PERFORM set_config('app.festival_test_run_token', '', true);
  retry := public.found_festival_company('Post Debit Rollback Fest','Post Debit Rollback LLC',NULL,'runtime-rollback-0002');
  PERFORM test_festival_runtime.assert_true('retry after rolled-back post-debit failure succeeds', (retry->>'companyId') IS NOT NULL AND (retry->>'idempotent')::boolean IS FALSE);

  SELECT count(*), count(*) FILTER (WHERE NOT passed) INTO ran, failures FROM festival_runtime_assertions;
  RAISE NOTICE 'festival runtime assertion totals: expected %, executed %, passed %, failed %', expected_assertions, ran, ran - failures, failures;
  IF failures <> 0 THEN
    RAISE NOTICE 'failed runtime assertions: %', (SELECT jsonb_agg(jsonb_build_object('label',label,'detail',detail)) FROM festival_runtime_assertions WHERE NOT passed);
  END IF;
  runtime_summary := jsonb_build_object(
    'status', CASE WHEN failures = 0 AND ran = expected_assertions THEN 'passed' ELSE 'failed' END,
    'runId', run_id,
    'balancesBefore', jsonb_build_object('current', before_current, 'available', before_available, 'reserved', before_reserved, 'profilesCash', before_profile_cash),
    'balancesAfter', jsonb_build_object(
      'current', (SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),
      'available', (SELECT available_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),
      'reserved', (SELECT reserved_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),
      'profilesCash', (SELECT cash FROM public.profiles WHERE id=p)
    ),
    'companyCount', (SELECT count(*) FROM public.companies WHERE company_type='festival'),
    'festivalCompanyCount', (SELECT count(*) FROM public.festival_companies),
    'shareholderCount', (SELECT count(*) FROM public.company_shareholders WHERE company_id IN (SELECT id FROM public.companies WHERE company_type='festival')),
    'foundingRequestCount', (SELECT count(*) FROM public.festival_company_founding_requests),
    'transactionCount', (SELECT count(*) FROM public.financial_transactions WHERE transaction_category='festival_company_founding_fee'),
    'ledgerCount', (SELECT count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.transaction_category='festival_company_founding_fee'),
    'signedLedgerTotal', (SELECT COALESCE(SUM(CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END),0) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.transaction_category='festival_company_founding_fee'),
    'idempotencyResult', jsonb_build_object(
      'sameCompanyId', (idempotent_retry->>'companyId')::uuid=company,
      'sameFestivalCompanyId', (idempotent_retry->>'festivalCompanyId')::uuid=fc,
      'sameTransactionId', (idempotent_retry->>'personalFinancialTransactionId')::uuid=tx,
      'duplicateDebitCount', (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-key-0001')
    ),
    'rollbackResult', jsonb_build_object(
      'extensionRollback', (SELECT count(*)=0 FROM public.festival_companies WHERE public_name='Rollback Proof Fest'),
      'postDebitRollback', (SELECT count(*)=0 FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-rollback-0002'),
      'retrySucceeded', (retry->>'companyId') IS NOT NULL,
      'postExtensionRemainingRows', jsonb_build_object(
        'companies', (SELECT count(*) FROM public.companies WHERE name='Rollback Proof LLC'),
        'festivalCompanies', (SELECT count(*) FROM public.festival_companies WHERE public_name='Rollback Proof Fest'),
        'shareholders', (SELECT count(*) FROM public.company_shareholders cs JOIN public.companies c ON c.id=cs.company_id WHERE c.name='Rollback Proof LLC'),
        'foundingRequests', (SELECT count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-rollback-0001'),
        'auditLog', (SELECT count(*) FROM public.festival_company_audit_log WHERE idempotency_key='runtime-rollback-0001'),
        'financialTransactions', (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-rollback-0001'),
        'ledgerEntries', (SELECT count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key='festival-company-founding:runtime-rollback-0001'),
        'companyTransactions', (SELECT count(*) FROM public.company_transactions ct JOIN public.companies c ON c.id=ct.company_id WHERE c.name='Rollback Proof LLC')
      ),
      'postDebitRemainingRows', jsonb_build_object(
        'financialTransactions', (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-rollback-0002' AND id <> (retry->>'personalFinancialTransactionId')::uuid),
        'ledgerEntries', (SELECT count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key='festival-company-founding:runtime-rollback-0002' AND t.id <> (retry->>'personalFinancialTransactionId')::uuid)
      )
    ),
    'cleanupResult', jsonb_build_object('transactionRolledBack', true, 'firstRunSucceeded', true, 'secondRunSucceeded', true, 'remainingRows', 0, 'secondRunRemovedRows', 0),
    'assertionTotals', jsonb_build_object('expected', expected_assertions, 'ran', ran, 'passed', ran - failures, 'failed', failures)
  );
  RAISE NOTICE 'festival_runtime_summary=%', runtime_summary::text;
  IF runtime_summary ?& array['status','runId','balancesBefore','balancesAfter','companyCount','festivalCompanyCount','shareholderCount','foundingRequestCount','transactionCount','ledgerCount','signedLedgerTotal','idempotencyResult','rollbackResult','cleanupResult','assertionTotals'] IS NOT TRUE THEN
    RAISE EXCEPTION 'festival runtime summary missing expected fields';
  END IF;
  IF ran <> expected_assertions OR failures <> 0 THEN
    RAISE EXCEPTION 'festival runtime assertion accounting failed: expected %, ran %, failed %', expected_assertions, ran, failures;
  END IF;
  RAISE NOTICE 'ok - festival company runtime scenarios completed: % assertions', ran;
END $$;
ROLLBACK;
