#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null; then echo "psql is required for concurrency verification" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
workdir="${TMPDIR:-/tmp}/festival-company-concurrency-$$"
mkdir -p "$workdir"
trap 'rm -rf "$workdir"' EXIT
setup="$workdir/setup.sql"
call1="$workdir/call1.sql"
call2="$workdir/call2.sql"
verify="$workdir/verify.sql"
cat > "$setup" <<'SQL'
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL app.allow_test_fixtures = 'true';
DELETE FROM auth.users WHERE id IN ('81280000-0000-0000-0000-000000000010');
INSERT INTO auth.users(id,email,role) VALUES ('81280000-0000-0000-0000-000000000010','festival-concurrency@example.test','authenticated');
INSERT INTO public.profiles(id,user_id,username,display_name,cash,is_active,is_vip) VALUES ('81280000-0000-0000-0000-000000000110','81280000-0000-0000-0000-000000000010','festival_concurrency','Festival Concurrency',10000000,true,true);
INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at) VALUES ('81280000-0000-0000-0000-000000000010','active','test',now()-interval '1 day',now()+interval '30 days');
PERFORM public.get_or_create_primary_financial_account('player','81280000-0000-0000-0000-000000000110','Concurrency player cash','USD');
UPDATE public.financial_accounts SET current_balance_minor=1000000000, available_balance_minor=1000000000 WHERE owner_type='player' AND owner_id='81280000-0000-0000-0000-000000000110' AND is_primary;
UPDATE public.game_config SET config_value = config_value || '{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"company_limit":3}'::jsonb WHERE config_key='festival_company_creation';
COMMIT;
SQL
cat > "$call1" <<'SQL'
SET ROLE authenticated;
SET request.jwt.claim.sub = '81280000-0000-0000-0000-000000000010';
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claims = '{"sub":"81280000-0000-0000-0000-000000000010","role":"authenticated"}';
SET app.allow_test_fixtures = 'true';
SET app.festival_foundation_delay_after_lock = '1.5';
SELECT public.found_festival_company('Concurrent Runtime Fest','Concurrent Runtime LLC','proof','runtime-concurrent-key') AS result;
SQL
cat > "$call2" <<'SQL'
SET ROLE authenticated;
SET request.jwt.claim.sub = '81280000-0000-0000-0000-000000000010';
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claims = '{"sub":"81280000-0000-0000-0000-000000000010","role":"authenticated"}';
SELECT public.found_festival_company('Concurrent Runtime Fest','Concurrent Runtime LLC','proof','runtime-concurrent-key') AS result;
SQL
cat > "$verify" <<'SQL'
DO $$
DECLARE c bigint; fc bigint; sh bigint; req bigint; tx bigint; led bigint; bal bigint; r1 jsonb; r2 jsonb;
BEGIN
  SELECT result::jsonb INTO r1 FROM pg_read_file(current_setting('app.concurrency_result_1')) AS result;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT 'companies', count(*) FROM public.companies WHERE name='Concurrent Runtime LLC';
SELECT 'festival_extensions', count(*) FROM public.festival_companies WHERE public_name='Concurrent Runtime Fest';
SELECT 'shareholders', count(*) FROM public.company_shareholders s JOIN public.companies c ON c.id=s.company_id WHERE c.name='Concurrent Runtime LLC';
SELECT 'requests', count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-concurrent-key';
SELECT 'transactions', count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-concurrent-key';
SELECT 'ledger_entries', count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key='festival-company-founding:runtime-concurrent-key';
SELECT 'balance', current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id='81280000-0000-0000-0000-000000000110' AND is_primary;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.companies WHERE name='Concurrent Runtime LLC') <> 1 THEN RAISE EXCEPTION 'expected one company'; END IF;
 IF (SELECT count(*) FROM public.festival_companies WHERE public_name='Concurrent Runtime Fest') <> 1 THEN RAISE EXCEPTION 'expected one festival extension'; END IF;
 IF (SELECT count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-concurrent-key') <> 1 THEN RAISE EXCEPTION 'expected one request'; END IF;
 IF (SELECT count(*) FROM public.financial_transactions WHERE idempotency_key='festival-company-founding:runtime-concurrent-key') <> 1 THEN RAISE EXCEPTION 'expected one debit transaction'; END IF;
 IF (SELECT count(*) FROM public.financial_ledger_entries e JOIN public.financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key='festival-company-founding:runtime-concurrent-key') <> 2 THEN RAISE EXCEPTION 'expected two ledger entries'; END IF;
 IF (SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id='81280000-0000-0000-0000-000000000110' AND is_primary) <> 800000000 THEN RAISE EXCEPTION 'expected 800000000 balance'; END IF;
END $$;
SQL
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$setup" >/dev/null
(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -tA -f "$call1" > "$workdir/out1" 2> "$workdir/err1") & p1=$!
sleep 0.2
(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -tA -f "$call2" > "$workdir/out2" 2> "$workdir/err2") & p2=$!
wait "$p1" || { cat "$workdir/err1" >&2; exit 1; }
wait "$p2" || { cat "$workdir/err2" >&2; exit 1; }
if rg -i "unique|deadlock" "$workdir/err1" "$workdir/err2"; then exit 1; fi
id1=$(python3 -c 'import json,sys; d=json.loads(open(sys.argv[1]).read().strip()); print(d["festivalCompanyId"])' "$workdir/out1")
id2=$(python3 -c 'import json,sys; d=json.loads(open(sys.argv[1]).read().strip()); print(d["festivalCompanyId"])' "$workdir/out2")
[[ "$id1" == "$id2" ]] || { echo "concurrent calls returned different festival companies" >&2; exit 1; }
if ! rg '"idempotent"\s*:\s*true' "$workdir/out1" "$workdir/out2" >/dev/null; then echo "expected one idempotent response" >&2; exit 1; fi
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$verify"
echo "ok - real two-session festival-company concurrency gate passed"
