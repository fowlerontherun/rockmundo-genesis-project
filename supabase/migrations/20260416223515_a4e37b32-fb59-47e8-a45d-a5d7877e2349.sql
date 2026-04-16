DROP FUNCTION IF EXISTS public.generate_pending_company_taxes();

CREATE FUNCTION public.generate_pending_company_taxes()
RETURNS TABLE (billed_company_id uuid, billed_amount numeric, billed_period text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company RECORD;
  v_period text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_revenue numeric;
  v_expenses numeric;
  v_taxable numeric;
  v_rate numeric;
  v_reputation_discount numeric;
  v_tax numeric;
  v_due timestamptz;
  v_existing uuid;
BEGIN
  v_period       := to_char(date_trunc('month', now() AT TIME ZONE 'UTC'), 'YYYY-MM');
  v_period_start := (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month');
  v_period_end   := date_trunc('month', now() AT TIME ZONE 'UTC');
  v_due          := now() + interval '7 days';

  FOR v_company IN
    SELECT c.id AS cid, c.reputation_score AS rep
      FROM public.companies c
     WHERE COALESCE(c.is_bankrupt, false) = false
  LOOP
    SELECT ctr.id INTO v_existing
      FROM public.company_tax_records ctr
     WHERE ctr.company_id = v_company.cid
       AND ctr.tax_period = v_period
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN ct.amount > 0 THEN ct.amount END), 0),
      COALESCE(SUM(CASE WHEN ct.amount < 0 AND COALESCE(ct.category, '') <> 'tax' THEN -ct.amount END), 0)
      INTO v_revenue, v_expenses
      FROM public.company_transactions ct
     WHERE ct.company_id = v_company.cid
       AND ct.created_at >= v_period_start
       AND ct.created_at <  v_period_end;

    IF v_revenue = 0 THEN
      SELECT
        COALESCE(SUM(CASE WHEN ct.amount > 0 THEN ct.amount END), 0),
        COALESCE(SUM(CASE WHEN ct.amount < 0 AND COALESCE(ct.category, '') <> 'tax' THEN -ct.amount END), 0)
        INTO v_revenue, v_expenses
        FROM public.company_transactions ct
       WHERE ct.company_id = v_company.cid
         AND ct.created_at >= now() - interval '30 days';
    END IF;

    v_taxable := GREATEST(v_revenue - v_expenses, 0);
    IF v_taxable <= 0 THEN CONTINUE; END IF;

    v_rate := CASE
                WHEN v_taxable < 50000   THEN 0.10
                WHEN v_taxable < 250000  THEN 0.15
                WHEN v_taxable < 1000000 THEN 0.20
                ELSE 0.25
              END;

    v_reputation_discount := LEAST(GREATEST(COALESCE(v_company.rep, 0), 0) / 20.0 * 0.01, 0.10);
    v_rate := GREATEST(v_rate * (1 - v_reputation_discount), 0.05);

    v_tax := ROUND(v_taxable * v_rate, 2);

    INSERT INTO public.company_tax_records (
      company_id, tax_period, gross_revenue, deductible_expenses,
      taxable_income, tax_rate, tax_amount, tax_type, penalty_amount,
      status, due_date
    ) VALUES (
      v_company.cid, v_period, v_revenue, v_expenses,
      v_taxable, v_rate, v_tax, 'corporate', 0,
      'pending', v_due
    );

    billed_company_id := v_company.cid;
    billed_amount := v_tax;
    billed_period := v_period;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_pending_company_taxes() TO authenticated, service_role;