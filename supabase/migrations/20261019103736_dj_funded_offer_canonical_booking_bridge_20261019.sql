-- Stage the funded DJ offer -> canonical booking financial boundary.
-- Booking conversion is service-role only until end-to-end payout release certification.
ALTER TABLE public.nightclub_dj_funded_offers DROP CONSTRAINT nightclub_dj_funded_offers_status_check;
ALTER TABLE public.nightclub_dj_funded_offers ADD CONSTRAINT nightclub_dj_funded_offers_status_check
 CHECK (status IN ('offered','accepted','booked','settled','declined','cancelled','expired','missed'));
ALTER TABLE public.nightclub_dj_funded_offers ADD COLUMN booking_id uuid UNIQUE REFERENCES public.dj_bookings(id);
ALTER TABLE public.nightclub_dj_funded_offers ADD COLUMN booking_request_id uuid;
ALTER TABLE public.nightclub_dj_funded_offers ADD COLUMN booked_at timestamptz;
ALTER TABLE public.nightclub_dj_funded_offers ADD CONSTRAINT nightclub_dj_booked_escrow_link_check
 CHECK ((booking_id IS NULL AND booking_request_id IS NULL AND booked_at IS NULL)
  OR (booking_id IS NOT NULL AND booking_request_id IS NOT NULL AND booked_at IS NOT NULL
     AND status IN ('booked','settled','cancelled','missed')));
CREATE UNIQUE INDEX nightclub_dj_unique_booking_request ON public.nightclub_dj_funded_offers(dj_user_id,booking_request_id)
 WHERE booking_request_id IS NOT NULL;
ALTER TABLE public.nightclub_dj_escrow_movements DROP CONSTRAINT nightclub_dj_escrow_movements_kind_check;
ALTER TABLE public.nightclub_dj_escrow_movements ADD CONSTRAINT nightclub_dj_escrow_movements_kind_check
 CHECK(kind IN ('fund','refund','payout'));
ALTER TABLE public.nightclub_dj_escrow_movements DROP CONSTRAINT nightclub_dj_escrow_movements_amount_check;
ALTER TABLE public.nightclub_dj_escrow_movements ADD CONSTRAINT nightclub_dj_escrow_movements_amount_check
 CHECK(amount BETWEEN 1 AND 1250);

CREATE FUNCTION public.confirm_accepted_nightclub_dj_offer_internal(
 p_offer_id uuid,p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 IF v_offer.status='booked' AND v_offer.booking_request_id=p_request_id
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
END $$;
REVOKE ALL ON FUNCTION public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)
 TO service_role;

CREATE FUNCTION private.refund_funded_dj_booking_on_terminal_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_offer public.nightclub_dj_funded_offers%ROWTYPE;
 v_before text:=current_setting('app.player_cash_context',true);
BEGIN
 IF NEW.status NOT IN ('cancelled','missed') OR OLD.status IS NOT DISTINCT FROM NEW.status
 THEN RETURN NEW;END IF;
 SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers
 WHERE booking_id=NEW.id AND status='booked' FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW;END IF;
 -- A converted booking that never settled is fully refundable to its original owner.
 PERFORM 1 FROM public.profiles WHERE id=v_offer.owner_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ escrow refund owner missing' USING ERRCODE='23503';END IF;
 PERFORM set_config('app.player_cash_context',jsonb_build_object(
  'classification','nightclub_dj_booking_refund','display_category','nightclub_dj_offer',
  'description','DJ booking cancelled or missed, owner escrow returned',
  'dj_offer_id',v_offer.id,'dj_booking_id',NEW.id,'external_cash_flow',true,
  'idempotency_key','club-dj-escrow-refund:'||v_offer.id)::text,true);
 UPDATE public.profiles SET cash=cash+v_offer.fee WHERE id=v_offer.owner_profile_id;
 PERFORM set_config('app.player_cash_context',coalesce(v_before,''),true);
 INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
 VALUES(v_offer.id,v_offer.owner_profile_id,'refund',v_offer.fee);
 UPDATE public.nightclub_dj_funded_offers SET
  status=CASE WHEN NEW.status='missed' THEN 'missed' ELSE 'cancelled' END,
  resolved_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=v_offer.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.refund_funded_dj_booking_on_terminal_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER refund_funded_dj_booking_on_terminal_status
 AFTER UPDATE OF status ON public.dj_bookings
 FOR EACH ROW WHEN (NEW.status IN ('cancelled','missed') AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION private.refund_funded_dj_booking_on_terminal_change();
COMMENT ON FUNCTION public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)
 IS 'Service-role only canonical DJ booking conversion; never activate publicly before funded settlement tests and feature flag certification.';