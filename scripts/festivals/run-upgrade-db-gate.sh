#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required for the reset disposable database}"
"$(dirname "$0")/assert-safe-test-database.sh" "$SUPABASE_DB_URL"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_upgrade_harness.sql
