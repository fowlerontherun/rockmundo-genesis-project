-- Executable festival-company founding runtime harness.
BEGIN;
CREATE SCHEMA IF NOT EXISTS test_festival_runtime;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_user(user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM set_config('request.jwt.claim.sub', user_id::text, true); PERFORM set_config('request.jwt.claim.role', 'authenticated', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE anon'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'anon', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE 'SET LOCAL ROLE service_role'; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claim.role', 'service_role', true); END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_true(label text, actual boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF actual IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %', label; END IF; END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_eq(label text, actual numeric, expected numeric) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'assertion failed: %, expected %, got %', label, expected, actual; END IF; END $$;
CREATE OR REPLACE FUNCTION test_festival_runtime.assert_raises(label text, statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN actual := SQLERRM; END; IF actual IS NULL OR position(expected in actual)=0 THEN RAISE EXCEPTION 'assertion failed: % expected %, got %', label, expected, actual; END IF; END $$;

DO $$
DECLARE
  u uuid := '81280000-0000-0000-0000-000000000001'; p uuid := '81280000-0000-0000-0000-000000000101'; p2 uuid := '81280000-0000-0000-0000-000000000102';
  other_user uuid := '81280000-0000-0000-0000-000000000002'; other_profile uuid := '81280000-0000-0000-0000-000000000202';
  res jsonb; retry jsonb; company uuid; fc uuid; tx uuid; before_requests bigint; before_tx bigint;
BEGIN
  PERFORM test_festival_runtime.as_service();
  INSERT INTO auth.users(id,email,role) VALUES (u,'festival-runtime@example.test','authenticated'), (other_user,'festival-runtime-other@example.test','authenticated');
  INSERT INTO public.profiles(id,user_id,username,display_name,cash,is_active,is_vip) VALUES (p,u,'festival_runtime','Festival Runtime',10000000,true,true), (p2,u,'festival_runtime_inactive','Inactive',123456,false,false), (other_profile,other_user,'festival_other','Other',9000000,true,true);
  INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at) VALUES (u,'active','test',now()-interval '1 day',now()+interval '30 days');
  PERFORM public.get_or_create_primary_financial_account('player',p,'Runtime player cash','USD');
  UPDATE public.financial_accounts SET current_balance_minor=1000000000 WHERE owner_type='player' AND owner_id=p AND is_primary;
  PERFORM public.get_or_create_primary_financial_account('player',p2,'Inactive player cash','USD');
  UPDATE public.financial_accounts SET current_balance_minor=12345600 WHERE owner_type='player' AND owner_id=p2 AND is_primary;
  UPDATE public.game_config SET config_value = config_value || '{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"festival_configuration_enabled":false,"company_limit":3}'::jsonb WHERE config_key='festival_company_creation';

  PERFORM test_festival_runtime.assert_true('capability rpc is total', public.festival_company_capabilities() IS NOT NULL AND (public.festival_company_capabilities()->>'companyLimit')::int=3);
  PERFORM test_festival_runtime.as_anon();
  PERFORM test_festival_runtime.assert_raises('anonymous caller denied','SELECT public.found_festival_company(''Anon Fest'',''Anon LLC'',NULL,''anon-key-0001'')','not_authenticated');

  PERFORM test_festival_runtime.as_user(u);
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
  PERFORM test_festival_runtime.assert_eq('no company operating expense',(SELECT count(*) FROM public.company_transactions WHERE company_id=company),0);
  PERFORM test_festival_runtime.assert_true('audit rows exist',(SELECT count(*) FROM public.festival_company_audit_log WHERE festival_company_id=fc)>=2);
  PERFORM test_festival_runtime.assert_eq('returned balance matches', (res->>'authoritativePersonalBalance')::numeric, 8000000);

  retry := public.found_festival_company('Runtime Proof Fest','Runtime Proof LLC','proof','runtime-key-0001');
  PERFORM test_festival_runtime.assert_true('retry idempotent same IDs',(retry->>'idempotent')::boolean AND (retry->>'companyId')::uuid=company AND (retry->>'festivalCompanyId')::uuid=fc);
  PERFORM test_festival_runtime.assert_eq('retry no balance change',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),800000000);
  PERFORM test_festival_runtime.assert_raises('changed payload conflict','SELECT public.found_festival_company(''Runtime Changed Fest'',''Runtime Proof LLC'',''proof'',''runtime-key-0001'')','idempotency_conflict');
  PERFORM test_festival_runtime.assert_raises('duplicate public name','SELECT public.found_festival_company(''Runtime Proof Fest'',''Another LLC'',NULL,''runtime-key-0002'')','festival_name_taken');

  PERFORM test_festival_runtime.as_service();
  UPDATE public.financial_accounts SET current_balance_minor=1000000000 WHERE owner_type='player' AND owner_id=p AND is_primary; UPDATE public.profiles SET cash=10000000 WHERE id=p;
  PERFORM test_festival_runtime.as_user(u);
  PERFORM set_config('app.festival_foundation_fail_after_extension','on', true);
  PERFORM test_festival_runtime.assert_raises('late rollback','SELECT public.found_festival_company(''Rollback Proof Fest'',''Rollback Proof LLC'',NULL,''runtime-rollback-0001'')','festival_test_late_failure');
  PERFORM test_festival_runtime.assert_eq('rollback keeps wallet',(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p AND is_primary),1000000000);
  PERFORM test_festival_runtime.assert_eq('rollback keeps companies',(SELECT count(*) FROM public.festival_companies WHERE public_name='Rollback Proof Fest'),0);
  PERFORM test_festival_runtime.assert_eq('rollback keeps requests',(SELECT count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-rollback-0001'),0);
END $$;
ROLLBACK;
