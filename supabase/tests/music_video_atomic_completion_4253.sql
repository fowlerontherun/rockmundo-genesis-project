-- #4253: production-safe rollback-only fixture certification.
-- No player XP, fame, band progress, video or activity writes persist.
BEGIN;
SET LOCAL statement_timeout='25s';
DO $verify$
DECLARE
 v_band_song uuid;
 v_solo_song uuid;
 v_band_id uuid;
 v_band_profile uuid;
 v_solo_profile uuid;
 v_band_video uuid;
 v_solo_video uuid;
 v_not_due_video uuid;
 v_band_base bigint;
 v_band_profile_base bigint;
 v_solo_profile_base bigint;
 v_band_hype integer;
 v_solo_hype integer;
 v_result jsonb;
 v_replay jsonb;
 v_profile_actual bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM public.music_videos v WHERE v.status='production'
      AND v.created_at+
       (CASE WHEN v.budget>=50000 THEN 6 WHEN v.budget>=25000 THEN 12
             WHEN v.budget>=10000 THEN 24 WHEN v.budget>=5000 THEN 36
             ELSE 48 END)*interval '1 hour' <=now())
 THEN RAISE EXCEPTION 'real_due_production_exists_aborting_test'; END IF;

 SELECT s.id,s.band_id,s.profile_id
 INTO STRICT v_band_song,v_band_id,v_band_profile
 FROM public.songs s
 JOIN public.profiles p ON p.id=s.profile_id AND p.user_id=s.user_id
 WHERE s.band_id IS NOT NULL ORDER BY s.id LIMIT 1;

 SELECT s.id,s.profile_id
 INTO STRICT v_solo_song,v_solo_profile
 FROM public.songs s
 JOIN public.profiles p ON p.id=s.profile_id AND p.user_id=s.user_id
 WHERE s.band_id IS NULL ORDER BY s.id LIMIT 1;

 SELECT fame INTO STRICT v_band_base
 FROM public.bands WHERE id=v_band_id;
 SELECT fame INTO STRICT v_band_profile_base
 FROM public.profiles WHERE id=v_band_profile;
 SELECT fame INTO STRICT v_solo_profile_base
 FROM public.profiles WHERE id=v_solo_profile;

 INSERT INTO public.music_videos(song_id,title,budget,production_quality,status,created_at)
 VALUES(v_band_song,'__4253_rollback_band__',2500,60,'production',now()-interval '72 hours')
 RETURNING id INTO v_band_video;

 INSERT INTO public.music_videos(song_id,title,budget,production_quality,status,created_at)
 VALUES(v_solo_song,'__4253_rollback_solo__',5000,55,'production',now()-interval '48 hours')
 RETURNING id INTO v_solo_video;

 INSERT INTO public.music_videos(song_id,title,budget,production_quality,status,created_at)
 VALUES(v_solo_song,'__4253_not_due__',2500,70,'production',now())
 RETURNING id INTO v_not_due_video;

 v_result:=public.complete_due_music_video_productions_atomic(100);
 IF (v_result->>'completed')::integer<>2 THEN
   RAISE EXCEPTION 'video_completion_batch_count_wrong_%',v_result; END IF;

 SELECT hype_awarded INTO STRICT v_band_hype FROM public.music_video_production_awards
 WHERE video_id=v_band_video AND profile_id=v_band_profile AND band_id=v_band_id;
 SELECT hype_awarded INTO STRICT v_solo_hype FROM public.music_video_production_awards
 WHERE video_id=v_solo_video AND profile_id=v_solo_profile AND band_id IS NULL;

 IF (SELECT count(*) FROM public.music_videos WHERE id IN(v_band_video,v_solo_video)
     AND status='released' AND release_date IS NOT NULL AND hype_score BETWEEN 0 AND 100)<>2
 THEN RAISE EXCEPTION 'video_release_state_incorrect'; END IF;
 IF (SELECT count(*) FROM public.music_videos WHERE id=v_not_due_video
     AND status='production' AND release_date IS NULL)<>1
 THEN RAISE EXCEPTION 'not_due_video_released'; END IF;

 IF (SELECT fame FROM public.bands WHERE id=v_band_id)
    IS DISTINCT FROM LEAST(2147483647::bigint,v_band_base+2*v_band_hype)::integer
 THEN RAISE EXCEPTION 'band_video_fame_incorrect'; END IF;

 SELECT fame INTO v_profile_actual FROM public.profiles WHERE id=v_band_profile;
 IF v_profile_actual IS DISTINCT FROM LEAST(2147483647::bigint,
    v_band_profile_base+v_band_hype+
    CASE WHEN v_band_profile=v_solo_profile THEN v_solo_hype ELSE 0 END)
 THEN RAISE EXCEPTION 'band_owner_character_fame_incorrect'; END IF;
 SELECT fame INTO v_profile_actual FROM public.profiles WHERE id=v_solo_profile;
 IF v_profile_actual IS DISTINCT FROM LEAST(2147483647::bigint,
    v_solo_profile_base+v_solo_hype+
    CASE WHEN v_band_profile=v_solo_profile THEN v_band_hype ELSE 0 END)
 THEN RAISE EXCEPTION 'solo_owner_character_fame_incorrect'; END IF;

 IF (SELECT count(*) FROM public.activity_feed
   WHERE activity_type='video_released'
     AND (metadata->>'video_id')::uuid IN(v_band_video,v_solo_video))<>2
 THEN RAISE EXCEPTION 'video_release_activity_notice_count_incorrect'; END IF;

 v_replay:=public.complete_due_music_video_productions_atomic(100);
 IF (v_replay->>'completed')::integer<>0
 THEN RAISE EXCEPTION 'video_reward_replayed'; END IF;

 IF (SELECT count(*) FROM public.music_video_production_awards
   WHERE video_id IN(v_band_video,v_solo_video))<>2
 THEN RAISE EXCEPTION 'video_award_receipt_replay_guard_missing'; END IF;

 IF has_function_privilege('anon','public.complete_due_music_video_productions_atomic(integer)','execute')
   OR has_function_privilege('authenticated','public.complete_due_music_video_productions_atomic(integer)','execute')
   OR has_function_privilege('anon','public.run_music_video_production_completion_scheduled()','execute')
   OR has_function_privilege('authenticated','public.run_music_video_production_completion_scheduled()','execute')
   OR NOT has_function_privilege('service_role','public.run_music_video_production_completion_scheduled()','execute')
 THEN RAISE EXCEPTION 'video_completion_acl_incorrect'; END IF;
 IF (SELECT count(*) FROM cron.job
    WHERE jobid=48 AND jobname='complete-video-production'
      AND active AND schedule='*/30 * * * *'
      AND command='SELECT public.run_music_video_production_completion_scheduled();')<>1
 THEN RAISE EXCEPTION 'video_completion_cron_cutover_incorrect'; END IF;
END
$verify$;
ROLLBACK;
SELECT 'video_atomic_completion_band_solo_replay_and_not_due_passed' AS result;
