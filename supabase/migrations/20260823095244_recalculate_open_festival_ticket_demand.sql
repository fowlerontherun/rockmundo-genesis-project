-- Bring existing editable Festival ticket forecasts onto the server-authoritative demand model
-- without consuming an owner-facing planning version.

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
