#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null; then echo "psql is required for concurrency verification" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
if [[ "${FESTIVAL_TEST_DATABASE_CONFIRMED:-}" != "true" ]]; then echo "Refusing to mutate database: set FESTIVAL_TEST_DATABASE_CONFIRMED=true for an isolated test database" >&2; exit 3; fi
case "$SUPABASE_DB_URL" in *prod*|*production*|*amazonaws.com*|*supabase.co*) echo "Refusing to run festival runtime gate against a possible production database" >&2; exit 4;; esac

run_id="frt-$(date +%s)-$RANDOM-$RANDOM"
token="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
user_id="81280000-0000-0000-0000-000000000010"
profile_id="81280000-0000-0000-0000-000000000110"
public_name="$run_id Concurrent Runtime Fest"
company_name="$run_id Concurrent Runtime LLC"
idempotency_key="$run_id-concurrent-key"
description="$run_id deterministic concurrency proof"
workdir="${TMPDIR:-/tmp}/festival-company-concurrency-$run_id"
mkdir -p "$workdir"

psql_base=(psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1)
cleanup() {
  set +e
  "${psql_base[@]}" -v run_id="$run_id" <<'SQL' >/dev/null
SET ROLE service_role;
SELECT festival_test.cleanup_run(:'run_id');
SQL
  rm -rf "$workdir"
}
trap cleanup EXIT INT TERM

"${psql_base[@]}" -v run_id="$run_id" -v token="$token" -v user_id="$user_id" -v profile_id="$profile_id" <<'SQL'
SET ROLE service_role;
SELECT festival_test.cleanup_run(:'run_id');
SELECT festival_test.create_run(:'run_id', :'token', 'concurrency', true, false, false, interval '15 minutes');
INSERT INTO auth.users(id,email,role) VALUES (:'user_id', :'run_id' || '@example.test','authenticated');
INSERT INTO public.profiles(id,user_id,username,display_name,cash,is_active,is_vip)
VALUES (:'profile_id', :'user_id', 'festival_' || replace(:'run_id','-','_'), :'run_id', 10000000, true, true);
INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at,metadata)
VALUES (:'user_id','active','test',now()-interval '1 day',now()+interval '30 days',jsonb_build_object('festival_test_run_id',:'run_id'));
SELECT public.get_or_create_primary_financial_account('player',:'profile_id','Concurrency player cash','USD');
UPDATE public.financial_accounts SET current_balance_minor=1000000000, available_balance_minor=1000000000, metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('festival_test_run_id',:'run_id') WHERE owner_type='player' AND owner_id=:'profile_id' AND is_primary;
UPDATE public.game_config SET config_value = config_value || '{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"company_limit":3}'::jsonb WHERE config_key='festival_company_creation';
SQL

make_call_sql() {
  local file="$1" token_arg="$2"
  cat > "$file" <<SQL
SET ROLE authenticated;
SET request.jwt.claim.sub = '$user_id';
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claims = '{"sub":"$user_id","role":"authenticated"}';
SET app.allow_test_fixtures = 'true';
SET app.festival_foundation_delay_after_lock = '5';
SET app.festival_foundation_fail_after_extension = 'on';
SET app.festival_foundation_fail_after_debit = 'on';
SET app.festival_test_run_token = '$token_arg';
SELECT public.found_festival_company('$public_name','$company_name','$description','$idempotency_key')::text;
SQL
}
make_call_sql "$workdir/call1.sql" "$token"
make_call_sql "$workdir/call2.sql" "ordinary-caller-controlled-token"

("${psql_base[@]}" -f "$workdir/call1.sql" >"$workdir/out1" 2>"$workdir/err1") & p1=$!
# Deterministically wait until session one has acquired the advisory lock and reached the trusted pause point.
for _ in $(seq 1 200); do
  reached=$("${psql_base[@]}" -v run_id="$run_id" -c "SET ROLE service_role; SELECT CASE WHEN reached_pause_at IS NULL THEN 'no' ELSE 'yes' END FROM festival_test.runs WHERE run_id=:'run_id';" | tail -n 1)
  [[ "$reached" == "yes" ]] && break
  sleep 0.05
done
[[ "${reached:-no}" == "yes" ]] || { echo "session one never reached trusted pause marker" >&2; exit 1; }
("${psql_base[@]}" -f "$workdir/call2.sql" >"$workdir/out2" 2>"$workdir/err2") & p2=$!
sleep 0.1
"${psql_base[@]}" -v run_id="$run_id" <<'SQL' >/dev/null
SET ROLE service_role;
UPDATE festival_test.runs SET second_started_at = now() WHERE run_id=:'run_id';
SELECT festival_test.release_run(:'run_id');
SQL
wait "$p1" || { cat "$workdir/err1" >&2; exit 1; }
wait "$p2" || { cat "$workdir/err2" >&2; exit 1; }
[[ ! -s "$workdir/err1" ]] || { cat "$workdir/err1" >&2; exit 1; }
[[ ! -s "$workdir/err2" ]] || { cat "$workdir/err2" >&2; exit 1; }

python3 - "$workdir/out1" "$workdir/out2" <<'PY'
import json, re, sys
uuid=re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
rows=[]
for path in sys.argv[1:]:
    lines=[l.strip() for l in open(path) if l.strip()]
    if len(lines)!=1: raise SystemExit(f'{path} must contain exactly one JSON line, got {len(lines)}')
    data=json.loads(lines[0]); rows.append(data)
    for key in ('companyId','festivalCompanyId','personalFinancialTransactionId'):
        if not uuid.match(str(data.get(key,''))): raise SystemExit(f'{path} missing uuid {key}')
    if data.get('foundingCost') != 2000000: raise SystemExit(f'{path} has wrong foundingCost')
if rows[0]['companyId'] != rows[1]['companyId'] or rows[0]['festivalCompanyId'] != rows[1]['festivalCompanyId'] or rows[0]['personalFinancialTransactionId'] != rows[1]['personalFinancialTransactionId']:
    raise SystemExit('responses returned different persisted ids')
if sorted([rows[0].get('idempotent'), rows[1].get('idempotent')]) != [False, True]:
    raise SystemExit('expected one original and one idempotent response')
print(rows[0]['companyId']); print(rows[0]['festivalCompanyId']); print(rows[0]['personalFinancialTransactionId'])
PY
readarray -t ids < <(python3 - "$workdir/out1" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); print(j['companyId']); print(j['festivalCompanyId']); print(j['personalFinancialTransactionId'])
PY
)
company_id="${ids[0]}"
festival_company_id="${ids[1]}"
tx_id="${ids[2]}"

"${psql_base[@]}" <<SQL
DO \$\$
DECLARE failures int := 0; ran int := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS festival_assertions(label text, passed boolean) ON COMMIT DROP;
  INSERT INTO festival_assertions VALUES
  ('one generic company', (SELECT count(*)=1 FROM public.companies WHERE id='$company_id'::uuid AND description LIKE '$run_id%')),
  ('one festival extension', (SELECT count(*)=1 FROM public.festival_companies WHERE id='$festival_company_id'::uuid AND company_id='$company_id'::uuid AND description LIKE '$run_id%')),
  ('one founder shareholder', (SELECT count(*)=1 FROM public.company_shareholders WHERE company_id='$company_id'::uuid AND user_id='$user_id'::uuid)),
  ('one successful request', (SELECT count(*)=1 FROM public.festival_company_founding_requests WHERE idempotency_key='$idempotency_key' AND status='succeeded')),
  ('two audit rows', (SELECT count(*)=2 FROM public.festival_company_audit_log WHERE festival_company_id='$festival_company_id'::uuid AND idempotency_key='$idempotency_key')),
  ('one founding fee transaction', (SELECT count(*)=1 FROM public.financial_transactions WHERE id='$tx_id'::uuid AND idempotency_key='festival-company-founding:$idempotency_key' AND transaction_category='festival_company_founding_fee')),
  ('two ledger entries', (SELECT count(*)=2 FROM public.financial_ledger_entries WHERE transaction_id='$tx_id'::uuid)),
  ('ledger balances to zero', (SELECT coalesce(sum(amount_minor),0)=0 FROM public.financial_ledger_entries WHERE transaction_id='$tx_id'::uuid)),
  ('zero company operating expenses', (SELECT count(*)=0 FROM public.company_transactions WHERE company_id='$company_id'::uuid)),
  ('company balance zero', (SELECT balance=0 FROM public.companies WHERE id='$company_id'::uuid)),
  ('wallet current balance 800000000', (SELECT current_balance_minor=800000000 FROM public.financial_accounts WHERE owner_type='player' AND owner_id='$profile_id'::uuid AND is_primary)),
  ('wallet available balance 800000000', (SELECT available_balance_minor=800000000 FROM public.financial_accounts WHERE owner_type='player' AND owner_id='$profile_id'::uuid AND is_primary)),
  ('profile cash 8000000', (SELECT cash=8000000 FROM public.profiles WHERE id='$profile_id'::uuid)),
  ('stored request has returned ids', (SELECT result->>'companyId'='$company_id' AND result->>'festivalCompanyId'='$festival_company_id' AND result->>'personalFinancialTransactionId'='$tx_id' FROM public.festival_company_founding_requests WHERE idempotency_key='$idempotency_key'));
  SELECT count(*), count(*) FILTER (WHERE NOT passed) INTO ran, failures FROM festival_assertions;
  IF failures <> 0 THEN
    RAISE EXCEPTION 'concurrency assertions failed: %', (SELECT jsonb_agg(label) FROM festival_assertions WHERE NOT passed);
  END IF;
  IF ran <> 14 THEN RAISE EXCEPTION 'expected 14 assertions, ran %', ran; END IF;
END \$\$;
SQL
echo "ok - deterministic festival-company concurrency gate passed for $run_id"
