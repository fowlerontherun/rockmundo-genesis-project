-- Production hotfix reconciliation (16 Oct 2026).
-- The reservation/finalisation procedures previously checked only the legacy
-- request.jwt.claim.role GUC, which is absent when JWT claims are supplied
-- through request.jwt.claims. Keep service-role-only access enforced.
DO $repair$
DECLARE
  f record;
  definition text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('reserve_song_generation_atomic', 'finish_song_generation_atomic')
  LOOP
    definition := pg_get_functiondef(f.oid);
    IF definition LIKE '%auth.role() IS DISTINCT FROM ''service_role''%' THEN
      CONTINUE; -- Already applied in production.
    END IF;
    IF definition NOT LIKE '%current_setting(''request.jwt.claim.role'', true) IS DISTINCT FROM ''service_role''%' THEN
      RAISE EXCEPTION 'Unexpected service-role guard in %: manual review required', f.proname;
    END IF;
    definition := replace(
      definition,
      'current_setting(''request.jwt.claim.role'', true) IS DISTINCT FROM ''service_role''',
      'auth.role() IS DISTINCT FROM ''service_role'''
    );
    EXECUTE definition;
  END LOOP;
END $repair$;
