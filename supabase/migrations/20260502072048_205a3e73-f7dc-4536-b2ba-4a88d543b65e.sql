-- Aggregate release sales server-side to bypass PostgREST 1000-row cap
-- Returns per-format aggregates with optional sale_date filter (UTC date)

CREATE OR REPLACE FUNCTION public.get_release_sales_breakdown(
  p_release_id uuid,
  p_sale_date date DEFAULT NULL
)
RETURNS TABLE (
  format_type text,
  units bigint,
  gross_cents bigint,
  tax_cents bigint,
  dist_cents bigint,
  net_cents bigint,
  sale_rows bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rf.format_type::text,
    COALESCE(SUM(rs.quantity_sold), 0)::bigint AS units,
    COALESCE(SUM(rs.total_amount), 0)::bigint AS gross_cents,
    COALESCE(SUM(rs.sales_tax_amount), 0)::bigint AS tax_cents,
    COALESCE(SUM(rs.distribution_fee), 0)::bigint AS dist_cents,
    COALESCE(SUM(rs.net_revenue), 0)::bigint AS net_cents,
    COUNT(rs.id)::bigint AS sale_rows
  FROM public.release_formats rf
  LEFT JOIN public.release_sales rs
    ON rs.release_format_id = rf.id
   AND (p_sale_date IS NULL OR (rs.sale_date AT TIME ZONE 'UTC')::date = p_sale_date)
  WHERE rf.release_id = p_release_id
  GROUP BY rf.format_type
  HAVING COALESCE(SUM(rs.quantity_sold), 0) > 0 OR p_sale_date IS NULL
  ORDER BY gross_cents DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_release_sales_breakdown(uuid, date) TO authenticated, anon;

-- List of distinct sale dates for a release (for the daily filter dropdown)
CREATE OR REPLACE FUNCTION public.get_release_sale_dates(
  p_release_id uuid
)
RETURNS TABLE (sale_day date, row_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (rs.sale_date AT TIME ZONE 'UTC')::date AS sale_day, COUNT(*)::bigint AS row_count
  FROM public.release_sales rs
  JOIN public.release_formats rf ON rf.id = rs.release_format_id
  WHERE rf.release_id = p_release_id
  GROUP BY 1
  ORDER BY 1 DESC
  LIMIT 60;
$$;

GRANT EXECUTE ON FUNCTION public.get_release_sale_dates(uuid) TO authenticated, anon;