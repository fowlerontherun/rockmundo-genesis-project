-- Top releases for the same band, optionally filtered by day and format type.
-- Used by the Sales tab "Top Releases" chart.
CREATE OR REPLACE FUNCTION public.get_top_releases_by_sales(
  p_band_id uuid,
  p_sale_date date DEFAULT NULL,
  p_format_type text DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  release_id uuid,
  title text,
  units bigint,
  gross_cents bigint,
  net_cents bigint,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS release_id,
    r.title::text,
    COALESCE(SUM(rs.quantity_sold), 0)::bigint AS units,
    COALESCE(SUM(rs.total_amount), 0)::bigint AS gross_cents,
    COALESCE(SUM(rs.net_revenue), 0)::bigint AS net_cents,
    false AS is_current
  FROM public.releases r
  JOIN public.release_formats rf ON rf.release_id = r.id
  LEFT JOIN public.release_sales rs
    ON rs.release_format_id = rf.id
   AND (p_sale_date IS NULL OR (rs.sale_date AT TIME ZONE 'UTC')::date = p_sale_date)
  WHERE r.band_id = p_band_id
    AND (p_format_type IS NULL OR rf.format_type = p_format_type)
  GROUP BY r.id, r.title
  HAVING COALESCE(SUM(rs.quantity_sold), 0) > 0
  ORDER BY gross_cents DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_releases_by_sales(uuid, date, text, int) TO authenticated, anon;