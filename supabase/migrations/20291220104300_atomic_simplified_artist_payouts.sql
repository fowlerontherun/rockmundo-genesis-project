-- Pay confirmed band booking commitments as part of one atomic simplified
-- Festival settlement. The existing estimated site operating cost did not include
-- accepted artist booking commitments and the current simplified settlement posts
-- only the Festival company's net profit.
--
-- The band payment is recorded in its contracted currency as a non-primary band
-- treasury where necessary. Do not convert GBP to an existing USD treasury
-- without a rate and an explicit FX journal.
CREATE TABLE IF NOT EXISTS public.festival_simplified_artist_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  festival_result_id uuid NOT NULL REFERENCES public.festival_simplified_edition_results(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.festival_artist_bookings(id) ON DELETE RESTRICT,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  band_transaction_id uuid NOT NULL REFERENCES public.band_treasury_transactions(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_edition_id, booking_id),
  UNIQUE(band_transaction_id)
);
ALTER TABLE public.festival_simplified_artist_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_simplified_artist_payouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.festival_simplified_artist_payouts TO service_role;

-- Before recording the new annual profit, add the actual committed booking
-- cost to the operating-cost total. This puts the payout cash and company net
-- on the SAME accounting basis, rather than debiting the company twice.
DO $patch$
DECLARE
  definition text;
  old_cost constant text := '  operating_cost:=greatest(0,e.estimated_operating_cost_minor);';
  new_cost constant text := $cost$
  IF EXISTS (
    SELECT 1 FROM public.festival_artist_bookings b
    JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
    WHERE ap.festival_edition_id=e.id
      AND b.status IN ('confirmed','awaiting_schedule','scheduled')
      AND coalesce(b.total_commitment_minor,0)>0
      AND (b.artist_type <> 'band' OR b.band_id IS NULL OR b.currency_code IS DISTINCT FROM currency)
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_PAYOUT_REQUIRES_CANONICAL_SETTLEMENT'
      USING ERRCODE='P0001';
  END IF;

  SELECT coalesce(sum(b.total_commitment_minor),0)::bigint INTO artist_fees_minor
  FROM public.festival_artist_bookings b
  JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
  WHERE ap.festival_edition_id=e.id
    AND b.status IN ('confirmed','awaiting_schedule','scheduled')
    AND b.artist_type='band';
  operating_cost:=greatest(0,e.estimated_operating_cost_minor) + artist_fees_minor;
$cost$;
BEGIN
  SELECT pg_get_functiondef('public._complete_simplified_festival_settlement(uuid)'::regprocedure) INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'festival_simplified_settlement_missing'; END IF;
  IF position('artist_fees_minor' IN definition)>0 THEN RETURN; END IF;
  IF position(old_cost IN definition)=0
     OR position('  operating_cost bigint := 0;' IN definition)=0
     OR position('''operatingCostMinor'',operating_cost,' IN definition)=0 THEN
    RAISE EXCEPTION 'festival_simplified_settlement_shape_changed';
  END IF;
  definition := replace(definition,
    '  operating_cost bigint := 0;',
    E'  operating_cost bigint := 0;\n  artist_fees_minor bigint := 0;');
  definition := replace(definition,old_cost,new_cost);
  definition := replace(definition,
    '''operatingCostMinor'',operating_cost,',
    '''operatingCostMinor'',operating_cost,''artistFeesMinor'',artist_fees_minor,');
  EXECUTE definition;
END;
$patch$;

CREATE OR REPLACE FUNCTION public._pay_simplified_festival_artist_bookings(p_result_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $payout$
DECLARE
  r public.festival_simplified_edition_results%ROWTYPE;
  booking RECORD;
  treasury public.band_treasuries%ROWTYPE;
  transaction_id uuid;
  payout_count integer:=0;
BEGIN
  SELECT * INTO r
  FROM public.festival_simplified_edition_results
  WHERE id=p_result_id FOR UPDATE;
  IF NOT FOUND OR r.settlement_applied_at IS NULL OR r.finance_ledger_frozen_at IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_ARTIST_PAYOUT_REQUIRES_FINANCIAL_POSTING'
      USING ERRCODE='P0001';
  END IF;

  FOR booking IN
    SELECT b.id,b.band_id,b.artist_type,b.status,b.total_commitment_minor,b.currency_code
    FROM public.festival_artist_bookings b
    JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
    WHERE ap.festival_edition_id=r.festival_edition_id
      AND b.status IN ('confirmed','awaiting_schedule','scheduled')
      AND b.total_commitment_minor>0
    ORDER BY b.id
  LOOP
    IF booking.artist_type<>'band' OR booking.band_id IS NULL
       OR booking.currency_code IS DISTINCT FROM r.currency_code THEN
      RAISE EXCEPTION 'FESTIVAL_ARTIST_PAYOUT_UNSUPPORTED_BOOKING'
        USING ERRCODE='P0001';
    END IF;

    -- Re-invocations do not credit any already-settled contract.
    IF EXISTS(
      SELECT 1 FROM public.festival_simplified_artist_payouts p
      WHERE p.festival_edition_id=r.festival_edition_id AND p.booking_id=booking.id
    ) THEN CONTINUE; END IF;

    INSERT INTO public.band_treasuries(band_id,currency_code,is_primary)
    VALUES(booking.band_id,r.currency_code,false)
    ON CONFLICT (band_id,currency_code) DO NOTHING;

    SELECT * INTO treasury FROM public.band_treasuries
    WHERE band_id=booking.band_id AND currency_code=r.currency_code
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_BAND_TREASURY_MISSING'; END IF;

    UPDATE public.band_treasuries
    SET balance_minor=balance_minor+booking.total_commitment_minor,
        updated_at=now()
    WHERE id=treasury.id
    RETURNING * INTO treasury;

    INSERT INTO public.band_treasury_transactions(
      band_id,treasury_id,profile_id,direction,amount_minor,currency_code,
      source_kind,category,note,idempotency_key,balance_after_minor
    ) VALUES (
      booking.band_id,treasury.id,NULL,'credit',
      booking.total_commitment_minor,r.currency_code,
      'festival_artist_booking','festival_artist_fee',
      'Annual Festival contracted artist payment',
      'festival-booking:'||booking.id::text,
      treasury.balance_minor
    ) RETURNING id INTO transaction_id;

    INSERT INTO public.festival_simplified_artist_payouts(
      festival_edition_id,festival_result_id,booking_id,band_id,
      band_transaction_id,amount_minor,currency_code
    ) VALUES (
      r.festival_edition_id,r.id,booking.id,booking.band_id,
      transaction_id,booking.total_commitment_minor,r.currency_code
    );
    payout_count:=payout_count+1;
  END LOOP;

  IF (SELECT coalesce(sum(p.amount_minor),0)
      FROM public.festival_simplified_artist_payouts p
      WHERE p.festival_result_id=r.id)
    IS DISTINCT FROM
    coalesce((r.result_snapshot->>'artistFeesMinor')::bigint,0)
  THEN
    RAISE EXCEPTION 'FESTIVAL_ARTIST_PAYOUT_LEDGER_MISMATCH'
      USING ERRCODE='P0001';
  END IF;
  RETURN payout_count;
END;
$payout$;
REVOKE ALL ON FUNCTION public._pay_simplified_festival_artist_bookings(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._pay_simplified_festival_artist_bookings(uuid) TO service_role;

-- The existing result-insert trigger posts the company result. Credit the
-- contracted artists in the same statement and transaction. Failure rolls
-- back BOTH company and band effects.
DO $patch$
DECLARE
  definition text;
  anchor constant text := '  PERFORM public._try_finalise_festival_owner_engagement(NEW.festival_edition_id);';
BEGIN
  SELECT pg_get_functiondef('public._festival_apply_simplified_company_effects_trigger()'::regprocedure)
    INTO definition;
  IF position('public._pay_simplified_festival_artist_bookings(NEW.id)' IN definition)>0 THEN RETURN; END IF;
  IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'festival_simplified_effect_trigger_changed'; END IF;
  definition:=replace(definition,anchor,
     '  PERFORM public._pay_simplified_festival_artist_bookings(NEW.id);'||chr(10)||anchor);
  EXECUTE definition;
END;
$patch$;

NOTIFY pgrst,'reload schema';
