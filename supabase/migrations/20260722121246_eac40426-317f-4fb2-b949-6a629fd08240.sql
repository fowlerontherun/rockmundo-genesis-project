
-- ============================================================
-- Hire staff: accept text candidate id (crew_catalog.id is text)
-- and pull name/skill/wage from the crew catalog when available.
-- ============================================================
DROP FUNCTION IF EXISTS public.hire_festival_edition_staff(uuid, uuid, text, bigint, jsonb, timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION public.hire_festival_edition_staff(
  p_edition_id uuid,
  p_candidate_id text,
  p_role text,
  p_wage_cents bigint,
  p_assignment_scope jsonb DEFAULT '{}'::jsonb,
  p_shift_start_at timestamptz DEFAULT NULL,
  p_shift_end_at timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_festival_id uuid;
  v_staff public.festival_staff%ROWTYPE;
  v_crew public.crew_catalog%ROWTYPE;
  v_name text;
  v_skill int;
  v_wage bigint;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED';
  END IF;
  SELECT festival_id INTO v_festival_id FROM public.festival_editions WHERE id = p_edition_id;

  SELECT * INTO v_crew FROM public.crew_catalog WHERE id = p_candidate_id;
  v_name := COALESCE(v_crew.name, 'Candidate ' || COALESCE(substr(p_candidate_id, 1, 8), 'staff'));
  v_skill := COALESCE(v_crew.skill, 50);
  v_wage := GREATEST(COALESCE(NULLIF(p_wage_cents, 0), v_crew.salary * 100, 200000), 0);

  INSERT INTO public.festival_staff(festival_id, edition_id, role, name, skill_level, weekly_wage_cents, morale, hired_at, metadata)
  VALUES (v_festival_id, p_edition_id, p_role, v_name, v_skill, v_wage, 60, now(),
    jsonb_build_object(
      'candidateId', p_candidate_id,
      'assignmentScope', COALESCE(p_assignment_scope, '{}'::jsonb),
      'shiftStartAt', p_shift_start_at,
      'shiftEndAt', p_shift_end_at,
      'idempotencyKey', p_idempotency_key
    ))
  RETURNING * INTO v_staff;

  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(),
      CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END,
      v_festival_id, p_edition_id, 'hire_staff', 'staff', v_staff.id, to_jsonb(v_staff), p_idempotency_key);
  RETURN to_jsonb(v_staff);
END;
$$;
GRANT EXECUTE ON FUNCTION public.hire_festival_edition_staff(uuid, text, text, bigint, jsonb, timestamptz, timestamptz, text) TO authenticated, service_role;

-- ============================================================
-- Apply for permit: idempotent per (edition_id, permit_type)
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_for_festival_edition_permit(
  p_edition_id uuid,
  p_requirement_code text,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_festival_id uuid;
  v_city_id uuid;
  v_permit public.festival_permits%ROWTYPE;
  v_fee bigint;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED';
  END IF;
  SELECT festival_id, city_id INTO v_festival_id, v_city_id FROM public.festival_editions WHERE id = p_edition_id;

  v_fee := CASE lower(p_requirement_code)
    WHEN 'public_event_licence' THEN 250000
    WHEN 'alcohol_licence' THEN 180000
    WHEN 'noise_permit' THEN 90000
    WHEN 'fire_safety_certificate' THEN 120000
    WHEN 'medical_cover_permit' THEN 150000
    WHEN 'security_plan_approval' THEN 100000
    WHEN 'road_closure_order' THEN 200000
    ELSE 50000
  END;

  SELECT * INTO v_permit FROM public.festival_permits
    WHERE edition_id = p_edition_id AND permit_type = p_requirement_code
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.festival_permits
       SET status = 'pending', permit_fee_cents = v_fee, updated_at = now()
     WHERE id = v_permit.id
     RETURNING * INTO v_permit;
  ELSE
    INSERT INTO public.festival_permits(festival_id, edition_id, city_id, permit_type, status, permit_fee_cents)
      VALUES (v_festival_id, p_edition_id, v_city_id, p_requirement_code, 'pending', v_fee)
      RETURNING * INTO v_permit;
  END IF;

  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(),
      CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END,
      v_festival_id, p_edition_id, 'apply_permit', 'permit', v_permit.id, to_jsonb(v_permit), p_idempotency_key);
  RETURN to_jsonb(v_permit);
END;
$$;

-- ============================================================
-- Purchase insurance: derive premium/ceiling from coverage_type
-- when the caller doesn't have a real quote row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_festival_edition_insurance(
  p_quote_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_edition_id uuid DEFAULT NULL,
  p_coverage_type text DEFAULT 'standard',
  p_premium_cents bigint DEFAULT NULL,
  p_payout_ceiling_cents bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_policy public.festival_insurance_policies%ROWTYPE;
  v_quote jsonb;
  v_existing public.festival_insurance_policies%ROWTYPE;
BEGIN
  IF p_edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: edition_id required'; END IF;
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;

  IF COALESCE(p_premium_cents, 0) = 0 THEN
    v_quote := public.quote_festival_edition_insurance(p_edition_id, 'RockMundo Mutual', p_coverage_type);
    p_premium_cents := (v_quote->>'premiumCents')::bigint;
    p_payout_ceiling_cents := (v_quote->>'payoutCeilingCents')::bigint;
  END IF;

  -- Deactivate any prior active policy of the same coverage type
  UPDATE public.festival_insurance_policies
     SET active = false, updated_at = now()
   WHERE edition_id = p_edition_id AND coverage_type = p_coverage_type AND active = true;

  INSERT INTO public.festival_insurance_policies(festival_id, edition_id, coverage_type, premium_cents, payout_ceiling_cents, weather_rider, active, effective_from, effective_to)
  VALUES (v_edition.festival_id, v_edition.id, p_coverage_type, p_premium_cents, p_payout_ceiling_cents,
    p_coverage_type IN ('standard','premium'), true,
    COALESCE((v_edition.start_at AT TIME ZONE COALESCE(v_edition.timezone,'UTC'))::date, CURRENT_DATE),
    COALESCE((v_edition.end_at AT TIME ZONE COALESCE(v_edition.timezone,'UTC'))::date + 1, CURRENT_DATE + 1))
  RETURNING * INTO v_policy;

  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(),
      CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END,
      v_edition.festival_id, p_edition_id, 'purchase_insurance', 'insurance', v_policy.id, to_jsonb(v_policy), p_idempotency_key);
  RETURN to_jsonb(v_policy);
END;
$$;

-- ============================================================
-- Finance summary: expand fields to match the UI's expectations
-- ============================================================
CREATE OR REPLACE FUNCTION public.festival_edition_finance_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_committed bigint := 0;
  v_paid bigint := 0;
  v_forecast_income bigint := 0;
  v_received_income bigint := 0;
  v_overdue bigint := 0;
  v_staff_wages bigint := 0;
  v_permit_fees bigint := 0;
  v_insurance_premiums bigint := 0;
  v_ledger jsonb := '[]'::jsonb;
  v_cost_cats jsonb := '[]'::jsonb;
  v_income_cats jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(sum(weekly_wage_cents),0) INTO v_staff_wages
    FROM public.festival_staff WHERE edition_id = p_edition_id AND terminated_at IS NULL;
  SELECT COALESCE(sum(permit_fee_cents),0) INTO v_permit_fees
    FROM public.festival_permits WHERE edition_id = p_edition_id;
  SELECT COALESCE(sum(premium_cents),0) INTO v_insurance_premiums
    FROM public.festival_insurance_policies WHERE edition_id = p_edition_id AND active = true;

  v_committed := v_staff_wages + v_permit_fees + v_insurance_premiums;
  v_forecast_income := COALESCE(v_edition.expected_attendance, 0) * COALESCE(v_edition.minimum_ticket_price_cents, 0);

  v_cost_cats := jsonb_build_array(
    jsonb_build_object('category','staff','committed_cents', v_staff_wages),
    jsonb_build_object('category','permits','committed_cents', v_permit_fees),
    jsonb_build_object('category','insurance','committed_cents', v_insurance_premiums),
    jsonb_build_object('category','performers','committed_cents', 0),
    jsonb_build_object('category','stages','committed_cents', 0),
    jsonb_build_object('category','marketing','committed_cents', 0),
    jsonb_build_object('category','security','committed_cents', 0),
    jsonb_build_object('category','medical','committed_cents', 0),
    jsonb_build_object('category','sanitation','committed_cents', 0),
    jsonb_build_object('category','utilities','committed_cents', 0),
    jsonb_build_object('category','transport','committed_cents', 0)
  );
  v_income_cats := jsonb_build_array(
    jsonb_build_object('category','tickets','forecast_cents', v_forecast_income),
    jsonb_build_object('category','sponsorship','forecast_cents', 0),
    jsonb_build_object('category','concessions','forecast_cents', 0),
    jsonb_build_object('category','merch','forecast_cents', 0),
    jsonb_build_object('category','other','forecast_cents', 0)
  );

  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'date', l.posted_at,
      'category', l.category,
      'description', l.description,
      'direction', l.direction,
      'status', 'posted',
      'due_date', NULL,
      'amount_cents', l.amount_cents
    ) ORDER BY l.posted_at DESC), '[]'::jsonb)
    INTO v_ledger
    FROM public.festival_expense_ledger l WHERE l.edition_id = p_edition_id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN v_ledger := '[]'::jsonb; END;

  RETURN jsonb_build_object(
    'edition_id', p_edition_id,
    'currency_code', v_edition.currency_code,
    'approved_budget_cents', v_edition.budget_cents,
    'budget_cents', v_edition.budget_cents,
    'treasury_allocation_cents', v_edition.treasury_allocation_cents,
    'committed_costs_cents', v_committed,
    'paid_costs_cents', v_paid,
    'forecast_income_cents', v_forecast_income,
    'received_income_cents', v_received_income,
    'forecast_profit_cents', v_forecast_income - v_committed,
    'actual_profit_cents', v_received_income - v_paid,
    'cash_requirement_cents', GREATEST(v_committed - COALESCE(v_edition.treasury_allocation_cents, v_edition.budget_cents, 0), 0),
    'overdue_cents', v_overdue,
    'expense_cents', v_committed,
    'ticket_revenue_cents', v_received_income,
    'net_cents', COALESCE(v_edition.treasury_allocation_cents, v_edition.budget_cents, 0) - v_committed,
    'cost_categories', v_cost_cats,
    'income_categories', v_income_cats,
    'ledger', v_ledger,
    'breakdown', '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- Operations summary: return real candidates, permit catalog,
-- 3 insurance quote tiers and staffing readiness.
-- ============================================================
CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_festival_name text;
  v_venue_name text;
  v_is_admin boolean;
  v_is_owner boolean;
  v_stages jsonb;
  v_slots jsonb;
  v_staff jsonb;
  v_candidates jsonb;
  v_permits jsonb;
  v_insurance jsonb;
  v_quotes jsonb;
  v_schedule jsonb;
  v_finance jsonb;
  v_staffing jsonb;
  v_cap int;
  v_days int;
  v_required text[] := ARRAY['stage_manager','production_manager','sound_engineer','lighting_engineer','security_lead','medical_lead','logistics_coordinator'];
  v_required_permits text[] := ARRAY['public_event_licence','alcohol_licence','noise_permit','fire_safety_certificate','medical_cover_permit','security_plan_approval'];
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501'; END IF;

  v_is_admin := COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false);
  v_is_owner := EXISTS (SELECT 1 FROM public.festivals f WHERE f.id = v_edition.festival_id AND f.owner_profile_id = public.current_profile_id_safe());

  SELECT f.name INTO v_festival_name FROM public.festivals f WHERE f.id = v_edition.festival_id;
  SELECT v.name INTO v_venue_name FROM public.venues v WHERE v.id = v_edition.venue_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', st.id, 'stage_name', st.stage_name, 'name', st.stage_name,
    'stage_number', st.stage_number, 'stage_type','stage',
    'capacity', st.capacity, 'genre_focus', st.genre_focus
  ) ORDER BY st.stage_number), '[]'::jsonb)
  INTO v_stages FROM public.festival_stages st WHERE st.edition_id = p_edition_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sl.id, 'stage_id', sl.stage_id, 'day_number', sl.day_number,
    'start_time', sl.start_time, 'end_time', sl.end_time,
    'slot_type', COALESCE(sl.slot_type,'performance'),
    'status', COALESCE(sl.status,'open'),
    'public_status', COALESCE(sl.public_status,'draft'),
    'slot_number', sl.slot_number,
    'changeover_minutes', sl.changeover_minutes,
    'changeover_duration_minutes', sl.changeover_minutes,
    'system_act_name', sl.npc_dj_name,
    'contract_status', CASE WHEN sl.canonical_contract_id IS NOT NULL THEN 'signed' END
  ) ORDER BY sl.day_number, sl.start_time, sl.slot_number), '[]'::jsonb)
  INTO v_slots FROM public.festival_stage_slots sl WHERE sl.edition_id = p_edition_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'role', s.role, 'name', s.name,
    'skill', s.skill_level, 'skill_level', s.skill_level,
    'reliability', s.morale,
    'status', CASE WHEN s.terminated_at IS NULL THEN 'active' ELSE 'terminated' END,
    'weekly_wage_cents', s.weekly_wage_cents,
    'wage_cents', s.weekly_wage_cents,
    'shift_start_at', (s.metadata->>'shiftStartAt'),
    'shift_end_at', (s.metadata->>'shiftEndAt'),
    'assigned_stage_name', (s.metadata->'assignmentScope'->>'area'),
    'area', (s.metadata->'assignmentScope'->>'area')
  ) ORDER BY s.role, s.name), '[]'::jsonb)
  INTO v_staff FROM public.festival_staff s WHERE s.edition_id = p_edition_id AND s.terminated_at IS NULL;

  -- Candidate browser: pull persistent crew from crew_catalog
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'role', c.role,
    'skill', c.skill,
    'reliability', c.loyalty,
    'experience', c.experience,
    'headline', c.headline,
    'city', c.city,
    'specialties', c.specialties,
    'wage_cents', c.salary * 100,
    'expected_wage_cents', c.salary * 100,
    'availability', CASE WHEN c.hired_by_band_id IS NULL THEN 'available' ELSE 'booked' END,
    'image_url', c.image_url
  ) ORDER BY c.skill DESC, c.name), '[]'::jsonb)
  INTO v_candidates
  FROM public.crew_catalog c
  WHERE c.hired_by_band_id IS NULL
  LIMIT 200;

  -- Permit requirements: merge canonical catalog with any existing applications
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', COALESCE(existing.id::text, req.code),
    'requirement_code', req.code,
    'permit_type', req.code,
    'type', req.label,
    'required', true,
    'status', COALESCE(existing.status, 'not_started'),
    'application_deadline', v_edition.start_at - INTERVAL '30 days',
    'fee_cents', COALESCE(existing.permit_fee_cents, req.fee),
    'submitted_at', existing.created_at,
    'response', NULL,
    'expires_at', existing.expires_on,
    'blocker_severity', CASE WHEN COALESCE(existing.status, 'not_started') IN ('approved','not_required') THEN 'none' ELSE 'blocker' END
  )), '[]'::jsonb)
  INTO v_permits
  FROM (VALUES
    ('public_event_licence','Public Event Licence', 250000::bigint),
    ('alcohol_licence','Alcohol Licence', 180000::bigint),
    ('noise_permit','Noise Permit', 90000::bigint),
    ('fire_safety_certificate','Fire Safety Certificate', 120000::bigint),
    ('medical_cover_permit','Medical Cover Permit', 150000::bigint),
    ('security_plan_approval','Security Plan Approval', 100000::bigint)
  ) AS req(code, label, fee)
  LEFT JOIN LATERAL (
    SELECT * FROM public.festival_permits p
    WHERE p.edition_id = p_edition_id AND p.permit_type = req.code
    ORDER BY p.created_at DESC LIMIT 1
  ) existing ON true;

  -- Existing insurance policies
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ip.id,
    'coverage_type', ip.coverage_type,
    'policy_status', CASE WHEN ip.active THEN 'active' ELSE 'inactive' END,
    'status', CASE WHEN ip.active THEN 'active' ELSE 'inactive' END,
    'active', ip.active,
    'premium_cents', ip.premium_cents,
    'coverage_ceiling_cents', ip.payout_ceiling_cents,
    'payout_ceiling_cents', ip.payout_ceiling_cents,
    'effective_from', ip.effective_from,
    'effective_to', ip.effective_to,
    'expires_at', ip.effective_to,
    'provider', 'RockMundo Mutual'
  )), '[]'::jsonb)
  INTO v_insurance FROM public.festival_insurance_policies ip WHERE ip.edition_id = p_edition_id;

  -- 3-tier quotes
  v_cap := COALESCE(v_edition.capacity, v_edition.expected_attendance, 5000);
  v_days := GREATEST(1, EXTRACT(day FROM (v_edition.end_at - v_edition.start_at))::int + 1);
  v_quotes := jsonb_build_array(
    jsonb_build_object(
      'id', 'basic', 'coverage_type','basic', 'provider','RockMundo Mutual',
      'status','quoted',
      'premium_cents', (v_cap * v_days * 80)::bigint,
      'deductible_cents', (v_cap * v_days * 80)::bigint / 10,
      'coverage_ceiling_cents', (v_cap * v_days * 80 * 10)::bigint,
      'exclusions','Weather cancellation excluded',
      'riders','None',
      'quote_expires_at', (now() + INTERVAL '48 hours')::text
    ),
    jsonb_build_object(
      'id', 'standard', 'coverage_type','standard', 'provider','RockMundo Mutual',
      'status','quoted',
      'premium_cents', (v_cap * v_days * 150)::bigint,
      'deductible_cents', (v_cap * v_days * 150)::bigint / 20,
      'coverage_ceiling_cents', (v_cap * v_days * 150 * 20)::bigint,
      'exclusions','Force majeure limited',
      'riders','Weather rider included',
      'quote_expires_at', (now() + INTERVAL '48 hours')::text
    ),
    jsonb_build_object(
      'id', 'premium', 'coverage_type','premium', 'provider','RockMundo Mutual',
      'status','quoted',
      'premium_cents', (v_cap * v_days * 300)::bigint,
      'deductible_cents', 0,
      'coverage_ceiling_cents', (v_cap * v_days * 300 * 40)::bigint,
      'exclusions','None',
      'riders','Weather, cancellation and equipment riders',
      'quote_expires_at', (now() + INTERVAL '48 hours')::text
    )
  );

  SELECT jsonb_build_object(
    'total_slots', count(*),
    'occupied_slots', count(*) FILTER (WHERE band_id IS NOT NULL OR canonical_contract_id IS NOT NULL),
    'open_slots', count(*) FILTER (WHERE band_id IS NULL AND canonical_contract_id IS NULL),
    'contracted_acts', count(*) FILTER (WHERE canonical_contract_id IS NOT NULL),
    'published_acts', count(*) FILTER (WHERE public_status = 'published'),
    'system_acts', count(*) FILTER (WHERE is_npc_dj = true)
  )
  INTO v_schedule FROM public.festival_stage_slots WHERE edition_id = p_edition_id;

  -- Staffing readiness: which required roles are missing
  v_staffing := jsonb_build_object(
    'required_roles', to_jsonb(v_required),
    'required_roles_count', array_length(v_required, 1),
    'missing_roles', COALESCE((
      SELECT to_jsonb(array_agg(r)) FROM unnest(v_required) r
      WHERE NOT EXISTS (
        SELECT 1 FROM public.festival_staff s
        WHERE s.edition_id = p_edition_id
          AND s.terminated_at IS NULL
          AND lower(s.role) LIKE '%' || replace(r,'_',' ') || '%'
      )
    ), '[]'::jsonb),
    'shift_gaps', '[]'::jsonb
  );

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
    'candidates', v_candidates,
    'staffing_readiness', v_staffing,
    'permit_requirements', v_permits,
    'insurance_policies', v_insurance,
    'insurance_quotes', v_quotes,
    'insurance_access','granted',
    'staff_wages_access','granted',
    'schedule_summary', v_schedule,
    'ticket_summary', jsonb_build_object('capacity', v_edition.capacity, 'tickets_sold', NULL, 'tiers','[]'::jsonb, 'source','unavailable'),
    'ticketing', jsonb_build_object('capacity', v_edition.capacity, 'tickets_sold', NULL, 'tiers','[]'::jsonb, 'source','unavailable'),
    'ticket_summary_source','unavailable',
    'finance', v_finance,
    'finance_access','granted',
    'data_health','[]'::jsonb,
    'data_health_access','granted',
    'permissions', jsonb_build_object(
      'can_manage', true,
      'staff', true, 'permits', true, 'insurance', true, 'finance', true,
      'finance_access', true,
      'full_access', v_is_owner OR v_is_admin
    ),
    'lifecycle', jsonb_build_object('status', v_edition.status, 'start_at', v_edition.start_at, 'end_at', v_edition.end_at, 'currency_code', v_edition.currency_code)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.festival_edition_finance_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_edition_permit(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_festival_edition_insurance(uuid, text, uuid, text, bigint, bigint) TO authenticated, service_role;
