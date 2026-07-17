-- Festival creation phase 1 harness.
-- Intended for a local Supabase test database with seeded admin auth context.
BEGIN;
SELECT has_function_privilege('authenticated', 'public.admin_create_festival_with_first_edition(jsonb)', 'EXECUTE') AS admin_create_festival_with_first_edition_executable;
SELECT has_function_privilege('authenticated', 'public.admin_create_festival_edition_with_setup(uuid,jsonb)', 'EXECUTE') AS admin_create_festival_edition_with_setup_executable;
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_festival_creation_requests' AND column_name IN ('idempotency_key','request_hash','festival_id','edition_id','result');
ROLLBACK;
