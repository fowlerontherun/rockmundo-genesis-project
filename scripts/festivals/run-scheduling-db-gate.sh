#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/assert-safe-test-database.sh"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
if [[ "${FESTIVAL_TEST_DATABASE_DISPOSABLE:-}" != "true" ]]; then
  echo "Refusing to run: set FESTIVAL_TEST_DATABASE_DISPOSABLE=true for an explicitly disposable database." >&2
  exit 2
fi
PGOPTIONS="${PGOPTIONS:-} -c app.is_disposable_test_database=true" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_authoritative_scheduling_harness.sql
