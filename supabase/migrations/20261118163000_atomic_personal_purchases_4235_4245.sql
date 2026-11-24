-- #4235 / #4245: pay for tattoos and video activities in the SAME transaction
-- as the thing being purchased. This is a forward-only migration; do not replay
-- historical client debits or attempt to reconcile real balances automatically.

CREATE TABLE IF NOT EXISTS public.personal_purchase_receipts (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  kind text NOT NULL CHECK (kind IN
    ('tattoo_custom','tattoo_text','tattoo_treatment','video_production','video_tv','video_promo')),
  intent_hash text NOT NULL,
  target_id uuid,
  option_id text,
  price bigint NOT NULL CHECK (price > 0),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_tv_placement_per_video_show
  ON public.personal_purchase_receipts(target_id,option_id)
  WHERE kind='video_tv';
ALTER TABLE public.personal_purchase_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_purchase_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.personal_purchase_receipts TO service_role;

-- The legacy request table was account-only while the page queries by profile_id.
-- Only backfill attribution backed by the already-linked tattoo; do not guess
-- which character commissioned an unlinked historical request.
ALTER TABLE public.custom_tattoo_requests
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.custom_tattoo_requests r SET profile_id=t.profile_id
  FROM public.player_tattoos t
  WHERE r.completed_tattoo_id=t.id AND r.profile_id IS NULL AND t.profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_tattoo_requests_profile_idx
  ON public.custom_tattoo_requests(profile_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.purchase_personal_tattoo_atomic(
  p_request_id uuid, p_profile_id uuid, p_kind text,
  p_parlour_id uuid DEFAULT NULL, p_artist_id uuid DEFAULT NULL,
  p_body_slot text DEFAULT NULL, p_text text DEFAULT NULL,
  p_font_style text DEFAULT NULL, p_description text DEFAULT NULL,
  p_tattoo_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_prior public.personal_purchase_receipts%ROWTYPE;
  v_parlour public.tattoo_parlours%ROWTYPE;
  v_artist public.tattoo_artists%ROWTYPE;
  v_tattoo public.player_tattoos%ROWTYPE;
  v_fmult numeric := 1;
  v_amult numeric := 1;
  v_bonus integer := 0;
  v_price integer;
  v_quality integer;
  v_low integer;
  v_high integer;
  v_infected boolean := false;
  v_tattoo_id uuid;
  v_intent text;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL OR p_profile_id IS NULL OR
    p_kind NOT IN ('custom','text','treatment') OR p_kind IS NULL THEN
    RAISE EXCEPTION 'Invalid or unauthenticated tattoo purchase';
  END IF;
  IF public.current_active_player_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Only the active character may purchase tattoos';
  END IF;
  -- A profile lock serializes two purchases or retries on the same balance.
  SELECT * INTO STRICT v_profile FROM public.profiles
    WHERE id=p_profile_id AND user_id=v_actor AND is_active IS TRUE
      AND deleted_at IS NULL AND died_at IS NULL FOR UPDATE;
  v_intent := md5(pg_catalog.jsonb_build_object('kind',p_kind,'parlour',p_parlour_id,
    'artist',p_artist_id,'slot',p_body_slot,'text',p_text,
    'font',p_font_style,'description',p_description,'tattoo',p_tattoo_id)::text);
  SELECT * INTO v_prior FROM public.personal_purchase_receipts WHERE request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.user_id<>v_actor OR v_prior.profile_id<>p_profile_id OR
      v_prior.kind<>'tattoo_'||p_kind OR v_prior.intent_hash<>v_intent THEN
      RAISE EXCEPTION 'Tattoo purchase request ID was reused';
    END IF;
    RETURN v_prior.result;
  END IF;

  IF p_kind='treatment' THEN
    SELECT * INTO v_tattoo FROM public.player_tattoos
      WHERE id=p_tattoo_id AND profile_id=p_profile_id AND user_id=v_actor FOR UPDATE;
    IF NOT FOUND OR v_tattoo.is_infected IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'This character has no untreated infection for that tattoo';
    END IF;
    v_price := 200;
    v_tattoo_id := p_tattoo_id;
    v_quality := v_tattoo.quality_score;
  ELSE
    IF p_body_slot NOT IN ('left_upper_arm','left_forearm','left_wrist','left_shoulder',
      'left_inner_arm','right_upper_arm','right_forearm','right_wrist','right_shoulder',
      'right_inner_arm','neck','chest','stomach','back','left_thigh','left_calf',
      'right_thigh','right_calf') OR p_body_slot IS NULL THEN
      RAISE EXCEPTION 'Unknown tattoo placement';
    END IF;
    SELECT * INTO v_parlour FROM public.tattoo_parlours
      WHERE id=p_parlour_id AND city_id=v_profile.current_city_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parlour unavailable in this city'; END IF;
    IF EXISTS (SELECT 1 FROM public.player_tattoos
      WHERE profile_id=p_profile_id AND body_slot=p_body_slot) THEN
      RAISE EXCEPTION 'Tattoo placement is already occupied';
    END IF;
    IF p_artist_id IS NOT NULL THEN
      SELECT * INTO v_artist FROM public.tattoo_artists
        WHERE id=p_artist_id AND parlour_id=p_parlour_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Tattoo artist is not in this parlour'; END IF;
      v_amult := v_artist.price_premium;
      v_bonus := v_artist.quality_bonus;
    END IF;
    IF p_kind='custom' THEN
      IF p_artist_id IS NULL OR NOT v_artist.accepts_custom OR
        length(btrim(coalesce(p_description,''))) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'A custom-capable artist and a description are required';
      END IF;
      v_price := round(300*v_parlour.price_multiplier*v_amult*1.5);
    ELSE
      IF length(btrim(coalesce(p_text,''))) NOT BETWEEN 1 AND 40 THEN
        RAISE EXCEPTION 'Text tattoo must contain 1 to 40 characters';
      END IF;
      v_fmult := CASE p_font_style
        WHEN 'gothic' THEN 1 WHEN 'script' THEN 1.2 WHEN 'typewriter' THEN 0.8
        WHEN 'bold_caps' THEN 1 WHEN 'minimal' THEN 0.9 WHEN 'graffiti' THEN 1.3
        WHEN 'old_english' THEN 1.4 WHEN 'japanese_brush' THEN 1.5 ELSE NULL END;
      IF v_fmult IS NULL THEN RAISE EXCEPTION 'Unknown tattoo font'; END IF;
      v_price := round(150*v_parlour.price_multiplier*v_amult*v_fmult);
    END IF;
    CASE v_parlour.quality_tier
      WHEN 1 THEN v_low:=20;v_high:=50;
      WHEN 2 THEN v_low:=35;v_high:=65;
      WHEN 3 THEN v_low:=50;v_high:=80;
      WHEN 4 THEN v_low:=70;v_high:=92;
      ELSE v_low:=85;v_high:=100;
    END CASE;
    v_quality := least(100,v_low+floor(random()*(v_high-v_low+1))::integer+v_bonus+
      CASE WHEN p_kind='custom' THEN 10 ELSE 0 END);
    v_infected := p_kind='text' AND random()<v_parlour.infection_risk;
  END IF;
  IF v_price<=0 OR v_profile.cash<v_price THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  UPDATE public.profiles SET cash=cash-v_price WHERE id=p_profile_id AND user_id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Failed to charge active character'; END IF;

  IF p_kind='treatment' THEN
    UPDATE public.player_tattoos SET is_infected=false,infection_cleared_at=now()
      WHERE id=v_tattoo_id AND profile_id=p_profile_id AND is_infected=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Infection treatment changed concurrently'; END IF;
  ELSE
    INSERT INTO public.player_tattoos(user_id,profile_id,tattoo_design_id,parlour_id,
      artist_id,body_slot,quality_score,ink_color,price_paid,is_infected,custom_text,font_style)
    VALUES(v_actor,p_profile_id,NULL,p_parlour_id,p_artist_id,p_body_slot,
      v_quality,'#1a1a2e',v_price,v_infected,
      CASE WHEN p_kind='text' THEN btrim(p_text) ELSE NULL END,
      CASE WHEN p_kind='text' THEN p_font_style ELSE NULL END)
    RETURNING id INTO v_tattoo_id;
    IF p_kind='custom' THEN
      INSERT INTO public.custom_tattoo_requests(user_id,profile_id,artist_id,description,
        body_slot,status,quoted_price,estimated_quality,completed_tattoo_id)
      VALUES(v_actor,p_profile_id,p_artist_id,btrim(p_description),p_body_slot,
        'completed',v_price,v_quality,v_tattoo_id);
    END IF;
    IF p_artist_id IS NOT NULL THEN
      UPDATE public.tattoo_artists SET total_tattoos_done=total_tattoos_done+1
      WHERE id=p_artist_id;
    END IF;
  END IF;
  v_result := pg_catalog.jsonb_build_object('tattoo_id',v_tattoo_id,
    'price',v_price,'quality_score',v_quality,'is_infected',v_infected,
    'cash_remaining',v_profile.cash-v_price);
  INSERT INTO public.personal_purchase_receipts(request_id,user_id,profile_id,
    kind,intent_hash,target_id,price,result)
  VALUES(p_request_id,v_actor,p_profile_id,'tattoo_'||p_kind,v_intent,v_tattoo_id,
    v_price,v_result);
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.purchase_personal_tattoo_atomic(
  uuid,uuid,text,uuid,uuid,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_personal_tattoo_atomic(
  uuid,uuid,text,uuid,uuid,text,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_music_video_atomic(
  p_request_id uuid,p_profile_id uuid,p_action text,
  p_song_id uuid DEFAULT NULL,p_video_id uuid DEFAULT NULL,
  p_budget integer DEFAULT NULL,p_style text DEFAULT NULL,
  p_option_id text DEFAULT NULL,p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,p_release_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_prior public.personal_purchase_receipts%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_video public.music_videos%ROWTYPE;
  v_video_id uuid;
  v_cost integer;
  v_views integer := 0;
  v_hype integer := 0;
  v_fame integer := 0;
  v_quality integer;
  v_kind text;
  v_intent text;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL OR p_profile_id IS NULL OR
    p_action NOT IN ('production','tv','promo') OR p_action IS NULL THEN
    RAISE EXCEPTION 'Invalid or unauthenticated video purchase';
  END IF;
  IF public.current_active_player_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Only the active character may purchase video services';
  END IF;
  SELECT * INTO STRICT v_profile FROM public.profiles
    WHERE id=p_profile_id AND user_id=v_actor AND is_active IS TRUE
      AND died_at IS NULL AND deleted_at IS NULL FOR UPDATE;
  v_kind := 'video_'||p_action;
  v_intent := md5(pg_catalog.jsonb_build_object('action',p_action,'song',p_song_id,
    'video',p_video_id,'budget',p_budget,'style',p_style,'option',p_option_id,
    'title',p_title,'description',p_description,'release',p_release_id)::text);
  SELECT * INTO v_prior FROM public.personal_purchase_receipts WHERE request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.user_id<>v_actor OR v_prior.profile_id<>p_profile_id OR
      v_prior.kind<>v_kind OR v_prior.intent_hash<>v_intent THEN
      RAISE EXCEPTION 'Video purchase request ID was reused';
    END IF;
    RETURN v_prior.result;
  END IF;

  IF p_action='production' THEN
    IF p_budget IS NULL OR p_style IS NULL OR
      p_budget NOT IN (2500,5000,10000,25000,50000) OR
      p_style NOT IN ('standard','premium','deluxe') OR
      length(btrim(coalesce(p_title,''))) NOT BETWEEN 1 AND 160 OR
      length(coalesce(p_description,''))>2000 THEN
      RAISE EXCEPTION 'Invalid video budget, style or title';
    END IF;
    v_cost := p_budget;
    v_quality := least(100,p_budget/100+20+CASE p_style
      WHEN 'premium' THEN 20 WHEN 'deluxe' THEN 40 ELSE 0 END);
    SELECT * INTO v_song FROM public.songs WHERE id=p_song_id;
  ELSE
    SELECT * INTO v_video FROM public.music_videos WHERE id=p_video_id FOR UPDATE;
    IF NOT FOUND OR v_video.status<>'released' THEN
      RAISE EXCEPTION 'Only released videos can be promoted';
    END IF;
    v_video_id := v_video.id;
    SELECT * INTO v_song FROM public.songs WHERE id=v_video.song_id;
  END IF;
  IF NOT FOUND OR NOT (
    (v_song.band_id IS NULL AND v_song.user_id=v_actor AND
      (v_song.profile_id IS NULL OR v_song.profile_id=p_profile_id))
    OR (v_song.band_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.band_members bm WHERE bm.band_id=v_song.band_id
        AND bm.profile_id=p_profile_id AND bm.user_id=v_actor AND bm.member_status='active'))
  ) THEN RAISE EXCEPTION 'Song not owned by this active character'; END IF;

  IF p_action='production' THEN
    IF v_song.status NOT IN ('recorded','released') THEN
      RAISE EXCEPTION 'Record the song before filming';
    END IF;
    IF p_release_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.release_songs rs JOIN public.releases r ON r.id=rs.release_id
      WHERE rs.song_id=v_song.id AND rs.release_id=p_release_id
        AND r.release_status='released'
        AND (r.user_id=v_actor OR (v_song.band_id IS NOT NULL AND r.band_id=v_song.band_id))
    ) THEN RAISE EXCEPTION 'Release does not contain this song'; END IF;
  ELSE
    IF p_action='tv' THEN
      SELECT x.cost,x.views,x.hype,x.fame INTO v_cost,v_views,v_hype,v_fame
      FROM (VALUES
        ('mtv_rotation',5000,10000,15,100),('mtv_trl',15000,50000,35,500),
        ('vh1_top20',8000,20000,20,200),('bet_106',12000,35000,28,300),
        ('fuse_daily',3000,5000,8,50),('late_night',25000,100000,50,1000)
      ) AS x(id,cost,views,hype,fame) WHERE x.id=p_option_id;
      IF v_cost IS NULL THEN RAISE EXCEPTION 'Unknown video placement'; END IF;
      IF v_profile.fame<coalesce(v_fame,2147483647) THEN
        RAISE EXCEPTION 'This TV show requires more fame';
      END IF;
      IF EXISTS (SELECT 1 FROM public.personal_purchase_receipts
        WHERE kind='video_tv' AND target_id=p_video_id AND option_id=p_option_id) THEN
        RAISE EXCEPTION 'This video has already been placed on that show';
      END IF;
    ELSE
      SELECT x.cost,x.views INTO v_cost,v_views
      FROM (VALUES
        ('social_ads',2000,5000),('influencer',10000,25000),
        ('billboard',15000,15000),('radio_push',5000,8000),
        ('press_release',1000,2000)
      ) AS x(id,cost,views) WHERE x.id=p_option_id;
    END IF;
    IF v_cost IS NULL THEN RAISE EXCEPTION 'Unknown video placement'; END IF;
  END IF;
  IF v_cost<=0 OR v_profile.cash<v_cost THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  UPDATE public.profiles SET cash=cash-v_cost WHERE id=p_profile_id AND user_id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Failed to charge active character'; END IF;

  IF p_action='production' THEN
    INSERT INTO public.music_videos(song_id,release_id,title,description,budget,
      production_quality,status,views_count,earnings,hype_score)
    VALUES(v_song.id,p_release_id,btrim(p_title),NULLIF(p_description,''),
      v_cost,v_quality,'production',0,0,0) RETURNING id INTO v_video_id;
  ELSIF p_action='tv' THEN
    UPDATE public.music_videos SET views_count=views_count+v_views,
      hype_score=least(100,hype_score+v_hype) WHERE id=v_video_id;
  ELSE
    UPDATE public.music_videos SET views_count=views_count+v_views,
      earnings=earnings+floor(v_views*0.002)::integer WHERE id=v_video_id;
  END IF;
  v_result := pg_catalog.jsonb_build_object('video_id',v_video_id,
    'price',v_cost,'views_added',v_views,'hype_added',v_hype,
    'cash_remaining',v_profile.cash-v_cost);
  INSERT INTO public.personal_purchase_receipts(request_id,user_id,profile_id,
    kind,intent_hash,target_id,option_id,price,result)
  VALUES(p_request_id,v_actor,p_profile_id,v_kind,v_intent,v_video_id,
    p_option_id,v_cost,v_result);
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.purchase_music_video_atomic(
  uuid,uuid,text,uuid,uuid,integer,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_music_video_atomic(
  uuid,uuid,text,uuid,uuid,integer,text,text,text,text,uuid) TO authenticated;
