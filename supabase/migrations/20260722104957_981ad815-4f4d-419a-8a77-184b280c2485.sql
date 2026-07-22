
-- Ownership/authorisation helper
CREATE OR REPLACE FUNCTION public.can_manage_festival_edition(p_edition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)
      OR EXISTS (
        SELECT 1 FROM public.festival_editions e
        JOIN public.festivals f ON f.id = e.festival_id
        WHERE e.id = p_edition_id
          AND f.owner_profile_id = public.current_profile_id_safe()
      )
      OR EXISTS (
        SELECT 1 FROM public.festival_edition_management_roles r
        WHERE r.edition_id = p_edition_id
          AND r.profile_id = public.current_profile_id_safe()
          AND r.status = 'active'
          AND (r.ends_at IS NULL OR r.ends_at > now())
      );
$$;
REVOKE ALL ON FUNCTION public.can_manage_festival_edition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_festival_edition(uuid) TO authenticated, service_role;

-- Simple finance summary
CREATE OR REPLACE FUNCTION public.festival_edition_finance_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_expense_cents bigint := 0;
  v_ticket_revenue_cents bigint := 0;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    SELECT coalesce(sum(amount_cents),0) INTO v_expense_cents
    FROM public.festival_expense_ledger WHERE festival_id = v_edition.festival_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN v_expense_cents := 0; END;

  RETURN jsonb_build_object(
    'edition_id', p_edition_id,
    'currency_code', v_edition.currency_code,
    'budget_cents', v_edition.budget_cents,
    'treasury_allocation_cents', v_edition.treasury_allocation_cents,
    'expense_cents', v_expense_cents,
    'ticket_revenue_cents', v_ticket_revenue_cents,
    'net_cents', coalesce(v_edition.treasury_allocation_cents,0) - v_expense_cents,
    'breakdown', '[]'::jsonb
  );
END $$;
REVOKE ALL ON FUNCTION public.festival_edition_finance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.festival_edition_finance_summary(uuid) TO authenticated, service_role;

-- Operations summary
CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_festival_name text;
  v_venue_name text;
  v_can_manage boolean;
  v_is_admin boolean;
  v_is_owner boolean;
  v_stages jsonb;
  v_slots jsonb;
  v_staff jsonb;
  v_permits jsonb;
  v_insurance jsonb;
  v_schedule jsonb;
  v_finance jsonb;
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  v_is_admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
  v_is_owner := EXISTS (SELECT 1 FROM public.festivals f WHERE f.id = v_edition.festival_id AND f.owner_profile_id = public.current_profile_id_safe());
  v_can_manage := true;

  SELECT f.name INTO v_festival_name FROM public.festivals f WHERE f.id = v_edition.festival_id;
  SELECT v.name INTO v_venue_name FROM public.venues v WHERE v.id = v_edition.venue_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', st.id,
    'stage_name', st.stage_name,
    'name', st.stage_name,
    'stage_number', st.stage_number,
    'stage_type', 'stage',
    'capacity', st.capacity,
    'genre_focus', st.genre_focus
  ) ORDER BY st.stage_number),'[]'::jsonb)
  INTO v_stages FROM public.festival_stages st WHERE st.edition_id = p_edition_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', sl.id,
    'stage_id', sl.stage_id,
    'day_number', sl.day_number,
    'start_time', sl.start_time,
    'end_time', sl.end_time,
    'slot_type', coalesce(sl.slot_type,'performance'),
    'status', coalesce(sl.status,'open'),
    'public_status', coalesce(sl.public_status,'draft'),
    'slot_number', sl.slot_number,
    'changeover_minutes', sl.changeover_minutes,
    'changeover_duration_minutes', sl.changeover_minutes,
    'system_act_id', NULL,
    'system_act_name', sl.npc_dj_name,
    'system_act_status', NULL,
    'contract_status', CASE WHEN sl.canonical_contract_id IS NOT NULL THEN 'signed' END
  ) ORDER BY sl.day_number, sl.start_time, sl.slot_number),'[]'::jsonb)
  INTO v_slots FROM public.festival_stage_slots sl WHERE sl.edition_id = p_edition_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'role', s.role,
    'name', s.name,
    'skill_level', s.skill_level,
    'status', CASE WHEN s.terminated_at IS NULL THEN 'active' ELSE 'terminated' END,
    'weekly_wage_cents', s.weekly_wage_cents,
    'shift_start_at', s.hired_at,
    'shift_end_at', s.terminated_at
  ) ORDER BY s.role, s.name),'[]'::jsonb)
  INTO v_staff FROM public.festival_staff s WHERE s.edition_id = p_edition_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'requirement_code', p.permit_type,
    'permit_type', p.permit_type,
    'type', p.permit_type,
    'status', coalesce(p.status,'not_started'),
    'required', true,
    'application_deadline', p.safety_inspection_date,
    'fee_cents', p.permit_fee_cents,
    'submitted_at', NULL,
    'response', NULL,
    'expires_at', p.expires_on,
    'blocker_severity', 'none'
  )),'[]'::jsonb)
  INTO v_permits FROM public.festival_permits p WHERE p.edition_id = p_edition_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ip.id,
    'coverage_type', ip.coverage_type,
    'policy_status', CASE WHEN ip.active THEN 'active' ELSE 'inactive' END,
    'active', ip.active,
    'premium_cents', ip.premium_cents,
    'payout_ceiling_cents', ip.payout_ceiling_cents,
    'effective_from', ip.effective_from,
    'effective_to', ip.effective_to,
    'expires_at', ip.effective_to,
    'provider', 'Rockmundo Insurance'
  )),'[]'::jsonb)
  INTO v_insurance FROM public.festival_insurance_policies ip WHERE ip.edition_id = p_edition_id;

  SELECT jsonb_build_object(
    'total_slots', count(*),
    'occupied_slots', count(*) FILTER (WHERE band_id IS NOT NULL OR canonical_contract_id IS NOT NULL),
    'open_slots', count(*) FILTER (WHERE band_id IS NULL AND canonical_contract_id IS NULL),
    'contracted_acts', count(*) FILTER (WHERE canonical_contract_id IS NOT NULL),
    'published_acts', count(*) FILTER (WHERE public_status = 'published'),
    'system_acts', count(*) FILTER (WHERE is_npc_dj = true)
  )
  INTO v_schedule FROM public.festival_stage_slots WHERE edition_id = p_edition_id;

  v_finance := public.festival_edition_finance_summary(p_edition_id);

  RETURN jsonb_build_object(
    'edition_id', p_edition_id,
    'festival_id', v_edition.festival_id,
    'festival_name', v_festival_name,
    'venue_name', v_venue_name,
    'currency_code', v_edition.currency_code,
    'stages', v_stages,
    'slots', v_slots,
    'staff', v_staff,
    'candidates', '[]'::jsonb,
    'permit_requirements', v_permits,
    'insurance_policies', v_insurance,
    'insurance_quotes', '[]'::jsonb,
    'insurance_access', 'granted',
    'staff_wages_access', 'granted',
    'schedule_summary', v_schedule,
    'ticket_summary', jsonb_build_object('capacity', v_edition.capacity, 'tickets_sold', NULL, 'tiers', '[]'::jsonb, 'source', 'unavailable'),
    'ticketing', jsonb_build_object('capacity', v_edition.capacity, 'tickets_sold', NULL, 'tiers', '[]'::jsonb, 'source', 'unavailable'),
    'ticket_summary_source', 'unavailable',
    'finance', v_finance,
    'finance_access', 'granted',
    'data_health', '[]'::jsonb,
    'data_health_access', 'granted',
    'permissions', jsonb_build_object('can_manage', true, 'finance_access', true, 'full_access', v_is_owner OR v_is_admin),
    'lifecycle', jsonb_build_object('status', v_edition.status, 'start_at', v_edition.start_at, 'end_at', v_edition.end_at, 'currency_code', v_edition.currency_code)
  );
END $$;
REVOKE ALL ON FUNCTION public.festival_edition_operations_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
