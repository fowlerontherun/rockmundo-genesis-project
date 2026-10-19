-- Server bridge for verified JWT actor, and owner-authorised cancellation for already booked funded sets.
CREATE FUNCTION public.dj_verified_funded_offer_booking_service(
 p_actor_user_id uuid,p_offer_id uuid,p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_previous text:=current_setting('request.jwt.claim.sub',true);
 v_id uuid;
BEGIN
 IF p_actor_user_id IS NULL OR NOT EXISTS(
 SELECT 1 FROM auth.users u WHERE u.id=p_actor_user_id) THEN
  RAISE EXCEPTION 'Verified DJ identity required' USING ERRCODE='42501';END IF;
 PERFORM set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
 v_id:=public.confirm_accepted_nightclub_dj_offer_internal(p_offer_id,p_request_id);
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.dj_verified_funded_offer_booking_service(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dj_verified_funded_offer_booking_service(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.cancel_owned_funded_dj_booking(
 p_offer_id uuid,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_actor uuid:=(select auth.uid());
 v_profile uuid:=public.current_active_player_profile_id();
 v_offer public.nightclub_dj_funded_offers%ROWTYPE;
 v_booking public.dj_bookings%ROWTYPE;
 v_prior public.nightclub_dj_offer_actions%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR v_profile IS NULL OR p_offer_id IS NULL OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'Active verified owner and cancellation request required' USING ERRCODE='42501';END IF;
 -- Booked performance row must be locked before escrow row, same lock order as
 -- DJ cancellation, missed-set processing and live settlement.
 SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers
 WHERE id=p_offer_id;
 IF NOT FOUND OR v_offer.owner_user_id<>v_actor OR v_offer.owner_profile_id<>v_profile
 OR NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
  JOIN public.nightclub_purchase_receipts r ON r.id=o.verified_purchase_id
   AND r.profile_id=o.profile_id AND r.club_id=o.club_id
  WHERE o.id=v_offer.owned_club_id AND o.profile_id=v_profile AND r.user_id=v_actor)
 THEN RAISE EXCEPTION 'Receipt-verified club owner required' USING ERRCODE='42501';END IF;
 IF v_offer.booking_id IS NULL THEN
  RAISE EXCEPTION 'This offer has not been converted to a DJ booking' USING ERRCODE='22023';END IF;
 SELECT * INTO v_booking FROM public.dj_bookings
 WHERE id=v_offer.booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Funded DJ booking missing' USING ERRCODE='23503';END IF;
 SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers
 WHERE id=p_offer_id FOR UPDATE;
 SELECT * INTO v_prior FROM public.nightclub_dj_offer_actions
 WHERE actor_user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.offer_id<>p_offer_id OR v_prior.action<>'cancel' THEN
   RAISE EXCEPTION 'Owner cancellation request ID used for another action' USING ERRCODE='23505';END IF;
  RETURN jsonb_build_object('offer_id',p_offer_id,'status',v_offer.status,'replayed',true);
 END IF;
 IF v_offer.status='cancelled' AND v_booking.status='cancelled' THEN
  RETURN jsonb_build_object('offer_id',p_offer_id,'status','cancelled','replayed',true);
 END IF;
 IF v_offer.status<>'booked' OR v_booking.status NOT IN('booked','ready')
 OR v_booking.starts_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Only future, unstarted funded DJ bookings can be cancelled'
   USING ERRCODE='22023';END IF;
 UPDATE public.dj_bookings SET status='cancelled',updated_at=now()
 WHERE id=v_booking.id;
 -- Terminal booking trigger atomically writes ONE owner refund and closes offer.
 IF (SELECT f.status FROM public.nightclub_dj_funded_offers f WHERE f.id=p_offer_id)<>'cancelled' THEN
  RAISE EXCEPTION 'DJ booking cancellation refund was not recorded' USING ERRCODE='23503';END IF;
 INSERT INTO public.nightclub_dj_offer_actions(offer_id,actor_user_id,action,request_id)
 VALUES(p_offer_id,v_actor,'cancel',p_request_id);
 RETURN jsonb_build_object('offer_id',p_offer_id,'status','cancelled','replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.cancel_owned_funded_dj_booking(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_owned_funded_dj_booking(uuid,uuid) TO authenticated;
