#!/usr/bin/env bash
set -euo pipefail
if ! command -v supabase >/dev/null; then echo "Supabase CLI is required for the festival DB gate" >&2; exit 127; fi
if ! command -v psql >/dev/null; then echo "psql is required for the festival DB gate" >&2; exit 127; fi
supabase start
supabase db reset
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_creation_phase1_harness.sql
