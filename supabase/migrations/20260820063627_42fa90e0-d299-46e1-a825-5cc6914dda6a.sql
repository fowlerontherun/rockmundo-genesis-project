ALTER TABLE public.pr_media_offers DROP CONSTRAINT IF EXISTS pr_media_offers_media_type_check;
ALTER TABLE public.pr_media_offers ADD CONSTRAINT pr_media_offers_media_type_check
  CHECK (media_type = ANY (ARRAY['tv','radio','podcast','newspaper','magazine','youtube','website','film']));

CREATE OR REPLACE FUNCTION public.request_media_appearance(
  p_band_id uuid,
  p_media_type text,
  p_media_outlet_id uuid,
  p_outlet_name text,
  p_show_id uuid DEFAULT NULL,
  p_show_name text DEFAULT NULL,
  p_proposed_date date DEFAULT NULL,
  p_offer_type text DEFAULT 'general_promo'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_band record;
  v_min_fame integer := 0;
  v_comp integer := 0;
  v_fame integer := 0;
  v_fans integer := 0;
  v_date date := COALESCE(p_proposed_date, (now() + interval '2 days')::date);
  v_offer_id uuid;
BEGIN
  IF p_media_type NOT IN ('tv','radio','podcast','newspaper','magazine','youtube','website') THEN
    RAISE EXCEPTION 'Unsupported media type for requests: %', p_media_type;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid() AND COALESCE(is_active, true) LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'No active character found';
  END IF;

  SELECT b.id, b.leader_id, COALESCE(b.fame,0) AS fame, COALESCE(b.total_fans,0) AS total_fans
    INTO v_band
  FROM public.bands b WHERE b.id = p_band_id;
  IF v_band.id IS NULL THEN
    RAISE EXCEPTION 'Band not found';
  END IF;
  IF v_band.leader_id IS DISTINCT FROM v_profile_id THEN
    RAISE EXCEPTION 'Only the band leader can request media appearances';
  END IF;

  IF v_date < now()::date THEN
    RAISE EXCEPTION 'Requested date must be today or later';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_media_cooldowns c
    WHERE c.band_id = p_band_id
      AND c.media_type = p_media_type
      AND c.outlet_id = p_media_outlet_id
      AND c.cooldown_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'This outlet is still on cooldown for your band';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pr_media_offers o
    WHERE o.band_id = p_band_id
      AND o.media_type = p_media_type
      AND o.media_outlet_id = p_media_outlet_id
      AND o.status IN ('pending','accepted')
  ) THEN
    RAISE EXCEPTION 'You already have an open request with this outlet';
  END IF;

  -- Fame gate + reward ranges per outlet type
  IF p_media_type = 'radio' THEN
    SELECT COALESCE(min_fame_required,0) INTO v_min_fame FROM public.radio_stations WHERE id = p_media_outlet_id;
    v_comp := 200; v_fame := 120; v_fans := 400;
  ELSIF p_media_type = 'tv' THEN
    SELECT COALESCE(min_fame_required,0) INTO v_min_fame FROM public.tv_networks WHERE id = p_media_outlet_id;
    v_comp := 800; v_fame := 400; v_fans := 1500;
    IF p_show_id IS NOT NULL THEN
      SELECT COALESCE(min_fame_required, v_min_fame),
             COALESCE((compensation_min + compensation_max)/2, v_comp),
             COALESCE((fame_boost_min + fame_boost_max)/2, v_fame),
             COALESCE((fan_boost_min + fan_boost_max)/2, v_fans)
        INTO v_min_fame, v_comp, v_fame, v_fans
      FROM public.tv_shows WHERE id = p_show_id;
    END IF;
  ELSIF p_media_type = 'podcast' THEN
    SELECT COALESCE(min_fame_required,0),
           COALESCE((compensation_min + compensation_max)/2, 400),
           COALESCE((fame_boost_min + fame_boost_max)/2, 200),
           COALESCE((fan_boost_min + fan_boost_max)/2, 600)
      INTO v_min_fame, v_comp, v_fame, v_fans
    FROM public.podcasts WHERE id = p_media_outlet_id;
  ELSIF p_media_type = 'newspaper' THEN
    SELECT COALESCE(min_fame_required,0),
           COALESCE((compensation_min + compensation_max)/2, 300),
           COALESCE((fame_boost_min + fame_boost_max)/2, 150),
           COALESCE((fan_boost_min + fan_boost_max)/2, 500)
      INTO v_min_fame, v_comp, v_fame, v_fans
    FROM public.newspapers WHERE id = p_media_outlet_id;
  ELSIF p_media_type = 'magazine' THEN
    SELECT COALESCE(min_fame_required,0),
           COALESCE((compensation_min + compensation_max)/2, 500),
           COALESCE((fame_boost_min + fame_boost_max)/2, 200),
           COALESCE((fan_boost_min + fan_boost_max)/2, 600)
      INTO v_min_fame, v_comp, v_fame, v_fans
    FROM public.magazines WHERE id = p_media_outlet_id;
  ELSIF p_media_type = 'youtube' THEN
    SELECT COALESCE(min_fame_required,0),
           COALESCE((compensation_min + compensation_max)/2, 600),
           COALESCE((fame_boost_min + fame_boost_max)/2, 300),
           COALESCE((fan_boost_min + fan_boost_max)/2, 900)
      INTO v_min_fame, v_comp, v_fame, v_fans
    FROM public.youtube_channels WHERE id = p_media_outlet_id;
  ELSE -- website
    SELECT COALESCE(min_fame_required,0),
           COALESCE((compensation_min + compensation_max)/2, 150),
           COALESCE((fame_boost_min + fame_boost_max)/2, 80),
           COALESCE((fan_boost_min + fan_boost_max)/2, 250)
      INTO v_min_fame, v_comp, v_fame, v_fans
    FROM public.websites WHERE id = p_media_outlet_id;
  END IF;

  IF v_band.fame < COALESCE(v_min_fame,0) THEN
    RAISE EXCEPTION 'Your band needs % fame for this outlet (you have %)', v_min_fame, v_band.fame;
  END IF;

  -- Player-initiated requests are worth less than inbound invitations
  v_comp := GREATEST(0, ROUND(COALESCE(v_comp,0) * 0.6))::int;
  v_fame := GREATEST(1, ROUND(COALESCE(v_fame,0) * 0.6))::int;
  v_fans := GREATEST(1, ROUND(COALESCE(v_fans,0) * 0.6))::int;

  INSERT INTO public.pr_media_offers (
    user_id, band_id, media_type, media_outlet_id, show_id, offer_type,
    outlet_name, show_name, proposed_date, compensation, fame_boost, fan_boost,
    status, expires_at, cooldown_days
  ) VALUES (
    auth.uid(), p_band_id, p_media_type, p_media_outlet_id, p_show_id,
    CASE WHEN p_offer_type IN ('general_promo','tour_promo','release_promo','personal_promo') THEN p_offer_type ELSE 'general_promo' END,
    p_outlet_name, p_show_name, v_date, v_comp, v_fame, v_fans,
    'pending', now() + interval '3 days', 14
  ) RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_media_appearance(uuid, text, uuid, text, uuid, text, date, text) TO authenticated;