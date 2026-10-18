#!/usr/bin/env bash
set -euo pipefail
if ! command -v supabase >/dev/null; then echo "Supabase CLI is required for the Phase 5 DB gate" >&2; exit 127; fi
if ! command -v psql >/dev/null; then echo "psql is required for the Phase 5 DB gate" >&2; exit 127; fi
supabase start
supabase db reset
supabase migration list
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_5_live_gig_release_gate.sql
# Protect the historical seed fixes from regressing once the reset succeeds.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_seed_quest_integrity.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/radio_station_canonical_city_seed.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/sponsorship_type_migration_compatibility.sql
