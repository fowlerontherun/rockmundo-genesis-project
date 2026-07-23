#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null; then echo "psql is required for concurrency verification" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
# Runs the same executable harness as a minimum concurrency contract placeholder until
# the local gate can add two psql sessions with deterministic pg_sleep instrumentation.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "select public.festival_company_capabilities() is not null as capability_contract;" >/dev/null
