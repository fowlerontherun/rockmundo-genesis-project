-- Repair festival admin catalogue warning arrays so they never contain null elements.

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_platform_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_platform_admin() FROM anon;

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
  edition_count bigint,
  lifecycle_state public.festival_edition_status,
  stage_count bigint,
  active_contract_count bigint,
  performance_session_count bigint,
  outcome_count bigint,
  attendance integer,
  currency_code text,
  projected_finance_cents bigint,
  actual_finance_cents bigint,
  legacy_mappings bigint,
  operational_readiness text,
  data_health_warnings jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH admin_authority AS (
    SELECT public.current_user_is_platform_admin() AS allowed
  ), edition_rollup AS (
    SELECT
      e.festival_id,
      count(*)::bigint AS edition_count,
      (array_agg(e.id ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS current_edition_id,
      (array_agg(e.title ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS current_edition_title,
      (array_agg(e.id ORDER BY e.start_at NULLS LAST, e.created_at DESC) FILTER (WHERE e.start_at >= now() AND e.status NOT IN ('cancelled','abandoned')))[1] AS next_edition_id,
      (array_agg(e.id ORDER BY e.completed_at DESC NULLS LAST, e.end_at DESC NULLS LAST, e.created_at DESC) FILTER (WHERE e.status = 'completed'))[1] AS completed_edition_id,
      (array_agg(e.status ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS lifecycle_state,
      (array_agg(e.expected_attendance ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS attendance,
      (array_agg(e.currency_code ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS currency_code,
      (array_agg(coalesce(e.budget_cents, e.treasury_allocation_cents, 0) ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning','concept') THEN 0 ELSE 1 END, e.start_at NULLS LAST, e.created_at DESC))[1] AS projected_finance_cents
    FROM public.festival_editions e
    GROUP BY e.festival_id
  ), counts AS (
    SELECT
      f.id AS festival_id,
      count(DISTINCT st.id) FILTER (WHERE st.archived_at IS NULL)::bigint AS stage_count,
      count(DISTINCT fc.id) FILTER (WHERE fc.status IN ('awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature','active','amendment_required'))::bigint AS active_contract_count,
      count(DISTINCT fps.id)::bigint AS performance_session_count,
      count(DISTINCT fpo.id)::bigint AS outcome_count,
      count(DISTINCT flm.id)::bigint AS legacy_mappings
    FROM public.festivals f
    LEFT JOIN public.festival_editions e ON e.festival_id = f.id
    LEFT JOIN public.festival_stages st ON st.edition_id = e.id
    LEFT JOIN public.festival_contracts fc ON fc.edition_id = e.id
    LEFT JOIN public.festival_performance_sessions fps ON fps.edition_id = e.id
    LEFT JOIN public.festival_performance_outcomes fpo ON fpo.edition_id = e.id
    LEFT JOIN public.festival_legacy_mappings flm ON flm.edition_id = e.id
    GROUP BY f.id
  ), warnings AS (
    SELECT
      f.id AS festival_id,
      warning_rows.data_health_warnings
    FROM public.festivals f
    LEFT JOIN edition_rollup er ON er.festival_id = f.id
    LEFT JOIN counts ct ON ct.festival_id = f.id
    LEFT JOIN public.profiles p ON p.id = f.owner_profile_id
    LEFT JOIN public.cities c ON c.id = f.city_id
    CROSS JOIN LATERAL (
      SELECT coalesce(jsonb_agg(w.warning), '[]'::jsonb) AS data_health_warnings
      FROM (VALUES
        (CASE WHEN coalesce(er.edition_count, 0) = 0 THEN jsonb_build_object('code','brand_without_edition','severity','blocker','message','Brand has no canonical edition') END),
        (CASE WHEN er.current_edition_id IS NOT NULL AND coalesce(ct.stage_count, 0) = 0 THEN jsonb_build_object('code','edition_without_stages','severity','warning','message','Selected edition has no edition-scoped stages') END),
        (CASE WHEN coalesce(ct.legacy_mappings, 0) > 1 THEN jsonb_build_object('code','duplicate_legacy_mapping','severity','warning','message','Multiple legacy mappings need review') END),
        (CASE WHEN f.owner_profile_id IS NOT NULL AND p.id IS NULL THEN jsonb_build_object('code','missing_owner_profile','severity','warning','message','Owner profile is missing') END),
        (CASE WHEN f.city_id IS NOT NULL AND c.id IS NULL THEN jsonb_build_object('code','missing_city','severity','warning','message','Festival city is missing') END)
      ) AS w(warning)
      WHERE w.warning IS NOT NULL
    ) AS warning_rows
  )
  SELECT
    f.id,
    f.name,
    p.display_name,
    c.name,
    er.current_edition_id,
    er.current_edition_title,
    er.next_edition_id,
    er.completed_edition_id,
    coalesce(er.edition_count, 0),
    er.lifecycle_state,
    coalesce(ct.stage_count, 0),
    coalesce(ct.active_contract_count, 0),
    coalesce(ct.performance_session_count, 0),
    coalesce(ct.outcome_count, 0),
    er.attendance,
    coalesce(er.currency_code, 'USD'),
    coalesce(er.projected_finance_cents, 0),
    0::bigint,
    coalesce(ct.legacy_mappings, 0),
    CASE
      WHEN coalesce(er.edition_count, 0) = 0 THEN 'missing_edition'
      WHEN coalesce(ct.stage_count, 0) = 0 THEN 'needs_stages'
      WHEN coalesce(ct.active_contract_count, 0) = 0 THEN 'needs_contracts'
      ELSE 'ready'
    END,
    coalesce(w.data_health_warnings, '[]'::jsonb)
  FROM public.festivals f
  CROSS JOIN admin_authority aa
  LEFT JOIN public.profiles p ON p.id = f.owner_profile_id
  LEFT JOIN public.cities c ON c.id = f.city_id
  LEFT JOIN edition_rollup er ON er.festival_id = f.id
  LEFT JOIN counts ct ON ct.festival_id = f.id
  LEFT JOIN warnings w ON w.festival_id = f.id
  WHERE aa.allowed
  ORDER BY f.name, f.id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_festival_catalogue() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_festival_catalogue() FROM anon;
