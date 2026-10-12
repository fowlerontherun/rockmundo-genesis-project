-- All installment effects must commit once, or roll back together.
CREATE OR REPLACE FUNCTION public.process_sponsorship_installment_atomic(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment public.sponsorship_payments%ROWTYPE;
  v_contract public.sponsorship_contracts%ROWTYPE;
  v_morale integer;
  v_remaining integer;
BEGIN
  SELECT * INTO v_payment FROM public.sponsorship_payments
    WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_payment_not_found'; END IF;
  IF v_payment.status <> 'scheduled' THEN
    RETURN jsonb_build_object('status',v_payment.status,'amount',0);
  END IF;
  SELECT * INTO v_contract FROM public.sponsorship_contracts
    WHERE id = v_payment.contract_id FOR UPDATE;
  IF NOT FOUND OR v_contract.status <> 'active' THEN
    UPDATE public.sponsorship_payments SET status = 'cancelled' WHERE id = p_payment_id;
    RETURN jsonb_build_object('status','cancelled','amount',0);
  END IF;

  v_morale := CASE WHEN v_payment.amount >= 5000 THEN 3
                   WHEN v_payment.amount >= 1000 THEN 2 ELSE 1 END;
  UPDATE public.bands
     SET band_balance = coalesce(band_balance,0) + v_payment.amount,
         morale = least(100, coalesce(morale,50) + v_morale)
   WHERE id = v_payment.band_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_band_not_found'; END IF;

  INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
  VALUES (v_payment.band_id,v_payment.amount,'sponsorship',
    'Weekly sponsorship payment (Week ' || v_payment.week_number || ')',
    jsonb_build_object('contract_id',v_contract.id,'payment_id',v_payment.id,'brand_id',v_contract.brand_id));

  UPDATE public.sponsorship_payments SET status='paid',paid_at=now() WHERE id=p_payment_id;
  UPDATE public.sponsorship_contracts SET
    weeks_paid = greatest(coalesce(weeks_paid,0), v_payment.week_number),
    total_paid = coalesce(total_paid,0) + v_payment.amount,
    last_payment_at = now()
   WHERE id=v_contract.id;

  SELECT count(*) INTO v_remaining FROM public.sponsorship_payments
   WHERE contract_id=v_contract.id AND status='scheduled';
  IF v_remaining=0 AND v_payment.week_number>=v_contract.term_weeks THEN
    UPDATE public.sponsorship_contracts SET status='completed' WHERE id=v_contract.id;
  END IF;
  RETURN jsonb_build_object('status','paid','amount',v_payment.amount);
END;
$$;
REVOKE ALL ON FUNCTION public.process_sponsorship_installment_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_sponsorship_installment_atomic(uuid) TO service_role;
