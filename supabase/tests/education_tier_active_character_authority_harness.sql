-- Executed on LIVE Supabase and passed 18 Oct 2026 inside a rollback-only
-- transaction; JWT/session changes are local and no real character is mutated.
BEGIN;
DO $tests$
DECLARE v_owner uuid; v_active uuid; v_inactive uuid; v_other uuid;
BEGIN
 SELECT active.user_id,active.id,inactive.id INTO v_owner,v_active,v_inactive
 FROM public.profiles active JOIN public.profiles inactive
 ON inactive.user_id=active.user_id
 WHERE active.is_active IS TRUE AND inactive.is_active IS FALSE
 AND active.user_id IS NOT NULL LIMIT 1;
 SELECT id INTO v_other FROM public.profiles WHERE user_id<>v_owner LIMIT 1;
 IF v_owner IS NULL OR v_inactive IS NULL OR v_other IS NULL THEN
   RAISE EXCEPTION 'No active/inactive same-account security test fixture';
 END IF;
 IF has_function_privilege('anon','public.skill_tier_unlocked(uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.skill_tier_access_bulk(uuid,text[])','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.skill_tier_unlocked(uuid,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.skill_tier_unlocked(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Eligibility RPC permissions invalid'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF NOT public.skill_tier_unlocked(v_active,'guitar') THEN
   RAISE EXCEPTION 'Active owner denied';
 END IF;
 IF public.skill_tier_unlocked(v_inactive,'guitar')
 OR public.skill_tier_unlocked(v_other,'guitar') THEN
   RAISE EXCEPTION 'Inactive or foreign character eligibility exposed';
 END IF;
 IF EXISTS(SELECT 1 FROM public.skill_tier_access_bulk(v_inactive,ARRAY['guitar']) WHERE is_unlocked)
 OR EXISTS(SELECT 1 FROM public.skill_tier_access_bulk(v_other,ARRAY['guitar']) WHERE is_unlocked) THEN
   RAISE EXCEPTION 'Bulk tier lookup bypassed owner/active guard';
 END IF;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 IF NOT public.skill_tier_unlocked(v_inactive,'guitar') THEN
   RAISE EXCEPTION 'Trusted service processing for inactive profile denied';
 END IF;
END;
$tests$;
ROLLBACK;
