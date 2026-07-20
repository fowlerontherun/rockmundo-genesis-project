-- Authoritative final festival owner operations summary.
-- This migration intentionally runs after all earlier festival operations migrations so
-- clean resets and upgraded databases finish with the same secured RPC contract.

CREATE OR REPLACE FUNCTION public.can_manage_festival_edition(p_actor_user_id uuid, p_edition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT coalesce(public.has_role(p_actor_user_id,'admin'::public.app_role), false)
    OR public.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM public.festival_editions e
      WHERE e.id = p_edition_id
        AND public.can_manage_festival_brand(e.festival_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.festival_edition_management_roles r
      WHERE r.edition_id = p_edition_id
        AND r.profile_id = public.current_profile_id_safe()
        AND r.status = 'active'
        AND (r.ends_at IS NULL OR r.ends_at > now())
        AND r.role IN ('delegated_manager','operations_manager','stage_manager','talent_booker','finance_manager','safety_officer')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_festival_edition(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_festival_edition(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary_internal(p_edition_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH e AS (
    SELECT * FROM public.festival_editions WHERE id = p_edition_id
  ), slots AS (
    SELECT sl.*, sa.id system_act_id, sa.display_name system_act_name, sa.status system_act_status,
      coalesce(sl.reservation_metadata->>'contract_status', CASE WHEN sa.id IS NOT NULL THEN 'published' END) contract_status
    FROM public.festival_stage_slots sl
    LEFT JOIN public.festival_system_acts sa ON sa.slot_id = sl.id AND sa.edition_id = sl.edition_id
    WHERE sl.edition_id = p_edition_id AND sl.archived_at IS NULL
  ), canonical_ticket AS (
    SELECT sum(c.ticket_holders)::integer tickets_sold, sum(c.estimated_demand)::integer estimated_demand
    FROM public.festival_audience_generations g
    JOIN public.festival_audience_cohorts c ON c.generation_id = g.id
    WHERE g.edition_id = p_edition_id
  ), ticket AS (
    SELECT
      coalesce((SELECT tickets_sold FROM canonical_ticket WHERE tickets_sold IS NOT NULL),
        CASE WHEN coalesce((e.lifecycle_metadata->>'is_test_fixture')::boolean,false) THEN (e.lifecycle_metadata->'ticket_summary'->>'tickets_sold')::integer END,
        0) tickets_sold,
      coalesce((e.lifecycle_metadata->'ticket_summary'->>'capacity')::integer, e.capacity, 0) capacity,
      CASE
        WHEN (SELECT tickets_sold FROM canonical_ticket WHERE tickets_sold IS NOT NULL) IS NOT NULL THEN 'canonical_sales'
        WHEN coalesce((e.lifecycle_metadata->>'is_test_fixture')::boolean,false) AND e.lifecycle_metadata ? 'ticket_summary' THEN 'test_fixture_metadata'
        ELSE 'server_projection'
      END ticket_summary_source,
      CASE WHEN coalesce((e.lifecycle_metadata->>'is_test_fixture')::boolean,false) THEN coalesce(e.lifecycle_metadata->'ticket_summary'->'tiers','[]'::jsonb) ELSE '[]'::jsonb END tiers
    FROM e
  )
  SELECT jsonb_build_object(
    'edition_id', p_edition_id,
    'festival_id', (SELECT festival_id FROM e),
    'festival_name', (SELECT f.name FROM public.festivals f JOIN e ON e.festival_id = f.id),
    'venue_name', (SELECT v.name FROM public.venues v JOIN e ON e.venue_id = v.id),
    'stages', (SELECT coalesce(jsonb_agg(to_jsonb(st) ORDER BY st.stage_number), '[]'::jsonb) FROM public.festival_stages st WHERE st.edition_id = p_edition_id AND st.archived_at IS NULL),
    'slots', (SELECT coalesce(jsonb_agg(to_jsonb(sl) || jsonb_build_object('system_act_id', sl.system_act_id, 'system_act_name', sl.system_act_name, 'system_act_status', sl.system_act_status, 'contract_status', sl.contract_status) ORDER BY sl.day_number, sl.start_time), '[]'::jsonb) FROM slots sl),
    'staff', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.role, s.name), '[]'::jsonb) FROM public.festival_staff s WHERE s.edition_id = p_edition_id),
    'permit_requirements', coalesce(public.festival_edition_permit_requirements(p_edition_id), '[]'::jsonb),
    'staffing_readiness', coalesce(public.festival_edition_staffing_readiness(p_edition_id), '{}'::jsonb),
    'insurance_policies', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.festival_insurance_policies p WHERE p.edition_id = p_edition_id),
    'ticket_summary', (SELECT jsonb_build_object('capacity', capacity, 'tickets_sold', tickets_sold, 'tiers', tiers, 'source', ticket_summary_source) FROM ticket),
    'ticketing', (SELECT jsonb_build_object('capacity', capacity, 'tickets_sold', tickets_sold, 'tiers', tiers, 'source', ticket_summary_source) FROM ticket),
    'tickets_sold', (SELECT tickets_sold FROM ticket),
    'ticket_summary_source', (SELECT ticket_summary_source FROM ticket),
    'schedule_summary', (SELECT jsonb_build_object('total_slots', count(*), 'occupied_slots', count(*) FILTER (WHERE system_act_id IS NOT NULL OR reservation_metadata ? 'system_act_id'), 'open_slots', count(*) FILTER (WHERE system_act_id IS NULL AND NOT (reservation_metadata ? 'system_act_id')), 'contracted_acts', count(*) FILTER (WHERE contract_status IN ('signed','accepted')), 'published_acts', count(*) FILTER (WHERE system_act_id IS NOT NULL), 'system_acts', count(*) FILTER (WHERE system_act_id IS NOT NULL)) FROM slots),
    'finance', coalesce(public.festival_edition_finance_summary(p_edition_id), '{}'::jsonb),
    'data_health', coalesce(public.festival_data_health(p_edition_id), '[]'::jsonb),
    'permissions', jsonb_build_object('can_manage', true),
    'lifecycle', (SELECT jsonb_build_object('status', status, 'start_at', start_at, 'end_at', end_at, 'currency_code', currency_code) FROM e),
    'candidates', '[]'::jsonb,
    'insurance_quotes', '[]'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.festival_edition_operations_summary_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary_internal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.festival_editions WHERE id = p_edition_id) THEN
    RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_festival_edition(auth.uid(), p_edition_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  RETURN public.festival_edition_operations_summary_internal(p_edition_id);
END;
$$;

REVOKE ALL ON FUNCTION public.festival_edition_operations_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.festival_edition_operations_summary(uuid) IS 'Authoritative owner-only festival operations RPC finalised by 20291217100000. Uses can_manage_festival_edition before calling private aggregators; public festival pages must use public projections.';
COMMENT ON FUNCTION public.festival_edition_operations_summary_internal(uuid) IS 'Private service-role/internal aggregation helper. Do not grant to anon or authenticated.';
