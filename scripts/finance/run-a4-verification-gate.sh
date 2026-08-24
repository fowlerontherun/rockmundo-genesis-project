#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

run_sql() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "==> $file"
    psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file"
  fi
}

echo "==> Verify migration timestamp ordering"
npm run verify:migration-timestamps

echo "==> Supabase database lint"
supabase db lint --db-url "$SUPABASE_DB_URL" --level error

# Finance/booking harnesses already carried by the repository. Keep this list
# explicit so the release gate fails as soon as a supported authority regresses.
run_sql supabase/tests/rehearsal_booking_finance_harness.sql
run_sql supabase/tests/recording_booking_finance_harness.sql
run_sql supabase/tests/finance_atomic_booking_refund_harness.sql
run_sql supabase/tests/finance_mortgage_obligation_harness.sql
run_sql supabase/tests/band_contribution_events_harness.sql

# Reconciliation is intentionally a separate executable check so deployments
# cannot silently ship unexplained ledger/provider/treasury differences.
run_sql supabase/diagnostics/finance_reconciliation.sql

echo "Finance A4 verification gate passed."
