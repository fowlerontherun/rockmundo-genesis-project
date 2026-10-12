-- Label legal services and contract termination: no stale client balance or
-- separate updates that can leave fees charged without the requested result.
CREATE OR REPLACE FUNCTION public.hire_artist_lawyer_atomic()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile uuid := public._caller_profile_id();
BEGIN
 IF v_profile IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
  WHERE id=v_profile AND user_id=auth.uid()) THEN RAISE EXCEPTION 'lawyer_character_required'; END IF;
 UPDATE public.profiles SET cash=cash-50000,has_active_lawyer=true,
  lawyer_hired_at=now(),lawyer_expires_at=NULL
 WHERE id=v_profile AND coalesce(has_active_lawyer,false)=false AND cash>=50000;
 IF NOT FOUND THEN RAISE EXCEPTION 'lawyer_already_active_or_insufficient_funds'; END IF;
 RETURN v_profile;
END $$;

CREATE OR REPLACE FUNCTION public.terminate_artist_contract_atomic(p_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_c public.artist_label_contracts%rowtype;
 v_profile uuid:=public._caller_profile_id();v_fee numeric;
BEGIN
 IF auth.uid() IS NULL OR v_profile IS NULL THEN RAISE EXCEPTION 'contract_character_required'; END IF;
 SELECT * INTO v_c FROM public.artist_label_contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR v_c.status NOT IN ('active','accepted_by_artist')
 THEN RAISE EXCEPTION 'contract_no_longer_active'; END IF;
 IF v_c.band_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.bands b WHERE b.id=v_c.band_id AND
    (b.leader_id IN (auth.uid(),v_profile) OR EXISTS (SELECT 1 FROM public.band_members bm
      WHERE bm.band_id=b.id AND bm.user_id=auth.uid() AND lower(bm.role) IN ('founder','leader','manager'))))
  THEN RAISE EXCEPTION 'band_leadership_required'; END IF;
 ELSE
  IF v_c.artist_profile_id<>v_profile THEN RAISE EXCEPTION 'solo_contract_not_owned'; END IF;
 END IF;
 v_fee:=round(greatest(0,coalesce(v_c.single_quota,0)-coalesce(v_c.singles_completed,0))*5000
     *coalesce(v_c.termination_fee_pct,50)/100 +
   greatest(0,coalesce(v_c.album_quota,0)-coalesce(v_c.albums_completed,0))*25000
     *coalesce(v_c.termination_fee_pct,50)/100 +
   greatest(0,coalesce(v_c.advance_amount,0)-coalesce(v_c.recouped_amount,0)));
 IF v_c.band_id IS NOT NULL THEN
  -- A band_earnings insertion triggers the canonical band_balance update.
  -- Hold the band lock and validate funds, but do not debit cash separately.
  PERFORM 1 FROM public.bands WHERE id=v_c.band_id
    AND coalesce(band_balance,0)>=v_fee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_band_contract_funds'; END IF;
  IF v_fee>0 THEN
   INSERT INTO public.band_earnings(band_id,amount,source,description)
   VALUES(v_c.band_id,-v_fee,'contract_termination','Early artist contract exit fee');
  END IF;
 ELSE
  UPDATE public.profiles SET cash=cash-v_fee
   WHERE id=v_profile AND user_id=auth.uid() AND cash>=v_fee;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_solo_contract_funds'; END IF;
 END IF;
 UPDATE public.artist_label_contracts
 SET status='terminated',terminated_at=now(),termination_fee_paid=v_fee
 WHERE id=v_c.id;
 IF v_c.label_id IS NOT NULL AND v_fee>0 THEN
  UPDATE public.labels SET balance=coalesce(balance,0)+v_fee WHERE id=v_c.label_id;
  INSERT INTO public.label_financial_transactions
    (label_id,transaction_type,amount,description,related_contract_id)
  VALUES (v_c.label_id,'revenue',v_fee,'Artist contract termination fee',v_c.id);
 END IF;
 RETURN jsonb_build_object('contractId',v_c.id,'terminationFee',v_fee);
END $$;

REVOKE ALL ON FUNCTION public.hire_artist_lawyer_atomic() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.terminate_artist_contract_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hire_artist_lawyer_atomic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_artist_contract_atomic(uuid) TO authenticated;
