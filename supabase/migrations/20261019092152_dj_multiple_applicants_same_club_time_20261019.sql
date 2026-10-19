-- A nightclub may shortlist among competing DJs for the same proposed time.
-- Prevent each DJ from sending overlapping applications, but do not reserve a club stage until a funded booking exists.
CREATE OR REPLACE FUNCTION public.apply_for_nightclub_dj_slot(p_profile_id uuid, p_owned_club_id uuid, p_setlist_id uuid, p_starts_at timestamp with time zone, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid:=(select auth.uid());
 v_player public.profiles%ROWTYPE;
 v_owner public.player_owned_nightclubs%ROWTYPE;
 v_club public.city_night_clubs%ROWTYPE;
 v_set public.dj_setlists%ROWTYPE;
 v_prior public.dj_club_applications%ROWTYPE;
 v_length int; v_end timestamptz; v_id uuid;
BEGIN
 IF v_actor IS NULL OR p_profile_id IS NULL OR p_owned_club_id IS NULL
 OR p_setlist_id IS NULL OR p_starts_at IS NULL OR p_request_id IS NULL
 OR public.current_active_player_profile_id() IS DISTINCT FROM p_profile_id THEN
  RAISE EXCEPTION 'Active DJ character required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dj:application:player:'||p_profile_id::text)::bigint);
 PERFORM pg_advisory_xact_lock(hashtext('dj:application:club:'||p_owned_club_id::text)::bigint);
 SELECT * INTO v_prior FROM public.dj_club_applications
  WHERE user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.profile_id IS DISTINCT FROM p_profile_id
  OR v_prior.owned_club_id IS DISTINCT FROM p_owned_club_id
  OR v_prior.setlist_id IS DISTINCT FROM p_setlist_id
  OR v_prior.starts_at IS DISTINCT FROM p_starts_at THEN
   RAISE EXCEPTION 'Application request ID already used for another slot' USING ERRCODE='23505';
  END IF;
  RETURN v_prior.id;
 END IF;
 SELECT * INTO v_player FROM public.profiles WHERE id=p_profile_id
  AND user_id=v_actor AND is_active AND died_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active DJ profile required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_owner FROM public.player_owned_nightclubs WHERE id=p_owned_club_id;
 IF NOT FOUND OR v_owner.club_id IS NULL OR NOT v_owner.is_open OR
  NOT EXISTS(SELECT 1 FROM public.nightclub_purchase_receipts receipt
   WHERE receipt.id=v_owner.verified_purchase_id AND receipt.club_id=v_owner.club_id
   AND receipt.profile_id=v_owner.profile_id) THEN
  RAISE EXCEPTION 'Only open receipt-verified clubs may receive DJ applications'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_club FROM public.city_night_clubs WHERE id=v_owner.club_id;
 IF NOT FOUND OR v_player.current_city_id IS DISTINCT FROM v_club.city_id THEN
  RAISE EXCEPTION 'DJ must visit the club city to apply' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_set FROM public.dj_setlists WHERE id=p_setlist_id
  AND profile_id=p_profile_id AND user_id=v_actor;
 IF NOT FOUND OR jsonb_typeof(v_set.items) IS DISTINCT FROM 'array'
 OR jsonb_array_length(coalesce(v_set.items,'[]'::jsonb)) NOT BETWEEN 1 AND 30 THEN
  RAISE EXCEPTION 'A saved DJ set containing 1-30 tracks is required' USING ERRCODE='22023'; END IF;
 IF p_starts_at<clock_timestamp()+interval '15 minutes'
 OR p_starts_at>clock_timestamp()+interval '14 days' THEN
  RAISE EXCEPTION 'DJ application must be 15 minutes to 14 days ahead' USING ERRCODE='22023'; END IF;
 v_length:=coalesce((v_club.dj_slot_config->>'set_length_minutes')::integer,45);
 IF v_length NOT BETWEEN 15 AND 180 THEN
  RAISE EXCEPTION 'Unsupported club DJ set duration' USING ERRCODE='22023'; END IF;
 v_end:=p_starts_at+make_interval(mins=>v_length);
 IF (SELECT count(*) FROM public.dj_club_applications
   WHERE profile_id=p_profile_id AND status IN ('pending','shortlisted')
   AND starts_at>clock_timestamp())>=5 THEN
  RAISE EXCEPTION 'Maximum of five outstanding DJ applications' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.dj_club_applications a WHERE
  a.profile_id=p_profile_id
  AND a.status IN ('pending','shortlisted') AND a.starts_at<v_end AND a.ends_at>p_starts_at) THEN
  RAISE EXCEPTION 'Proposed DJ slot conflicts with another application' USING ERRCODE='23P01'; END IF;
 IF EXISTS (SELECT 1 FROM public.dj_bookings b WHERE
  (b.profile_id=p_profile_id OR b.club_id=v_owner.club_id)
  AND b.status IN ('booked','ready','live','resolving')
  AND b.starts_at<v_end AND b.ends_at>p_starts_at) THEN
  RAISE EXCEPTION 'Proposed slot conflicts with an existing DJ booking' USING ERRCODE='23P01'; END IF;
 INSERT INTO public.dj_club_applications
 (user_id,profile_id,owned_club_id,club_id,setlist_id,setlist_name,dj_display_name,
 starts_at,ends_at,status,request_id)
 VALUES (v_actor,p_profile_id,p_owned_club_id,v_owner.club_id,p_setlist_id,
 left(coalesce(nullif(btrim(v_set.name),''),'Saved DJ set'),90),
 left(coalesce(nullif(btrim(v_player.display_name),''),'RockMundo DJ'),90),
 p_starts_at,v_end,'pending',p_request_id) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;