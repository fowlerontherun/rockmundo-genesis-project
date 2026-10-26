-- Music-video settlements must be all-or-nothing and character-specific.
-- Legacy 2026-10-26 failed processing changed the video BEFORE its profile lookup
-- failed. Never automatically replay a date in video_simulation_day_claims.
CREATE TABLE IF NOT EXISTS public.video_daily_settlements (
  run_date date NOT NULL,
  video_id uuid NOT NULL REFERENCES public.music_videos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_error text,
  daily_views bigint,
  earned_cents integer,
  creator_paid integer,
  band_paid integer,
  owner_profile_id uuid,
  band_id uuid,
  PRIMARY KEY (run_date,video_id)
);
CREATE TABLE IF NOT EXISTS public.video_royalty_carry (
  video_id uuid PRIMARY KEY REFERENCES public.music_videos(id) ON DELETE CASCADE,
  creator_cents integer NOT NULL DEFAULT 0 CHECK (creator_cents BETWEEN 0 AND 99),
  band_cents integer NOT NULL DEFAULT 0 CHECK (band_cents BETWEEN 0 AND 99),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_daily_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_royalty_carry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_daily_settlements, public.video_royalty_carry FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.video_daily_settlements, public.video_royalty_carry TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_daily_video(p_day date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_video_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF p_day IS NULL OR p_day <> (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Only the current UTC date may be simulated';
  END IF;
  -- Older jobs may already have incremented the view count without paying the
  -- artist; do not replay those dates without a separate, audited reconciliation.
  IF EXISTS (SELECT 1 FROM public.video_simulation_day_claims WHERE run_date=p_day) THEN
    RETURN NULL;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-video:'||p_day::text,0));
  -- A stale processing claim is safe to reclaim because every settlement
  -- transaction is atomic; a concurrent late finish serializes on its receipt.
  SELECT s.video_id INTO v_video_id
  FROM public.video_daily_settlements s
  WHERE s.run_date=p_day AND s.status='processing'
    AND s.started_at < now() - interval '3 minutes'
  ORDER BY s.started_at
  FOR UPDATE SKIP LOCKED LIMIT 1;
  IF v_video_id IS NOT NULL THEN
    UPDATE public.video_daily_settlements
    SET started_at=now(),finished_at=NULL,last_error=NULL
    WHERE run_date=p_day AND video_id=v_video_id;
    RETURN v_video_id;
  END IF;

  SELECT v.id INTO v_video_id FROM public.music_videos v
  JOIN public.songs s ON s.id=v.song_id
  WHERE v.status='released' AND (v.release_date IS NULL OR v.release_date<=now())
    AND NOT EXISTS (
      SELECT 1 FROM public.video_daily_settlements d
      WHERE d.run_date=p_day AND d.video_id=v.id
    )
  ORDER BY v.id
  FOR UPDATE OF v SKIP LOCKED LIMIT 1;
  IF v_video_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.video_daily_settlements(run_date,video_id) VALUES(p_day,v_video_id);
  RETURN v_video_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.settle_daily_video(
  p_day date, p_video_id uuid, p_daily_views bigint,
  p_daily_earnings_cents integer, p_video_hype_change integer, p_is_viral boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_claim text;
  v_song record;
  v_video record;
  v_creator_cents integer;
  v_band_cents integer;
  v_carry_creator integer;
  v_carry_band integer;
  v_creator_paid integer;
  v_band_paid integer;
  v_new_fans integer;
  v_sentiment_boost integer;
  v_morale_boost integer;
  v_new_sentiment numeric;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  SELECT status INTO v_claim FROM public.video_daily_settlements
  WHERE run_date=p_day AND video_id=p_video_id FOR UPDATE;
  IF v_claim='completed' THEN RETURN false; END IF;
  IF v_claim IS DISTINCT FROM 'processing' THEN RAISE EXCEPTION 'No active video/day receipt'; END IF;
  IF p_day <> (now() AT TIME ZONE 'UTC')::date OR p_daily_views<0 OR p_daily_views>10000000
    OR p_daily_earnings_cents IS DISTINCT FROM round(p_daily_views::numeric / 5)::integer
    OR p_video_hype_change NOT BETWEEN -10 AND 10 THEN
    RAISE EXCEPTION 'Invalid video settlement metrics or date';
  END IF;

  SELECT v.title,v.views_count,v.earnings,v.hype_score,v.status
  INTO v_video FROM public.music_videos v WHERE v.id=p_video_id FOR UPDATE;
  IF NOT FOUND OR v_video.status<>'released' THEN RAISE EXCEPTION 'Video not released'; END IF;
  SELECT s.id,s.profile_id,s.user_id,s.band_id INTO v_song
  FROM public.music_videos v JOIN public.songs s ON s.id=v.song_id WHERE v.id=p_video_id;
  IF v_song.profile_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles WHERE id=v_song.profile_id AND user_id=v_song.user_id
  ) THEN RAISE EXCEPTION 'Song creator profile missing or mismatched'; END IF;

  INSERT INTO public.video_royalty_carry(video_id) VALUES(p_video_id)
  ON CONFLICT DO NOTHING;
  SELECT creator_cents,band_cents INTO v_carry_creator,v_carry_band
    FROM public.video_royalty_carry WHERE video_id=p_video_id FOR UPDATE;

  v_creator_cents := CASE WHEN v_song.band_id IS NULL THEN p_daily_earnings_cents
    ELSE round(p_daily_earnings_cents::numeric * 0.30)::integer END;
  v_band_cents := p_daily_earnings_cents-v_creator_cents;
  v_creator_paid := (v_carry_creator+v_creator_cents) / 100;
  v_band_paid := (v_carry_band+v_band_cents) / 100;
  v_new_fans := round(p_daily_views::numeric*0.001)::integer;
  v_sentiment_boost := CASE WHEN p_is_viral THEN 5
    WHEN p_daily_views>10000 THEN 2 WHEN p_daily_views>1000 THEN 1 ELSE 0 END;
  v_morale_boost := CASE WHEN p_is_viral THEN 6 WHEN p_daily_views>10000 THEN 3
    WHEN p_daily_views>1000 THEN 2 ELSE 0 END;

  UPDATE public.video_royalty_carry SET
    creator_cents=(v_carry_creator+v_creator_cents) % 100,
    band_cents=(v_carry_band+v_band_cents) % 100, updated_at=now()
  WHERE video_id=p_video_id;

  UPDATE public.music_videos SET
    views_count=coalesce(views_count,0)+p_daily_views,
    earnings=coalesce(earnings,0)+p_daily_earnings_cents::numeric/100,
    hype_score=least(100,greatest(0,coalesce(hype_score,0)+p_video_hype_change))
  WHERE id=p_video_id;

  UPDATE public.songs SET hype=least(100,greatest(0,
    coalesce(hype,0)+round(p_daily_views::numeric*0.01)::integer))
  WHERE id=v_song.id;

  UPDATE public.profiles SET cash=coalesce(cash,0)+v_creator_paid,
    fans=coalesce(fans,0)+v_new_fans WHERE id=v_song.profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not credit song creator'; END IF;

  IF v_song.band_id IS NOT NULL THEN
    UPDATE public.bands SET
      weekly_fans=coalesce(weekly_fans,0)+v_new_fans,
      fan_sentiment_score=least(100,greatest(-100,coalesce(fan_sentiment_score,0)+v_sentiment_boost)),
      morale=least(100,coalesce(morale,50)+v_morale_boost)
    WHERE id=v_song.band_id RETURNING fan_sentiment_score INTO v_new_sentiment;
    IF NOT FOUND THEN RAISE EXCEPTION 'Video band missing'; END IF;
    -- The band_earnings trigger credits band_balance once: never do so directly.
    IF v_band_paid>0 THEN
      INSERT INTO public.band_earnings(band_id,amount,source,description,earned_by_user_id,profile_id,metadata)
      VALUES(v_song.band_id,v_band_paid,'music_video',
        'Music video views: '||coalesce(v_video.title,'Video'),v_song.user_id,
        v_song.profile_id,jsonb_build_object('video_id',p_video_id,
           'daily_views',p_daily_views,'song_id',v_song.id,
           'settlement_date',p_day,'earned_cents',p_daily_earnings_cents));
    END IF;
    IF v_sentiment_boost>0 THEN
      INSERT INTO public.band_sentiment_events(
        band_id,event_type,sentiment_change,media_intensity_change,
        sentiment_after,source,description,metadata)
      VALUES(v_song.band_id,CASE WHEN p_is_viral THEN 'viral_video' ELSE 'music_video_views' END,
        v_sentiment_boost,CASE WHEN p_is_viral THEN 5 ELSE 1 END,
        v_new_sentiment,'simulate-video-views',
        'Music video gained '||p_daily_views::text||' views',
        jsonb_build_object('video_id',p_video_id,'date',p_day));
    END IF;
  END IF;

  UPDATE public.video_daily_settlements SET status='completed',finished_at=now(),
    daily_views=p_daily_views,earned_cents=p_daily_earnings_cents,
    creator_paid=v_creator_paid,band_paid=v_band_paid,
    owner_profile_id=v_song.profile_id,band_id=v_song.band_id,last_error=NULL
  WHERE run_date=p_day AND video_id=p_video_id;
  RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION public.fail_daily_video(p_day date,p_video_id uuid,p_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE public.video_daily_settlements
    SET status='failed',finished_at=now(),last_error=left(p_error,500)
  WHERE run_date=p_day AND video_id=p_video_id AND status='processing';
  RETURN found;
END $fn$;

REVOKE ALL ON FUNCTION public.claim_next_daily_video(date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_daily_video(date,uuid,bigint,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_daily_video(date,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_daily_video(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_daily_video(date,uuid,bigint,integer,integer,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_daily_video(date,uuid,text) TO service_role;
