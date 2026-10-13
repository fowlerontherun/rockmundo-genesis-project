-- Keep sub-dollar sales revenue until enough cents accumulate for a whole-dollar
-- earnings-ledger credit. band_earnings.amount is an integer-dollar column.
CREATE TABLE IF NOT EXISTS public.band_sales_fractional_carry (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  remainder_minor integer NOT NULL DEFAULT 0 CHECK(remainder_minor >= 0 AND remainder_minor < 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.band_sales_fractional_carry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_sales_fractional_carry FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_band_sales_with_carry(
  p_band_id uuid, p_net_minor bigint, p_gross_minor bigint,
  p_units integer, p_formats text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_prior integer;
  v_total bigint;
  v_credit bigint;
BEGIN
  IF p_band_id IS NULL OR p_net_minor IS NULL OR p_net_minor < 0 OR
     p_gross_minor IS NULL OR p_gross_minor < 0 OR p_units IS NULL OR p_units < 0 THEN
    RAISE EXCEPTION 'Invalid sales credit payload';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bands WHERE id=p_band_id) THEN
    RAISE EXCEPTION 'Band unavailable for sales payout';
  END IF;
  INSERT INTO public.band_sales_fractional_carry(band_id) VALUES(p_band_id)
    ON CONFLICT DO NOTHING;
  SELECT remainder_minor INTO v_prior FROM public.band_sales_fractional_carry
    WHERE band_id=p_band_id FOR UPDATE;
  v_total:=p_net_minor+v_prior;
  v_credit:=v_total / 100;
  IF v_credit > 2147483647 THEN RAISE EXCEPTION 'Sales payout exceeds ledger limit'; END IF;
  UPDATE public.band_sales_fractional_carry
    SET remainder_minor=MOD(v_total,100)::integer,updated_at=now()
    WHERE band_id=p_band_id;
  IF v_credit > 0 THEN
    INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
    VALUES(p_band_id,v_credit::integer,'release_sales',
      'Daily sales revenue (net after tax, distribution and label split)',
      jsonb_build_object('gross_revenue_minor',p_gross_minor,
                         'net_revenue_minor',p_net_minor,
                         'total_units',p_units,'formats',to_jsonb(p_formats),
                         'carried_minor',MOD(v_total,100)));
  END IF;
  RETURN v_credit::integer;
END; $$;
REVOKE ALL ON FUNCTION public.credit_band_sales_with_carry(uuid,bigint,bigint,integer,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_band_sales_with_carry(uuid,bigint,bigint,integer,text[]) TO service_role;
