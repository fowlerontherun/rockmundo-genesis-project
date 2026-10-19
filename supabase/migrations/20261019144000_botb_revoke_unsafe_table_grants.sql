-- 2026-10-19: lock down direct API privileges on BOTB base tables.
--
-- These tables were created with broad Supabase default grants: both anon
-- and authenticated could TRUNCATE them. TRUNCATE bypasses RLS entirely.
-- All gameplay mutations happen through authenticated SECURITY DEFINER
-- RPCs or server-only settlement functions.
--
-- Preserve authenticated read access and a temporary authenticated DELETE
-- privilege on botb_entries for clients still using the legacy withdrawal
-- flow. Its existing RLS policy restricts ownership and the event cutoff.
-- Once old clients are retired, remove even that DELETE grant.
REVOKE ALL PRIVILEGES ON TABLE public.botb_events
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.botb_entries
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.botb_events TO authenticated;
GRANT SELECT, DELETE ON TABLE public.botb_entries TO authenticated;

DO $verify_botb_grants$
BEGIN
  IF has_table_privilege('anon','public.botb_events','TRUNCATE')
    OR has_table_privilege('authenticated','public.botb_events','TRUNCATE')
    OR has_table_privilege('anon','public.botb_entries','TRUNCATE')
    OR has_table_privilege('authenticated','public.botb_entries','TRUNCATE')
    OR has_table_privilege('anon','public.botb_events','INSERT')
    OR has_table_privilege('authenticated','public.botb_events','INSERT')
    OR has_table_privilege('authenticated','public.botb_events','UPDATE')
    OR has_table_privilege('authenticated','public.botb_events','DELETE')
    OR has_table_privilege('authenticated','public.botb_entries','INSERT')
    OR has_table_privilege('authenticated','public.botb_entries','UPDATE')
    OR has_table_privilege('anon','public.botb_entries','DELETE')
    OR NOT has_table_privilege('authenticated','public.botb_events','SELECT')
    OR NOT has_table_privilege('authenticated','public.botb_entries','SELECT')
    OR NOT has_table_privilege('authenticated','public.botb_entries','DELETE')
    OR NOT has_table_privilege('service_role','public.botb_events','UPDATE')
    OR NOT has_table_privilege('service_role','public.botb_entries','INSERT')
  THEN
    RAISE EXCEPTION 'BOTB_PRIVILEGE_HARDENING_INCOMPLETE';
  END IF;
END;
$verify_botb_grants$;
