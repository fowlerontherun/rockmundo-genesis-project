-- This migration duplicates the app_role enum, user_roles table, role helpers,
-- RLS policies and handle_new_user() definition owned by
-- 20250916092537_a7a97757-8b10-4046-b558-dd22f45d296c.sql.
--
-- Keeping this timestamp as an explicit no-op preserves migration history while
-- preventing duplicate type, table and policy creation on fresh databases.
DO $$
BEGIN
  RAISE NOTICE 'Duplicate role schema migration intentionally skipped';
END
$$;