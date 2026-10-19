#!/usr/bin/env bash
set -euo pipefail
if ! command -v supabase >/dev/null; then echo "Supabase CLI is required for the Phase 5 DB gate" >&2; exit 127; fi
if ! command -v psql >/dev/null; then echo "psql is required for the Phase 5 DB gate" >&2; exit 127; fi
node --test scripts/supabase/skills-seed-migration.contract.test.mjs
supabase start
supabase db reset
supabase migration list
DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase_5_live_gig_release_gate.sql
# Protect the historical seed fixes from regressing once the reset succeeds.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_seed_quest_integrity.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/radio_station_canonical_city_seed.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/sponsorship_type_migration_compatibility.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/behavior_settings_profile_uniqueness.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/politics_university_canonical_seed.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/unified_notifications_legacy_compat.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/equipment_purchase_result_signature_compat.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/company_jobs_legacy_association.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/mentor_discovery_pootube_integrity.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/mentor_rpc_only_write_access.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/pootube_future_skill_autoseed.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/weekly_experience_cron_signature.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_atomic_purchase_authority_harness.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_staff_atomic_hire_fire_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_staff_real_role_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_verified_owner_theme_night_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_owner_theme_night_authenticated_role.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_club_application_shortlist_authority.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_club_application_real_authenticated_role.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_club_multiple_applicants_same_slot.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_dj_funded_offer_escrow_harness.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_dj_escrow_authenticated_role.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_escrow_booking_settlement_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_residency_mutual_consent_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_residency_authenticated_role_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_residency_per_occurrence_escrow_contract.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_residency_occurrence_authenticated_role.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/dj_funded_booking_release_permissions.sql
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/nightclub_revenue_log_server_only.sql
