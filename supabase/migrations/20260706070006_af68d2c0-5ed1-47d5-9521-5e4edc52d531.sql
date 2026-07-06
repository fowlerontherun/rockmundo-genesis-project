
-- Wire real SKU prices and combined mayor + type tax rates into resolve_company_demand.
CREATE OR REPLACE FUNCTION public.resolve_company_demand(target_date date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  processed integer := 0;
  r record;
  city_pop integer;
  base_customers integer;
  price_mult numeric;
  staff_mult numeric;
  law_mult numeric;
  type_weight numeric;
  rev numeric;
  base_tax numeric;
  sales_tax numeric;
  combined_tax numeric;
  tax_amount numeric;
  sku_avg_price numeric;
  behavior text;
  fallback_price numeric;
BEGIN
  FOR r IN
    SELECT c.id, c.headquarters_city_id, c.company_type, c.reputation_score,
           s.quality_score, s.price_tier, s.capacity, s.sold_out_behavior
      FROM public.companies c
      JOIN public.company_storefront s ON s.company_id = c.id
     WHERE c.is_bankrupt = false AND c.status = 'active' AND s.is_public = true
  LOOP
    SELECT COALESCE(population, 50000) INTO city_pop FROM public.cities WHERE id = r.headquarters_city_id;
    IF city_pop IS NULL THEN city_pop := 50000; END IF;

    SELECT COALESCE(demand_weight, 1.0) INTO type_weight FROM public.company_type_definitions WHERE type_key = r.company_type;
    IF type_weight IS NULL THEN type_weight := 1.0; END IF;

    price_mult := CASE r.price_tier WHEN 1 THEN 1.6 WHEN 2 THEN 1.3 WHEN 3 THEN 1.0 WHEN 4 THEN 0.75 WHEN 5 THEN 0.5 ELSE 1.0 END;
    staff_mult := public.apply_player_staff_bonus(r.id);
    law_mult   := public.mayor_company_modifier(r.headquarters_city_id);

    base_customers := GREATEST(0, FLOOR(
      (city_pop / 10000.0)
      * ((COALESCE(r.reputation_score, 50) + COALESCE(r.quality_score, 50)) / 100.0)
      * price_mult * staff_mult * law_mult * type_weight
    ))::int;
    base_customers := LEAST(base_customers, COALESCE(r.capacity, 100) * 10);

    -- Real per-customer ticket size: stock-weighted average unit_price across
    -- ACTIVE SKUs. Sold-out SKUs count only when the storefront doesn't hide them.
    behavior := COALESCE(r.sold_out_behavior, 'hide');
    SELECT
      CASE
        WHEN SUM(CASE WHEN stock > 0 OR behavior <> 'hide' THEN GREATEST(stock, 1) ELSE 0 END) > 0
        THEN SUM(unit_price * CASE WHEN stock > 0 OR behavior <> 'hide' THEN GREATEST(stock, 1) ELSE 0 END)
           / NULLIF(SUM(CASE WHEN stock > 0 OR behavior <> 'hide' THEN GREATEST(stock, 1) ELSE 0 END), 0)
      END
      INTO sku_avg_price
    FROM public.company_inventory
    WHERE company_id = r.id AND is_active = true;

    fallback_price := CASE r.price_tier WHEN 1 THEN 18 WHEN 2 THEN 12 WHEN 3 THEN 8 WHEN 4 THEN 5 WHEN 5 THEN 3 ELSE 8 END;
    IF sku_avg_price IS NULL OR sku_avg_price <= 0 THEN
      sku_avg_price := fallback_price;
    END IF;

    rev := ROUND(base_customers * sku_avg_price, 2);

    INSERT INTO public.company_demand_log (company_id, resolved_for, customers, revenue, demand_score)
    VALUES (r.id, target_date, base_customers, rev,
            (COALESCE(r.reputation_score,50) + COALESCE(r.quality_score,50)) * price_mult * staff_mult * law_mult * type_weight)
    ON CONFLICT (company_id, resolved_for) DO UPDATE
      SET customers = EXCLUDED.customers, revenue = EXCLUDED.revenue, demand_score = EXCLUDED.demand_score;

    UPDATE public.companies SET balance = balance + rev WHERE id = r.id;

    IF r.headquarters_city_id IS NOT NULL AND rev > 0 THEN
      -- Base corporate tax from the company type definition
      SELECT COALESCE(base_tax_rate, 0.20) INTO base_tax
        FROM public.company_type_definitions WHERE type_key = r.company_type;
      base_tax := COALESCE(base_tax, 0.20);

      -- City sales tax set by the sitting mayor (currently-effective city_laws row)
      SELECT COALESCE(sales_tax_rate, 0)
        INTO sales_tax
        FROM public.city_laws
       WHERE city_id = r.headquarters_city_id
         AND effective_from <= now()
         AND (effective_until IS NULL OR effective_until > now())
       ORDER BY effective_from DESC
       LIMIT 1;
      sales_tax := COALESCE(sales_tax, 0);

      -- Combined effective rate applied to gross revenue.
      combined_tax := LEAST(GREATEST(base_tax + sales_tax, 0), 0.95);
      tax_amount := ROUND(rev * combined_tax, 2);

      INSERT INTO public.company_city_tax_payments (company_id, city_id, amount, tax_rate, period_start, period_end)
      VALUES (r.id, r.headquarters_city_id, tax_amount, combined_tax, target_date, target_date);
      UPDATE public.city_treasury
         SET balance = COALESCE(balance, 0) + tax_amount, updated_at = now()
       WHERE city_id = r.headquarters_city_id;
      INSERT INTO public.city_treasury_ledger (city_id, amount, transaction_type, description)
      VALUES (r.headquarters_city_id, tax_amount, 'tax_income',
              'Corporate tax: ' || r.company_type || ' (base ' || (base_tax*100)::text || '% + city sales ' || (sales_tax*100)::text || '%)')
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.company_storefront
       SET total_customers_week = total_customers_week + base_customers,
           total_revenue_week = total_revenue_week + rev,
           updated_at = now()
     WHERE company_id = r.id;

    processed := processed + 1;
  END LOOP;
  RETURN processed;
END; $function$;
