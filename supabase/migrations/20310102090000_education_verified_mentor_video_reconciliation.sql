-- 18 Oct 2026: live-first Education reconciliation.
-- Applied directly to production before source reconciliation; idempotent for fresh resets.
-- Verified videos below refer to published lessons by the attributed educators.
ALTER TABLE public.education_youtube_resources
 ADD COLUMN IF NOT EXISTS verified_video boolean NOT NULL DEFAULT false;

WITH curated(skill_slug,title,description,video_url,category,difficulty_level,duration_minutes,tags,channel_name) AS (
VALUES
 ('basic_singing','Five vocal warm-ups for singing beginners','Cheryl Porter teaches lip trills, pitch, articulation and safe warm-up technique.','https://www.youtube.com/watch?v=1XHXezdnL0A','vocals',1,10,ARRAY['singing','warmups','breathing'],'Cheryl Porter Vocal Coach'),
 ('basic_live_looping','Loop guitar and vocals in Ableton Live','An official Ableton beginner tutorial on audio routing, the Looper effect and recording loops.','https://www.youtube.com/watch?v=q7tq_F9wOqU','music production',1,7,ARRAY['live looping','ableton','guitar'],'Ableton'),
 ('basic_midi_controller','Set up a MIDI controller in Ableton Live','An official Ableton video introducing connection and setup of a MIDI controller.','https://www.youtube.com/watch?v=FPdn2LunC-E','music technology',1,NULL::integer,ARRAY['midi','controller','ableton'],'Ableton'),
 ('basic_percussions','How to play drums: beginner rhythm lesson','Drumeo introduces stick grip, basic beat counting and drum fills.','https://www.youtube.com/watch?v=ondTlJEmPYA','percussion',1,10,ARRAY['percussion','drums','rhythm'],'Drumeo'),
 ('basic_percussions','Learn a basic drum beat with Domino Santantonio','Drumeo beginner lesson and guided practice to build a simple drum beat.','https://www.youtube.com/watch?v=XeVLe4dX9V8','percussion',1,12,ARRAY['percussion','drums','practice'],'Drumeo')
)
INSERT INTO public.education_youtube_resources
 (skill_slug,title,description,video_url,category,difficulty_level,duration_minutes,tags,channel_name,is_featured,verified_video)
SELECT c.skill_slug,c.title,c.description,c.video_url,c.category,c.difficulty_level,c.duration_minutes,c.tags,c.channel_name,false,true
FROM curated c
WHERE EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text=c.skill_slug)
  AND NOT EXISTS(SELECT 1 FROM public.education_youtube_resources v WHERE v.video_url=c.video_url);

UPDATE public.education_youtube_resources
SET verified_video=true
WHERE video_url IN (
 'https://www.youtube.com/watch?v=1XHXezdnL0A',
 'https://www.youtube.com/watch?v=q7tq_F9wOqU',
 'https://www.youtube.com/watch?v=FPdn2LunC-E',
 'https://www.youtube.com/watch?v=ondTlJEmPYA',
 'https://www.youtube.com/watch?v=XeVLe4dX9V8'
);

-- Former function inserted discoveries with SECURITY DEFINER and no ownership
-- check. Bookings reject undiscovered mentors, so guard the discovery flow.
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
     SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid()
   )) THEN RAISE EXCEPTION 'mentor_profile_not_owned'; END IF;
 SELECT * INTO v_mentor FROM public.education_mentors
 WHERE id=p_mentor_id AND is_active=true AND COALESCE(is_discoverable,true);
 IF NOT FOUND THEN RAISE EXCEPTION 'mentor_not_discoverable'; END IF;
 IF v_mentor.city_id IS NOT NULL AND p_method='exploration' AND NOT EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.current_city_id=v_mentor.city_id
 ) THEN RAISE EXCEPTION 'mentor_wrong_city'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('exploration','venue_gig','studio_session','achievement','automatic')
 THEN RAISE EXCEPTION 'mentor_invalid_discovery_method'; END IF;
 INSERT INTO public.player_master_discoveries(profile_id,mentor_id,discovery_method,discovery_metadata)
 VALUES(p_profile_id,p_mentor_id,p_method,COALESCE(p_metadata,'{}'::jsonb))
 ON CONFLICT(profile_id,mentor_id) DO NOTHING;
 RETURN true;
END $function$;

REVOKE EXECUTE ON FUNCTION public.discover_master(uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_master(uuid,uuid,text,jsonb) TO authenticated, service_role;

-- Atomic video XP claims must never reward a search result or unverified
-- placeholder. Upgrade the production function without changing XP maths,
-- ownership, cooldown, ledger, or payout behavior.
DO $video_guard$
DECLARE
 definition text;
 needle text := E'  IF NOT FOUND THEN\n    RAISE EXCEPTION ''education_video_not_in_catalog'' USING ERRCODE=''22023'';\n  END IF;\n';
 guard_sql text := E'  IF NOT coalesce(v_resource.verified_video,false) OR v_resource.video_url !~ ''/watch[?]v=[A-Za-z0-9_-]{11}($|[&#])'' THEN\n    RAISE EXCEPTION ''education_video_unverified'' USING ERRCODE=''22023'';\n  END IF;\n';
BEGIN
 SELECT pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure)
 INTO definition;
 IF definition IS NULL THEN RAISE EXCEPTION 'Video rewards RPC not found'; END IF;
 IF position('education_video_unverified' IN definition)=0 THEN
   IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unrecognized video RPC; cannot insert verification guard'; END IF;
   EXECUTE replace(definition,needle,needle||guard_sql);
 END IF;
END $video_guard$;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.education_youtube_resources
   WHERE verified_video AND video_url IN (
      'https://www.youtube.com/watch?v=1XHXezdnL0A',
      'https://www.youtube.com/watch?v=q7tq_F9wOqU',
      'https://www.youtube.com/watch?v=FPdn2LunC-E',
      'https://www.youtube.com/watch?v=ondTlJEmPYA',
      'https://www.youtube.com/watch?v=XeVLe4dX9V8'
   ))<>5 THEN RAISE EXCEPTION 'Five verified tutorial rows required'; END IF;
 IF has_function_privilege('anon','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous discovery RPC must be denied'; END IF;
 IF position('education_video_unverified' IN pg_get_functiondef('public.reward_education_video_atomic(uuid,text,text,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Video reward guard not installed'; END IF;
END $verify$;
