-- Prevent unfunded DJ bookings at receipt-verified clubs from bypassing the owner's approval and escrow.
CREATE OR REPLACE FUNCTION public.reserve_dj_booking_internal(p_profile_id uuid, p_club_id uuid, p_setlist_id uuid, p_starts_at timestamp with time zone, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Receipt-verified player-owned clubs MUST have an accepted escrowed DJ
  -- contract. An ordinary DJ reservation cannot bypass the owner's approval.
  IF EXISTS (
   SELECT 1 FROM public.player_owned_nightclubs o
   JOIN public.nightclub_purchase_receipts r
     ON r.id=o.verified_purchase_id AND r.club_id=o.club_id
        AND r.profile_id=o.profile_id
   WHERE o.club_id=p_club_id
  ) AND NOT EXISTS (
   SELECT 1 FROM public.nightclub_dj_funded_offers f
   JOIN public.dj_club_applications a ON a.id=f.application_id
   WHERE f.id::text=current_setting('app.dj_funded_conversion_offer_id',true)
    AND f.status='accepted' AND f.expires_at>clock_timestamp()
    AND a.status='shortlisted'
    AND a.club_id=p_club_id AND a.profile_id=p_profile_id
    AND a.setlist_id=p_setlist_id AND a.starts_at=p_starts_at
    AND f.dj_user_id=v_actor AND f.dj_profile_id=p_profile_id
    AND f.booking_id IS NULL
    AND EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
      WHERE m.offer_id=f.id AND m.kind='fund' AND m.amount=f.fee)
    AND NOT EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
      WHERE m.offer_id=f.id AND m.kind IN('refund','payout'))
  ) THEN
   RAISE EXCEPTION 'Verified owner nightclub requires an accepted, fully funded DJ offer'
    USING ERRCODE='42501';
  END IF;

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
$function$
;
CREATE OR REPLACE FUNCTION public.confirm_accepted_nightclub_dj_offer_internal(p_offer_id uuid, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid:=(select auth.uid());
 v_active uuid:=public.current_active_player_profile_id();
 v_offer public.nightclub_dj_funded_offers%ROWTYPE;
 v_application public.dj_club_applications%ROWTYPE;
 v_booking uuid;
 v_prior_context text:=current_setting('app.dj_funded_conversion_offer_id',true);
BEGIN
 IF v_actor IS NULL OR v_active IS NULL OR p_offer_id IS NULL OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'Authenticated DJ and booking request required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers
 WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND OR v_offer.dj_user_id<>v_actor OR v_offer.dj_profile_id<>v_active THEN
  RAISE EXCEPTION 'Funded DJ offer does not belong to selected character' USING ERRCODE='42501';END IF;
 IF v_offer.booking_request_id=p_request_id
  AND v_offer.booking_id IS NOT NULL THEN RETURN v_offer.booking_id;END IF;
 IF v_offer.status<>'accepted' OR v_offer.booking_id IS NOT NULL OR
  v_offer.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Only accepted and unexpired offers can be booked' USING ERRCODE='22023';END IF;
 SELECT * INTO v_application FROM public.dj_club_applications
 WHERE id=v_offer.application_id AND profile_id=v_active AND user_id=v_actor;
 IF NOT FOUND OR v_application.status<>'shortlisted'
  OR v_application.starts_at<=clock_timestamp()+interval '15 minutes' THEN
   RAISE EXCEPTION 'DJ applicant is no longer eligible for this slot' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
 JOIN public.nightclub_purchase_receipts r ON r.id=o.verified_purchase_id
   AND r.profile_id=o.profile_id AND r.club_id=o.club_id
 WHERE o.id=v_offer.owned_club_id AND o.club_id=v_application.club_id
   AND o.profile_id=v_offer.owner_profile_id AND r.user_id=v_offer.owner_user_id AND o.is_open)
 THEN RAISE EXCEPTION 'Verified club is not open for DJ booking' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
   WHERE m.offer_id=v_offer.id AND m.kind='fund' AND m.amount=v_offer.fee)
  OR EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
   WHERE m.offer_id=v_offer.id AND m.kind IN ('payout','refund')) THEN
  RAISE EXCEPTION 'DJ booking escrow is missing or no longer fully held' USING ERRCODE='23503';END IF;

 -- Canonical booking creation validates consent, club hours, fame and calendar conflicts.
 PERFORM set_config('app.dj_funded_conversion_offer_id',v_offer.id::text,true);
 v_booking:=public.reserve_dj_booking_internal(
  v_active,v_application.club_id,v_application.setlist_id,
  v_application.starts_at,p_request_id);
 PERFORM set_config('app.dj_funded_conversion_offer_id',coalesce(v_prior_context,''),true);
 UPDATE public.nightclub_dj_funded_offers SET
   status='booked',booking_id=v_booking,booking_request_id=p_request_id,
   booked_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=v_offer.id;
 RETURN v_booking;
END $function$
;