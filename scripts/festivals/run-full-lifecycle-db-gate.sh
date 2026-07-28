#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/assert-safe-test-database.sh"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
festival_assert_safe_test_database "$SUPABASE_DB_URL"

fixtures=(
  festival_company_founding_foundation_harness.sql festival_editions_harness.sql
  festival_site_stage_planning_harness.sql festival_artist_applications_bookings_harness.sql
  festival_staffing_suppliers_harness.sql festival_sponsorship_workflows_harness.sql
  festival_ticketing_capacity_planning_harness.sql live_festival_runtime_foundation_harness.sql
  festival_performance_sessions_harness.sql festival_settlement_v7_reconciliation_harness.sql
)
for fixture in "${fixtures[@]}"; do
  printf 'Running %s\n' "$fixture"
  psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f "supabase/tests/$fixture"
done
