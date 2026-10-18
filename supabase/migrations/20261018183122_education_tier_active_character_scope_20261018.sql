-- Applied DIRECTLY to live Supabase as migration version 20261018183122
-- on 18 October 2026. Preserve prior suffix mastery rules and trusted service
-- lookups; block direct authenticated tier queries for inactive/deleted/dead
-- or unrelated characters. No changes to saved skill progress or XP.
DO $patch$
DECLARE old_definition text;
DECLARE old_guard text := E'      AND owner.user_id=auth.uid()\n';
DECLARE new_guard text := E'      AND owner.user_id=auth.uid()\n      AND owner.is_active IS TRUE\n      AND owner.deleted_at IS NULL\n      AND owner.died_at IS NULL\n';
BEGIN
 SELECT pg_get_functiondef('public.skill_tier_unlocked(uuid,text)'::regprocedure)
 INTO old_definition;
 IF old_definition IS NULL
 OR position(old_guard IN old_definition)=0
 OR position('AND owner.is_active IS TRUE' IN old_definition)>0
 OR has_function_privilege('anon','public.skill_tier_unlocked(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Unexpected eligibility RPC source or permissions; aborting';
 END IF;
 EXECUTE replace(old_definition,old_guard,new_guard);
 IF position('AND owner.is_active IS TRUE' IN
   pg_get_functiondef('public.skill_tier_unlocked(uuid,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Active character ownership guard was not installed'; END IF;
END;
$patch$;
REVOKE EXECUTE ON FUNCTION public.skill_tier_unlocked(uuid,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.skill_tier_access_bulk(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.skill_tier_unlocked(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.skill_tier_access_bulk(uuid,text[]) TO authenticated,service_role;
