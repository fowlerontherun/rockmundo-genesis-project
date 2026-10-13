-- Activate band or solo label contracts and pay advances in the same DB transaction.
-- The existing band_earnings trigger is the only writer of band_balance.
CREATE OR REPLACE FUNCTION public.activate_label_contract_atomic(p_contract_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_contract public.artist_label_contracts%ROWTYPE;
  v_label public.labels%ROWTYPE;
  v_advance bigint;
  v_already_paid boolean;
  v_term integer;
  v_end timestamptz;
BEGIN
  SELECT * INTO v_contract FROM public.artist_label_contracts
   WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF NOT public._can_manage_label(v_contract.label_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF v_contract.status='active' THEN
    RETURN jsonb_build_object('status','active','advance_paid',0);
  END IF;
  IF v_contract.status<>'accepted_by_artist' THEN
    RAISE EXCEPTION 'Artist must accept the offer first';
  END IF;
  SELECT * INTO v_label FROM public.labels WHERE id=v_contract.label_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Label not found'; END IF;
  v_advance := greatest(0,coalesce(v_contract.advance_amount,0));
  SELECT EXISTS(SELECT 1 FROM public.label_financial_transactions
   WHERE label_id=v_contract.label_id AND related_contract_id=p_contract_id
     AND transaction_type='advance') INTO v_already_paid;

  IF v_advance>0 AND NOT v_already_paid THEN
    IF coalesce(v_label.balance,0)<v_advance THEN
      RAISE EXCEPTION 'Insufficient label balance for advance';
    END IF;
    -- Ensure the receiving account is valid before debiting the label.
    IF v_contract.band_id IS NULL THEN
      IF v_contract.artist_profile_id IS NULL OR NOT EXISTS(
        SELECT 1 FROM public.profiles WHERE id=v_contract.artist_profile_id FOR UPDATE
      ) THEN RAISE EXCEPTION 'Solo artist profile required for advance'; END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=v_contract.band_id FOR UPDATE) THEN
        RAISE EXCEPTION 'Band required for advance';
      END IF;
    END IF;
    UPDATE public.labels SET balance=balance-v_advance,updated_at=now()
      WHERE id=v_contract.label_id;
    IF v_contract.band_id IS NOT NULL THEN
      INSERT INTO public.band_earnings(band_id,amount,source,description)
      VALUES(v_contract.band_id,v_advance,'label_advance','Record label contract advance');
    ELSE
      UPDATE public.profiles SET cash=cash+v_advance
        WHERE id=v_contract.artist_profile_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Solo artist advance payment failed'; END IF;
    END IF;
    INSERT INTO public.label_financial_transactions
      (label_id,transaction_type,amount,description,related_contract_id)
    VALUES(v_contract.label_id,'advance',v_advance,
      'Artist advance paid on contract activation',p_contract_id);
  END IF;

  v_term := CASE WHEN v_contract.start_date IS NOT NULL AND v_contract.end_date IS NOT NULL
    THEN greatest(1,round(extract(epoch from
      (v_contract.end_date::timestamptz-v_contract.start_date::timestamptz))/2592000.0)::int)
    ELSE 24 END;
  v_end:=now()+(v_term||' months')::interval;
  UPDATE public.artist_label_contracts
    SET status='active',start_date=current_date,end_date=v_end::date,updated_at=now()
    WHERE id=p_contract_id;
  RETURN jsonb_build_object('status','active',
    'advance_paid',CASE WHEN v_already_paid THEN 0 ELSE v_advance END);
END $$;
REVOKE ALL ON FUNCTION public.activate_label_contract_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_label_contract_atomic(uuid) TO authenticated;
