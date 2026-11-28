-- Forward-only production repair: stadium economics and atomic gig tax settlement.
-- Do not replay existing gigs. Only outcomes explicitly marked arena_stadium_v2
-- by the new completion worker may invoke this settlement.

CREATE TABLE IF NOT EXISTS public.gig_financial_settlements (
  gig_id uuid PRIMARY KEY REFERENCES public.gigs(id) ON DELETE RESTRICT,
  outcome_id uuid NOT NULL REFERENCES public.gig_outcomes(id),
  band_id uuid NOT NULL REFERENCES public.bands(id),
  gross_profit integer NOT NULL,
  city_id uuid REFERENCES public.cities(id),
  city_income_tax integer NOT NULL DEFAULT 0 CHECK (city_income_tax >= 0),
  label_id uuid REFERENCES public.labels(id),
  label_cut integer NOT NULL DEFAULT 0 CHECK (label_cut >= 0),
  band_payout integer NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now(),
  CHECK (band_payout = gross_profit - city_income_tax - label_cut)
);

ALTER TABLE public.gig_financial_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_financial_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gig_financial_settlements TO service_role;

-- Marginal city income tax: mayor's base rate still sets the first band;
-- profitable arena/stadium shows pay another 5/10 percentage points on higher
-- slices. This is a fictional game-economy policy, not a real tax schedule.
CREATE OR REPLACE FUNCTION public.calculate_gig_city_tax_v2(p_profit integer, p_base_rate numeric)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT
SET search_path TO 'pg_catalog'
AS $tax$
  SELECT round(
    least(greatest(p_profit,0),50000) * greatest(0,least(50,p_base_rate)) / 100
    + least(greatest(p_profit-50000,0),200000) * greatest(0,least(50,p_base_rate+5)) / 100
    + greatest(p_profit-250000,0) * greatest(0,least(50,p_base_rate+10)) / 100
  )::integer;
$tax$;
REVOKE ALL ON FUNCTION public.calculate_gig_city_tax_v2(integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_gig_city_tax_v2(integer,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_gig_finance_v2(p_gig_id uuid)
RETURNS public.gig_financial_settlements
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $body$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_outcome public.gig_outcomes%ROWTYPE;
  v_receipt public.gig_financial_settlements%ROWTYPE;
  v_city_id uuid;
  v_rate numeric := 0;
  v_tax integer := 0;
  v_label_id uuid;
  v_label_contract uuid;
  v_label_rate numeric := 0;
  v_label_cut integer := 0;
  v_payout integer;
  v_band_name text;
BEGIN
  -- Executable only through the service-role completion worker or SQL admin.
  IF coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role'
     AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'gig finance settlement requires service role' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig not found'; END IF;
  SELECT * INTO v_receipt FROM public.gig_financial_settlements WHERE gig_id=p_gig_id;
  IF FOUND THEN RETURN v_receipt; END IF;

  SELECT * INTO v_outcome FROM public.gig_outcomes WHERE gig_id=p_gig_id;
  IF NOT FOUND OR v_outcome.completed_at IS NULL
     OR v_outcome.production_breakdown->>'finance_version' IS DISTINCT FROM 'arena_stadium_v2' THEN
    RAISE EXCEPTION 'gig has no eligible v2 completed outcome';
  END IF;
  IF v_gig.status NOT IN ('in_progress','completed') THEN
    RAISE EXCEPTION 'gig is not eligible for settlement';
  END IF;

  SELECT name INTO v_band_name FROM public.bands WHERE id=v_gig.band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'band not found'; END IF;
  SELECT city_id INTO v_city_id FROM public.venues WHERE id=v_gig.venue_id;
  IF v_city_id IS NOT NULL AND v_outcome.net_profit > 0 THEN
    SELECT greatest(0, least(50, income_tax_rate)) INTO v_rate
    FROM public.city_laws WHERE city_id=v_city_id AND effective_until IS NULL
    ORDER BY effective_from DESC NULLS LAST LIMIT 1;
    v_tax := public.calculate_gig_city_tax_v2(v_outcome.net_profit,coalesce(v_rate,0));
  END IF;

  IF v_outcome.net_profit - v_tax > 0 THEN
    SELECT c.id, c.label_id, greatest(0,least(100,coalesce(c.royalty_label_pct,20)))
    INTO v_label_contract,v_label_id,v_label_rate
    FROM public.artist_label_contracts c
    JOIN public.label_deal_types dt ON dt.id=c.deal_type_id AND dt.name='360 Deal'
    WHERE c.band_id=v_gig.band_id AND c.status='active'
    ORDER BY c.created_at DESC, c.id LIMIT 1;
    IF FOUND THEN v_label_cut := round((v_outcome.net_profit-v_tax)*v_label_rate/100); END IF;
  END IF;
  v_payout := v_outcome.net_profit - v_tax - v_label_cut;

  INSERT INTO public.gig_financial_settlements
    (gig_id,outcome_id,band_id,gross_profit,city_id,city_income_tax,label_id,label_cut,band_payout)
  VALUES (p_gig_id,v_outcome.id,v_gig.band_id,v_outcome.net_profit,v_city_id,v_tax,v_label_id,v_label_cut,v_payout)
  RETURNING * INTO v_receipt;

  UPDATE public.bands SET band_balance = COALESCE(band_balance,0) + v_payout
  WHERE id=v_gig.band_id;

  IF v_tax>0 THEN
    PERFORM public.credit_city_treasury(v_city_id,v_tax,'gig_income_tax',
      'Gig income tax withheld from ' || coalesce(v_band_name,'band'),p_gig_id);
  END IF;

  IF v_label_cut>0 THEN
    UPDATE public.labels SET balance=COALESCE(balance,0)+v_label_cut WHERE id=v_label_id;
    INSERT INTO public.label_financial_transactions
      (label_id,transaction_type,amount,description,related_contract_id,related_band_id)
    VALUES(v_label_id,'revenue',v_label_cut,'360 Deal touring cut from gig',v_label_contract,v_gig.band_id);
  END IF;

  INSERT INTO public.band_earnings (band_id,source,amount,description,metadata)
  VALUES (v_gig.band_id,'gig_performance',v_payout,
    'Gig settlement after city tax and label share',
    jsonb_build_object('gig_id',p_gig_id,'outcome_id',v_outcome.id,
      'city_id',v_city_id,'city_tax',v_tax,'label_cut',v_label_cut,
      'gross_profit',v_outcome.net_profit,'finance_version','arena_stadium_v2'));

  UPDATE public.gig_outcomes
  SET production_breakdown = coalesce(production_breakdown,'{}'::jsonb)
      || jsonb_build_object('settlement',jsonb_build_object(
        'city_income_tax',v_tax,'label_cut',v_label_cut,'band_payout',v_payout))
  WHERE id=v_outcome.id;

  RETURN v_receipt;
END;
$body$;

REVOKE ALL ON FUNCTION public.settle_gig_finance_v2(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_gig_finance_v2(uuid) TO service_role;
