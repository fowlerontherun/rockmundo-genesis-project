-- Automatically return individual unbooked fee holds when a residency ends.
-- The existing 15-minute escrow cron runs this same SKIP LOCKED idempotent worker.
CREATE OR REPLACE FUNCTION private.expire_nightclub_dj_offer_escrows_internal(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_offer public.nightclub_dj_funded_offers%ROWTYPE;
 v_prior_context text:=current_setting('app.player_cash_context',true);
 v_count integer:=0;
 v_ended_residency boolean;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid DJ escrow expiration batch size' USING ERRCODE='22023';END IF;
 FOR v_offer IN SELECT * FROM public.nightclub_dj_funded_offers f
  WHERE f.status IN ('offered','accepted') AND
  (f.expires_at<=clock_timestamp() OR EXISTS (
   SELECT 1 FROM public.nightclub_dj_residency_occurrences o
   JOIN public.nightclub_dj_residencies r ON r.id=o.residency_id
   WHERE o.application_id=f.application_id AND r.status='ended'))
  ORDER BY f.expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  -- Never alter escrow for an actual booked gig. Only prebooking holds qualify.
  SELECT EXISTS(SELECT 1 FROM public.nightclub_dj_residency_occurrences o
   JOIN public.nightclub_dj_residencies r ON r.id=o.residency_id
   WHERE o.application_id=v_offer.application_id AND r.status='ended')
   INTO v_ended_residency;
  -- The offer row lock serializes against DJ/owner cancellation and refunds.
  PERFORM 1 FROM public.profiles p WHERE p.id=v_offer.owner_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing DJ escrow owner balance' USING ERRCODE='23503';END IF;
  PERFORM set_config('app.player_cash_context',jsonb_build_object(
   'classification','nightclub_dj_offer_escrow_refund',
   'display_category','nightclub_dj_offer',
   'description',CASE WHEN v_ended_residency THEN 'Refunded unbooked DJ fee after resident agreement ended'
                      ELSE 'Auto-refunded expired DJ fee offer' END,
   'dj_offer_id',v_offer.id,'external_cash_flow',true,
   'idempotency_key','club-dj-escrow-refund:'||v_offer.id)::text,true);
  UPDATE public.profiles SET cash=cash+v_offer.fee WHERE id=v_offer.owner_profile_id;
  PERFORM set_config('app.player_cash_context',coalesce(v_prior_context,''),true);
  INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
   VALUES(v_offer.id,v_offer.owner_profile_id,'refund',v_offer.fee);
  UPDATE public.nightclub_dj_funded_offers SET
   status=CASE WHEN v_ended_residency THEN 'cancelled' ELSE 'expired' END,
    resolved_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=v_offer.id;
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $function$
;