
CREATE OR REPLACE FUNCTION public.admin_festival_catalogue()
RETURNS TABLE (
  festival_id uuid,
  brand_name text,
  owner_name text,
  city_name text,
  current_edition_id uuid,
  current_edition_title text,
  next_edition_id uuid,
  completed_edition_id uuid,
  edition_count integer,
  lifecycle_state text,
  stage_count integer,
  active_contract_count integer,
  performance_session_count integer,
  outcome_count integer,
  attendance integer,
  currency_code text,
  projected_finance_cents bigint,
  actual_finance_cents bigint,
  legacy_mappings integer,
  operational_readiness text,
  data_health_warnings jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id AS festival_id,
    f.name AS brand_name,
    NULL::text AS owner_name,
    c.name AS city_name,
    f.id AS current_edition_id,
    f.name AS current_edition_title,
    NULL::uuid AS next_edition_id,
    NULL::uuid AS completed_edition_id,
    COALESCE(f.edition_number, 1)::int AS edition_count,
    COALESCE(f.status, 'draft')::text AS lifecycle_state,
    COALESCE((SELECT COUNT(*)::int FROM festival_stages s WHERE s.festival_id = f.id), 0) AS stage_count,
    0::int AS active_contract_count,
    0::int AS performance_session_count,
    0::int AS outcome_count,
    f.expected_attendance AS attendance,
    'USD'::text AS currency_code,
    COALESCE(f.annual_operating_cost_cents, 0)::bigint AS projected_finance_cents,
    COALESCE(f.treasury_cents, 0)::bigint AS actual_finance_cents,
    0::int AS legacy_mappings,
    'basic'::text AS operational_readiness,
    '[]'::jsonb AS data_health_warnings
  FROM festivals f
  LEFT JOIN cities c ON c.id = f.city_id
  ORDER BY f.name;
$$;

GRANT EXECUTE ON FUNCTION public.admin_festival_catalogue() TO authenticated, service_role;
