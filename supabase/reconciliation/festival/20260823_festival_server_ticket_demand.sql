-- Production reconciliation extension for server-authoritative Festival ticket demand.
-- Owners choose price and availability; the game owns the sell-through forecast.

CREATE OR REPLACE FUNCTION public._festival_ticket_demand_basis_points(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_price_minor bigint
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_marketing_basis_points integer := 10000;
  v_reputation integer := 0;
  v_operating_cost_minor bigint := 0;
  v_expected_capacity integer := 1;
  v_marketing_upgrade_basis_points integer := 0;
  v_benchmark_price_minor bigint := 1000;
  v_price_adjustment integer := 0;
BEGIN
  SELECT
    coalesce((e.planning_effects->>'marketingDemandBasisPoints')::integer, 10000),
    coalesce(c.reputation_score, 0),
    coalesce(e.estimated_operating_cost_minor, 0),
    greatest(coalesce(e.expected_capacity, 1), 1)
  INTO
    v_marketing_basis_points,
    v_reputation,
    v_operating_cost_minor,
    v_expected_capacity
  FROM public.festival_editions_v2 e
  JOIN public.festival_companies fc
    ON fc.id = e.festival_company_id
  JOIN public.companies c
    ON c.id = fc.company_id
  WHERE e.id = p_festival_edition_id
    AND e.festival_company_id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce((ul.effects->>'revenueBasisPoints')::integer, 0)
  INTO v_marketing_upgrade_basis_points
  FROM public.festival_company_upgrades u
  JOIN public.festival_upgrade_levels ul
    ON ul.catalogue_version = u.catalogue_version
   AND ul.category_key = u.category_key
   AND ul.level = u.active_level
   AND ul.active
  WHERE u.festival_company_id = p_festival_company_id
    AND u.category_key = 'marketing_media'
  LIMIT 1;

  v_marketing_upgrade_basis_points := coalesce(v_marketing_upgrade_basis_points, 0);
  v_benchmark_price_minor := greatest(
    1000::bigint,
    round(v_operating_cost_minor::numeric / v_expected_capacity * 1.25)::bigint
  );

  v_price_adjustment := greatest(
    -3000,
    least(
      2000,
      round(
        ((v_benchmark_price_minor - greatest(coalesce(p_price_minor, 0), 0))::numeric
          / v_benchmark_price_minor) * 2500
      )::integer
    )
  );

  RETURN greatest(
    2500,
    least(
      9800,
      8000
        + ((v_marketing_basis_points - 10000) / 2)
        + v_price_adjustment
        + least(greatest(v_reputation, 0), 100) * 10
        + least(greatest(v_marketing_upgrade_basis_points, 0), 2500) / 2
    )
  );
END;
$$;

COMMENT ON FUNCTION public._festival_ticket_demand_basis_points(uuid, uuid, bigint)
IS 'Server-authoritative Festival ticket sell-through forecast based on marketing, price, reputation and active Marketing & Media upgrades.';

REVOKE ALL ON FUNCTION public._festival_ticket_demand_basis_points(uuid, uuid, bigint)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_festival_edition_ticket_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_version integer,
  p_ticket_plan jsonb,
  p_products jsonb,
  p_release_phases jsonb,
  p_capacity_allocations jsonb,
  p_idempotency_key uuid,
  p_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  ticket public.festival_ticket_plans%ROWTYPE;
  product public.festival_ticket_products%ROWTYPE;
  price bigint;
  cap integer;
  sellthrough integer;
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor)
  THEN
    RAISE EXCEPTION 'festival_ticket_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.materialize_festival_edition_foundations(
    p_festival_company_id,
    p_festival_edition_id
  );

  SELECT *
  INTO ticket
  FROM public.festival_ticket_plans
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id
  FOR UPDATE;

  IF ticket.planning_version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_ticket_plan_stale' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO product
  FROM public.festival_ticket_products
  WHERE festival_ticket_plan_id = ticket.id
    AND product_class = 'admission'
    AND active
  ORDER BY sale_priority
  LIMIT 1;

  price := coalesce(
    (
      SELECT nullif(x->>'priceMinor', '')::bigint
      FROM jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) x
      WHERE x->>'productClass' = 'admission'
        AND coalesce((x->>'active')::boolean, true)
      LIMIT 1
    ),
    product.price_minor
  );

  cap := coalesce(
    (
      SELECT nullif(x->>'capacityLimit', '')::integer
      FROM jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) x
      WHERE x->>'productClass' = 'admission'
        AND coalesce((x->>'active')::boolean, true)
      LIMIT 1
    ),
    product.capacity_limit
  );

  IF price IS NULL
     OR price < 0
     OR cap IS NULL
     OR cap <= 0
     OR cap > (
       SELECT usable_capacity
       FROM public.festival_site_plans
       WHERE id = ticket.festival_site_plan_id
     )
  THEN
    RAISE EXCEPTION 'festival_ticket_plan_invalid' USING ERRCODE = 'P0001';
  END IF;

  sellthrough := public._festival_ticket_demand_basis_points(
    p_festival_company_id,
    p_festival_edition_id,
    price
  );

  UPDATE public.festival_ticket_products
  SET price_minor = price,
      face_value_minor = price,
      capacity_limit = cap,
      updated_at = now()
  WHERE id = product.id;

  UPDATE public.festival_ticket_capacity_allocations
  SET capacity_allocated = cap,
      updated_at = now()
  WHERE festival_ticket_plan_id = ticket.id
    AND festival_ticket_product_id = product.id;

  UPDATE public.festival_ticket_plans
  SET expected_sell_through_basis_points = sellthrough,
      forecast = public._festival_projection_forecast(
        (SELECT starts_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
        (SELECT ends_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
        cap,
        price,
        sellthrough,
        sales_tax_rate_basis_points,
        expected_refund_basis_points
      ),
      status = 'ready_for_artist_planning',
      planning_version = planning_version + 1,
      owner_confirmed_at = CASE WHEN p_complete THEN now() ELSE owner_confirmed_at END,
      completed_at = CASE WHEN p_complete THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = ticket.id;

  RETURN public._festival_edition_ticket_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
END;
$$;

WITH recalculated AS (
  SELECT
    tp.id AS ticket_plan_id,
    e.starts_on,
    e.ends_on,
    product.capacity_limit,
    product.price_minor,
    public._festival_ticket_demand_basis_points(
      e.festival_company_id,
      e.id,
      product.price_minor
    ) AS sellthrough_basis_points
  FROM public.festival_ticket_plans tp
  JOIN public.festival_editions_v2 e
    ON e.id = tp.festival_edition_id
  JOIN LATERAL (
    SELECT p.price_minor, p.capacity_limit
    FROM public.festival_ticket_products p
    WHERE p.festival_ticket_plan_id = tp.id
      AND p.product_class = 'admission'
      AND p.active
    ORDER BY p.sale_priority
    LIMIT 1
  ) product ON true
  WHERE e.status = 'draft'
)
UPDATE public.festival_ticket_plans tp
SET expected_sell_through_basis_points = recalculated.sellthrough_basis_points,
    forecast = public._festival_projection_forecast(
      recalculated.starts_on,
      recalculated.ends_on,
      recalculated.capacity_limit,
      recalculated.price_minor,
      recalculated.sellthrough_basis_points,
      tp.sales_tax_rate_basis_points,
      tp.expected_refund_basis_points
    ),
    updated_at = now()
FROM recalculated
WHERE tp.id = recalculated.ticket_plan_id;
