#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/assert-safe-test-database.sh"
REQUIRED_SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.31.8}"
if ! command -v supabase >/dev/null; then echo "Supabase CLI ${REQUIRED_SUPABASE_CLI_VERSION} is required for the festival DB gate" >&2; exit 127; fi
if ! supabase --version | grep -Fq "$REQUIRED_SUPABASE_CLI_VERSION"; then echo "Supabase CLI version must be pinned to ${REQUIRED_SUPABASE_CLI_VERSION}; found: $(supabase --version)" >&2; exit 1; fi
if ! command -v psql >/dev/null; then echo "psql is required for the festival DB gate" >&2; exit 127; fi
if ! command -v docker >/dev/null; then echo "Docker is required for Supabase local startup" >&2; exit 127; fi
trap 'supabase stop --no-backup || true' EXIT
supabase start
supabase db reset
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
festival_assert_safe_test_database "$DB_URL"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_creation_phase1_harness.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_phase2a_scheduling_harness.sql
