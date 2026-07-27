#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL must identify a disposable, fully migrated database}"
scripts/festivals/assert-safe-test-database.sh "$SUPABASE_DB_URL"

# Separate commands and ON_ERROR_STOP preserve every psql failure status.
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/festival_lifecycle_recovery_harness.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/festival_lifecycle_recovery_negative_harness.sql
