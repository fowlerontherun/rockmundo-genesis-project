-- Label-initiated release of an artist is allowed only with no outstanding advance.
-- Financially unsettled contracts require an explicit, separately approved settlement.
CREATE OR REPLACE FUNCTION public.label_release_artist_contract_atomic(p_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_contract public.artist_label_contracts%ROWTYPE;
 v_label public.labels%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_contract FROM public.artist_label_contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR v_contract.status<>'active' THEN RAISE EXCEPTION 'CONTRACT_NOT_ACTIVE'; END IF;
 SELECT * INTO v_label FROM public.labels WHERE id=v_contract.label_id FOR UPDATE;
 IF NOT FOUND OR NOT (v_label.created_by=auth.uid() OR v_label.owner_id=auth.uid()) THEN
  RAISE EXCEPTION 'LABEL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF coalesce(v_contract.advance_amount,0)>coalesce(v_contract.recouped_amount,0)
 THEN RAISE EXCEPTION 'UNRECOUPED_ADVANCE_REQUIRES_SETTLEMENT'; END IF;
 -- No silent forgiveness or fee: owner-initiated release may only close
 -- an already recouped contract, leaving settled royalty history intact.
 UPDATE public.artist_label_contracts
 SET status='terminated',terminated_at=now(),termination_fee_paid=0,last_action_by=auth.uid()
 WHERE id=p_contract_id AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'CONCURRENT_CONTRACT_CHANGE'; END IF;
 RETURN jsonb_build_object('contractId',p_contract_id,'status','terminated','unrecoupedAdvance',0);
END $$;
REVOKE ALL ON FUNCTION public.label_release_artist_contract_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.label_release_artist_contract_atomic(uuid) TO authenticated;
