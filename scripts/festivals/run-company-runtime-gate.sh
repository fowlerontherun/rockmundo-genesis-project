#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/assert-safe-test-database.sh"
if ! command -v psql >/dev/null; then echo "psql is required for festival company runtime tests" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
festival_assert_safe_test_database "$SUPABASE_DB_URL"
npm run verify:supabase-rpcs
mkdir -p festival-runtime-diagnostics
runtime_log="festival-runtime-diagnostics/runtime-gate.psql.log"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_company_financial_correctness_harness.sql 2>&1 | tee "$runtime_log"
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/festival_settlement_v3_regression_harness.sql 2>&1 | tee -a "$runtime_log"
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/festival_settlement_v4_semantic_harness.sql 2>&1 | tee -a "$runtime_log"
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/festival_settlement_v5_native_harness.sql 2>&1 | tee -a "$runtime_log"
run_id=$(sed -nE 's/.*festival_runtime_summary=\{.*"runId": "([^"]+)".*/\1/p' "$runtime_log")
[[ -n "$run_id" ]] || { echo "runtime run id was not emitted" >&2; exit 1; }
cleanup_one=0; cleanup_two=0
count_remaining() {
psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1 -v run_id="$run_id" <<'SQL' | tail -n 1
SELECT
 (SELECT count(*) FROM auth.users WHERE id IN ('81280000-0000-0000-0000-000000000001','81280000-0000-0000-0000-000000000002'))+
 (SELECT count(*) FROM profiles WHERE id IN ('81280000-0000-0000-0000-000000000101','81280000-0000-0000-0000-000000000102','81280000-0000-0000-0000-000000000202'))+
 (SELECT count(*) FROM vip_subscriptions WHERE user_id='81280000-0000-0000-0000-000000000001')+
 (SELECT count(*) FROM financial_accounts WHERE owner_id IN ('81280000-0000-0000-0000-000000000101','81280000-0000-0000-0000-000000000102','81280000-0000-0000-0000-000000000202'))+
 (SELECT count(*) FROM companies WHERE name IN ('Runtime Proof LLC','Caller GUC Ignored LLC','Rollback Proof LLC','Post Debit Rollback LLC'))+
 (SELECT count(*) FROM festival_companies WHERE public_name IN ('Runtime Proof Fest','Caller GUC Ignored Fest','Rollback Proof Fest','Post Debit Rollback Fest'))+
 (SELECT count(*) FROM festival_company_founding_requests WHERE idempotency_key LIKE 'runtime-%')+
 (SELECT count(*) FROM festival_company_audit_log WHERE idempotency_key LIKE 'runtime-%')+
 (SELECT count(*) FROM financial_transactions WHERE idempotency_key LIKE 'festival-company-founding:runtime-%')+
 (SELECT count(*) FROM financial_ledger_entries e JOIN financial_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key LIKE 'festival-company-founding:runtime-%')+
 (SELECT count(*) FROM company_transactions ct JOIN companies c ON c.id=ct.company_id WHERE c.name IN ('Runtime Proof LLC','Caller GUC Ignored LLC','Rollback Proof LLC','Post Debit Rollback LLC'))+
 (SELECT count(*) FROM company_shareholders cs JOIN companies c ON c.id=cs.company_id WHERE c.name IN ('Runtime Proof LLC','Caller GUC Ignored LLC','Rollback Proof LLC','Post Debit Rollback LLC'))+
 (SELECT count(*) FROM festival_test.runs WHERE run_id=:'run_id');
SQL
}
before_cleanup=$(count_remaining)
psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1 -v run_id="$run_id" \
  -c "SET ROLE service_role; SELECT festival_test.cleanup_run(:'run_id');" >/dev/null || cleanup_one=$?
after_first=$(count_remaining)
psql "$SUPABASE_DB_URL" -X -qAt -v ON_ERROR_STOP=1 -v run_id="$run_id" \
  -c "SET ROLE service_role; SELECT festival_test.cleanup_run(:'run_id');" >/dev/null || cleanup_two=$?
remaining=$(count_remaining)
printf 'festival_runtime_cleanup={"firstRunSucceeded":%s,"firstRunRemovedRows":%s,"secondRunSucceeded":%s,"secondRunRemovedRows":%s,"remainingRows":%s}\n' \
  "$([[ $cleanup_one -eq 0 ]] && echo true || echo false)" "$((before_cleanup-after_first))" \
  "$([[ $cleanup_two -eq 0 ]] && echo true || echo false)" "$((after_first-remaining))" "$remaining" | tee -a "$runtime_log"
node scripts/festivals/validate-runtime-summary.mjs "$runtime_log" festival-runtime-diagnostics/runtime-summary.json
bash scripts/festivals/run-company-runtime-concurrency.sh | tee festival-runtime-diagnostics/concurrency-summary.log
node scripts/festivals/validate-concurrency-summary.mjs festival-runtime-diagnostics/concurrency-summary.json
