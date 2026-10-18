-- PooTube is fictional. Validate full skill coverage without YouTube URLs.
DO $catalogue$
BEGIN
 IF EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE (
   SELECT count(*) FROM public.education_youtube_resources v
   WHERE v.skill_slug::text=sd.slug::text
     AND v.video_url LIKE 'pooutube://lesson/%'
 )<2) THEN RAISE EXCEPTION 'Some skills lack two fictional PooTube lessons'; END IF;
 IF position('education_video_unverified' IN
   pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure))<>0
 THEN RAISE EXCEPTION 'XP function still requires real YouTube playback'; END IF;
 IF NOT has_function_privilege('authenticated','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Mentor discovery access regression'; END IF;
END $catalogue$;

-- Roll back the entire XP/ledger claim from a test-owned profile.
-- New databases with no registered player profiles skip this optional smoke.
BEGIN;
DO $smoke$
DECLARE p uuid; usr uuid; vid uuid; name text; slug text; reward jsonb;
BEGIN
 SELECT profile.id,profile.user_id INTO p,usr
 FROM public.profiles profile
 JOIN public.player_xp_wallet wallet ON wallet.profile_id=profile.id
 WHERE profile.user_id IS NOT NULL AND profile.is_active IS TRUE
 AND profile.deleted_at IS NULL AND profile.died_at IS NULL
 AND (SELECT count(*) FROM public.education_video_reward_claims c
      WHERE c.profile_id=profile.id AND c.claimed_at>now()-interval '2 hours')<2
 ORDER BY profile.id LIMIT 1;
 IF p IS NULL THEN RAISE NOTICE 'No valid player fixture for transactional XP smoke'; RETURN; END IF;
 SELECT id,title,skill_slug INTO vid,name,slug
 FROM public.education_youtube_resources
 WHERE video_url LIKE 'pooutube://lesson/%' ORDER BY id LIMIT 1;
 IF vid IS NULL THEN RAISE EXCEPTION 'Missing fictional video fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',usr::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',
   jsonb_build_object('sub',usr::text,'role','authenticated')::text,true);
 reward := public.reward_education_video_atomic(p,vid::text,name,slug);
 IF coalesce((reward->>'xpEarned')::integer,0) <> 15
 THEN RAISE EXCEPTION 'In-game PooTube completion awarded unexpected XP: %',reward; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.education_video_reward_claims c
                WHERE c.id=(reward->>'claimId')::uuid AND c.profile_id=p)
 THEN RAISE EXCEPTION 'Atomic XP claim was not recorded'; END IF;
END $smoke$;
ROLLBACK;
