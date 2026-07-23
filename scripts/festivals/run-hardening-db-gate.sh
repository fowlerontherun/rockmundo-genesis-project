#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null; then echo "psql is required"; exit 127; fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then echo "SUPABASE_DB_URL is required after supabase start/db reset"; exit 2; fi
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_company_hardening_harness.sql
