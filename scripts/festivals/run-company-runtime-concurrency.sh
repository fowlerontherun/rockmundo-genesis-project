#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/assert-safe-test-database.sh"

command -v psql >/dev/null || { echo "psql is required for concurrency verification" >&2; exit 127; }
[[ -n "${SUPABASE_DB_URL:-}" ]] || { echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; }
festival_assert_safe_test_database "$SUPABASE_DB_URL"

uuid() { python3 -c 'import uuid; print(uuid.uuid4())'; }
utc_now() { date -u +'%Y-%m-%dT%H:%M:%S.%6NZ'; }
run_id="frt-$(uuid)"; user_id="$(uuid)"; profile_id="$(uuid)"
token="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
public_name="$run_id Concurrent Runtime Fest"; company_name="$run_id Concurrent Runtime LLC"
idempotency_key="$run_id-concurrent-key"; description="$run_id deterministic concurrency proof"
diagnostics="festival-runtime-diagnostics"; mkdir -p "$diagnostics"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/festival-company-concurrency.XXXXXX")"
psql_base=(psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1)
pids=(); cleanup_complete=false

terminate_children() {
  local pid
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null || true; fi
  done
  for pid in "${pids[@]:-}"; do wait "$pid" 2>/dev/null || true; done
}
emergency_cleanup() {
  local status=$?
  terminate_children
  if [[ "$cleanup_complete" != true ]]; then
    "${psql_base[@]}" -v run_id="$run_id" <<'SQL' >/dev/null 2>&1 || true
SET ROLE service_role;
SELECT festival_test.cleanup_run(:'run_id');
SQL
  fi
  if (( status != 0 )); then
    for file in "$workdir"/*.err "$workdir"/*.out; do [[ -f "$file" ]] && { echo "--- $file" >&2; cat "$file" >&2; }; done
  fi
  rm -rf "$workdir"
  exit "$status"
}
trap emergency_cleanup EXIT INT TERM

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
UPDATE public.financial_accounts SET current_balance_minor=1000000000,reserved_balance_minor=0,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('festival_test_run_id',:'run_id')
 WHERE owner_type='player' AND owner_id=:'profile_id' AND is_primary;
UPDATE public.game_config SET config_value=config_value||'{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"company_limit":3}'::jsonb
 WHERE config_key='festival_company_creation';
SQL

cat >"$workdir/call.sql" <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'user_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'user_id', 'role', 'authenticated')::text, false);
SELECT set_config('app.allow_test_fixtures', 'true', false);
SELECT set_config('app.festival_foundation_delay_after_lock', '5', false);
SELECT set_config('app.festival_foundation_fail_after_extension', 'on', false);
SELECT set_config('app.festival_foundation_fail_after_debit', 'on', false);
SELECT set_config('app.festival_test_run_token', :'request_token', false);
SELECT public.found_festival_company(:'public_name', :'company_name', :'description', :'idempotency_key')::text;
SQL

run_request() {
  local number="$1" request_token="$2" started="$3" result="$diagnostics/concurrency-request-$number.json"
  local raw="$workdir/$number.out" err="$workdir/$number.err" completed status
  set +e
  timeout --signal=TERM --kill-after=5s 30s "${psql_base[@]}" \
    -v user_id="$user_id" -v request_token="$request_token" -v public_name="$public_name" \
    -v company_name="$company_name" -v description="$description" -v idempotency_key="$idempotency_key" \
    -f "$workdir/call.sql" >"$raw" 2>"$err"
  status=$?; set -e; completed="$(utc_now)"
  python3 - "$raw" "$result" "$started" "$completed" "$status" <<'PY'
import json, pathlib, sys
raw, target, started, completed, status = sys.argv[1:]
lines=[line.strip() for line in pathlib.Path(raw).read_text().splitlines() if line.strip().startswith('{')]
if len(lines) != 1:
    payload={"malformedRpcOutput": True}
else:
    try: payload=json.loads(lines[0])
    except json.JSONDecodeError: payload={"malformedRpcOutput": True}
payload["startedAt"]=started
payload["completedAt"]=completed
payload["exitCode"]=int(status)
pathlib.Path(target).write_text(json.dumps(payload, indent=2)+"\n")
PY
  return "$status"
}

first_started="$(utc_now)"; run_request one "$token" "$first_started" & p1=$!; pids+=("$p1")
reached=no; pause_reached=""
for _ in $(seq 1 200); do
  if ! kill -0 "$p1" 2>/dev/null; then break; fi
  reached=$("${psql_base[@]}" -v run_id="$run_id" <<'SQL' | tail -n 1
SET ROLE service_role;
SELECT CASE WHEN reached_pause_at IS NULL THEN 'no' ELSE 'yes' END FROM festival_test.runs WHERE run_id=:'run_id';
SQL
  )
  if [[ "$reached" == yes ]]; then
    pause_reached=$("${psql_base[@]}" -v run_id="$run_id" <<'SQL' | tail -n 1
SET ROLE service_role;
SELECT to_char(reached_pause_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM festival_test.runs WHERE run_id=:'run_id';
SQL
    ); break
  fi
  sleep .05
done
[[ "$reached" == yes ]] || { echo "first request never reached the trusted pause" >&2; exit 1; }

second_started="$(utc_now)"; run_request two "ordinary-caller-controlled-token" "$second_started" & p2=$!; pids+=("$p2")
"${psql_base[@]}" -v run_id="$run_id" <<'SQL' >/dev/null
SET ROLE service_role;
UPDATE festival_test.runs SET second_started_at=clock_timestamp() WHERE run_id=:'run_id';
SQL
sleep .1
release_requested="$(utc_now)"
"${psql_base[@]}" -v run_id="$run_id" <<'SQL' >/dev/null || { echo "release failed" >&2; exit 1; }
SET ROLE service_role;
SELECT festival_test.release_run(:'run_id');
SQL

set +e; wait "$p1"; s1=$?; wait "$p2"; s2=$?; set -e; pids=()
(( s1 == 0 && s2 == 0 )) || { echo "founding child failed: first=$s1 second=$s2" >&2; exit 1; }
for err in "$workdir/one.err" "$workdir/two.err"; do
  ! rg -i '^(ERROR|FATAL|PANIC):' "$err" >/dev/null || { cat "$err" >&2; exit 1; }
done

# Parse independently captured results. This emits only values proven by both executed RPCs.
readarray -t parsed < <(python3 - "$diagnostics/concurrency-request-one.json" "$diagnostics/concurrency-request-two.json" <<'PY'
import json, sys, uuid
rows=[json.load(open(p)) for p in sys.argv[1:]]
for path,row in zip(sys.argv[1:],rows):
  if row.get('exitCode') != 0 or row.get('malformedRpcOutput'): raise SystemExit(f'invalid RPC result: {path}')
  for key in ('startedAt','completedAt'):
    if not isinstance(row.get(key), str) or not row[key]: raise SystemExit(f'missing {key}: {path}')
  for key in ('companyId','festivalCompanyId','personalFinancialTransactionId'): uuid.UUID(row[key])
  if not isinstance(row.get('authoritativePersonalBalance'), (int,float)): raise SystemExit(f'missing balance: {path}')
print(rows[0]['companyId']); print(rows[0]['festivalCompanyId']); print(rows[0]['personalFinancialTransactionId'])
print(str(rows[0]['companyId']==rows[1]['companyId']).lower())
print(str(rows[0]['festivalCompanyId']==rows[1]['festivalCompanyId']).lower())
print(str(rows[0]['personalFinancialTransactionId']==rows[1]['personalFinancialTransactionId']).lower())
print(sum(r.get('idempotent') is False for r in rows)); print(sum(r.get('idempotent') is True for r in rows))
print(rows[0]['completedAt']); print(rows[1]['completedAt'])
PY
)
company_id=${parsed[0]}; festival_company_id=${parsed[1]}; tx_id=${parsed[2]}
same_company=${parsed[3]}; same_festival=${parsed[4]}; same_tx=${parsed[5]}
original_count=${parsed[6]}; replay_count=${parsed[7]}; first_completed=${parsed[8]}; second_completed=${parsed[9]}

db_json=$("${psql_base[@]}" -v run_id="$run_id" -v company_id="$company_id" \
  -v festival_company_id="$festival_company_id" -v idempotency_key="$idempotency_key" -v transaction_id="$tx_id" <<'SQL' | tail -n 1
SET ROLE service_role;
SELECT jsonb_build_object(
 'companyCount',(SELECT count(*) FROM companies WHERE id=:'company_id'::uuid AND description LIKE :'run_id'||'%'),
 'festivalCompanyCount',(SELECT count(*) FROM festival_companies WHERE id=:'festival_company_id'::uuid AND company_id=:'company_id'::uuid),
 'shareholderCount',(SELECT count(*) FROM company_shareholders WHERE company_id=:'company_id'::uuid),
 'foundingRequestCount',(SELECT count(*) FROM festival_company_founding_requests WHERE idempotency_key=:'idempotency_key' AND status='succeeded'),
 'transactionCount',(SELECT count(*) FROM financial_transactions WHERE id=:'transaction_id'::uuid),
 'ledgerEntryCount',(SELECT count(*) FROM financial_ledger_entries WHERE transaction_id=:'transaction_id'::uuid),
 'signedLedgerTotal',(SELECT coalesce(sum(CASE WHEN entry_direction='credit' THEN amount_minor ELSE -amount_minor END),0) FROM financial_ledger_entries WHERE transaction_id=:'transaction_id'::uuid),
 'debitCount',(SELECT count(*) FROM financial_transactions WHERE idempotency_key='festival-company-founding:'||:'idempotency_key')
)::text;
SQL
)

owned_count() {
  "${psql_base[@]}" -v run_id="$run_id" <<'SQL' | tail -n 1
SET ROLE service_role;
WITH owned_companies AS (SELECT id FROM companies WHERE description LIKE :'run_id'||'%'),
owned_transactions AS (SELECT id FROM financial_transactions WHERE idempotency_key LIKE 'festival-company-founding:'||:'run_id'||'-%')
SELECT (SELECT count(*) FROM festival_test.runs WHERE run_id=:'run_id')+
 (SELECT count(*) FROM festival_company_audit_log WHERE idempotency_key LIKE :'run_id'||'-%')+
 (SELECT count(*) FROM festival_company_founding_requests WHERE idempotency_key LIKE :'run_id'||'-%')+
 (SELECT count(*) FROM financial_ledger_entries WHERE transaction_id IN (SELECT id FROM owned_transactions))+
 (SELECT count(*) FROM owned_transactions)+(SELECT count(*) FROM company_transactions WHERE company_id IN (SELECT id FROM owned_companies))+
 (SELECT count(*) FROM company_shareholders WHERE company_id IN (SELECT id FROM owned_companies))+
 (SELECT count(*) FROM festival_companies WHERE company_id IN (SELECT id FROM owned_companies))+(SELECT count(*) FROM owned_companies)+
 (SELECT count(*) FROM financial_accounts WHERE metadata->>'festival_test_run_id'=:'run_id')+
 (SELECT count(*) FROM vip_subscriptions WHERE metadata->>'festival_test_run_id'=:'run_id')+
 (SELECT count(*) FROM profiles WHERE username LIKE 'festival_'||replace(:'run_id','-','_')||'%')+
 (SELECT count(*) FROM auth.users WHERE email LIKE :'run_id'||'%@example.test');
SQL
}
before_cleanup=$(owned_count)
set +e; "${psql_base[@]}" -v run_id="$run_id" -c "SET ROLE service_role; SELECT festival_test.cleanup_run(:'run_id');" >/dev/null; cleanup_one_status=$?; set -e
after_first=$(owned_count)
set +e; "${psql_base[@]}" -v run_id="$run_id" -c "SET ROLE service_role; SELECT festival_test.cleanup_run(:'run_id');" >/dev/null; cleanup_two_status=$?; set -e
after_second=$(owned_count); cleanup_complete=true

python3 - "$diagnostics/concurrency-summary.json" "$run_id" "$first_started" "$pause_reached" "$second_started" "$release_requested" "$first_completed" "$second_completed" "$same_company" "$same_festival" "$same_tx" "$original_count" "$replay_count" "$db_json" "$cleanup_one_status" "$cleanup_two_status" "$before_cleanup" "$after_first" "$after_second" <<'PY'
import json, pathlib, sys
(out,run_id,*v)=sys.argv[1:]
db=json.loads(v[11]); one=int(v[12]); two=int(v[13]); before=int(v[14]); after1=int(v[15]); after2=int(v[16])
responses={'sameCompanyId':v[6]=='true','sameFestivalCompanyId':v[7]=='true','sameTransactionId':v[8]=='true','originalSuccessCount':int(v[9]),'idempotentReplayCount':int(v[10])}
checks=list(responses.values())[:3]+[responses['originalSuccessCount']==1,responses['idempotentReplayCount']==1,
 db['companyCount']==1,db['festivalCompanyCount']==1,db['shareholderCount']==1,db['foundingRequestCount']==1,db['transactionCount']==1,
 db['ledgerEntryCount']==2,db['signedLedgerTotal']==0,db['debitCount']==1,one==0,two==0,after1==0,after2==0]
summary={'status':'passed' if all(checks) else 'failed','runId':run_id,
 'timestamps':dict(zip(('firstRequestStartedAt','pauseReachedAt','secondRequestStartedAt','releaseRequestedAt','firstRequestCompletedAt','secondRequestCompletedAt'),v[:6])),
 'responses':responses,'database':db,
 'cleanup':{'firstRunSucceeded':one==0,'firstRunRemovedRows':before-after1,'secondRunSucceeded':two==0,'secondRunRemovedRows':after1-after2,'remainingRows':after2},
 'assertions':{'total':len(checks),'passed':sum(checks),'failed':len(checks)-sum(checks)}}
pathlib.Path(out).write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,separators=(',',':')))
PY
node scripts/festivals/validate-concurrency-summary.mjs "$diagnostics/concurrency-summary.json"
echo "ok - deterministic festival-company concurrency gate passed for $run_id"
