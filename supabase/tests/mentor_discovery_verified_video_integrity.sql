-- Education regression: no fabricated video rewards and mentors can be discovered
-- only for a character owned by the signed-in user.
DO $verify_education$
DECLARE
  guarded boolean;
BEGIN
 IF (SELECT count(*) FROM public.education_youtube_resources WHERE verified_video) < 5 THEN
  RAISE EXCEPTION 'Five independently verified videos missing';
 END IF;
 IF EXISTS (SELECT 1 FROM public.education_youtube_resources WHERE verified_video=true
   AND video_url !~ '/watch[?]v=[A-Za-z0-9_-]{11}($|[&#])') THEN
  RAISE EXCEPTION 'Verified video contains an invalid direct YouTube ID';
 END IF;
 IF NOT has_function_privilege('authenticated','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Mentor discovery access policy invalid';
 END IF;
 IF position('education_video_unverified' IN pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Video rewards missing catalogue verification guard'; END IF;
 IF position('mentor_profile_not_owned' IN pg_get_functiondef('public.discover_master(uuid,uuid,text,jsonb)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Mentor discovery missing profile ownership guard'; END IF;
END $verify_education$;

BEGIN;
DO $ownership_smoke$
DECLARE own_prof uuid; owner_user uuid; foreign_prof uuid; mentor_uuid uuid; unverified_uuid uuid; response jsonb;
BEGIN
 SELECT p.id,p.user_id INTO own_prof,owner_user FROM public.profiles p
 WHERE p.user_id IS NOT NULL AND p.is_active AND p.deleted_at IS NULL AND p.died_at IS NULL ORDER BY p.id LIMIT 1;
 SELECT p.id INTO foreign_prof FROM public.profiles p WHERE p.user_id<>owner_user ORDER BY p.id LIMIT 1;
 SELECT m.id INTO mentor_uuid FROM public.education_mentors m WHERE m.is_active AND m.is_discoverable IS TRUE
   AND m.city_id IS NULL ORDER BY m.id LIMIT 1;
 SELECT v.id INTO unverified_uuid FROM public.education_youtube_resources v
   WHERE verified_video=false ORDER BY id LIMIT 1;
 IF own_prof IS NULL OR foreign_prof IS NULL OR mentor_uuid IS NULL OR unverified_uuid IS NULL THEN
   RAISE NOTICE 'No representative user/video fixtures: skipping transaction-only learner smoke';
   RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_user::text,'role','authenticated')::text,true);
 BEGIN
  PERFORM public.discover_master(foreign_prof,mentor_uuid,'exploration','{}'::jsonb);
  RAISE EXCEPTION 'Foreign-profile discovery incorrectly succeeded';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'mentor_profile_not_owned' THEN RAISE; END IF;
 END;
 IF NOT public.discover_master(own_prof,mentor_uuid,'exploration','{}'::jsonb) THEN
  RAISE EXCEPTION 'Owned mentor discovery failed'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.player_master_discoveries d
  WHERE d.profile_id=own_prof AND d.mentor_id=mentor_uuid
 ) THEN RAISE EXCEPTION 'Owned mentor discovery was not saved'; END IF;
 BEGIN
  PERFORM public.reward_education_video_atomic(own_prof,unverified_uuid::text,'Unverified video',null);
  RAISE EXCEPTION 'Unverified tutorial granted XP';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'education_video_unverified' THEN RAISE; END IF;
 END;
END $ownership_smoke$;
ROLLBACK;
