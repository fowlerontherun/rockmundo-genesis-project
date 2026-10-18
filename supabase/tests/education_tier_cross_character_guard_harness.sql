-- Read-only regression checks for the actual live ownership guard.
-- Runs in a transaction and rolls back all simulated JWT/session settings.
BEGIN;
DO $tests$
DECLARE my_profile uuid;
DECLARE my_owner uuid;
DECLARE other_profile uuid;
BEGIN
 SELECT id,user_id INTO my_profile,my_owner
 FROM public.profiles WHERE user_id IS NOT NULL ORDER BY id LIMIT 1;
 SELECT id INTO other_profile
 FROM public.profiles WHERE user_id <> my_owner ORDER BY id LIMIT 1;
 IF my_profile IS NULL OR other_profile IS NULL THEN
   RAISE EXCEPTION 'Insufficient distinct test characters';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',my_owner::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',my_owner::text,'role','authenticated')::text,true);
 IF auth.uid() IS DISTINCT FROM my_owner THEN RAISE EXCEPTION 'JWT claim fixture invalid'; END IF;

 IF NOT public.skill_tier_unlocked(my_profile,'guitar') THEN
   RAISE EXCEPTION 'Owned profile incorrectly denied';
 END IF;
 IF public.skill_tier_unlocked(other_profile,'guitar') THEN
   RAISE EXCEPTION 'Other account profile accessible';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.skill_tier_access_bulk(other_profile,
     ARRAY['guitar','basic_mixing_mastering']) WHERE is_unlocked
 ) THEN RAISE EXCEPTION 'Bulk tier lookup exposed foreign profile'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.skill_tier_access_bulk(my_profile, ARRAY['guitar'])
   WHERE is_unlocked
 ) THEN RAISE EXCEPTION 'Bulk tier lookup denied owned profile'; END IF;

 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('role','service_role')::text,true);
 IF NOT public.skill_tier_unlocked(other_profile,'guitar') THEN
   RAISE EXCEPTION 'Trusted server role lost tier access';
 END IF;
END $tests$;
ROLLBACK;
