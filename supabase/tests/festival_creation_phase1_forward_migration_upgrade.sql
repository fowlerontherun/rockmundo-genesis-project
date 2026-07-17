-- Static upgrade contract for the Phase 1.1 forward migration.
-- Full behaviour is covered by festival_creation_phase1_harness.sql after supabase db reset.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.admin_festival_creation_requests'::regclass AND attname='actor_resolution_status' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'actor_resolution_status column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='admin_festival_creation_requests_actor_user_id_new_writes') THEN
    RAISE EXCEPTION 'actor identity preservation check missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='admin_festival_creation_requests_actor_user_operation_key' AND indexdef ILIKE '%WHERE (actor_user_id IS NOT NULL)%') THEN
    RAISE EXCEPTION 'partial actor-user idempotency index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='internal_create_festival_edition_setup' AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'internal creation helper must not be executable by authenticated users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='admin_create_festival_edition_with_setup' AND pg_get_functiondef(oid) ILIKE '%FESTIVAL_CREATE_FIRST_EDITION_ALREADY_EXISTS%' AND pg_get_functiondef(oid) ILIKE '%FESTIVAL_CREATE_ADD_EDITION_REQUIRES_EXISTING%') THEN
    RAISE EXCEPTION 'server creation mode enforcement missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='admin_create_festival_with_first_edition' AND pg_get_functiondef(oid) NOT ILIKE '%DELETE FROM public.admin_festival_creation_requests%' AND pg_get_functiondef(oid) NOT ILIKE '%admin_create_festival_edition_with_setup%') THEN
    RAISE EXCEPTION 'first-edition RPC still appears to nest public creation';
  END IF;
END $$;
ROLLBACK;
