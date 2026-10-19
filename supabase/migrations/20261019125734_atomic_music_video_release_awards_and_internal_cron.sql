-- Issue #4253: the production release and all rewards must share one DB
-- transaction. The former Edge worker used separate, replayable writes.
CREATE TABLE IF NOT EXISTS public.music_video_production_awards (
  video_id uuid PRIMARY KEY REFERENCES public.music_videos(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id),
  band_id uuid REFERENCES public.bands(id),
  profile_id uuid REFERENCES public.profiles(id),
  hype_awarded integer NOT NULL CHECK (hype_awarded BETWEEN 0 AND 100),
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.music_video_production_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.music_video_production_awards FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.music_video_production_awards TO service_role;

CREATE OR REPLACE FUNCTION public.complete_due_music_video_productions_atomic(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $complete$
DECLARE
  v_video record;
  v_song record;
  v_profile_id uuid;
  v_hype integer;
  v_rows integer;
  v_completed integer:=0;
  v_fame integer;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200
  THEN RAISE EXCEPTION 'invalid_video_completion_batch_size'; END IF;

  FOR v_video IN
    SELECT v.id,v.song_id,v.title,v.production_quality,v.budget,v.created_at
    FROM public.music_videos v
    WHERE v.status='production'
      AND v.created_at +
        (CASE WHEN v.budget>=50000 THEN 6
              WHEN v.budget>=25000 THEN 12
              WHEN v.budget>=10000 THEN 24
              WHEN v.budget>=5000 THEN 36 ELSE 48 END) * interval '1 hour'
       <= now()
    ORDER BY v.created_at,v.id LIMIT p_limit
    FOR UPDATE OF v SKIP LOCKED
  LOOP
    IF EXISTS (SELECT 1 FROM public.music_video_production_awards
               WHERE video_id=v_video.id)
    THEN RAISE EXCEPTION 'video_already_awarded_but_not_released_%',v_video.id; END IF;

    SELECT s.id,s.band_id,s.user_id,s.profile_id,s.quality_score
      INTO STRICT v_song FROM public.songs s WHERE s.id=v_video.song_id;

    v_profile_id:=NULL;
    IF v_song.profile_id IS NOT NULL THEN
      SELECT p.id INTO v_profile_id
      FROM public.profiles p
      WHERE p.id=v_song.profile_id AND p.user_id=v_song.user_id
      FOR UPDATE;
    END IF;
    IF v_profile_id IS NULL THEN
      SELECT p.id INTO v_profile_id
      FROM public.profiles p
      WHERE p.user_id=v_song.user_id AND p.is_active IS TRUE
        AND p.died_at IS NULL
      ORDER BY p.id LIMIT 1 FOR UPDATE;
    END IF;

    v_hype:=LEAST(100,GREATEST(0,
      round(50 * (GREATEST(0,LEAST(100,v_video.production_quality))::numeric/100)
               * (GREATEST(0,LEAST(100,v_song.quality_score))::numeric/100)
            + floor(random()*30))::integer));
    v_fame:=v_hype*2;

    UPDATE public.music_videos
    SET status='released',release_date=now(),hype_score=v_hype
    WHERE id=v_video.id AND status='production';
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN
      RAISE EXCEPTION 'video_completion_state_changed_%',v_video.id; END IF;

    INSERT INTO public.music_video_production_awards(
      video_id,song_id,band_id,profile_id,hype_awarded
    ) VALUES(v_video.id,v_song.id,v_song.band_id,v_profile_id,v_hype);

    IF v_song.band_id IS NOT NULL THEN
      UPDATE public.bands SET
        fame=LEAST(2147483647::bigint,
                   GREATEST(0,COALESCE(fame,0))::bigint+v_fame)::integer,
        morale=LEAST(100,COALESCE(morale,50)+
          CASE WHEN v_hype>=60 THEN 5 ELSE 3 END),
        fan_sentiment_score=LEAST(100,COALESCE(fan_sentiment_score,0)+
          CASE WHEN v_hype>=60 THEN 6 ELSE 3 END),
        reputation_score=LEAST(100,COALESCE(reputation_score,0)+
          CASE WHEN v_hype>=60 THEN 3 ELSE 1 END)
      WHERE id=v_song.band_id;
      GET DIAGNOSTICS v_rows=ROW_COUNT;
      IF v_rows<>1 THEN RAISE EXCEPTION 'video_band_missing_%',v_song.band_id; END IF;
    END IF;

    IF v_profile_id IS NOT NULL THEN
      UPDATE public.profiles SET
        fame=LEAST(2147483647::bigint,
                   GREATEST(0,COALESCE(fame,0))::bigint+v_hype)::integer
      WHERE id=v_profile_id;
      GET DIAGNOSTICS v_rows=ROW_COUNT;
      IF v_rows<>1 THEN RAISE EXCEPTION 'video_profile_missing_%',v_profile_id; END IF;
    END IF;

    INSERT INTO public.activity_feed(user_id,profile_id,activity_type,message,metadata)
    VALUES(v_song.user_id,v_profile_id,'video_released',
      format('Music video "%s" has been released on PooTube!',v_video.title),
      jsonb_build_object('video_id',v_video.id,'title',v_video.title,
                         'hype_score',v_hype,'production_award',true));

    v_completed:=v_completed+1;
  END LOOP;
  RETURN jsonb_build_object('completed',v_completed);
END
$complete$;

CREATE OR REPLACE FUNCTION public.run_music_video_production_completion_scheduled()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $run$
DECLARE
 v_job_id uuid;
 v_started_at timestamptz:=clock_timestamp();
 v_summary jsonb;
BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(4253,48) THEN
   RETURN jsonb_build_object('skipped',true,'reason','previous_completion_running');
 END IF;
 INSERT INTO public.cron_job_runs(job_name,status,triggered_by)
 VALUES('complete-video-production','running','pg_cron')
 RETURNING id INTO v_job_id;

 v_summary:=public.complete_due_music_video_productions_atomic(100);

 UPDATE public.cron_job_runs SET status='success',
   completed_at=now(),
   duration_ms=LEAST(2147483647,(EXTRACT(EPOCH FROM clock_timestamp()-v_started_at)*1000)::bigint)::integer,
   processed_count=coalesce((v_summary->>'completed')::integer,0),
   error_count=0,result_summary=v_summary
 WHERE id=v_job_id;

 RETURN v_summary;
END
$run$;

REVOKE ALL ON FUNCTION public.complete_due_music_video_productions_atomic(integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_music_video_production_completion_scheduled()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_due_music_video_productions_atomic(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_music_video_production_completion_scheduled() TO service_role;

-- Reconfigure the SAME pg_cron job, without changing its half-hour schedule.
-- The transaction and unique award receipt replace a public service-role HTTP
-- endpoint and its stored bearer token. Do not backfill old released videos.
DO $cron$
DECLARE v_old bigint; v_new bigint;
BEGIN
 SELECT jobid INTO STRICT v_old FROM cron.job
 WHERE jobname='complete-video-production' AND active=true;
 IF v_old<>48 THEN RAISE EXCEPTION 'video_completion_cron_identity_changed'; END IF;
 v_new:=cron.schedule('complete-video-production','*/30 * * * *',
   $cmd$SELECT public.run_music_video_production_completion_scheduled();$cmd$);
 IF v_new IS DISTINCT FROM v_old THEN
   RAISE EXCEPTION 'video_completion_cron_replaced'; END IF;
END $cron$;

UPDATE public.cron_job_config SET allow_manual_trigger=false,updated_at=now()
 WHERE edge_function_name='complete-video-production';
