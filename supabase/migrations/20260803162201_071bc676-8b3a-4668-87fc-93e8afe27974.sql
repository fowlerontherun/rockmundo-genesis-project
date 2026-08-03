CREATE TABLE IF NOT EXISTS public.festival_operations_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid UNIQUE NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  artist_programme_id uuid REFERENCES public.festival_artist_programmes(id) ON DELETE SET NULL,
  currency_code text NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
  staff_budget_minor bigint NOT NULL DEFAULT 0 CHECK (staff_budget_minor >= 0),
  supplier_budget_minor bigint NOT NULL DEFAULT 0 CHECK (supplier_budget_minor >= 0),
  contingency_budget_minor bigint NOT NULL DEFAULT 0 CHECK (contingency_budget_minor >= 0),
  staffing_mode text NOT NULL DEFAULT 'mixed' CHECK (staffing_mode IN ('npc_only','player_preferred','mixed')),
  procurement_mode text NOT NULL DEFAULT 'mixed' CHECK (procurement_mode IN ('npc_only','player_company_preferred','mixed')),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','requirements_generated','recruitment_open','procurement_open','contracts_in_progress','coverage_in_progress','ready_for_sponsorship')),
  planning_version integer NOT NULL DEFAULT 1 CHECK (planning_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.festival_operational_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  department_type text NOT NULL,
  name text NOT NULL,
  priority text NOT NULL DEFAULT 'standard' CHECK (priority IN ('essential','high','standard')),
  minimum_quality integer NOT NULL DEFAULT 40 CHECK (minimum_quality BETWEEN 0 AND 100),
  target_quality integer NOT NULL DEFAULT 70 CHECK (target_quality BETWEEN 0 AND 100),
  manager_profile_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','recruiting','covered','ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_operations_plan_id, department_type)
);

CREATE TABLE IF NOT EXISTS public.festival_staffing_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.festival_operational_departments(id) ON DELETE CASCADE,
  role_type text NOT NULL,
  required_count integer NOT NULL CHECK (required_count > 0),
  minimum_skill_level integer NOT NULL DEFAULT 0 CHECK (minimum_skill_level BETWEEN 0 AND 100),
  shift_length_minutes integer NOT NULL DEFAULT 480 CHECK (shift_length_minutes BETWEEN 60 AND 960),
  coverage_start timestamptz NOT NULL,
  coverage_end timestamptz NOT NULL,
  safety_critical boolean NOT NULL DEFAULT false,
  player_eligible boolean NOT NULL DEFAULT true,
  npc_eligible boolean NOT NULL DEFAULT true,
  estimated_cost_minor bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_minor >= 0),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coverage_start < coverage_end),
  UNIQUE (festival_operations_plan_id, role_type)
);

CREATE TABLE IF NOT EXISTS public.festival_staff_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  staffing_requirement_id uuid NOT NULL REFERENCES public.festival_staffing_requirements(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  employment_type text NOT NULL DEFAULT 'single_shift' CHECK (employment_type IN ('temporary_contract','single_shift','multi_day_contract','volunteer','company_assignment')),
  positions_available integer NOT NULL CHECK (positions_available > 0),
  positions_filled integer NOT NULL DEFAULT 0 CHECK (positions_filled >= 0 AND positions_filled <= positions_available),
  pay_type text NOT NULL DEFAULT 'per_shift' CHECK (pay_type IN ('hourly','per_shift','fixed_contract','unpaid_volunteer')),
  pay_minor bigint NOT NULL DEFAULT 0 CHECK (pay_minor >= 0),
  currency_code text NOT NULL DEFAULT 'USD',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  application_deadline timestamptz,
  minimum_skill_level integer,
  player_only boolean NOT NULL DEFAULT false,
  npc_fallback_allowed boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','filled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.festival_staff_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.festival_staff_vacancies(id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','shortlisted','accepted','rejected','withdrawn','expired')),
  skill_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  expected_pay_minor bigint CHECK (expected_pay_minor >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  withdrawn_at timestamptz,
  application_version integer NOT NULL DEFAULT 1 CHECK (application_version > 0),
  UNIQUE (vacancy_id, applicant_profile_id)
);

CREATE TABLE IF NOT EXISTS public.festival_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  staffing_requirement_id uuid NOT NULL REFERENCES public.festival_staffing_requirements(id) ON DELETE CASCADE,
  vacancy_id uuid REFERENCES public.festival_staff_vacancies(id) ON DELETE SET NULL,
  application_id uuid UNIQUE REFERENCES public.festival_staff_applications(id) ON DELETE SET NULL,
  assignment_source text NOT NULL CHECK (assignment_source IN ('player_application','direct_player_offer','npc_hire','company_contract','existing_employee')),
  profile_id uuid REFERENCES public.profiles(id),
  npc_staff_name text,
  company_id uuid REFERENCES public.companies(id),
  role_type text NOT NULL,
  agreed_pay_minor bigint NOT NULL DEFAULT 0 CHECK (agreed_pay_minor >= 0),
  currency_code text NOT NULL DEFAULT 'USD',
  quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('planned','committed','active','cancelled')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  assignment_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.festival_staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  staff_assignment_id uuid NOT NULL REFERENCES public.festival_staff_assignments(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.festival_operational_departments(id) ON DELETE CASCADE,
  festival_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
  location_type text,
  coverage_type text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.festival_supplier_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  requirement_type text NOT NULL,
  category text NOT NULL,
  description text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_type text NOT NULL DEFAULT 'unit',
  minimum_quality integer NOT NULL DEFAULT 40 CHECK (minimum_quality BETWEEN 0 AND 100),
  delivery_start timestamptz,
  delivery_end timestamptz,
  service_start timestamptz,
  service_end timestamptz,
  estimated_cost_minor bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_minor >= 0),
  safety_critical boolean NOT NULL DEFAULT false,
  player_company_eligible boolean NOT NULL DEFAULT true,
  npc_supplier_eligible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_operations_plan_id, requirement_type)
);

CREATE TABLE IF NOT EXISTS public.festival_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_requirement_id uuid NOT NULL REFERENCES public.festival_supplier_requirements(id) ON DELETE CASCADE,
  supplier_source text NOT NULL CHECK (supplier_source IN ('player_company','npc_supplier','admin_supplier')),
  supplier_company_id uuid REFERENCES public.companies(id),
  npc_supplier_name text,
  submitted_by_profile_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','under_review','accepted','declined','withdrawn','expired','superseded')),
  currency_code text NOT NULL DEFAULT 'USD',
  base_cost_minor bigint NOT NULL DEFAULT 0 CHECK (base_cost_minor >= 0),
  delivery_cost_minor bigint NOT NULL DEFAULT 0 CHECK (delivery_cost_minor >= 0),
  setup_cost_minor bigint NOT NULL DEFAULT 0 CHECK (setup_cost_minor >= 0),
  staffing_cost_minor bigint NOT NULL DEFAULT 0 CHECK (staffing_cost_minor >= 0),
  deposit_minor bigint NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  total_cost_minor bigint NOT NULL DEFAULT 0 CHECK (total_cost_minor >= 0),
  quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  reliability_score integer NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  delivery_terms jsonb,
  service_terms jsonb,
  expires_at timestamptz,
  quote_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_cost_minor = base_cost_minor + delivery_cost_minor + setup_cost_minor + staffing_cost_minor),
  CHECK (deposit_minor <= total_cost_minor)
);

CREATE TABLE IF NOT EXISTS public.festival_supplier_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_operations_plan_id uuid NOT NULL REFERENCES public.festival_operations_plans(id) ON DELETE CASCADE,
  supplier_requirement_id uuid NOT NULL REFERENCES public.festival_supplier_requirements(id) ON DELETE CASCADE,
  accepted_quote_id uuid UNIQUE NOT NULL REFERENCES public.festival_supplier_quotes(id) ON DELETE CASCADE,
  supplier_source text NOT NULL,
  supplier_company_id uuid REFERENCES public.companies(id),
  npc_supplier_name text,
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed','awaiting_delivery','active','completed','cancelled','supplier_defaulted','festival_cancelled')),
  currency_code text NOT NULL DEFAULT 'USD',
  total_commitment_minor bigint NOT NULL DEFAULT 0 CHECK (total_commitment_minor >= 0),
  deposit_commitment_minor bigint NOT NULL DEFAULT 0 CHECK (deposit_commitment_minor >= 0),
  quality_score integer NOT NULL DEFAULT 50,
  reliability_score integer NOT NULL DEFAULT 50,
  delivery_start timestamptz,
  delivery_end timestamptz,
  service_start timestamptz,
  service_end timestamptz,
  terms_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.festival_operations_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  target_id uuid,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (actor_profile_id, action, target_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_operations_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  previous_state text,
  new_state text,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_financial_commitments ALTER COLUMN artist_booking_id DROP NOT NULL;
ALTER TABLE public.festival_financial_commitments ADD COLUMN IF NOT EXISTS staff_assignment_id uuid UNIQUE REFERENCES public.festival_staff_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.festival_financial_commitments ADD COLUMN IF NOT EXISTS supplier_contract_id uuid UNIQUE REFERENCES public.festival_supplier_contracts(id) ON DELETE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['festival_operations_plans','festival_operational_departments','festival_staffing_requirements','festival_staff_vacancies','festival_staff_applications','festival_staff_assignments','festival_staff_shifts','festival_supplier_requirements','festival_supplier_quotes','festival_supplier_contracts','festival_operations_requests','festival_operations_audit']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._festival_operations_result(p_company uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.festival_operations_plans;
  v_required integer := 0;
  v_assigned integer := 0;
  v_supplier_required integer := 0;
  v_supplier_contracted integer := 0;
  v_staff_commit bigint := 0;
  v_supplier_commit bigint := 0;
  v_artist_commit bigint := 0;
  v_staff_bp integer := 0;
  v_supplier_bp integer := 0;
  v_can_write boolean;
BEGIN
  v_can_write := public._festival_artist_manager(p_company, public.current_profile_id());
  SELECT * INTO v_plan FROM public.festival_operations_plans WHERE festival_company_id = p_company;

  IF v_plan.id IS NOT NULL THEN
    SELECT COALESCE(sum(required_count), 0) INTO v_required FROM public.festival_staffing_requirements WHERE festival_operations_plan_id = v_plan.id;
    SELECT count(*) INTO v_assigned FROM public.festival_staff_assignments WHERE festival_operations_plan_id = v_plan.id AND status <> 'cancelled';
    SELECT count(*) INTO v_supplier_required FROM public.festival_supplier_requirements WHERE festival_operations_plan_id = v_plan.id;
    SELECT count(DISTINCT supplier_requirement_id) INTO v_supplier_contracted FROM public.festival_supplier_contracts WHERE festival_operations_plan_id = v_plan.id AND status NOT IN ('cancelled','festival_cancelled','supplier_defaulted');
    SELECT COALESCE(sum(agreed_pay_minor), 0) INTO v_staff_commit FROM public.festival_staff_assignments WHERE festival_operations_plan_id = v_plan.id AND status <> 'cancelled';
    SELECT COALESCE(sum(total_commitment_minor), 0) INTO v_supplier_commit FROM public.festival_supplier_contracts WHERE festival_operations_plan_id = v_plan.id AND status NOT IN ('cancelled','festival_cancelled');
    v_staff_bp := CASE WHEN v_required = 0 THEN 0 ELSE LEAST(10000, (v_assigned * 10000) / v_required) END;
    v_supplier_bp := CASE WHEN v_supplier_required = 0 THEN 0 ELSE LEAST(10000, (v_supplier_contracted * 10000) / v_supplier_required) END;
  END IF;

  SELECT COALESCE(sum(total_commitment_minor), 0) INTO v_artist_commit
  FROM public.festival_artist_bookings b
  JOIN public.festival_artist_programmes p ON p.id = b.festival_artist_programme_id
  WHERE p.festival_company_id = p_company AND b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled');

  RETURN jsonb_build_object(
    'festivalCompanyId', p_company,
    'operationsPlan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_plan.id,
      'currencyCode', v_plan.currency_code,
      'staffBudgetMinor', v_plan.staff_budget_minor,
      'supplierBudgetMinor', v_plan.supplier_budget_minor,
      'contingencyBudgetMinor', v_plan.contingency_budget_minor,
      'staffingMode', v_plan.staffing_mode,
      'procurementMode', v_plan.procurement_mode,
      'status', v_plan.status,
      'planningVersion', v_plan.planning_version) END,
    'departments', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at) FROM public.festival_operational_departments d WHERE d.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'staffingRequirements', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.festival_staffing_requirements r WHERE r.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'vacancies', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at) FROM public.festival_staff_vacancies v WHERE v.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'applications', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.submitted_at) FROM public.festival_staff_applications a JOIN public.festival_staff_vacancies v ON v.id = a.vacancy_id WHERE v.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'assignments', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_staff_assignments a WHERE a.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'shifts', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.starts_at) FROM public.festival_staff_shifts s WHERE s.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'supplierRequirements', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.festival_supplier_requirements r WHERE r.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'quotes', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at) FROM public.festival_supplier_quotes q JOIN public.festival_supplier_requirements r ON r.id = q.supplier_requirement_id WHERE r.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'contracts', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM public.festival_supplier_contracts c WHERE c.festival_operations_plan_id = v_plan.id), '[]'::jsonb),
    'budgetSummary', jsonb_build_object(
      'staffBudgetMinor', COALESCE(v_plan.staff_budget_minor, 0),
      'supplierBudgetMinor', COALESCE(v_plan.supplier_budget_minor, 0),
      'contingencyMinor', COALESCE(v_plan.contingency_budget_minor, 0),
      'staffCommitmentsMinor', v_staff_commit,
      'supplierCommitmentsMinor', v_supplier_commit,
      'artistCommitmentsMinor', v_artist_commit),
    'qualityScores', jsonb_build_object(
      'staffingCoverageBasisPoints', v_staff_bp,
      'supplierCoverageBasisPoints', v_supplier_bp,
      'safetyReadinessScore', (v_staff_bp / 100),
      'productionReadinessScore', (v_supplier_bp / 100),
      'guestExperienceScore', ((v_staff_bp + v_supplier_bp) / 200),
      'artistExperienceScore', ((v_staff_bp + v_supplier_bp) / 200),
      'overallOperationsScore', ((v_staff_bp + v_supplier_bp) / 200)),
    'issues', '[]'::jsonb,
    'readiness', COALESCE(v_staff_bp >= 8000 AND v_supplier_bp >= 8000, false),
    'canWrite', COALESCE(v_can_write, false),
    'planningVersion', COALESCE(v_plan.planning_version, 0),
    'updatedAt', v_plan.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_operations_plan(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid := public.current_profile_id();
BEGIN
  IF v_profile IS NULL OR NOT public._festival_artist_manager(p_festival_company_id, v_profile) THEN
    RAISE EXCEPTION 'festival_operations_forbidden';
  END IF;
  RETURN public._festival_operations_result(p_festival_company_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_festival_operations_plan(
  p_festival_company_id uuid,
  p_expected_version integer,
  p_plan jsonb,
  p_idempotency_key uuid,
  p_complete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_programme uuid;
  v_currency text;
  v_plan public.festival_operations_plans;
  v_hash text := md5(coalesce(p_plan::text, '') || coalesce(p_complete::text, 'false'));
  v_existing public.festival_operations_requests;
  v_dept uuid;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF v_profile IS NULL OR NOT public._festival_artist_manager(p_festival_company_id, v_profile) THEN
    RAISE EXCEPTION 'festival_operations_forbidden';
  END IF;

  SELECT id, currency_code INTO v_programme, v_currency
  FROM public.festival_artist_programmes WHERE festival_company_id = p_festival_company_id;
  IF v_programme IS NULL THEN
    RAISE EXCEPTION 'festival_operations_prerequisite_incomplete';
  END IF;

  SELECT * INTO v_existing FROM public.festival_operations_requests
  WHERE actor_profile_id = v_profile AND action = 'save_operations_plan'
    AND target_id = p_festival_company_id AND idempotency_key = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.payload_hash <> v_hash THEN RAISE EXCEPTION 'festival_operations_idempotency_conflict'; END IF;
    RETURN public._festival_operations_result(p_festival_company_id);
  END IF;

  SELECT * INTO v_plan FROM public.festival_operations_plans WHERE festival_company_id = p_festival_company_id FOR UPDATE;

  IF v_plan.id IS NULL THEN
    IF COALESCE(p_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'festival_operations_plan_stale'; END IF;
    INSERT INTO public.festival_operations_plans (
      festival_company_id, artist_programme_id, currency_code,
      staff_budget_minor, supplier_budget_minor, contingency_budget_minor,
      staffing_mode, procurement_mode, status)
    VALUES (
      p_festival_company_id, v_programme, COALESCE(v_currency, 'USD'),
      GREATEST(COALESCE((p_plan->>'staffBudgetMinor')::bigint, 0), 0),
      GREATEST(COALESCE((p_plan->>'supplierBudgetMinor')::bigint, 0), 0),
      GREATEST(COALESCE((p_plan->>'contingencyBudgetMinor')::bigint, 0), 0),
      COALESCE(p_plan->>'staffingMode', 'mixed'),
      COALESCE(p_plan->>'procurementMode', 'mixed'),
      'requirements_generated')
    RETURNING * INTO v_plan;
  ELSE
    IF v_plan.planning_version <> COALESCE(p_expected_version, -1) THEN RAISE EXCEPTION 'festival_operations_plan_stale'; END IF;
    UPDATE public.festival_operations_plans SET
      staff_budget_minor = GREATEST(COALESCE((p_plan->>'staffBudgetMinor')::bigint, staff_budget_minor), 0),
      supplier_budget_minor = GREATEST(COALESCE((p_plan->>'supplierBudgetMinor')::bigint, supplier_budget_minor), 0),
      contingency_budget_minor = GREATEST(COALESCE((p_plan->>'contingencyBudgetMinor')::bigint, contingency_budget_minor), 0),
      staffing_mode = COALESCE(p_plan->>'staffingMode', staffing_mode),
      procurement_mode = COALESCE(p_plan->>'procurementMode', procurement_mode),
      status = CASE WHEN p_complete THEN 'ready_for_sponsorship' ELSE status END,
      completed_at = CASE WHEN p_complete THEN now() ELSE completed_at END,
      planning_version = planning_version + 1,
      updated_at = now()
    WHERE id = v_plan.id RETURNING * INTO v_plan;
  END IF;

  SELECT COALESCE(sp.service_start, cfg.planned_start_date::timestamptz), COALESCE(sp.service_end, cfg.planned_end_date::timestamptz + interval '1 day')
  INTO v_start, v_end
  FROM public.festival_configurations cfg
  LEFT JOIN (SELECT festival_company_id, NULL::timestamptz AS service_start, NULL::timestamptz AS service_end) sp ON sp.festival_company_id = cfg.festival_company_id
  WHERE cfg.festival_company_id = p_festival_company_id;
  v_start := COALESCE(v_start, now() + interval '30 days');
  v_end := COALESCE(v_end, v_start + interval '3 days');

  IF NOT EXISTS (SELECT 1 FROM public.festival_operational_departments WHERE festival_operations_plan_id = v_plan.id) THEN
    INSERT INTO public.festival_operational_departments (festival_operations_plan_id, department_type, name, priority, minimum_quality, target_quality)
    VALUES
      (v_plan.id, 'security', 'Security and crowd safety', 'essential', 60, 85),
      (v_plan.id, 'medical', 'Medical and welfare', 'essential', 60, 85),
      (v_plan.id, 'production', 'Stage and production crew', 'high', 50, 80),
      (v_plan.id, 'site', 'Site build and cleaning', 'high', 40, 70),
      (v_plan.id, 'bars', 'Bars and beverage', 'standard', 40, 70),
      (v_plan.id, 'food', 'Food and traders', 'standard', 40, 70);

    FOR v_dept IN SELECT id FROM public.festival_operational_departments WHERE festival_operations_plan_id = v_plan.id LOOP
      INSERT INTO public.festival_staffing_requirements (
        festival_operations_plan_id, department_id, role_type, required_count,
        minimum_skill_level, coverage_start, coverage_end, safety_critical, estimated_cost_minor)
      SELECT v_plan.id, d.id, d.department_type || '_crew',
        CASE d.priority WHEN 'essential' THEN 12 WHEN 'high' THEN 8 ELSE 5 END,
        d.minimum_quality, v_start, v_end,
        d.priority = 'essential',
        CASE d.priority WHEN 'essential' THEN 1200000 WHEN 'high' THEN 800000 ELSE 500000 END
      FROM public.festival_operational_departments d WHERE d.id = v_dept
      ON CONFLICT (festival_operations_plan_id, role_type) DO NOTHING;
    END LOOP;

    INSERT INTO public.festival_supplier_requirements (
      festival_operations_plan_id, requirement_type, category, quantity, unit_type,
      minimum_quality, service_start, service_end, estimated_cost_minor, safety_critical)
    VALUES
      (v_plan.id, 'sanitation', 'facilities', 40, 'unit', 50, v_start, v_end, 900000, false),
      (v_plan.id, 'fencing', 'site', 1500, 'metre', 50, v_start, v_end, 1200000, true),
      (v_plan.id, 'power', 'technical', 6, 'generator', 60, v_start, v_end, 2200000, true),
      (v_plan.id, 'waste', 'facilities', 30, 'unit', 40, v_start, v_end, 600000, false),
      (v_plan.id, 'water', 'facilities', 20, 'point', 60, v_start, v_end, 500000, true)
    ON CONFLICT (festival_operations_plan_id, requirement_type) DO NOTHING;
  END IF;

  INSERT INTO public.festival_operations_requests (
    festival_company_id, actor_profile_id, action, target_id, idempotency_key, payload_hash, status, completed_at)
  VALUES (p_festival_company_id, v_profile, 'save_operations_plan', p_festival_company_id, p_idempotency_key, v_hash, 'succeeded', now());

  INSERT INTO public.festival_operations_audit (
    festival_company_id, actor_profile_id, entity_type, entity_id, event_type, new_state, version)
  VALUES (p_festival_company_id, v_profile, 'operations_plan', v_plan.id,
    CASE WHEN p_complete THEN 'operations_plan_completed' ELSE 'operations_plan_saved' END,
    v_plan.status, v_plan.planning_version);

  RETURN public._festival_operations_result(p_festival_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_festival_operations_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_operations_plan(uuid, integer, jsonb, uuid, boolean) TO authenticated;