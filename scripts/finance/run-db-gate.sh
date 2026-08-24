#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for the finance database gate" >&2
  exit 127
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required (run supabase start and supabase db reset first)" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

finance_harnesses=(
  finance_a1_atomic_bookings_harness.sql
  finance_a2_replay_refund_mortgage_harness.sql
  finance_a3_treasury_ux_harness.sql
  finance_a4_reconciliation_gate.sql
)

for harness in "${finance_harnesses[@]}"; do
  echo "==> supabase/tests/${harness}"
  output_file="$(mktemp)"
  trap 'rm -f "${output_file:-}"' EXIT
  psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 \
    -f "$repo_root/supabase/tests/$harness" | tee "$output_file"

  if grep -qx 'f' "$output_file"; then
    echo "Finance assertion failed in supabase/tests/${harness}" >&2
    exit 1
  fi

  rm -f "$output_file"
  trap - EXIT
done
