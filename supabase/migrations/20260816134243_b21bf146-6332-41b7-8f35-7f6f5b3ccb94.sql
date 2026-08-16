-- 1. Song cover licensing settings + fame/popularity metadata
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS available_for_covers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_royalty_percentage numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS cover_flat_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_auto_approve boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fame_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS popularity_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS peak_popularity integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS songs_available_for_covers_idx
  ON public.songs (available_for_covers) WHERE available_for_covers;

-- 2. Extend song_covers with approval state
ALTER TABLE public.song_covers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS allows_live boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 3. Cover requests
CREATE TABLE IF NOT EXISTS public.song_cover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  requesting_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  requesting_profile_id uuid NOT NULL,
  owner_band_id uuid,
  owner_profile_id uuid,
  purpose text NOT NULL DEFAULT 'live',
  message text,
  status text NOT NULL DEFAULT 'pending',
  royalty_percentage numeric NOT NULL DEFAULT 15,
  flat_fee_amount numeric NOT NULL DEFAULT 0,
  response_message text,
  responded_at timestamptz,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS song_cover_requests_pending_uniq
  ON public.song_cover_requests (song_id, requesting_band_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS song_cover_requests_owner_idx ON public.song_cover_requests (owner_band_id, status);
CREATE INDEX IF NOT EXISTS song_cover_requests_requester_idx ON public.song_cover_requests (requesting_band_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_cover_requests TO authenticated;
GRANT ALL ON public.song_cover_requests TO service_role;

ALTER TABLE public.song_cover_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters and owners can view cover requests"
ON public.song_cover_requests FOR SELECT TO authenticated
USING (
  requesting_profile_id = public._caller_profile_id()
  OR owner_profile_id = public._caller_profile_id()
  OR (requesting_band_id IS NOT NULL AND public._band_active_member(requesting_band_id, public._caller_profile_id()))
  OR (owner_band_id IS NOT NULL AND public._band_active_member(owner_band_id, public._caller_profile_id()))
);

CREATE POLICY "Band members can create cover requests"
ON public.song_cover_requests FOR INSERT TO authenticated
WITH CHECK (
  requesting_profile_id = public._caller_profile_id()
  AND public._band_active_member(requesting_band_id, public._caller_profile_id())
);

CREATE POLICY "Requesters and owners can update cover requests"
ON public.song_cover_requests FOR UPDATE TO authenticated
USING (
  requesting_profile_id = public._caller_profile_id()
  OR owner_profile_id = public._caller_profile_id()
  OR (owner_band_id IS NOT NULL AND public._band_active_member(owner_band_id, public._caller_profile_id()))
);

CREATE TRIGGER song_cover_requests_updated_at
BEFORE UPDATE ON public.song_cover_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Lookup of coverable songs
CREATE OR REPLACE FUNCTION public.get_coverable_songs(
  p_search text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_exclude_band_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS TABLE (
  song_id uuid,
  title text,
  genre text,
  quality_score integer,
  fame integer,
  popularity integer,
  peak_popularity integer,
  owner_band_id uuid,
  owner_band_name text,
  owner_profile_id uuid,
  cover_royalty_percentage numeric,
  cover_flat_fee numeric,
  cover_auto_approve boolean,
  gig_play_count integer,
  release_date timestamptz,
  existing_request_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.genre,
    COALESCE(s.quality_score, 0),
    COALESCE(s.fame, 0),
    COALESCE(s.popularity, 0),
    COALESCE(s.peak_popularity, 0),
    s.band_id,
    b.name,
    s.profile_id,
    s.cover_royalty_percentage,
    s.cover_flat_fee,
    s.cover_auto_approve,
    COALESCE(s.gig_play_count, 0),
    s.release_date,
    (
      SELECT r.status FROM public.song_cover_requests r
      WHERE r.song_id = s.id AND r.requesting_band_id = p_exclude_band_id
      ORDER BY r.created_at DESC LIMIT 1
    )
  FROM public.songs s
  LEFT JOIN public.bands b ON b.id = s.band_id
  WHERE s.available_for_covers = true
    AND COALESCE(s.archived, false) = false
    AND (p_exclude_band_id IS NULL OR s.band_id IS DISTINCT FROM p_exclude_band_id)
    AND (p_genre IS NULL OR s.genre = p_genre)
    AND (p_search IS NULL OR s.title ILIKE '%' || p_search || '%' OR b.name ILIKE '%' || p_search || '%')
  ORDER BY COALESCE(s.fame, 0) DESC, COALESCE(s.popularity, 0) DESC
  LIMIT GREATEST(1, LEAST(200, COALESCE(p_limit, 60)));
$$;

GRANT EXECUTE ON FUNCTION public.get_coverable_songs(text, text, uuid, integer) TO authenticated;

-- 5. Request a cover
CREATE OR REPLACE FUNCTION public.request_song_cover(
  p_song_id uuid,
  p_band_id uuid,
  p_purpose text DEFAULT 'live',
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_song public.songs;
  v_request public.song_cover_requests;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'No active character';
  END IF;
  IF NOT public._band_active_member(p_band_id, v_profile) THEN
    RAISE EXCEPTION 'You are not an active member of this band';
  END IF;

  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;
  IF v_song.id IS NULL THEN
    RAISE EXCEPTION 'Song not found';
  END IF;
  IF v_song.available_for_covers IS NOT TRUE THEN
    RAISE EXCEPTION 'This song is not available for covers';
  END IF;
  IF v_song.band_id IS NOT NULL AND v_song.band_id = p_band_id THEN
    RAISE EXCEPTION 'Your band already owns this song';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.song_cover_requests
    WHERE song_id = p_song_id AND requesting_band_id = p_band_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this song';
  END IF;

  INSERT INTO public.song_cover_requests (
    song_id, requesting_band_id, requesting_profile_id, owner_band_id, owner_profile_id,
    purpose, message, royalty_percentage, flat_fee_amount, status
  ) VALUES (
    p_song_id, p_band_id, v_profile, v_song.band_id, v_song.profile_id,
    COALESCE(p_purpose, 'live'), p_message, v_song.cover_royalty_percentage, v_song.cover_flat_fee,
    CASE WHEN v_song.cover_auto_approve THEN 'approved' ELSE 'pending' END
  )
  RETURNING * INTO v_request;

  IF v_song.cover_auto_approve THEN
    UPDATE public.song_cover_requests
    SET responded_at = now(), response_message = 'Auto-approved by songwriter terms'
    WHERE id = v_request.id;

    INSERT INTO public.song_covers (
      original_song_id, covering_band_id, original_band_id, original_user_id,
      payment_type, flat_fee_amount, royalty_percentage, status, request_id,
      allows_live, allows_recording, approved_at
    ) VALUES (
      p_song_id, p_band_id, v_song.band_id, v_song.user_id,
      CASE WHEN v_song.cover_flat_fee > 0 THEN 'flat_fee' ELSE 'royalty' END,
      v_song.cover_flat_fee, v_song.cover_royalty_percentage, 'active', v_request.id,
      true, COALESCE(p_purpose, 'live') IN ('recording', 'both'), now()
    );
  END IF;

  RETURN jsonb_build_object(
    'request_id', v_request.id,
    'status', CASE WHEN v_song.cover_auto_approve THEN 'approved' ELSE 'pending' END,
    'royalty_percentage', v_song.cover_royalty_percentage,
    'flat_fee_amount', v_song.cover_flat_fee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_song_cover(uuid, uuid, text, text) TO authenticated;

-- 6. Respond to a cover request
CREATE OR REPLACE FUNCTION public.respond_to_song_cover_request(
  p_request_id uuid,
  p_approve boolean,
  p_royalty_percentage numeric DEFAULT NULL,
  p_response_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_request public.song_cover_requests;
  v_song public.songs;
  v_royalty numeric;
BEGIN
  SELECT * INTO v_request FROM public.song_cover_requests WHERE id = p_request_id;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been handled';
  END IF;

  IF NOT (
    (v_request.owner_profile_id IS NOT NULL AND v_request.owner_profile_id = v_profile)
    OR (v_request.owner_band_id IS NOT NULL AND public._band_active_member(v_request.owner_band_id, v_profile))
  ) THEN
    RAISE EXCEPTION 'You are not authorised to answer this request';
  END IF;

  SELECT * INTO v_song FROM public.songs WHERE id = v_request.song_id;
  v_royalty := LEAST(100, GREATEST(0, COALESCE(p_royalty_percentage, v_request.royalty_percentage)));

  UPDATE public.song_cover_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      royalty_percentage = v_royalty,
      response_message = p_response_message,
      responded_at = now(),
      responded_by = v_profile
  WHERE id = p_request_id;

  IF p_approve THEN
    INSERT INTO public.song_covers (
      original_song_id, covering_band_id, original_band_id, original_user_id,
      payment_type, flat_fee_amount, royalty_percentage, status, request_id,
      allows_live, allows_recording, approved_at, approved_by
    ) VALUES (
      v_request.song_id, v_request.requesting_band_id, v_request.owner_band_id, v_song.user_id,
      CASE WHEN v_request.flat_fee_amount > 0 THEN 'flat_fee' ELSE 'royalty' END,
      v_request.flat_fee_amount, v_royalty, 'active', v_request.id,
      true, v_request.purpose IN ('recording', 'both'), now(), v_profile
    );
  END IF;

  RETURN jsonb_build_object('request_id', p_request_id, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, 'royalty_percentage', v_royalty);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_song_cover_request(uuid, boolean, numeric, text) TO authenticated;

-- 7. Fame / popularity engine
CREATE OR REPLACE FUNCTION public.recalculate_song_fame_popularity(p_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song public.songs;
  v_streams bigint := 0;
  v_radio bigint := 0;
  v_fame integer;
  v_pop integer;
  v_days integer;
BEGIN
  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;
  IF v_song.id IS NULL THEN
    RAISE EXCEPTION 'Song not found';
  END IF;

  SELECT COALESCE(SUM(total_streams), 0) INTO v_streams FROM public.song_releases WHERE song_id = p_song_id;
  v_radio := COALESCE(v_song.total_radio_plays, 0);

  -- Fame never decreases: it is the running maximum of earned fame
  v_fame := GREATEST(
    COALESCE(v_song.fame, 0),
    FLOOR(
      (COALESCE(v_streams, 0) + COALESCE(v_song.streams, 0)) / 1000.0
      + v_radio * 2
      + COALESCE(v_song.hype, 0) / 50.0
      + COALESCE(v_song.gig_play_count, 0) * 3
      + COALESCE(v_song.quality_score, 0) / 10.0
    )::integer
  );

  v_days := CASE
    WHEN v_song.last_gigged_at IS NULL THEN 999
    ELSE GREATEST(0, EXTRACT(DAY FROM (now() - v_song.last_gigged_at))::integer)
  END;

  v_pop := COALESCE(v_song.popularity, 0);
  -- Popularity gravitates toward a fame-derived floor and decays with time off stage
  v_pop := v_pop - LEAST(v_pop, v_days * CASE WHEN COALESCE(v_song.is_fan_favourite, false) THEN 1 ELSE 2 END);
  v_pop := GREATEST(v_pop, LEAST(500, FLOOR(v_fame / 4.0)::integer));
  v_pop := LEAST(1000, GREATEST(0, v_pop));

  UPDATE public.songs
  SET fame = v_fame,
      popularity = v_pop,
      peak_popularity = GREATEST(COALESCE(peak_popularity, 0), v_pop),
      fame_updated_at = now(),
      popularity_updated_at = now()
  WHERE id = p_song_id;

  RETURN jsonb_build_object('song_id', p_song_id, 'fame', v_fame, 'popularity', v_pop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_song_fame_popularity(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_daily_song_popularity_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.songs s
    SET popularity = LEAST(1000, GREATEST(
          LEAST(500, FLOOR(COALESCE(s.fame, 0) / 4.0)::integer),
          COALESCE(s.popularity, 0) - CASE WHEN COALESCE(s.is_fan_favourite, false) THEN 1 ELSE 2 END
        )),
        popularity_updated_at = now()
    WHERE COALESCE(s.popularity, 0) > 0
      AND (s.popularity_updated_at IS NULL OR s.popularity_updated_at < now() - interval '20 hours')
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN jsonb_build_object('songs_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_daily_song_popularity_decay() TO service_role;