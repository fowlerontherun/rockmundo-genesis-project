-- =========================================================
-- 1) Workforce aggregation across all real subsidiary tables
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_company_workforce_counts(_owner_id uuid)
RETURNS TABLE (company_id uuid, employee_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owned AS (
    SELECT id FROM public.companies WHERE owner_id = _owner_id
  ),
  staff AS (
    SELECT mf.company_id, w.id::text AS staff_id
      FROM public.merch_factory_workers w
      JOIN public.merch_factories mf ON mf.id = w.factory_id
     WHERE mf.company_id IN (SELECT id FROM owned)
    UNION ALL
    SELECT sf.company_id, sg.id::text
      FROM public.security_guards sg
      JOIN public.security_firms sf ON sf.id = sg.security_firm_id
     WHERE sf.company_id IN (SELECT id FROM owned)
       AND COALESCE(sg.status, 'active') = 'active'
    UNION ALL
    SELECT v.company_id, vs.id::text
      FROM public.venue_staff vs
      JOIN public.venues v ON v.id = vs.venue_id
     WHERE v.company_id IN (SELECT id FROM owned)
    UNION ALL
    SELECT rr.company_id, rs.id::text
      FROM public.rehearsal_room_staff rs
      JOIN public.rehearsal_rooms rr ON rr.id = rs.room_id
     WHERE rr.company_id IN (SELECT id FROM owned)
       AND COALESCE(rs.is_active, true) = true
    UNION ALL
    SELECT l.company_id, ls.id::text
      FROM public.label_staff ls
      JOIN public.labels l ON l.id = ls.label_id
     WHERE l.company_id IN (SELECT id FROM owned)
    UNION ALL
    SELECT lc.company_id, ld.id::text
      FROM public.logistics_drivers ld
      JOIN public.logistics_companies lc ON lc.id = ld.logistics_company_id
     WHERE lc.company_id IN (SELECT id FROM owned)
       AND COALESCE(ld.status, 'active') = 'active'
  )
  SELECT o.id AS company_id,
         COALESCE(COUNT(s.staff_id), 0)::bigint AS employee_count
    FROM owned o
    LEFT JOIN staff s ON s.company_id = o.id
   GROUP BY o.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_workforce_counts(uuid) TO authenticated;

-- =========================================================
-- 2) Monthly tax bill generator
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_pending_company_taxes()
RETURNS TABLE (company_id uuid, tax_amount numeric, tax_period text, status text)
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
  -- Bill for the previous month, due in 7 days
  v_period       := to_char(date_trunc('month', now() AT TIME ZONE 'UTC'), 'YYYY-MM');
  v_period_start := (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month');
  v_period_end   := date_trunc('month', now() AT TIME ZONE 'UTC');
  v_due          := now() + interval '7 days';

  FOR v_company IN
    SELECT c.id, c.reputation_score
      FROM public.companies c
     WHERE COALESCE(c.is_bankrupt, false) = false
  LOOP
    SELECT id INTO v_existing
      FROM public.company_tax_records
     WHERE company_tax_records.company_id = v_company.id
       AND tax_period = v_period
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0),
      COALESCE(SUM(CASE WHEN amount < 0 AND COALESCE(category, '') <> 'tax' THEN -amount END), 0)
      INTO v_revenue, v_expenses
      FROM public.company_transactions
     WHERE company_transactions.company_id = v_company.id
       AND created_at >= v_period_start
       AND created_at <  v_period_end;

    -- Fall back to the last 30 days when there's no prior-month activity yet
    IF v_revenue = 0 THEN
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0),
        COALESCE(SUM(CASE WHEN amount < 0 AND COALESCE(category, '') <> 'tax' THEN -amount END), 0)
        INTO v_revenue, v_expenses
        FROM public.company_transactions
       WHERE company_transactions.company_id = v_company.id
         AND created_at >= now() - interval '30 days';
    END IF;

    v_taxable := GREATEST(v_revenue - v_expenses, 0);

    IF v_taxable <= 0 THEN
      CONTINUE;
    END IF;

    -- Progressive corporate rate (matches client `CORPORATE_TAX_RATES`)
    v_rate := CASE
                WHEN v_taxable < 50000  THEN 0.10
                WHEN v_taxable < 250000 THEN 0.15
                WHEN v_taxable < 1000000 THEN 0.20
                ELSE 0.25
              END;

    -- Reputation discount: -1% per 20 reputation points, max 10% off
    v_reputation_discount := LEAST(GREATEST(COALESCE(v_company.reputation_score, 0), 0) / 20.0 * 0.01, 0.10);
    v_rate := GREATEST(v_rate * (1 - v_reputation_discount), 0.05);

    v_tax := ROUND(v_taxable * v_rate, 2);

    INSERT INTO public.company_tax_records (
      company_id, tax_period, gross_revenue, deductible_expenses,
      taxable_income, tax_rate, tax_amount, tax_type, penalty_amount,
      status, due_date
    ) VALUES (
      v_company.id, v_period, v_revenue, v_expenses,
      v_taxable, v_rate, v_tax, 'corporate', 0,
      'pending', v_due
    );

    company_id  := v_company.id;
    tax_amount  := v_tax;
    tax_period  := v_period;
    status      := 'pending';
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_pending_company_taxes() TO authenticated, service_role;