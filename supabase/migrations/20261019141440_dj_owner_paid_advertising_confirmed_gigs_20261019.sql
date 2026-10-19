-- Paid player-owned nightclub DJ advertising. Promotional spend is a real cash expense,
-- never a payout or door-revenue credit. Only verified owners and funded future bookings.
CREATE TABLE public.nightclub_dj_paid_promotions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL UNIQUE REFERENCES public.dj_bookings(id) ON DELETE RESTRICT,
 owned_club_id uuid NOT NULL REFERENCES public.player_owned_nightclubs(id),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 request_id uuid NOT NULL,
 budget integer NOT NULL CHECK(budget IN (100,250,500)),
 attendance_boost_percent integer NOT NULL CHECK(attendance_boost_percent BETWEEN 1 AND 15),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_user_id,request_id)
);
CREATE INDEX nightclub_dj_paid_promotions_owner_idx
 ON public.nightclub_dj_paid_promotions(owned_club_id,created_at DESC);
ALTER TABLE public.nightclub_dj_paid_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Receipt verified nightclub owners read paid promotions"
 ON public.nightclub_dj_paid_promotions FOR SELECT TO authenticated
 USING(owner_user_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM public.player_owned_nightclubs o
   JOIN public.nightclub_purchase_receipts r
    ON r.id=o.verified_purchase_id
     AND r.profile_id=o.profile_id AND r.club_id=o.club_id
   WHERE o.id=nightclub_dj_paid_promotions.owned_club_id
    AND o.profile_id=nightclub_dj_paid_promotions.owner_profile_id
    AND r.user_id=(SELECT auth.uid())
 ));
REVOKE ALL ON public.nightclub_dj_paid_promotions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_paid_promotions TO authenticated;

CREATE FUNCTION public.purchase_nightclub_dj_promotion(
 p_owned_club_id uuid,p_booking_id uuid,p_budget integer,p_request_id uuid
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $promote$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_profile_id uuid:=public.current_active_player_profile_id();
 v_booking public.dj_bookings%ROWTYPE;
 v_club public.player_owned_nightclubs%ROWTYPE;
 v_prior public.nightclub_dj_paid_promotions%ROWTYPE;
 v_owner_cash bigint;
 v_boost integer;
 v_old_context text:=current_setting('app.player_cash_context',true);
BEGIN
 IF v_actor IS NULL OR v_profile_id IS NULL OR p_owned_club_id IS NULL
  OR p_booking_id IS NULL OR p_budget IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'Authenticated club owner, booking, and request required' USING ERRCODE='42501';END IF;

 -- Serialize with booking cancellation and starting the DJ set.
 SELECT * INTO v_booking FROM public.dj_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ booking not found' USING ERRCODE='42501';END IF;
 SELECT * INTO v_club FROM public.player_owned_nightclubs
 WHERE id=p_owned_club_id AND profile_id=v_profile_id AND club_id=v_booking.club_id FOR UPDATE;
 IF NOT FOUND OR NOT v_club.is_open OR NOT EXISTS (
  SELECT 1 FROM public.nightclub_purchase_receipts r
  WHERE r.id=v_club.verified_purchase_id
   AND r.profile_id=v_profile_id AND r.club_id=v_booking.club_id AND r.user_id=v_actor
 ) THEN RAISE EXCEPTION 'Active receipt-verified nightclub owner required' USING ERRCODE='42501';END IF;

 SELECT * INTO v_prior FROM public.nightclub_dj_paid_promotions
 WHERE owner_user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
   IF v_prior.owned_club_id IS DISTINCT FROM p_owned_club_id
    OR v_prior.booking_id IS DISTINCT FROM p_booking_id
    OR v_prior.budget IS DISTINCT FROM p_budget THEN
    RAISE EXCEPTION 'Promotion request key used for different intent' USING ERRCODE='23505';END IF;
   RETURN jsonb_build_object('promotion_id',v_prior.id,'booking_id',v_prior.booking_id,
       'budget',v_prior.budget,'boost_percent',v_prior.attendance_boost_percent,'replayed',true);
 END IF;
 IF p_budget NOT IN(100,250,500) OR p_budget>v_club.quality_level*100
 THEN RAISE EXCEPTION 'Choose advertising budget within club quality tier' USING ERRCODE='22023';END IF;
 IF v_booking.status NOT IN('booked','ready')
    OR v_booking.starts_at<=clock_timestamp()+interval '3 hours'
 THEN RAISE EXCEPTION 'Only upcoming DJ sets more than 3 hours ahead can be promoted'
 USING ERRCODE='22023';END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.nightclub_dj_funded_offers f
  WHERE f.booking_id=v_booking.id AND f.owned_club_id=v_club.id
   AND f.status='booked'
  AND EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
    WHERE m.offer_id=f.id AND m.kind='fund' AND m.amount=f.fee)
  AND NOT EXISTS(SELECT 1 FROM public.nightclub_dj_escrow_movements m
    WHERE m.offer_id=f.id AND m.kind IN('payout','refund'))
 ) THEN RAISE EXCEPTION 'A fully funded and confirmed owner DJ gig is required'
 USING ERRCODE='23503';END IF;
 IF EXISTS (SELECT 1 FROM public.nightclub_dj_paid_promotions WHERE booking_id=p_booking_id)
 THEN RAISE EXCEPTION 'This DJ set was already advertised' USING ERRCODE='23505';END IF;
 -- Profile row lock ensures concurrent fee offers, equipment buys and
 -- promotions cannot collectively exceed actual player cash.
 SELECT cash INTO v_owner_cash FROM public.profiles
 WHERE id=v_profile_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND OR v_owner_cash<p_budget THEN
   RAISE EXCEPTION 'Not enough real owner character cash for advertising'
   USING ERRCODE='22023';END IF;

 v_boost:=CASE p_budget WHEN 100 THEN 2 WHEN 250 THEN 5 ELSE 10 END;
 PERFORM set_config('app.player_cash_context',jsonb_build_object(
  'classification','nightclub_dj_paid_advertising',
  'display_category','nightclub_dj_promotion',
  'description','Paid advertising for a confirmed nightclub DJ performance',
  'dj_booking_id',v_booking.id,
  'external_cash_flow',true,
  'idempotency_key','nightclub-dj-advertising:'||v_actor::text||':'||p_request_id::text
 )::text,true);
 UPDATE public.profiles SET cash=cash-p_budget WHERE id=v_profile_id;
 PERFORM set_config('app.player_cash_context',coalesce(v_old_context,''),true);
 INSERT INTO public.nightclub_dj_paid_promotions(
  booking_id,owned_club_id,owner_user_id,owner_profile_id,
  request_id,budget,attendance_boost_percent
 ) VALUES(v_booking.id,v_club.id,v_actor,v_profile_id,p_request_id,p_budget,v_boost)
 RETURNING * INTO v_prior;
 RETURN jsonb_build_object('promotion_id',v_prior.id,'booking_id',v_prior.booking_id,
   'budget',v_prior.budget,'boost_percent',v_prior.attendance_boost_percent,'replayed',false);
END $promote$;
REVOKE ALL ON FUNCTION public.purchase_nightclub_dj_promotion(uuid,uuid,integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_nightclub_dj_promotion(uuid,uuid,integer,uuid)
 TO authenticated;
COMMENT ON TABLE public.nightclub_dj_paid_promotions IS
 'Advertising purchased for a real confirmed funded DJ booking. Costs actual owner cash and modestly boosts capped attendance at verified settlement; no invented door revenue, no refund after advertising is purchased.';