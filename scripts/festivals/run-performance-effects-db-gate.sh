#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
test -n "${SUPABASE_DB_URL:-}" || { echo "SUPABASE_DB_URL must identify an explicitly disposable database" >&2; exit 2; }
"$root/scripts/festivals/assert-safe-test-database.sh" "$SUPABASE_DB_URL"
node "$root/scripts/festivals/certify-performance-effects-harness.mjs"
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$root/supabase/tests/live_performance_progression_harness.sql"
