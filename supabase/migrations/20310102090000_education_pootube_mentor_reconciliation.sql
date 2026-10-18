-- Rockmundo PooTube is an entirely fictional in-game learning activity.
-- No real YouTube URL, embed or external player is required to study.
-- Safe/idempotent on installations that already have these catalogue rows.
-- Production was repaired directly on 2026-10-18.

-- Every defined skill receives two reusable, game-native lesson activities.
-- Keep existing book/video catalogue rows, historical claims and XP unchanged.
WITH lesson_templates(idx,suffix,description,difficulty,duration) AS (
 VALUES
 (1,'Essentials','Discover the key ideas behind %s, with examples, useful terminology and a guided demonstration.',1,10),
 (2,'Practice Session','Follow an in-game practice workshop for %s, review common mistakes and test what you learned.',2,14)
), lessons AS (
 SELECT sd.slug::text skill_slug,sd.display_name,template.idx,template.suffix,
        template.description,template.difficulty,template.duration,
        ('pooutube://lesson/'||sd.slug::text||'/'||template.idx)::varchar AS local_ref
 FROM public.skill_definitions sd CROSS JOIN lesson_templates template
)
INSERT INTO public.education_youtube_resources
(title,description,video_url,category,difficulty_level,duration_minutes,tags,skill_slug,channel_name,is_featured)
SELECT left(display_name||' — '||suffix,240),format(description,display_name),
       local_ref,'PooTube Originals',difficulty,duration,
       ARRAY['in-game lesson','PooTube',CASE WHEN idx=1 THEN 'essentials' ELSE 'practice' END]::text[],
       skill_slug,'Rockmundo Academy',false
FROM lessons l
WHERE NOT EXISTS (
 SELECT 1 FROM public.education_youtube_resources v WHERE v.video_url=l.local_ref
);

-- A short-lived experiment mistakenly required a real externally verified
-- YouTube URL for XP. Remove ONLY this known block if present; preserve all
-- ownership, skill progression, quota and atomic ledger checks.
DO $restore_pootube$
DECLARE
 f text;
 blocked text := E'  IF NOT coalesce(v_resource.verified_video,false) OR v_resource.video_url !~ ''/watch[?]v=[A-Za-z0-9_-]{11}($|[&#])'' THEN\n    RAISE EXCEPTION ''education_video_unverified'' USING ERRCODE=''22023'';\n  END IF;\n';
BEGIN
 SELECT pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure)
 INTO f;
 IF f IS NULL THEN RAISE EXCEPTION 'Missing atomic PooTube XP function'; END IF;
 IF position(blocked IN f)>0 THEN
  EXECUTE replace(f,blocked,'');
 ELSIF position('education_video_unverified' IN f)>0 THEN
  RAISE EXCEPTION 'Unknown video verification guard: manual review required';
 END IF;
 IF position('education_video_profile_not_owned' IN
  pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'PooTube profile ownership safeguard missing'; END IF;
END $restore_pootube$;

-- An older SECURITY DEFINER discovery RPC could unlock mentors against other
-- players' profiles. Preserve discovery methods but enforce ownership and
-- exploration-city checks. No existing discoveries or sessions are deleted.
CREATE OR REPLACE FUNCTION public.discover_master(
 p_profile_id uuid, p_mentor_id uuid,
 p_method text DEFAULT 'exploration', p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_mentor public.education_mentors%ROWTYPE;
BEGIN
 IF p_profile_id IS NULL OR p_mentor_id IS NULL THEN RAISE EXCEPTION 'mentor_invalid_discovery'; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND
   (auth.uid() IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.id=p_profile_id AND p.user_id=auth.uid()
   )) THEN RAISE EXCEPTION 'mentor_profile_not_owned'; END IF;
 SELECT * INTO v_mentor FROM public.education_mentors
 WHERE id=p_mentor_id AND is_active=true AND COALESCE(is_discoverable,true);
 IF NOT FOUND THEN RAISE EXCEPTION 'mentor_not_discoverable'; END IF;
 IF v_mentor.city_id IS NOT NULL AND p_method='exploration' AND NOT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id=p_profile_id AND p.current_city_id=v_mentor.city_id
 ) THEN RAISE EXCEPTION 'mentor_wrong_city'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('exploration','npc_hint','achievement','friend_tip','admin_grant','venue_gig','studio_session','automatic')
 THEN RAISE EXCEPTION 'mentor_invalid_discovery_method'; END IF;
 INSERT INTO public.player_master_discoveries
  (profile_id,mentor_id,discovery_method,discovery_metadata)
 VALUES(p_profile_id,p_mentor_id,p_method,COALESCE(p_metadata,'{}'::jsonb))
 ON CONFLICT(profile_id,mentor_id) DO NOTHING;
 RETURN true;
END $function$;
REVOKE EXECUTE ON FUNCTION public.discover_master(uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_master(uuid,uuid,text,jsonb) TO authenticated, service_role;

-- Preserve all original discovery labels and explicitly allow newer venue/studio
-- and automatic events. The old CHECK disallowed methods already used by clients.
ALTER TABLE public.player_master_discoveries
  DROP CONSTRAINT IF EXISTS player_master_discoveries_discovery_method_check;
ALTER TABLE public.player_master_discoveries
  ADD CONSTRAINT player_master_discoveries_discovery_method_check
  CHECK (discovery_method IN (
   'exploration','npc_hint','achievement','friend_tip','admin_grant',
   'venue_gig','studio_session','automatic'
  ));

-- A successful historical mentor session proves the player has met that
-- mentor. Restore only missing discoveries and preserve original first date.
INSERT INTO public.player_master_discoveries
 (profile_id,mentor_id,discovered_at,discovery_method,discovery_metadata)
SELECT sessions.profile_id,sessions.mentor_id,min(sessions.session_date),
       'admin_grant',jsonb_build_object(
         'source','verified_prior_mentor_session','restored_on','2026-10-18'
       )
FROM public.player_mentor_sessions sessions
JOIN public.profiles p ON p.id=sessions.profile_id
JOIN public.education_mentors mentors ON mentors.id=sessions.mentor_id
GROUP BY sessions.profile_id,sessions.mentor_id
ON CONFLICT (profile_id,mentor_id) DO NOTHING;

DO $verify$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.skill_definitions sd
  WHERE (SELECT count(*) FROM public.education_youtube_resources r
         WHERE r.skill_slug::text=sd.slug::text
         AND r.video_url LIKE 'pooutube://lesson/%') < 2
 ) THEN RAISE EXCEPTION 'Missing fictional PooTube lessons for skills'; END IF;
 IF position('education_video_unverified' IN
   pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure))>0
 THEN RAISE EXCEPTION 'External video gate still enabled'; END IF;
 IF has_function_privilege('anon','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Anon mentor discovery is incorrectly permitted'; END IF;
 IF EXISTS (SELECT 1 FROM public.player_mentor_sessions sess WHERE NOT EXISTS (
   SELECT 1 FROM public.player_master_discoveries d WHERE d.profile_id=sess.profile_id AND d.mentor_id=sess.mentor_id
 )) THEN RAISE EXCEPTION 'Existing trained mentors must count as discovered'; END IF;
END $verify$;
