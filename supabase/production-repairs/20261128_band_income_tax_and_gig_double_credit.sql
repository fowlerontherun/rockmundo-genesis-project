-- Forward-only live repair: fix arena gig double-credit and withhold income
-- tax from net band revenue. Historic income/balances are untouched.

CREATE TABLE IF NOT EXISTS public.band_income_tax_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  earning_id uuid NOT NULL UNIQUE REFERENCES public.band_earnings(id),
  band_id uuid NOT NULL REFERENCES public.bands(id),
  source text NOT NULL,
  city_id uuid NOT NULL REFERENCES public.cities(id),
  tax_period text NOT NULL,
  gross_amount bigint NOT NULL CHECK (gross_amount > 0),
  deductible_cost bigint NOT NULL DEFAULT 0 CHECK (deductible_cost >= 0),
  taxable_amount bigint NOT NULL CHECK (taxable_amount >= 0),
  tax_amount bigint NOT NULL CHECK (tax_amount >= 0),
  net_amount bigint NOT NULL CHECK (net_amount >= 0),
  base_tax_rate numeric(6,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  CONSTRAINT band_income_tax_amounts_balance CHECK (gross_amount = tax_amount + net_amount),
  CONSTRAINT band_income_tax_costs_balance CHECK (taxable_amount + deductible_cost = gross_amount)
);
CREATE INDEX IF NOT EXISTS band_income_tax_receipts_band_period_idx
  ON public.band_income_tax_receipts(band_id,tax_period);
ALTER TABLE public.band_income_tax_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Band finance can view income tax" ON public.band_income_tax_receipts;
CREATE POLICY "Band finance can view income tax" ON public.band_income_tax_receipts
  FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
REVOKE ALL ON public.band_income_tax_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.band_income_tax_receipts TO authenticated;
GRANT ALL ON public.band_income_tax_receipts TO service_role;

-- Progressive marginal *monthly* band tax on post-sales-tax, post-label
-- receipts: base city rate to $50k, +5 points to $250k, +10 points beyond.
CREATE OR REPLACE FUNCTION public.calculate_band_income_tax(
  p_monthly_taxable bigint,p_city_base_rate numeric
) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $tax$
  SELECT CASE WHEN p_monthly_taxable <= 0 THEN 0::bigint ELSE
    round(
      least(p_monthly_taxable,50000)::numeric
        * greatest(0,least(50,coalesce(p_city_base_rate,10))) / 100
      + least(greatest(p_monthly_taxable-50000,0),200000)::numeric
        * greatest(0,least(50,coalesce(p_city_base_rate,10)+5)) / 100
      + greatest(p_monthly_taxable-250000,0)::numeric
        * greatest(0,least(50,coalesce(p_city_base_rate,10)+10)) / 100
    )::bigint END;
 $tax$;
REVOKE ALL ON FUNCTION public.calculate_band_income_tax(bigint,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_band_income_tax(bigint,numeric) TO service_role;

-- AFTER INSERT ordering matters: the existing update_band_balance... trigger
-- credits gross first; the zz_ trigger then inserts a negative income-tax row.
-- This prevents the net payout ever being credited twice or going negative.
CREATE OR REPLACE FUNCTION public.withhold_band_earned_income_tax()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $tax$
DECLARE
  v_city uuid;
  v_rate numeric;
  v_period text := to_char(timezone('utc',now()),'YYYY-MM');
  v_previous bigint;
  v_cost bigint := 0;
  v_taxable bigint;
  v_tax bigint;
  v_receipt uuid;
BEGIN
  IF NEW.amount <= 0 OR NEW.source NOT IN (
    'release_sales','streaming','merchandise','pr_appearance',
    'major_event','music_video','cover_license','battle_of_the_bands'
  ) THEN RETURN NEW; END IF;

  SELECT b.home_city_id INTO v_city FROM public.bands b WHERE b.id=NEW.band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_BAND_NOT_FOUND'; END IF;
  IF v_city IS NULL THEN
    SELECT p.current_city_id INTO v_city FROM public.band_members bm
      JOIN public.profiles p ON p.id=bm.profile_id
      WHERE bm.band_id=NEW.band_id AND p.current_city_id IS NOT NULL
        AND coalesce(bm.member_status,'active')='active'
        AND NOT coalesce(bm.is_touring_member,false)
      ORDER BY bm.profile_id LIMIT 1;
  END IF;
  IF v_city IS NULL THEN RAISE EXCEPTION 'TAX_BAND_CITY_REQUIRED'; END IF;

  SELECT l.income_tax_rate INTO v_rate FROM public.city_laws l
    WHERE l.city_id=v_city AND l.effective_from<=now()
      AND (l.effective_until IS NULL OR l.effective_until>now())
    ORDER BY l.effective_from DESC,l.id DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT t.tax_rate_pct INTO v_rate FROM public.city_treasury t WHERE t.city_id=v_city;
  END IF;
  v_rate := greatest(0,least(50,coalesce(v_rate,10)));

  -- Merchandise manufacturing costs were paid when stock was made.
  -- Deduct their realised cost of goods sold from taxable merch income.
  IF NEW.source='merchandise' AND jsonb_typeof(NEW.metadata->'production_cost_basis')='number' THEN
    v_cost := least(NEW.amount,greatest(0,round((NEW.metadata->>'production_cost_basis')::numeric)::bigint));
  END IF;
  v_taxable := NEW.amount::bigint-v_cost;

  SELECT coalesce(sum(r.taxable_amount),0)::bigint INTO v_previous
    FROM public.band_income_tax_receipts r
    WHERE r.band_id=NEW.band_id AND r.tax_period=v_period;
  v_tax := least(NEW.amount::bigint,greatest(0,
    public.calculate_band_income_tax(v_previous+v_taxable,v_rate)
    - public.calculate_band_income_tax(v_previous,v_rate)));

  INSERT INTO public.band_income_tax_receipts
    (earning_id,band_id,source,city_id,tax_period,gross_amount,
     deductible_cost,taxable_amount,tax_amount,net_amount,base_tax_rate)
  VALUES(NEW.id,NEW.band_id,NEW.source,v_city,v_period,NEW.amount,
    v_cost,v_taxable,v_tax,NEW.amount::bigint-v_tax,v_rate)
  RETURNING id INTO v_receipt;

  IF v_tax>0 THEN
    -- This ledger entry is the ONLY balance deduction: the canonical
    -- band_earnings AFTER INSERT trigger updates both balance projections.
    INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
      VALUES(NEW.band_id,-v_tax::integer,'income_tax',
        'Income tax withheld on '||NEW.source,
        jsonb_build_object('tax_receipt_id',v_receipt,'taxed_earning_id',NEW.id,
          'city_id',v_city,'tax_period',v_period,'taxable_income',v_taxable));
    PERFORM public.credit_city_treasury(v_city,v_tax,'band_income_tax',
      'Band income tax on '||NEW.source,v_receipt);
  END IF;

  INSERT INTO public.tax_period_summaries
    (owner_type,owner_id,tax_jurisdiction,tax_period,
     taxable_income_minor,deductible_expenses_minor,tax_withheld_minor,tax_paid_minor)
  VALUES ('band'::public.financial_owner_type,NEW.band_id,'city:'||v_city::text,v_period,
          v_taxable*100,v_cost*100,v_tax*100,v_tax*100)
  ON CONFLICT(owner_type,owner_id,tax_period) DO UPDATE SET
    taxable_income_minor=public.tax_period_summaries.taxable_income_minor+EXCLUDED.taxable_income_minor,
    deductible_expenses_minor=public.tax_period_summaries.deductible_expenses_minor+EXCLUDED.deductible_expenses_minor,
    tax_withheld_minor=public.tax_period_summaries.tax_withheld_minor+EXCLUDED.tax_withheld_minor,
    tax_paid_minor=public.tax_period_summaries.tax_paid_minor+EXCLUDED.tax_paid_minor,
    tax_jurisdiction=CASE WHEN public.tax_period_summaries.tax_jurisdiction=EXCLUDED.tax_jurisdiction
      THEN EXCLUDED.tax_jurisdiction ELSE 'multiple cities' END,
    last_calculated_at=now(),updated_at=now();

  RETURN NEW;
END;
$tax$;
REVOKE ALL ON FUNCTION public.withhold_band_earned_income_tax() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withhold_band_earned_income_tax() TO service_role;

DROP TRIGGER IF EXISTS zz_withhold_band_income_tax ON public.band_earnings;
CREATE TRIGGER zz_withhold_band_income_tax AFTER INSERT ON public.band_earnings
  FOR EACH ROW EXECUTE FUNCTION public.withhold_band_earned_income_tax();

-- The corrected settle_gig_finance_v2 definition follows. Its single band
-- earnings credit must drive the treasury; never UPDATE bands directly.
CREATE OR REPLACE FUNCTION public.settle_gig_finance_v2(p_gig_id uuid)
 RETURNS gig_financial_settlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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

  -- band_earnings is the single canonical band-balance writer; its AFTER
  -- INSERT trigger applies the payout to bands and band_treasuries exactly once.

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
$function$;
