-- Issue #4082: guarded, service-role-only sponsorship settlement RPC.
-- MANUAL OPERATOR RELEASE ONLY: NOT an automatic historical migration.
-- Source: compatible rewrite of 20261012213100_atomic_sponsorship_installments.sql.
-- No payout or cron work occurs when this file is installed.
-- Never replay the old migration or force the earnings/band-balance projections
-- to agree by minting cash. Validate on a restored staging database first.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.sponsorship_payments') IS NULL
    OR to_regclass('public.sponsorship_contracts') IS NULL
    OR to_regclass('public.band_earnings') IS NULL
    OR to_regclass('public.band_treasuries') IS NULL
    OR to_regclass('public.bands') IS NULL
    OR to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'sponsorship_installment_cutover_schema_drift'
      USING ERRCODE='55000';
  END IF;
  -- The current source-of-balance model recomputes from earnings on INSERT.
  -- Until #4119 reconciles historical expenses, each candidate payout must
  -- be checked under locks so the trigger cannot overwrite spent cash.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.band_earnings'::regclass
      AND t.tgname='update_band_balance_on_earnings_insert'
      AND t.tgenabled='O'
      AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.bands'::regclass
      AND t.tgname='bands_sync_treasury_balance_projection'
      AND t.tgenabled='O'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'sponsorship_settlement_balance_trigger_contract_changed'
      USING ERRCODE='55000';
  END IF;
  -- Existing duplicate sponsor ledger rows must be reconciled, never
  -- hidden by CREATE INDEX IF NOT EXISTS or paid again.
  IF EXISTS (
    SELECT 1 FROM public.band_earnings e
    WHERE e.source='sponsorship'
      AND e.metadata->>'payment_id' IS NOT NULL
    GROUP BY e.metadata->>'payment_id' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'sponsorship_historical_duplicate_earnings_block_cutover'
      USING ERRCODE='55000';
  END IF;
END;
$preflight$;

-- In addition to the locked installment row, this index is the durable
-- backstop against parallel/manual duplicate sponsor journal insertion.
CREATE UNIQUE INDEX IF NOT EXISTS
  band_earnings_sponsorship_payment_once
ON public.band_earnings ((metadata->>'payment_id'))
WHERE source='sponsorship' AND metadata->>'payment_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_sponsorship_installment_atomic(
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $sponsorship$
DECLARE
  v_payment public.sponsorship_payments%ROWTYPE;
  v_contract public.sponsorship_contracts%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_treasury public.band_treasuries%ROWTYPE;
  v_treasury_count integer;
  v_earnings_total bigint;
  v_prior_paid bigint;
  v_existing_ledger integer;
  v_remaining integer;
  v_morale integer;
  v_expected_balance bigint;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
     OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'sponsorship_service_role_required' USING ERRCODE='42501';
  END IF;
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'sponsorship_payment_id_required' USING ERRCODE='22023';
  END IF;

  -- The payment row serializes all retries of the *same* installment.
  SELECT * INTO v_payment FROM public.sponsorship_payments
    WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_payment_not_found'; END IF;
  IF v_payment.status IN ('paid','cancelled') THEN
    RETURN jsonb_build_object('status',v_payment.status,'amount',0,'replayed',true);
  END IF;
  IF v_payment.status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'sponsorship_payment_unexpected_state';
  END IF;
  IF v_payment.scheduled_at IS NULL OR v_payment.scheduled_at > now() THEN
    RAISE EXCEPTION 'sponsorship_installment_not_due';
  END IF;
  SELECT * INTO v_contract FROM public.sponsorship_contracts
    WHERE id=v_payment.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_contract_not_found'; END IF;
  IF v_payment.band_id IS DISTINCT FROM v_contract.band_id
    OR v_payment.amount IS NULL OR v_payment.amount<=0
    OR v_payment.amount>v_contract.weekly_payment
    OR v_payment.week_number NOT BETWEEN 1 AND v_contract.term_weeks
  THEN RAISE EXCEPTION 'invalid_sponsorship_installment'; END IF;
  -- Never settle an installment already present in either payment or
  -- earnings history. A mismatch is a finance incident, not a retry.
  SELECT count(*) INTO v_existing_ledger FROM public.band_earnings e
   WHERE e.source='sponsorship' AND e.metadata->>'payment_id'=v_payment.id::text;
  IF v_existing_ledger<>0 THEN
    RAISE EXCEPTION 'sponsorship_installment_requires_reconciliation'
      USING ERRCODE='55000';
  END IF;
  SELECT coalesce(sum(amount),0)::bigint INTO v_prior_paid
    FROM public.sponsorship_payments
   WHERE contract_id=v_contract.id AND status='paid';
  IF v_prior_paid IS DISTINCT FROM v_contract.total_paid
    OR v_contract.total_paid<0
    OR v_contract.total_paid::bigint+v_payment.amount>v_contract.total_value
    OR v_payment.week_number<=v_contract.weeks_paid
  THEN RAISE EXCEPTION 'sponsorship_contract_payment_history_drift'
    USING ERRCODE='55000'; END IF;

  IF v_contract.status IS DISTINCT FROM 'active' THEN
    UPDATE public.sponsorship_payments
       SET status='cancelled' WHERE id=p_payment_id AND status='scheduled';
    RETURN jsonb_build_object('status','cancelled','amount',0,'replayed',false);
  END IF;

  -- The current earnings trigger replaces band_balance with SUM(earnings),
  -- even when players spent some of their balance on recording/rehearsal.
  -- Fail closed for those bands until the cash/earnings model is fixed.
  SELECT * INTO v_band FROM public.bands
    WHERE id=v_payment.band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_band_not_found'; END IF;
  IF v_band.status IS DISTINCT FROM 'active'::public.band_status THEN
    RAISE EXCEPTION 'sponsorship_band_not_active';
  END IF;
  SELECT coalesce(sum(e.amount),0)::bigint INTO v_earnings_total
    FROM public.band_earnings e WHERE e.band_id=v_band.id;
  IF v_band.band_balance IS NULL OR v_band.band_balance<0
    OR v_band.band_balance::bigint IS DISTINCT FROM v_earnings_total
  THEN RAISE EXCEPTION 'sponsorship_earnings_projection_drift'
    USING ERRCODE='55000'; END IF;

  SELECT count(*) INTO v_treasury_count
    FROM public.band_treasuries bt
    WHERE bt.band_id=v_band.id AND bt.is_primary=true;
  IF v_treasury_count<>1 THEN
    RAISE EXCEPTION 'sponsorship_primary_gameplay_treasury_mismatch'
      USING ERRCODE='55000';
  END IF;
  SELECT * INTO v_treasury
    FROM public.band_treasuries bt
    WHERE bt.band_id=v_band.id AND bt.is_primary=true
    FOR UPDATE;
  IF v_treasury.currency_code IS DISTINCT FROM 'GBP'
    OR v_treasury.balance_minor IS DISTINCT FROM v_band.band_balance::bigint * 100
    OR v_treasury.balance_minor<0
    OR coalesce(v_treasury.reserved_balance_minor,0)<0
    OR coalesce(v_treasury.reserved_balance_minor,0)>v_treasury.balance_minor
  THEN RAISE EXCEPTION 'sponsorship_gameplay_treasury_drift'
    USING ERRCODE='55000'; END IF;
  v_expected_balance:=v_treasury.balance_minor + v_payment.amount::bigint*100;

  v_morale:=CASE WHEN v_payment.amount>=5000 THEN 3
                 WHEN v_payment.amount>=1000 THEN 2 ELSE 1 END;
  UPDATE public.bands SET morale=least(100,coalesce(morale,50)+v_morale)
    WHERE id=v_band.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_band_not_found'; END IF;

  -- One authoritative source of value. The existing earnings AFTER INSERT
  -- trigger projects to bands, then from bands to primary gameplay treasury.
  INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
  VALUES(v_band.id,v_payment.amount,'sponsorship',
    'Weekly sponsorship payment (Week '||v_payment.week_number||')',
    jsonb_build_object('contract_id',v_contract.id,'payment_id',v_payment.id,
                       'brand_id',v_contract.brand_id));

  -- A trigger malfunction must roll back earnings, morale and payment status,
  -- rather than silently creating two contradictory spendable balances.
  IF NOT EXISTS (
    SELECT 1 FROM public.bands b
      JOIN public.band_treasuries bt ON bt.band_id=b.id
        AND bt.is_primary=true
    WHERE b.id=v_band.id
      AND b.band_balance::bigint=v_earnings_total+v_payment.amount
      AND bt.balance_minor=v_expected_balance
  ) THEN
    RAISE EXCEPTION 'sponsorship_post_credit_projection_failed'
      USING ERRCODE='55000';
  END IF;

  UPDATE public.sponsorship_payments SET status='paid',paid_at=now()
    WHERE id=p_payment_id AND status='scheduled';
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_payment_claim_lost'; END IF;
  UPDATE public.sponsorship_contracts SET
    weeks_paid=greatest(coalesce(weeks_paid,0),v_payment.week_number),
    total_paid=coalesce(total_paid,0)+v_payment.amount,
    last_payment_at=now()
  WHERE id=v_contract.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sponsorship_contract_claim_lost'; END IF;

  SELECT count(*) INTO v_remaining FROM public.sponsorship_payments
    WHERE contract_id=v_contract.id AND status='scheduled';
  IF v_remaining=0 AND v_payment.week_number>=v_contract.term_weeks THEN
    UPDATE public.sponsorship_contracts SET status='completed'
      WHERE id=v_contract.id;
  END IF;
  RETURN jsonb_build_object('status','paid','amount',v_payment.amount,
                            'replayed',false);
END;
$sponsorship$;

REVOKE ALL ON FUNCTION public.process_sponsorship_installment_atomic(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_sponsorship_installment_atomic(uuid)
  TO service_role;

COMMIT;
-- No cron schedule is created/changed; no payment is invoked.
