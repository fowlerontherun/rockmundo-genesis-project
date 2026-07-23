#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null; then echo "psql is required for festival company runtime tests" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
for migration in \
  supabase/migrations/20260723120000_secure_vip_festival_company_founding.sql \
  supabase/migrations/20260723153000_harden_festival_company_founding.sql \
  supabase/migrations/20260723170000_fix_festival_single_charge_rollout.sql \
  supabase/migrations/20260723193000_festival_runtime_gate_capabilities.sql \
  supabase/migrations/20260723203000_complete_festival_runtime_gate_security.sql; do
  [[ -f "$migration" ]] || { echo "Required migration is missing: $migration" >&2; exit 3; }
done
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null
PGOPTIONS="-c app.allow_test_fixtures=true" npm run verify:supabase-rpcs
PGOPTIONS="-c app.allow_test_fixtures=true" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_company_financial_correctness_harness.sql
PGOPTIONS="-c app.allow_test_fixtures=true" bash scripts/festivals/run-company-runtime-concurrency.sh
node scripts/festivals/check-edition-migration-order.mjs
