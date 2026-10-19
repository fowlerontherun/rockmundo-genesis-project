
-- DJ interest proposals are NOT booked performances, stage reservations, offers of money or calendar events.
CREATE TABLE public.dj_club_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 owned_club_id uuid NOT NULL REFERENCES public.player_owned_nightclubs(id),
 club_id uuid NOT NULL REFERENCES public.city_night_clubs(id),
 setlist_id uuid NOT NULL REFERENCES public.dj_setlists(id),
 setlist_name text NOT NULL,
 dj_display_name text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','shortlisted','declined','withdrawn')),
 request_id uuid NOT NULL,
 reviewer_profile_id uuid REFERENCES public.profiles(id),
 reviewer_user_id uuid REFERENCES auth.users(id),
 review_request_id uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dj_application_positive_duration CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '3 hours'),
 CONSTRAINT dj_application_single_review CHECK(
  (reviewer_profile_id IS NULL AND reviewer_user_id IS NULL AND review_request_id IS NULL AND reviewed_at IS NULL)
  OR (reviewer_profile_id IS NOT NULL AND reviewer_user_id IS NOT NULL AND review_request_id IS NOT NULL AND reviewed_at IS NOT NULL)
 ),
 UNIQUE(user_id,request_id),
 UNIQUE(reviewer_user_id,review_request_id)
);
CREATE INDEX dj_club_applications_owner_pending_idx ON public.dj_club_applications(owned_club_id,status,starts_at);
CREATE INDEX dj_club_applications_player_idx ON public.dj_club_applications(profile_id,created_at DESC);
CREATE UNIQUE INDEX dj_club_one_active_application_per_player_time
 ON public.dj_club_applications(profile_id,club_id,starts_at)
 WHERE status IN ('pending','shortlisted');
ALTER TABLE public.dj_club_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DJ applicants can read own applications" ON public.dj_club_applications
 FOR SELECT TO authenticated USING (
 dj_club_applications.user_id=(select auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles p
  WHERE p.id=dj_club_applications.profile_id AND p.user_id=(select auth.uid()))
 );
CREATE POLICY "Verified club owners can read their applications" ON public.dj_club_applications
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
 JOIN public.nightclub_purchase_receipts receipt
  ON receipt.id=o.verified_purchase_id AND receipt.profile_id=o.profile_id
   AND receipt.club_id=o.club_id
 JOIN public.profiles owner_profile ON owner_profile.id=o.profile_id
 WHERE o.id=dj_club_applications.owned_club_id AND o.club_id=dj_club_applications.club_id
 AND owner_profile.user_id=(select auth.uid()) AND receipt.user_id=(select auth.uid()))
 );
REVOKE ALL ON public.dj_club_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dj_club_applications TO authenticated;
CREATE FUNCTION public.get_verified_nightclub_application_club(p_club_id uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
 IF (select auth.uid()) IS NULL OR p_club_id IS NULL THEN RETURN NULL; END IF;
 SELECT o.id INTO v_id FROM public.player_owned_nightclubs o
 JOIN public.nightclub_purchase_receipts receipt
  ON receipt.id=o.verified_purchase_id AND receipt.profile_id=o.profile_id
  AND receipt.club_id=o.club_id
 WHERE o.club_id=p_club_id AND o.is_open LIMIT 1;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.get_verified_nightclub_application_club(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_verified_nightclub_application_club(uuid) TO authenticated;
CREATE FUNCTION public.apply_for_nightclub_dj_slot(
 p_profile_id uuid,p_owned_club_id uuid,p_setlist_id uuid,
 p_starts_at timestamptz,p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
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
  (a.profile_id=p_profile_id OR a.club_id=v_owner.club_id)
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
END $$;
REVOKE ALL ON FUNCTION public.apply_for_nightclub_dj_slot(uuid,uuid,uuid,timestamptz,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_nightclub_dj_slot(uuid,uuid,uuid,timestamptz,uuid)
 TO authenticated;

CREATE FUNCTION public.review_nightclub_dj_application(
 p_owned_club_id uuid,p_application_id uuid,p_decision text,p_request_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=(select auth.uid());
 v_active uuid:=public.current_active_player_profile_id();
 v_owner public.player_owned_nightclubs%ROWTYPE;
 v_application public.dj_club_applications%ROWTYPE;
 v_status text;
BEGIN
 IF v_actor IS NULL OR v_active IS NULL OR p_owned_club_id IS NULL
  OR p_application_id IS NULL OR p_request_id IS NULL
  OR p_decision IS NULL OR p_decision NOT IN ('shortlist','decline') THEN
  RAISE EXCEPTION 'Active verified owner and review decision required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_owner FROM public.player_owned_nightclubs o
  WHERE o.id=p_owned_club_id AND o.profile_id=v_active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles owner_profile
  WHERE owner_profile.id=v_owner.profile_id AND owner_profile.user_id=v_actor)
 OR NOT EXISTS(SELECT 1 FROM public.nightclub_purchase_receipts receipt
  WHERE receipt.id=v_owner.verified_purchase_id AND receipt.club_id=v_owner.club_id
  AND receipt.profile_id=v_active AND receipt.user_id=v_actor) THEN
  RAISE EXCEPTION 'Receipt-verified owner required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_application FROM public.dj_club_applications
  WHERE id=p_application_id AND owned_club_id=p_owned_club_id
  AND club_id=v_owner.club_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application does not belong to club' USING ERRCODE='42501'; END IF;
 v_status:=CASE WHEN p_decision='shortlist' THEN 'shortlisted' ELSE 'declined' END;
 IF v_application.review_request_id IS NOT NULL THEN
  IF v_application.review_request_id=p_request_id
  AND v_application.reviewer_user_id=v_actor AND v_application.status=v_status
  THEN RETURN v_application.id; END IF;
  RAISE EXCEPTION 'This application already has a review' USING ERRCODE='23505';
 END IF;
 IF v_application.status<>'pending' OR v_application.starts_at<=clock_timestamp()+interval '5 minutes'
 THEN RAISE EXCEPTION 'Only pending future applications may be reviewed' USING ERRCODE='22023'; END IF;
 UPDATE public.dj_club_applications SET status=v_status,
  reviewer_user_id=v_actor,reviewer_profile_id=v_active,review_request_id=p_request_id,
  reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=p_application_id;
 RETURN p_application_id;
END $$;
REVOKE ALL ON FUNCTION public.review_nightclub_dj_application(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_nightclub_dj_application(uuid,uuid,text,uuid)
 TO authenticated;

CREATE FUNCTION public.withdraw_nightclub_dj_application(p_application_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=(select auth.uid());
 v_row public.dj_club_applications%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_application_id IS NULL THEN
  RAISE EXCEPTION 'Sign in to withdraw your DJ application' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM public.dj_club_applications
  WHERE id=p_application_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ application not owned by this account' USING ERRCODE='42501'; END IF;
 IF v_row.status='withdrawn' THEN RETURN v_row.id; END IF;
 IF v_row.status NOT IN ('pending','shortlisted') THEN
  RAISE EXCEPTION 'Only open applications may be withdrawn' USING ERRCODE='22023'; END IF;
 UPDATE public.dj_club_applications SET status='withdrawn',updated_at=clock_timestamp()
 WHERE id=p_application_id;
 RETURN p_application_id;
END $$;
REVOKE ALL ON FUNCTION public.withdraw_nightclub_dj_application(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_nightclub_dj_application(uuid) TO authenticated;
COMMENT ON TABLE public.dj_club_applications IS
 'Interest and shortlisting only. No booked slots, stage reservations, guaranteed fees, schedule activities, cash transactions or player rewards.';