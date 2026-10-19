-- Preserve the original owner decision across later applicant withdrawals. An exact request replay remains idempotent.
ALTER TABLE public.dj_club_applications ADD COLUMN review_decision text CHECK(review_decision IN ('shortlist','decline'));
ALTER TABLE public.dj_club_applications ADD CONSTRAINT dj_review_decision_matches_receipt
 CHECK ((review_request_id IS NULL AND review_decision IS NULL) OR (review_request_id IS NOT NULL AND review_decision IS NOT NULL));
CREATE OR REPLACE FUNCTION public.review_nightclub_dj_application(p_owned_club_id uuid, p_application_id uuid, p_decision text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  AND v_application.reviewer_user_id=v_actor AND v_application.review_decision=p_decision
  THEN RETURN v_application.id; END IF;
  RAISE EXCEPTION 'This application already has a review' USING ERRCODE='23505';
 END IF;
 IF v_application.status<>'pending' OR v_application.starts_at<=clock_timestamp()+interval '5 minutes'
 THEN RAISE EXCEPTION 'Only pending future applications may be reviewed' USING ERRCODE='22023'; END IF;
 UPDATE public.dj_club_applications SET status=v_status,
  reviewer_user_id=v_actor,reviewer_profile_id=v_active,review_request_id=p_request_id,
  review_decision=p_decision,
  reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=p_application_id;
 RETURN p_application_id;
END $function$
;