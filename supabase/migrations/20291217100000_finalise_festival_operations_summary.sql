-- Authoritative final festival owner operations summary.
-- This migration intentionally runs after all earlier festival operations migrations so
-- clean resets and upgraded databases finish with the same secured RPC contract.

DROP FUNCTION IF EXISTS public.can_manage_festival_edition(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_manage_festival_edition_internal(p_actor_user_id uuid, p_profile_id uuid, p_edition_id uuid)
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
      JOIN public.festivals f ON f.id = e.festival_id
      WHERE e.id = p_edition_id
        AND f.owner_profile_id = p_profile_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.festival_edition_management_roles r
      WHERE r.edition_id = p_edition_id
        AND r.profile_id = p_profile_id
        AND r.status = 'active'
        AND (r.ends_at IS NULL OR r.ends_at > now())
        AND r.role IN ('delegated_manager','operations_manager','stage_manager','talent_booker','finance_manager','safety_officer')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_festival_edition_internal(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_festival_edition_internal(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_festival_edition(p_edition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT public.can_manage_festival_edition_internal(auth.uid(), public.current_profile_id_safe(), p_edition_id);
$$;

REVOKE ALL ON FUNCTION public.can_manage_festival_edition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_festival_edition(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_safe_jsonb_nonnegative_integer(p_json jsonb, p_key text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN p_json ? p_key AND p_json->>p_key ~ '^[0-9]+$' THEN (p_json->>p_key)::integer END;
$$;
REVOKE ALL ON FUNCTION public.festival_safe_jsonb_nonnegative_integer(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.festival_safe_jsonb_nonnegative_integer(jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary_internal(p_edition_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH e AS (
    SELECT * FROM public.festival_editions WHERE id = p_edition_id
  ), access AS (
    SELECT
      public.is_service_role() OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) OR EXISTS (SELECT 1 FROM e JOIN public.festivals f ON f.id=e.festival_id WHERE f.owner_profile_id=public.current_profile_id_safe()) AS full_access,
      EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=p_edition_id AND r.profile_id=public.current_profile_id_safe() AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now()) AND r.role IN ('delegated_manager','operations_manager','finance_manager')) AS finance_access,
      EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=p_edition_id AND r.profile_id=public.current_profile_id_safe() AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now()) AND r.role IN ('safety_officer')) AS safety_access
  ), slots AS (
    SELECT sl.*, sa.id system_act_id, sa.display_name system_act_name, sa.status system_act_status,
      coalesce(sl.reservation_metadata->>'contract_status', CASE WHEN sa.id IS NOT NULL THEN 'published' END) contract_status
    FROM public.festival_stage_slots sl
    LEFT JOIN public.festival_system_acts sa ON sa.slot_id = sl.id AND sa.edition_id = sl.edition_id
    WHERE sl.edition_id = p_edition_id AND sl.archived_at IS NULL
  ), simulated_ticket AS (
    SELECT sum(c.ticket_holders)::integer tickets_sold FROM public.festival_audience_generations g JOIN public.festival_audience_cohorts c ON c.generation_id = g.id WHERE g.edition_id = p_edition_id
  ), ticket AS (
    SELECT
      CASE WHEN coalesce(e.lifecycle_metadata->>'is_test_fixture','false') = 'true' THEN public.festival_safe_jsonb_nonnegative_integer(e.lifecycle_metadata->'ticket_summary','tickets_sold') END fixture_sold,
      CASE WHEN coalesce(e.lifecycle_metadata->>'is_test_fixture','false') = 'true' THEN public.festival_safe_jsonb_nonnegative_integer(e.lifecycle_metadata->'ticket_summary','capacity') END fixture_capacity,
      coalesce(e.lifecycle_metadata->>'is_test_fixture','false') = 'true' is_fixture,
      e.capacity edition_capacity,
      CASE WHEN coalesce(e.lifecycle_metadata->>'is_test_fixture','false') = 'true' THEN coalesce(e.lifecycle_metadata->'ticket_summary'->'tiers','[]'::jsonb) ELSE '[]'::jsonb END tiers
    FROM e
  ), ticket_final AS (
    SELECT coalesce(edition_capacity, fixture_capacity) capacity,
      fixture_sold tickets_sold,
      CASE WHEN is_fixture AND fixture_sold IS NOT NULL THEN 'test_fixture_metadata' ELSE 'unavailable' END ticket_summary_source,
      tiers
    FROM ticket
  )
  SELECT jsonb_build_object(
    'edition_id', p_edition_id,
    'festival_id', (SELECT festival_id FROM e),
    'festival_name', (SELECT f.name FROM public.festivals f JOIN e ON e.festival_id = f.id),
    'venue_name', (SELECT v.name FROM public.venues v JOIN e ON e.venue_id = v.id),
    'stages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',st.id,'stage_name',st.stage_name,'stage_number',st.stage_number,'stage_type',st.stage_type,'capacity',st.capacity,'genre_focus',st.genre_focus) ORDER BY st.stage_number), '[]'::jsonb) FROM public.festival_stages st WHERE st.edition_id = p_edition_id AND st.archived_at IS NULL),
    'slots', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',sl.id,'stage_id',sl.stage_id,'day_number',sl.day_number,'start_time',sl.start_time,'end_time',sl.end_time,'slot_type',sl.slot_type,'system_act_id',sl.system_act_id,'system_act_name',sl.system_act_name,'system_act_status',sl.system_act_status,'contract_status',sl.contract_status) ORDER BY sl.day_number, sl.start_time), '[]'::jsonb) FROM slots sl),
    'staff', (SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.id,'role',s.role,'name',s.name,'skill_level',s.skill_level,'assignment_scope',s.assignment_scope,'shift_start_at',s.shift_start_at,'shift_end_at',s.shift_end_at,'status',s.status,'weekly_wage_cents',CASE WHEN (SELECT full_access OR finance_access FROM access) THEN s.weekly_wage_cents END)) ORDER BY s.role, s.name), '[]'::jsonb) FROM public.festival_staff s WHERE s.edition_id = p_edition_id),
    'staff_wages_access', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN 'granted' ELSE 'denied' END,
    'permit_requirements', coalesce(public.festival_edition_permit_requirements(p_edition_id), '[]'::jsonb),
    'staffing_readiness', coalesce(public.festival_edition_staffing_readiness(p_edition_id), '{}'::jsonb),
    'insurance_policies', (SELECT coalesce(jsonb_agg(CASE WHEN (SELECT full_access OR finance_access FROM access) THEN jsonb_build_object('id',p.id,'coverage_type',p.coverage_type,'policy_status',p.policy_status,'active',p.active,'premium_cents',p.premium_cents,'payout_ceiling_cents',p.payout_ceiling_cents,'effective_from',p.effective_from,'effective_to',p.effective_to) ELSE jsonb_build_object('id',p.id,'coverage_type',p.coverage_type,'policy_status',p.policy_status,'active',p.active,'effective_from',p.effective_from,'effective_to',p.effective_to) END), '[]'::jsonb) FROM public.festival_insurance_policies p WHERE p.edition_id = p_edition_id),
    'insurance_access', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN 'granted' WHEN (SELECT safety_access FROM access) THEN 'limited' ELSE 'denied' END,
    'ticket_summary', (SELECT jsonb_build_object('capacity', capacity, 'tickets_sold', tickets_sold, 'tiers', tiers, 'source', ticket_summary_source) FROM ticket_final),
    'ticketing', (SELECT jsonb_build_object('capacity', capacity, 'tickets_sold', tickets_sold, 'tiers', tiers, 'source', ticket_summary_source) FROM ticket_final),
    'tickets_sold', (SELECT tickets_sold FROM ticket_final),
    'ticket_summary_source', (SELECT ticket_summary_source FROM ticket_final),
    'schedule_summary', (SELECT jsonb_build_object('total_slots', count(*), 'occupied_slots', count(*) FILTER (WHERE system_act_id IS NOT NULL OR reservation_metadata ? 'system_act_id'), 'open_slots', count(*) FILTER (WHERE system_act_id IS NULL AND NOT (reservation_metadata ? 'system_act_id')), 'contracted_acts', count(*) FILTER (WHERE contract_status IN ('signed','accepted')), 'published_acts', count(*) FILTER (WHERE system_act_id IS NOT NULL), 'system_acts', count(*) FILTER (WHERE system_act_id IS NOT NULL)) FROM slots),
    'finance', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN coalesce(public.festival_edition_finance_summary(p_edition_id), '{}'::jsonb) END,
    'finance_access', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN 'granted' ELSE 'denied' END,
    'data_health', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN coalesce(public.festival_data_health(p_edition_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'data_health_access', CASE WHEN (SELECT full_access OR finance_access FROM access) THEN 'granted' ELSE 'denied' END,
    'permissions', jsonb_build_object('can_manage', true, 'finance_access', (SELECT full_access OR finance_access FROM access), 'full_access', (SELECT full_access FROM access)),
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

  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  RETURN public.festival_edition_operations_summary_internal(p_edition_id);
END;
$$;

REVOKE ALL ON FUNCTION public.festival_edition_operations_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.festival_edition_operations_summary(uuid) IS 'Authoritative owner-only festival operations RPC finalised by 20291217100000. Uses can_manage_festival_edition(p_edition_id) before calling private aggregators; public festival pages must use public projections.';
COMMENT ON FUNCTION public.festival_edition_operations_summary_internal(uuid) IS 'Private service-role/internal aggregation helper. Do not grant to anon or authenticated.';
COMMENT ON FUNCTION public.can_manage_festival_edition(uuid) IS 'Authenticated authorisation helper that derives actor identity from auth.uid() and current_profile_id_safe().';
COMMENT ON FUNCTION public.can_manage_festival_edition_internal(uuid,uuid,uuid) IS 'Service-role-only internal helper for trusted workflows that must evaluate an explicit actor/profile pair.';
