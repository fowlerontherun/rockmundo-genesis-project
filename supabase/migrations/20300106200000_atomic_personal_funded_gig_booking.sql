-- #4029: one transaction for optional wallet funding AND the canonical gig
-- booking. An invalid slot, cooldown, race, or other booking failure rolls
-- back the wallet debit, treasury credit and all associated ledger writes.
CREATE OR REPLACE FUNCTION public.book_gig_with_personal_funding(
  p_band_id uuid,
  p_venue_id uuid,
  p_setlist_id uuid,
  p_local_date date,
  p_slot text,
  p_ticket_price integer,
  p_request_id uuid,
  p_topup_minor bigint,
  p_rider_id uuid DEFAULT NULL,
  p_ticket_operator_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_request_id IS NULL OR NOT public.can_manage_band_gigs(p_band_id,auth.uid()) THEN
    RAISE EXCEPTION 'gig_booking_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_topup_minor IS NULL OR p_topup_minor<0 OR p_topup_minor>1000000000
      OR (p_topup_minor % 100)<>0 THEN
    RAISE EXCEPTION 'gig_booking_invalid_wallet_topup' USING ERRCODE='22023';
  END IF;
  -- Serialize all retry requests before checking the idempotent booking row.
  PERFORM pg_advisory_xact_lock(hashtextextended('personal-gig:'||p_request_id::text,0));
  IF EXISTS (SELECT 1 FROM public.gigs WHERE booking_request_id=p_request_id) THEN
    RETURN public.book_gig(p_band_id,p_venue_id,p_setlist_id,p_local_date,
       p_slot,p_ticket_price,p_request_id,p_rider_id,p_ticket_operator_id);
  END IF;
  IF p_topup_minor>0 THEN
    PERFORM public.fund_my_band(
      p_band_id,'wallet',NULL,p_topup_minor,
      'Personal funds for gig booking / City Hall permit',
      'gig-booking:'||p_request_id::text);
  END IF;
  -- Both RPCs execute within THIS database transaction. No exception is
  -- caught; an unsuccessful booking necessarily rolls back the funding.
  v_result:=public.book_gig(p_band_id,p_venue_id,p_setlist_id,p_local_date,
       p_slot,p_ticket_price,p_request_id,p_rider_id,p_ticket_operator_id);
  IF v_result IS NULL OR v_result->'gig' IS NULL THEN
    RAISE EXCEPTION 'gig_booking_not_confirmed';
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.book_gig_with_personal_funding(uuid,uuid,uuid,date,text,integer,uuid,bigint,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.book_gig_with_personal_funding(uuid,uuid,uuid,date,text,integer,uuid,bigint,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
