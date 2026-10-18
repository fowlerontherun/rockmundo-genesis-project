-- Phase 4 internal DJ booking reservation foundation, not a playable or paid gig.
-- No authenticated access to the reservation RPC until slot hours, travel,
-- schedule projection and atomic performance settlement are integrated.
-- Existing instant DJ performance flow is deliberately unchanged.

CREATE TABLE IF NOT EXISTS public.dj_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  club_id uuid NOT NULL REFERENCES public.city_night_clubs(id),
  setlist_id uuid NOT NULL REFERENCES public.dj_setlists(id),
  setlist_version integer NOT NULL CHECK (setlist_version >= 1),
  setlist_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(setlist_snapshot)='array'
    AND jsonb_array_length(setlist_snapshot) BETWEEN 1 AND 30
  ),
  request_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (
    status IN ('booked','ready','live','resolving','completed','cancelled','missed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_booking_positive_window CHECK (ends_at > starts_at),
  CONSTRAINT dj_booking_request_unique UNIQUE (user_id,request_id)
);

CREATE INDEX IF NOT EXISTS dj_bookings_player_window_idx
  ON public.dj_bookings(profile_id,starts_at,ends_at)
  WHERE status IN ('booked','ready','live','resolving');
CREATE INDEX IF NOT EXISTS dj_bookings_club_window_idx
  ON public.dj_bookings(club_id,starts_at,ends_at)
  WHERE status IN ('booked','ready','live','resolving');

ALTER TABLE public.dj_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players read their DJ bookings" ON public.dj_bookings;
CREATE POLICY "Players read their DJ bookings"
  ON public.dj_bookings FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
    )
  );
GRANT SELECT ON public.dj_bookings TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.dj_bookings FROM PUBLIC,anon,authenticated;

-- Deliberately restricted to service_role. An authenticated account cannot
-- invoke this partial backend before the approved player booking flow exists.
CREATE OR REPLACE FUNCTION public.reserve_dj_booking_internal(
  p_profile_id uuid,
  p_club_id uuid,
  p_setlist_id uuid,
  p_starts_at timestamptz,
  p_request_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_profile public.profiles%ROWTYPE;
  v_club public.city_night_clubs%ROWTYPE;
  v_set public.dj_setlists%ROWTYPE;
  v_existing public.dj_bookings%ROWTYPE;
  v_item jsonb;
  v_id uuid;
  v_duration integer;
  v_min_fame integer;
  v_ends timestamptz;
  v_new_id uuid;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL
     OR p_starts_at IS NULL OR p_profile_id IS NULL
     OR p_club_id IS NULL OR p_setlist_id IS NULL
  THEN
    RAISE EXCEPTION 'DJ reservation requires authenticated actor and complete parameters'
      USING ERRCODE='42501';
  END IF;

  -- All reservations (including identical replay requests) serialize by player,
  -- then by club. Do not permit direct browser writes to this table.
  PERFORM pg_advisory_xact_lock(hashtext('dj:profile:' || p_profile_id::text)::bigint);
  PERFORM pg_advisory_xact_lock(hashtext('dj:club:' || p_club_id::text)::bigint);

  SELECT * INTO v_existing FROM public.dj_bookings
   WHERE user_id=v_actor AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.profile_id<>p_profile_id
       OR v_existing.club_id<>p_club_id
       OR v_existing.setlist_id<>p_setlist_id
       OR v_existing.starts_at<>p_starts_at
    THEN RAISE EXCEPTION 'DJ request ID already used for a different booking'
      USING ERRCODE='23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT * INTO v_profile FROM public.profiles
    WHERE id=p_profile_id AND user_id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'DJ profile not owned by this account'
    USING ERRCODE='42501'; END IF;

  SELECT * INTO v_club FROM public.city_night_clubs WHERE id=p_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DJ club does not exist' USING ERRCODE='22023'; END IF;
  IF v_profile.current_city_id IS DISTINCT FROM v_club.city_id
  THEN RAISE EXCEPTION 'Travel to the club city before requesting a DJ slot'
    USING ERRCODE='22023'; END IF;

  v_min_fame := COALESCE((v_club.dj_slot_config->>'minimum_fame')::integer,0);
  IF COALESCE(v_profile.fame,0)<v_min_fame
  THEN RAISE EXCEPTION 'Insufficient DJ reputation for this club' USING ERRCODE='42501'; END IF;

  v_duration := COALESCE((v_club.dj_slot_config->>'set_length_minutes')::integer,45);
  IF v_duration NOT BETWEEN 15 AND 180
  THEN RAISE EXCEPTION 'Club DJ slot duration is not supported' USING ERRCODE='22023'; END IF;

  IF p_starts_at < now() + interval '15 minutes'
     OR p_starts_at > now() + interval '14 days'
  THEN RAISE EXCEPTION 'DJ bookings must be 15 minutes to 14 days in advance'
    USING ERRCODE='22023'; END IF;
  v_ends := p_starts_at + make_interval(mins=>v_duration);

  SELECT * INTO v_set FROM public.dj_setlists
    WHERE id=p_setlist_id AND user_id=v_actor AND profile_id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose one of your own saved DJ sets'
    USING ERRCODE='42501'; END IF;

  -- Never accept an old setlist snapshot without checking audio permissions
  -- again at reservation time; performance start must revalidate them again.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_set.items) LOOP
    v_id := (v_item->>'id')::uuid;
    IF v_item->>'source'='game' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.songs s WHERE s.id=v_id AND COALESCE(s.archived,false)=false
          AND (s.audio_url IS NOT NULL OR s.extended_audio_url IS NOT NULL)
          AND (
            (s.profile_id=p_profile_id AND s.user_id=v_actor AND
              s.status IN ('recorded','released','completed','mastered'))
            OR (s.dj_use_allowed IS TRUE AND s.status IN ('recorded','released'))
          )
      ) THEN
        RAISE EXCEPTION 'Saved DJ set contains unplayable or unlicensed song'
          USING ERRCODE='42501';
      END IF;
    ELSIF v_item->>'source'='admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.dj_audio_tracks t
        WHERE t.id=v_id AND t.is_active AND t.rights_confirmed
      ) THEN RAISE EXCEPTION 'Saved DJ set contains unpublished club music'
        USING ERRCODE='42501'; END IF;
    ELSE RAISE EXCEPTION 'Unknown DJ setlist audio source' USING ERRCODE='22023';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.dj_bookings b
    WHERE (b.profile_id=p_profile_id OR b.club_id=p_club_id)
      AND b.status IN ('booked','ready','live','resolving')
      AND b.starts_at<v_ends AND b.ends_at>p_starts_at
  ) THEN
    RAISE EXCEPTION 'DJ or club stage is already booked at this time'
      USING ERRCODE='23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_scheduled_activities a
    WHERE a.profile_id=p_profile_id AND a.status IN ('scheduled','in_progress')
      AND a.scheduled_start<v_ends AND a.scheduled_end>p_starts_at
  ) THEN RAISE EXCEPTION 'Existing scheduled activity conflicts with this DJ slot'
    USING ERRCODE='23P01'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.gigs g
    JOIN public.band_members bm ON bm.band_id=g.band_id
    WHERE bm.profile_id=p_profile_id AND bm.member_status='active'
      AND g.status IN ('scheduled','confirmed','in_progress')
      AND g.scheduled_date < v_ends
      AND COALESCE(g.scheduled_end,g.scheduled_date+interval '2 hours')>p_starts_at
  ) THEN RAISE EXCEPTION 'Band gig conflicts with this DJ slot'
    USING ERRCODE='23P01'; END IF;

  INSERT INTO public.dj_bookings (
    user_id,profile_id,club_id,setlist_id,setlist_version,setlist_snapshot,
    request_id,starts_at,ends_at,status
  ) VALUES (
    v_actor,p_profile_id,p_club_id,p_setlist_id,v_set.version,v_set.items,
    p_request_id,p_starts_at,v_ends,'booked'
  ) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_dj_booking_internal(uuid,uuid,uuid,timestamptz,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_dj_booking_internal(uuid,uuid,uuid,timestamptz,uuid)
 TO service_role;

COMMENT ON TABLE public.dj_bookings IS
  'Internal DJ booking foundation. No performance/payout workflow until canonical booking, schedule and settlement gates land.';
