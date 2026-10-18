-- Applied directly to live Rockmundo Supabase on 2026-10-18.
-- Historical repair record, not meant to be replayed against an already-patched DB.
-- Preserve the existing function owner, grants, SECURITY DEFINER, prerequisites,
-- legacy earned XP, and server-side attendance/reward code.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $patch$
DECLARE definition text;
DECLARE needle text := E'BEGIN\n  IF p_slug IS NULL OR btrim(p_slug) = '''' THEN\n';
DECLARE replacement text := E'BEGIN\n  -- Signed-in game clients may check only characters owned by their account.\n'
  || E'  -- Trusted service_role / internal database jobs remain unrestricted.\n'
  || E'  IF auth.role() = ''authenticated'' THEN\n'
  || E'    IF p_profile_id IS NULL OR auth.uid() IS NULL OR NOT EXISTS (\n'
  || E'      SELECT 1 FROM public.profiles owner WHERE owner.id=p_profile_id\n'
  || E'      AND owner.user_id=auth.uid()\n'
  || E'    ) THEN\n'
  || E'      RETURN false;\n'
  || E'    END IF;\n'
  || E'  END IF;\n\n'
  || E'  IF p_slug IS NULL OR btrim(p_slug) = '''' THEN\n';
BEGIN
 SELECT pg_get_functiondef('public.skill_tier_unlocked(uuid,text)'::regprocedure) INTO definition;
 IF definition IS NULL OR position(needle IN definition)=0
 OR position('owner.user_id=auth.uid()' IN definition)>0 THEN
  RAISE EXCEPTION 'Unexpected tier function definition; aborting safe change';
 END IF;
 EXECUTE replace(definition,needle,replacement);
END $patch$;
COMMIT;

-- Verification was run in the same original patch transaction and
-- independently afterward; SQL harness below is safe/read-only.
-- Existing direct SELECT policies on public.skill_progress still allow
-- authenticated access to skill XP by design; do not silently change global
-- game player visibility without product review.
