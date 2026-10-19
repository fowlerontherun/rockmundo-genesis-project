-- Verified-owner DJ offer escrow, intentionally NOT a scheduled booking.
-- Funds enter a durable hold, and may only be returned here. DJ payouts remain disabled.
CREATE TABLE public.nightclub_dj_funded_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owned_club_id uuid NOT NULL REFERENCES public.player_owned_nightclubs(id),
 application_id uuid NOT NULL UNIQUE REFERENCES public.dj_club_applications(id),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 dj_user_id uuid NOT NULL REFERENCES auth.users(id),
 dj_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 fee integer NOT NULL CHECK(fee BETWEEN 50 AND 1250),
 funding_request_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'offered'
   CHECK(status IN ('offered','accepted','declined','cancelled','expired')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_at timestamptz,
 UNIQUE(owner_user_id,funding_request_id),
 CHECK(owner_user_id<>dj_user_id)
);
CREATE INDEX nightclub_dj_offers_owner_idx ON public.nightclub_dj_funded_offers(owned_club_id,status,created_at DESC);
CREATE INDEX nightclub_dj_offers_dj_idx ON public.nightclub_dj_funded_offers(dj_profile_id,status,created_at DESC);
CREATE INDEX nightclub_dj_offers_expiry_idx ON public.nightclub_dj_funded_offers(expires_at)
 WHERE status IN ('offered','accepted');
ALTER TABLE public.nightclub_dj_funded_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or applicant sees funded DJ offers"
 ON public.nightclub_dj_funded_offers FOR SELECT TO authenticated
 USING ((dj_user_id=(select auth.uid()) AND EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=dj_profile_id AND p.user_id=(select auth.uid())
  )) OR
  (owner_user_id=(select auth.uid()) AND EXISTS(
    SELECT 1 FROM public.player_owned_nightclubs o
    JOIN public.nightclub_purchase_receipts r ON r.id=o.verified_purchase_id
      AND r.club_id=o.club_id AND r.profile_id=o.profile_id
    WHERE o.id=owned_club_id AND o.profile_id=owner_profile_id
      AND r.user_id=(select auth.uid())
  )));
REVOKE ALL ON public.nightclub_dj_funded_offers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_funded_offers TO authenticated;

CREATE TABLE public.nightclub_dj_escrow_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES public.nightclub_dj_funded_offers(id),
 owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('fund','refund')),
 amount integer NOT NULL CHECK(amount BETWEEN 50 AND 1250),
 performed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(offer_id,kind)
);
ALTER TABLE public.nightclub_dj_escrow_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own nightclub DJ escrow accounting" ON public.nightclub_dj_escrow_movements
 FOR SELECT TO authenticated USING(EXISTS (
  SELECT 1 FROM public.nightclub_dj_funded_offers f
  WHERE f.id=offer_id AND (f.owner_user_id=(select auth.uid()) OR f.dj_user_id=(select auth.uid()))
 ));
REVOKE ALL ON public.nightclub_dj_escrow_movements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_escrow_movements TO authenticated;

CREATE TABLE public.nightclub_dj_offer_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES public.nightclub_dj_funded_offers(id),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL CHECK(action IN ('fund','accept','decline','cancel','expire')),
 request_id uuid NOT NULL,
 performed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_user_id,request_id)
);
ALTER TABLE public.nightclub_dj_offer_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Related DJ offer action receipts" ON public.nightclub_dj_offer_actions
 FOR SELECT TO authenticated USING(EXISTS(
   SELECT 1 FROM public.nightclub_dj_funded_offers f
   WHERE f.id=offer_id AND (f.owner_user_id=(select auth.uid()) OR f.dj_user_id=(select auth.uid()))
 ));
REVOKE ALL ON public.nightclub_dj_offer_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_offer_actions TO authenticated;

CREATE FUNCTION public.fund_nightclub_dj_offer(
 p_owned_club_id uuid,p_application_id uuid,p_fee integer,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fund$
DECLARE v_actor uuid:=(select auth.uid());v_profile uuid:=public.current_active_player_profile_id();
 v_club public.player_owned_nightclubs%ROWTYPE;v_app public.dj_club_applications%ROWTYPE;
 v_prior public.nightclub_dj_funded_offers%ROWTYPE;v_owner_cash bigint;
 v_id uuid;v_expire timestamptz;v_old_ctx text:=current_setting('app.player_cash_context',true);
BEGIN
 IF v_actor IS NULL OR v_profile IS NULL OR p_owned_club_id IS NULL OR p_application_id IS NULL
 OR p_fee IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'Active verified nightclub owner and complete offer required' USING ERRCODE='42501';END IF;
 -- The club lock serializes concurrent offers and prevents overspending through this RPC.
 SELECT * INTO v_club FROM public.player_owned_nightclubs c
 WHERE c.id=p_owned_club_id AND c.profile_id=v_profile FOR UPDATE;
 IF NOT FOUND OR NOT v_club.is_open OR v_club.club_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.nightclub_purchase_receipts r
  JOIN public.profiles p ON p.id=r.profile_id AND p.user_id=r.user_id
  WHERE r.id=v_club.verified_purchase_id AND r.club_id=v_club.club_id
   AND r.profile_id=v_profile AND r.user_id=v_actor)
 THEN RAISE EXCEPTION 'Verified open nightclub ownership required to fund DJ offers' USING ERRCODE='42501';END IF;

 SELECT * INTO v_prior FROM public.nightclub_dj_funded_offers f
 WHERE f.owner_user_id=v_actor AND f.funding_request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.owned_club_id IS DISTINCT FROM p_owned_club_id
    OR v_prior.application_id IS DISTINCT FROM p_application_id
    OR v_prior.fee IS DISTINCT FROM p_fee THEN
   RAISE EXCEPTION 'Funding request ID reused for another offer' USING ERRCODE='23505';END IF;
  RETURN jsonb_build_object('offer_id',v_prior.id,'fee',v_prior.fee,
   'status',v_prior.status,'replayed',true,'expires_at',v_prior.expires_at);
 END IF;

 IF p_fee NOT BETWEEN 50 AND least(1250,greatest(250,250*v_club.quality_level)) THEN
  RAISE EXCEPTION 'DJ offer fee exceeds bounded club tier budget' USING ERRCODE='22023';END IF;
 SELECT * INTO v_app FROM public.dj_club_applications a
 WHERE a.id=p_application_id AND a.owned_club_id=p_owned_club_id
 AND a.club_id=v_club.club_id FOR UPDATE;
 IF NOT FOUND OR v_app.status<>'shortlisted'
 OR v_app.starts_at<=clock_timestamp()+interval '90 minutes' THEN
  RAISE EXCEPTION 'Only shortlisted future DJ applications may receive offers' USING ERRCODE='22023';END IF;
 IF v_app.user_id=v_actor THEN
  RAISE EXCEPTION 'Owner cannot create a paid DJ offer to the same user' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.nightclub_dj_funded_offers f WHERE f.application_id=p_application_id)
 THEN RAISE EXCEPTION 'Application already has a DJ offer' USING ERRCODE='23505';END IF;
 IF EXISTS(SELECT 1 FROM public.dj_bookings b WHERE
  (b.profile_id=v_app.profile_id OR b.club_id=v_app.club_id)
  AND b.status IN ('booked','ready','live','resolving')
  AND b.starts_at<v_app.ends_at AND b.ends_at>v_app.starts_at)
 THEN RAISE EXCEPTION 'DJ application conflicts with a booked set' USING ERRCODE='23P01';END IF;
 v_expire:=least(clock_timestamp()+interval '24 hours',v_app.starts_at-interval '60 minutes');
 IF v_expire<=clock_timestamp()+interval '10 minutes' THEN
  RAISE EXCEPTION 'Too late to fund this DJ application' USING ERRCODE='22023';END IF;
 IF (SELECT count(*) FROM public.nightclub_dj_funded_offers f
 WHERE f.owned_club_id=p_owned_club_id AND f.status IN ('offered','accepted'))>=5
 THEN RAISE EXCEPTION 'Club has reached its five outstanding escrow offers' USING ERRCODE='22023';END IF;
 SELECT p.cash INTO v_owner_cash FROM public.profiles p
 WHERE p.id=v_profile AND p.user_id=v_actor FOR UPDATE;
 IF coalesce(v_owner_cash,0)<p_fee THEN RAISE EXCEPTION 'Insufficient nightclub owner cash' USING ERRCODE='22023';END IF;
 INSERT INTO public.nightclub_dj_funded_offers(
  owned_club_id,application_id,owner_user_id,owner_profile_id,dj_user_id,
  dj_profile_id,fee,funding_request_id,expires_at
 ) VALUES(p_owned_club_id,p_application_id,v_actor,v_profile,v_app.user_id,
  v_app.profile_id,p_fee,p_request_id,v_expire) RETURNING id INTO v_id;
 PERFORM set_config('app.player_cash_context',jsonb_build_object(
  'classification','nightclub_dj_offer_escrow','display_category','nightclub_dj_offer',
  'description','Held nightclub DJ offer fee pending booking certification',
  'dj_offer_id',v_id,'external_cash_flow',true,
  'idempotency_key','club-dj-escrow-fund:'||v_id)::text,true);
 UPDATE public.profiles SET cash=cash-p_fee WHERE id=v_profile AND user_id=v_actor AND cash>=p_fee;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner balance changed while funding offer' USING ERRCODE='22023';END IF;
 PERFORM set_config('app.player_cash_context',coalesce(v_old_ctx,''),true);
 INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
 VALUES(v_id,v_profile,'fund',p_fee);
 INSERT INTO public.nightclub_dj_offer_actions(offer_id,actor_user_id,action,request_id)
 VALUES(v_id,v_actor,'fund',p_request_id);
 RETURN jsonb_build_object('offer_id',v_id,'fee',p_fee,'status','offered',
  'replayed',false,'expires_at',v_expire);
END $fund$;

CREATE FUNCTION public.decide_nightclub_dj_offer(
 p_offer_id uuid,p_action text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $decision$
DECLARE v_actor uuid:=(select auth.uid());
 v_active uuid:=public.current_active_player_profile_id();
 v_offer public.nightclub_dj_funded_offers%ROWTYPE;
 v_receipt public.nightclub_dj_offer_actions%ROWTYPE;
 v_next text;v_old_ctx text:=current_setting('app.player_cash_context',true);
BEGIN
 IF v_actor IS NULL OR p_offer_id IS NULL OR p_request_id IS NULL
 OR p_action IS NULL OR p_action NOT IN ('accept','decline','cancel','expire')
 THEN RAISE EXCEPTION 'Authenticated offer decision required' USING ERRCODE='42501';END IF;
 SELECT * INTO v_receipt FROM public.nightclub_dj_offer_actions
 WHERE actor_user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_receipt.offer_id<>p_offer_id OR v_receipt.action<>p_action THEN
   RAISE EXCEPTION 'DJ offer request ID reused for different intent' USING ERRCODE='23505';END IF;
  SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers WHERE id=p_offer_id;
  RETURN jsonb_build_object('offer_id',p_offer_id,'status',v_offer.status,
    'fee',v_offer.fee,'replayed',true);
 END IF;
 SELECT * INTO v_offer FROM public.nightclub_dj_funded_offers f
 WHERE f.id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ offer not found' USING ERRCODE='42501';END IF;
 IF p_action='expire' THEN
  IF clock_timestamp()<v_offer.expires_at THEN
   RAISE EXCEPTION 'DJ offer not expired yet' USING ERRCODE='22023';END IF;
 ELSE
  IF v_active IS NULL THEN RAISE EXCEPTION 'Select your active character to decide DJ offers'
   USING ERRCODE='42501';END IF;
  IF p_action='cancel' THEN
   IF v_offer.owner_user_id<>v_actor OR v_offer.owner_profile_id<>v_active
   OR NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
    JOIN public.nightclub_purchase_receipts r ON r.id=o.verified_purchase_id
      AND r.club_id=o.club_id AND r.profile_id=o.profile_id
    WHERE o.id=v_offer.owned_club_id AND o.profile_id=v_active
    AND r.user_id=v_actor)
   THEN RAISE EXCEPTION 'Only verified owner can cancel DJ offer' USING ERRCODE='42501';END IF;
  ELSE
   IF v_offer.dj_user_id<>v_actor OR v_offer.dj_profile_id<>v_active THEN
    RAISE EXCEPTION 'Only targeted DJ character can decide this offer'
     USING ERRCODE='42501';END IF;
  END IF;
 END IF;
 IF v_offer.status NOT IN ('offered','accepted') THEN
  RAISE EXCEPTION 'DJ offer is already closed' USING ERRCODE='22023';END IF;
 IF p_action='accept' THEN
  IF v_offer.status<>'offered' OR clock_timestamp()>=v_offer.expires_at
  OR NOT EXISTS(SELECT 1 FROM public.dj_club_applications a
   WHERE a.id=v_offer.application_id AND a.status='shortlisted'
    AND a.user_id=v_actor AND a.profile_id=v_active) THEN
    RAISE EXCEPTION 'Offer expired or applicant no longer shortlisted' USING ERRCODE='22023';END IF;
  v_next:='accepted';
 ELSE
  v_next:=CASE p_action WHEN 'cancel' THEN 'cancelled'
   WHEN 'decline' THEN 'declined' ELSE 'expired' END;
  IF p_action='decline' AND v_offer.status<>'offered' THEN
   RAISE EXCEPTION 'An accepted offer may be cancelled by owner or expired' USING ERRCODE='22023';END IF;
 END IF;
 UPDATE public.nightclub_dj_funded_offers SET status=v_next,updated_at=clock_timestamp(),
 resolved_at=CASE WHEN v_next IN ('declined','cancelled','expired')
 THEN clock_timestamp() ELSE NULL END WHERE id=p_offer_id;
 IF v_next IN ('declined','cancelled','expired') THEN
  -- Exactly one refund, even under cancellation/expiry races: offer row lock and unique movement.
  PERFORM 1 FROM public.profiles p WHERE p.id=v_offer.owner_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nightclub owner cash account missing' USING ERRCODE='23503';END IF;
  PERFORM set_config('app.player_cash_context',jsonb_build_object(
   'classification','nightclub_dj_offer_escrow_refund',
   'display_category','nightclub_dj_offer','description','Refunded unbooked nightclub DJ offer',
   'dj_offer_id',v_offer.id,'external_cash_flow',true,
   'idempotency_key','club-dj-escrow-refund:'||v_offer.id)::text,true);
  UPDATE public.profiles SET cash=cash+v_offer.fee WHERE id=v_offer.owner_profile_id;
  PERFORM set_config('app.player_cash_context',coalesce(v_old_ctx,''),true);
  INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
  VALUES(v_offer.id,v_offer.owner_profile_id,'refund',v_offer.fee);
 END IF;
 INSERT INTO public.nightclub_dj_offer_actions(offer_id,actor_user_id,action,request_id)
 VALUES(v_offer.id,v_actor,p_action,p_request_id);
 RETURN jsonb_build_object('offer_id',v_offer.id,'status',v_next,'fee',v_offer.fee,'replayed',false);
END $decision$;
REVOKE ALL ON FUNCTION public.fund_nightclub_dj_offer(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.decide_nightclub_dj_offer(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fund_nightclub_dj_offer(uuid,uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_nightclub_dj_offer(uuid,text,uuid) TO authenticated;
COMMENT ON TABLE public.nightclub_dj_funded_offers IS
 'Owner cash escrowed for DJ interest. Accept does NOT create a DJ booking or payment; cancel, decline, and expire always refund owner once. No settle transition until separate certified payout integration.';
