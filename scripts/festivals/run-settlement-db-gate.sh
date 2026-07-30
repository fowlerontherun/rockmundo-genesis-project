#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
if [[ "${FESTIVAL_TEST_DATABASE_DISPOSABLE:-}" != "true" ]]; then
  echo "Refusing: set FESTIVAL_TEST_DATABASE_DISPOSABLE=true only for a reset disposable database." >&2
  exit 2
fi
bash scripts/festivals/assert-safe-test-database.sh "$SUPABASE_DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_edition_settlement_harness.sql
