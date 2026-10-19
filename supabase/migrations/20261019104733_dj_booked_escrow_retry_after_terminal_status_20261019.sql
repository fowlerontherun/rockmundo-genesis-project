-- An acknowledged booking ID stays replayable after settlement, DJ cancellation or a missed set.
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
 v_booking:=public.reserve_dj_booking_internal(
  v_active,v_application.club_id,v_application.setlist_id,
  v_application.starts_at,p_request_id);
 UPDATE public.nightclub_dj_funded_offers SET
   status='booked',booking_id=v_booking,booking_request_id=p_request_id,
   booked_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=v_offer.id;
 RETURN v_booking;
END $function$
;