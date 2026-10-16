-- Reconcile production AI-generation RPC authorization (2026-10-16).
-- Production confirmed: both SECURITY DEFINER functions have EXECUTE privilege
-- exclusively for postgres and service_role; neither PUBLIC nor authenticated
-- nor anon may invoke them. A second JWT-claim guard inside those functions
-- caused SERVICE_ROLE_REQUIRED even for valid privileged Edge Function calls.
--
-- Ensure the database API permissions are the actual authorization boundary.
-- These functions must only be invoked from trusted backend code; the admin
-- and player Edge Functions must authenticate/authorize callers first.
DO $repair$
DECLARE
  f record;
  definition text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('reserve_song_generation_atomic','finish_song_generation_atomic')
  LOOP
    -- First ensure SQL-level EXECUTE cannot be inherited by untrusted roles.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.oid::regprocedure);
    IF has_function_privilege('anon',f.oid,'EXECUTE')
       OR has_function_privilege('authenticated',f.oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Unsafe privileges for %',f.proname;
    END IF;
    definition:=pg_get_functiondef(f.oid);
    -- Support both the legacy guard and the later JWT-aware guard.
    definition:=replace(definition,
      E'  IF current_setting(''request.jwt.claim.role'', true) IS DISTINCT FROM ''service_role'' THEN\n    RAISE EXCEPTION ''SERVICE_ROLE_REQUIRED'' USING ERRCODE=''42501'';\n  END IF;\n',
      E'  -- Trusted execution is enforced by PostgreSQL function EXECUTE privileges.\n');
    definition:=replace(definition,
      E'  IF auth.role() IS DISTINCT FROM ''service_role'' THEN\n    RAISE EXCEPTION ''SERVICE_ROLE_REQUIRED'' USING ERRCODE=''42501'';\n  END IF;\n',
      E'  -- Trusted execution is enforced by PostgreSQL function EXECUTE privileges.\n');
    IF definition LIKE '%SERVICE_ROLE_REQUIRED%' THEN
      RAISE EXCEPTION 'Unexpected additional authorization guard in %',f.proname;
    END IF;
    EXECUTE definition;
    -- CREATE OR REPLACE FUNCTION preserves ACL, but assert again after change.
    IF has_function_privilege('anon',f.oid,'EXECUTE')
       OR has_function_privilege('authenticated',f.oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Unsafe post-replacement privileges for %',f.proname;
    END IF;
  END LOOP;
END $repair$;
