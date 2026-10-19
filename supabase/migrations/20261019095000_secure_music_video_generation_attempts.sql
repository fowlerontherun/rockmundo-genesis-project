-- #4240/#4241: an authenticated, charged video attempt is the ONLY
-- source of authority for starting, completing or refunding AI video jobs.
ALTER TABLE public.music_videos
 DROP CONSTRAINT IF EXISTS music_videos_status_check;
ALTER TABLE public.music_videos
 ADD CONSTRAINT music_videos_status_check
 CHECK (status IN ('planning','generating','failed','production','released'));

CREATE TABLE IF NOT EXISTS public.music_video_generation_attempts (
 id uuid PRIMARY KEY,
 video_id uuid NOT NULL UNIQUE REFERENCES public.music_videos(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 charge_amount bigint NOT NULL CHECK (charge_amount=75000),
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','preparing','generating','succeeded','failed')),
 prediction_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 registered_at timestamptz,
 settled_at timestamptz,
 refunded_at timestamptz,
 error text,
 CONSTRAINT music_video_attempt_refund_once CHECK
   (refunded_at IS NULL OR (state='failed' AND settled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS music_video_attempt_state_created_idx
 ON public.music_video_generation_attempts(state,created_at);
ALTER TABLE public.music_video_generation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.music_video_generation_attempts FROM PUBLIC,anon,authenticated;
-- No app/API write path to attempts except SECURITY DEFINER reserve and service-role settle.

CREATE OR REPLACE FUNCTION public.reserve_music_video_generation(
 p_song_id uuid,p_title text,p_description jsonb,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_profile public.profiles%ROWTYPE;
 v_song public.songs%ROWTYPE;
 v_prior public.music_video_generation_attempts%ROWTYPE;
 v_video uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'VIDEO_AUTH_REQUIRED'; END IF;
 IF p_request_id IS NULL OR p_song_id IS NULL
   OR length(btrim(coalesce(p_title,''))) NOT BETWEEN 1 AND 160
   OR jsonb_typeof(p_description)<>'object'
   OR length(p_description::text)>16000 THEN
   RAISE EXCEPTION 'VIDEO_INVALID_REQUEST';
 END IF;
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=public.current_active_player_profile_id()
   AND user_id=v_user AND is_active IS TRUE
   AND died_at IS NULL AND deleted_at IS NULL
 FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(v_profile.is_vip,false) THEN
   RAISE EXCEPTION 'VIDEO_ACTIVE_VIP_CHARACTER_REQUIRED';
 END IF;

 SELECT * INTO v_prior FROM public.music_video_generation_attempts
 WHERE id=p_request_id;
 IF FOUND THEN
   IF v_prior.user_id<>v_user OR v_prior.profile_id<>v_profile.id OR
      NOT EXISTS (SELECT 1 FROM public.music_videos
         WHERE id=v_prior.video_id AND song_id=p_song_id AND title=btrim(p_title)) THEN
     RAISE EXCEPTION 'VIDEO_RESERVATION_CONFLICT';
   END IF;
   RETURN jsonb_build_object('video_id',v_prior.video_id,
     'attempt_id',v_prior.id,'state',v_prior.state,'already_reserved',true);
 END IF;

 SELECT * INTO v_song FROM public.songs WHERE id=p_song_id;
 IF NOT FOUND OR NOT (
   (v_song.user_id=v_user AND
      (v_song.profile_id IS NULL OR v_song.profile_id=v_profile.id))
   OR (v_song.band_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.band_members bm
     WHERE bm.band_id=v_song.band_id AND bm.profile_id=v_profile.id
       AND bm.user_id=v_user AND bm.member_status='active'
   ))
 ) THEN
   RAISE EXCEPTION 'VIDEO_SONG_NOT_OWNED';
 END IF;
 IF v_profile.cash<75000 THEN RAISE EXCEPTION 'VIDEO_INSUFFICIENT_FUNDS'; END IF;
 INSERT INTO public.music_videos(
   song_id,title,budget,production_quality,status,description,
   views_count,earnings,hype_score
 ) VALUES (
   p_song_id,btrim(p_title),75000,95,'planning',p_description::text,0,0,0
 ) RETURNING id INTO v_video;
 UPDATE public.profiles SET cash=cash-75000
 WHERE id=v_profile.id AND user_id=v_user AND cash>=75000;
 IF NOT FOUND THEN RAISE EXCEPTION 'VIDEO_FUNDS_CHANGED'; END IF;
 INSERT INTO public.music_video_generation_attempts(
   id,video_id,user_id,profile_id,charge_amount,state
 ) VALUES (p_request_id,v_video,v_user,v_profile.id,75000,'reserved');
 RETURN jsonb_build_object('video_id',v_video,
   'attempt_id',p_request_id,'state','reserved','already_reserved',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.reserve_music_video_generation(uuid,text,jsonb,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_music_video_generation(uuid,text,jsonb,uuid)
 TO authenticated,service_role;

-- Claim BEFORE generating the first-frame image to block parallel duplicate
-- provider jobs for one paid reservation.
CREATE OR REPLACE FUNCTION public.claim_music_video_generation(
 p_video_id uuid,p_attempt_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_attempt public.music_video_generation_attempts%ROWTYPE;
BEGIN
 SELECT * INTO v_attempt FROM public.music_video_generation_attempts
 WHERE video_id=p_video_id AND id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR v_attempt.state<>'reserved' THEN
   RAISE EXCEPTION 'VIDEO_RESERVATION_NOT_AVAILABLE';
 END IF;
 UPDATE public.music_video_generation_attempts SET state='preparing'
 WHERE id=v_attempt.id;
 UPDATE public.music_videos SET status='generating',
   generation_started_at=now(),generation_error=NULL
 WHERE id=p_video_id AND status='planning';
 IF NOT FOUND THEN RAISE EXCEPTION 'VIDEO_NOT_PLANNING'; END IF;
 RETURN jsonb_build_object('claimed',true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.claim_music_video_generation(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_music_video_generation(uuid,uuid)
 TO service_role;

CREATE OR REPLACE FUNCTION public.register_music_video_prediction(
 p_video_id uuid,p_attempt_id uuid,p_prediction_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_attempt public.music_video_generation_attempts%ROWTYPE;
BEGIN
 IF p_prediction_id IS NULL OR length(p_prediction_id) NOT BETWEEN 5 AND 256 THEN
   RAISE EXCEPTION 'VIDEO_INVALID_PREDICTION_ID';
 END IF;
 SELECT * INTO v_attempt FROM public.music_video_generation_attempts
 WHERE video_id=p_video_id AND id=p_attempt_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VIDEO_ATTEMPT_NOT_FOUND'; END IF;
 IF v_attempt.state='generating' AND v_attempt.prediction_id=p_prediction_id THEN
   RETURN jsonb_build_object('registered',true,'already_registered',true);
 END IF;
 IF v_attempt.state<>'preparing' OR v_attempt.prediction_id IS NOT NULL THEN
   RAISE EXCEPTION 'VIDEO_ATTEMPT_NOT_RESERVABLE';
 END IF;
 UPDATE public.music_video_generation_attempts
 SET state='generating',prediction_id=p_prediction_id,registered_at=now()
 WHERE id=v_attempt.id;
 -- The preflight claim already marked the video generating.
 RETURN jsonb_build_object('registered',true,'already_registered',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.register_music_video_prediction(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_music_video_prediction(uuid,uuid,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.settle_music_video_generation(
 p_video_id uuid,p_prediction_id text,p_status text,
 p_video_url text,p_error text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_attempt public.music_video_generation_attempts%ROWTYPE;
 v_video public.music_videos%ROWTYPE;
 v_band uuid;
 v_after numeric;
 v_boost numeric;
BEGIN
 IF p_status NOT IN ('succeeded','failed') THEN
   RAISE EXCEPTION 'VIDEO_UNSUPPORTED_TERMINAL_STATUS'; END IF;
 SELECT * INTO v_attempt FROM public.music_video_generation_attempts
 WHERE video_id=p_video_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VIDEO_ATTEMPT_NOT_FOUND'; END IF;
 -- Required for callbacks: prediction ID must match the one registered by
 -- the authenticated, paid generator. Before-provider errors may ONLY fail
 -- an as-yet unregistered reservation with NULL prediction.
 IF p_prediction_id IS NULL THEN
   IF NOT (v_attempt.state IN ('reserved','preparing') AND v_attempt.prediction_id IS NULL
     AND p_status='failed') THEN RAISE EXCEPTION 'VIDEO_UNREGISTERED_SETTLEMENT'; END IF;
 ELSIF v_attempt.prediction_id IS DISTINCT FROM p_prediction_id THEN
   RAISE EXCEPTION 'VIDEO_PREDICTION_MISMATCH';
 END IF;
 IF v_attempt.state IN ('failed','succeeded') THEN
   RETURN jsonb_build_object('settled',false,'reason','already_terminal',
      'status',v_attempt.state,'refunded',v_attempt.refunded_at IS NOT NULL);
 END IF;
 IF p_prediction_id IS NOT NULL AND v_attempt.state<>'generating' THEN
   RAISE EXCEPTION 'VIDEO_NOT_GENERATING'; END IF;

 SELECT * INTO v_video FROM public.music_videos WHERE id=p_video_id FOR UPDATE;
 IF NOT FOUND OR v_video.status NOT IN ('planning','generating') THEN
   RAISE EXCEPTION 'VIDEO_STATE_CONFLICT';
 END IF;

 IF p_status='succeeded' THEN
   IF p_prediction_id IS NULL OR p_video_url IS NULL OR
     length(p_video_url)>2048 OR
     p_video_url !~ '^https://[^[:space:]]+$' THEN
     RAISE EXCEPTION 'VIDEO_INVALID_SUCCESS_URL';
   END IF;
   UPDATE public.music_videos SET status='production',video_url=p_video_url,
     generation_error=NULL,generation_completed_at=now() WHERE id=p_video_id;
   -- Band sentiment/media rewards are guarded by this same locked state,
   -- never by an independently retryable Edge worker read-modify-write.
   SELECT band_id INTO v_band FROM public.songs WHERE id=v_video.song_id;
   IF v_band IS NOT NULL THEN
     UPDATE public.bands SET
       fan_sentiment_score=least(100,coalesce(fan_sentiment_score,0)+6),
       media_intensity=least(100,coalesce(media_intensity,0)+12),
       media_fatigue=least(100,coalesce(media_fatigue,0)+6)
     WHERE id=v_band RETURNING fan_sentiment_score INTO v_after;
     IF FOUND THEN
       INSERT INTO public.band_sentiment_events(
         band_id,event_type,sentiment_change,media_intensity_change,
         media_fatigue_change,sentiment_after,source,description,metadata
       ) VALUES (
         v_band,'music_video_release',6,12,6,v_after,
         'music-video-callback','Verified AI video generation completed',
         jsonb_build_object('video_id',p_video_id,'attempt_id',v_attempt.id)
       );
     END IF;
   END IF;
 ELSE
   UPDATE public.profiles SET cash=cash+v_attempt.charge_amount
   WHERE id=v_attempt.profile_id AND user_id=v_attempt.user_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'VIDEO_REFUND_OWNER_NOT_FOUND'; END IF;
   UPDATE public.music_videos SET status='failed',generation_error=left(coalesce(p_error,'Generation failed'),500),
     generation_completed_at=now() WHERE id=p_video_id;
 END IF;

 UPDATE public.music_video_generation_attempts
 SET state=p_status,settled_at=now(),
   refunded_at=CASE WHEN p_status='failed' THEN now() ELSE NULL END,
   error=CASE WHEN p_status='failed' THEN left(coalesce(p_error,'Generation failed'),500) ELSE NULL END
 WHERE id=v_attempt.id;

 INSERT INTO public.activity_feed(user_id,profile_id,activity_type,message,metadata)
 VALUES (v_attempt.user_id,v_attempt.profile_id,
   CASE WHEN p_status='succeeded' THEN 'video_generation_completed'
        ELSE 'video_generation_failed' END,
   CASE WHEN p_status='succeeded'
     THEN 'AI video generation completed for "'||v_video.title||'".'
     ELSE 'AI video generation failed for "'||v_video.title||'". Your $75,000 charge was refunded.' END,
   jsonb_build_object('video_id',p_video_id,'attempt_id',v_attempt.id,
     'prediction_id',p_prediction_id,'refunded',p_status='failed')
 );
 RETURN jsonb_build_object('settled',true,'status',p_status,
   'refunded',p_status='failed','refund_amount',
   CASE WHEN p_status='failed' THEN v_attempt.charge_amount ELSE 0 END);
END;
$fn$;
REVOKE ALL ON FUNCTION public.settle_music_video_generation(uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_music_video_generation(uuid,text,text,text,text)
 TO service_role;

-- Stale reservations/preflights where no Replicate prediction was registered
-- must not trap $75,000 forever. Only unregistered jobs are eligible;
-- registered predictions are resolved by the signed webhook.
CREATE OR REPLACE FUNCTION public.expire_stale_music_video_preparations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_row record; v_count integer:=0; v_failed integer:=0;
BEGIN
 FOR v_row IN SELECT id,video_id
   FROM public.music_video_generation_attempts
   WHERE state IN ('reserved','preparing') AND prediction_id IS NULL
     AND created_at<now()-interval '1 hour'
   ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
 LOOP
   BEGIN
     PERFORM public.settle_music_video_generation(v_row.video_id,NULL,
       'failed',NULL,'Generation could not start; original charge returned');
     v_count:=v_count+1;
   EXCEPTION WHEN OTHERS THEN
     v_failed:=v_failed+1;
     RAISE WARNING 'Could not reconcile stale video reservation %: %',
       v_row.id,SQLERRM;
   END;
 END LOOP;
 RETURN jsonb_build_object('refunded',v_count,'errors',v_failed);
END;
$fn$;
REVOKE ALL ON FUNCTION public.expire_stale_music_video_preparations()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_music_video_preparations()
 TO service_role;

DO $schedule$
BEGIN
 IF to_regclass('cron.job') IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM cron.job WHERE jobname='expire-unstarted-music-video-generations'
 ) THEN
   PERFORM cron.schedule('expire-unstarted-music-video-generations',
      '0 * * * *','SELECT public.expire_stale_music_video_preparations();');
 END IF;
END;
$schedule$;
