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
node scripts/festivals/validate-runtime-summary.mjs "$runtime_log" festival-runtime-diagnostics/runtime-summary.json
bash scripts/festivals/run-company-runtime-concurrency.sh | tee festival-runtime-diagnostics/concurrency-summary.log
