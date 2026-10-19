
-- A resident agreement is NOT a stage hold. Each date has its own DJ application,
-- fixed contractual fee, owner-funded escrow and separate canonical booking.
CREATE TABLE public.nightclub_dj_residency_occurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 residency_id uuid NOT NULL REFERENCES public.nightclub_dj_residencies(id),
 occurrence_number int NOT NULL CHECK(occurrence_number BETWEEN 1 AND 4),
 application_id uuid NOT NULL UNIQUE REFERENCES public.dj_club_applications(id),
 prepared_by_user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(residency_id,occurrence_number),
 UNIQUE(prepared_by_user_id,request_id)
);
CREATE INDEX nightclub_residency_occurrence_application_idx
 ON public.nightclub_dj_residency_occurrences(application_id);
ALTER TABLE public.nightclub_dj_residency_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed residency parties may read individual slot preparation"
 ON public.nightclub_dj_residency_occurrences
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.nightclub_dj_residencies residency
  WHERE residency.id=nightclub_dj_residency_occurrences.residency_id
   AND (
    (residency.dj_user_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.profiles p WHERE p.id=residency.dj_profile_id AND p.user_id=(select auth.uid())
    ))
    OR
    (residency.owner_user_id=(select auth.uid()) AND EXISTS(
      SELECT 1 FROM public.player_owned_nightclubs club
      JOIN public.nightclub_purchase_receipts receipt
       ON receipt.id=club.verified_purchase_id AND receipt.club_id=club.club_id
        AND receipt.profile_id=club.profile_id
      WHERE club.id=residency.owned_club_id AND club.profile_id=residency.owner_profile_id
       AND receipt.user_id=(select auth.uid())
    ))
   )
 ));
REVOKE ALL ON public.nightclub_dj_residency_occurrences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_residency_occurrences TO authenticated;

CREATE FUNCTION public.prepare_nightclub_dj_residency_occurrence(
 p_residency_id uuid,p_occurrence_number integer,p_request_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 actor uuid:=(select auth.uid());active_profile uuid:=public.current_active_player_profile_id();
 agreement public.nightclub_dj_residencies%ROWTYPE;
 existing public.nightclub_dj_residency_occurrences%ROWTYPE;
 application public.dj_club_applications%ROWTYPE;
 start_time timestamptz;app_id uuid;minutes integer;
BEGIN
 IF actor IS NULL OR active_profile IS NULL OR p_residency_id IS NULL
  OR p_occurrence_number IS NULL OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'Authenticated DJ character and complete occurrence request required'
   USING ERRCODE='42501';END IF;
 SELECT * INTO agreement FROM public.nightclub_dj_residencies
 WHERE id=p_residency_id FOR UPDATE;
 IF NOT FOUND OR agreement.dj_user_id<>actor OR agreement.dj_profile_id<>active_profile THEN
  RAISE EXCEPTION 'Residency belongs to another DJ character' USING ERRCODE='42501';END IF;
 SELECT * INTO existing FROM public.nightclub_dj_residency_occurrences
 WHERE prepared_by_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF existing.residency_id<>p_residency_id OR existing.occurrence_number<>p_occurrence_number
  THEN RAISE EXCEPTION 'Residency preparation request reused with changed intent'
   USING ERRCODE='23505';END IF;
  RETURN existing.application_id;
 END IF;
 SELECT * INTO existing FROM public.nightclub_dj_residency_occurrences
 WHERE residency_id=p_residency_id AND occurrence_number=p_occurrence_number;
 IF FOUND THEN RETURN existing.application_id;END IF;
 IF agreement.status<>'agreed' OR p_occurrence_number NOT BETWEEN 1 AND agreement.occurrence_count THEN
  RAISE EXCEPTION 'Only signed residency dates can be prepared'
   USING ERRCODE='22023';END IF;
 start_time:=agreement.planned_starts_at[p_occurrence_number];
 IF start_time<=clock_timestamp()+interval '90 minutes'
  OR start_time>clock_timestamp()+interval '14 days' THEN
  RAISE EXCEPTION 'Prepare this week within 14 days and over 90 minutes ahead'
   USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs club
  JOIN public.nightclub_purchase_receipts receipt
   ON receipt.id=club.verified_purchase_id AND receipt.club_id=club.club_id
    AND receipt.profile_id=club.profile_id
  WHERE club.id=agreement.owned_club_id AND club.club_id=agreement.club_id
   AND club.profile_id=agreement.owner_profile_id
   AND receipt.user_id=agreement.owner_user_id AND club.is_open) THEN
  RAISE EXCEPTION 'Resident club is no longer open or purchase-verified'
   USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.dj_setlists setlist
  WHERE setlist.id=agreement.setlist_id AND setlist.profile_id=active_profile
   AND setlist.user_id=actor) THEN
  RAISE EXCEPTION 'DJ no longer owns the agreed saved set' USING ERRCODE='42501';END IF;
 IF p_occurrence_number=1 THEN
  SELECT * INTO application FROM public.dj_club_applications app
  WHERE app.id=agreement.source_application_id
   AND app.status='shortlisted' AND app.profile_id=active_profile
   AND app.user_id=actor AND app.starts_at=start_time
   AND app.setlist_id=agreement.setlist_id AND app.owned_club_id=agreement.owned_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original residency application is no longer shortlisted'
   USING ERRCODE='22023';END IF;
  app_id:=application.id;
 ELSE
  -- The existing application RPC rechecks the DJ's selected profile,
  -- current city, saved set ownership, slot length and booking conflicts.
  app_id:=public.apply_for_nightclub_dj_slot(active_profile,agreement.owned_club_id,
   agreement.setlist_id,start_time,p_request_id);
  SELECT * INTO application FROM public.dj_club_applications
  WHERE id=app_id FOR UPDATE;
  IF application.status='pending' THEN
   -- The owner already approved this exact local-time recurring slot by
   -- proposing the residency. The DJ expressly accepted and prepared it.
   UPDATE public.dj_club_applications SET status='shortlisted',
     reviewer_profile_id=agreement.owner_profile_id,
     reviewer_user_id=agreement.owner_user_id,
     review_request_id=gen_random_uuid(),reviewed_at=clock_timestamp(),
     review_decision='shortlist',updated_at=clock_timestamp()
   WHERE id=app_id;
  ELSIF application.status<>'shortlisted' THEN
   RAISE EXCEPTION 'Residency slot application is no longer usable' USING ERRCODE='22023';END IF;
 END IF;
 INSERT INTO public.nightclub_dj_residency_occurrences
  (residency_id,occurrence_number,application_id,prepared_by_user_id,request_id)
 VALUES (p_residency_id,p_occurrence_number,app_id,actor,p_request_id);
 RETURN app_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_nightclub_dj_residency_occurrence(uuid,integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_nightclub_dj_residency_occurrence(uuid,integer,uuid)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.fund_nightclub_dj_offer(p_owned_club_id uuid, p_application_id uuid, p_fee integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 -- A signed resident agreement fixes the per-show fee. A stale/unsigned/ended
 -- residency may never be used to bypass owner/DJ consent or escrow budgets.
 IF EXISTS(SELECT 1 FROM public.nightclub_dj_residencies r
   WHERE r.source_application_id=p_application_id)
 OR EXISTS(SELECT 1 FROM public.nightclub_dj_residency_occurrences o
   WHERE o.application_id=p_application_id) THEN
  IF NOT EXISTS(
   SELECT 1 FROM public.nightclub_dj_residency_occurrences occurrence
   JOIN public.nightclub_dj_residencies residency
    ON residency.id=occurrence.residency_id
   WHERE occurrence.application_id=p_application_id
    AND residency.status='agreed' AND residency.proposed_fee=p_fee
    AND residency.owner_user_id=v_actor AND residency.owner_profile_id=v_profile
    AND residency.owned_club_id=p_owned_club_id
    AND residency.dj_profile_id=v_app.profile_id
    AND residency.dj_user_id=v_app.user_id
    AND residency.setlist_id=v_app.setlist_id
    AND residency.planned_starts_at[occurrence.occurrence_number]=v_app.starts_at
  ) THEN RAISE EXCEPTION 'Residence must be agreed, prepared, and funded at the agreed fee'
    USING ERRCODE='22023'; END IF;
 END IF;
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
END $function$
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
 -- A terminated residency cannot create another gig from an outstanding
 -- unconverted fee hold. Already-booked gigs are handled before this check.
 IF EXISTS (SELECT 1 FROM public.nightclub_dj_residency_occurrences o
  JOIN public.nightclub_dj_residencies r ON r.id=o.residency_id
  WHERE o.application_id=v_offer.application_id AND r.status<>'agreed') THEN
  RAISE EXCEPTION 'Residency ended before booking confirmation'
   USING ERRCODE='22023';END IF;
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
COMMENT ON TABLE public.nightclub_dj_residency_occurrences IS
 'Prepared resident DJ slot, not an escrow, calendar reservation or payout. Owner funds its unique application at the agreed fee; DJ separately accepts and confirms a canonical booking.';
