-- Weekly player-owned company finances, staff performance, and recruitment lifecycle.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  ADD COLUMN IF NOT EXISTS performance_score integer NOT NULL DEFAULT 50 CHECK (performance_score >= 0 AND performance_score <= 100),
  ADD COLUMN IF NOT EXISTS recent_unpaid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_warning_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_weekly_finance_at timestamptz;

ALTER TABLE public.company_type_definitions
  ADD COLUMN IF NOT EXISTS base_weekly_revenue numeric NOT NULL DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS weekly_revenue_cap numeric NOT NULL DEFAULT 75000,
  ADD COLUMN IF NOT EXISTS weekly_property_cost numeric NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS weekly_utilities_cost numeric NOT NULL DEFAULT 700,
  ADD COLUMN IF NOT EXISTS weekly_maintenance_cost numeric NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS weekly_marketing_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_other_cost numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS real_player_bonus_multiplier numeric NOT NULL DEFAULT 1.45,
  ADD COLUMN IF NOT EXISTS npc_bonus_multiplier numeric NOT NULL DEFAULT 0.90,
  ADD COLUMN IF NOT EXISTS staff_contribution_cap numeric NOT NULL DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS diminishing_return_factor numeric NOT NULL DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS financial_grace_weeks integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS random_variation_min numeric NOT NULL DEFAULT 0.95,
  ADD COLUMN IF NOT EXISTS random_variation_max numeric NOT NULL DEFAULT 1.05;

ALTER TABLE public.company_employees
  DROP CONSTRAINT IF EXISTS company_employees_company_id_profile_id_key;

ALTER TABLE public.company_employees
  ADD COLUMN IF NOT EXISTS employee_type text NOT NULL DEFAULT 'player' CHECK (employee_type IN ('npc','player')),
  ADD COLUMN IF NOT EXISTS staff_category text NOT NULL DEFAULT 'specialist' CHECK (staff_category IN ('manager','assistant_manager','customer_service','sales','marketing','finance','security','technician','cleaner','specialist')),
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS required_skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS weekly_wage numeric NOT NULL DEFAULT 0 CHECK (weekly_wage >= 0),
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent','contract','temporary')),
  ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'employed' CHECK (contract_status IN ('application_submitted','application_withdrawn','application_rejected','offer_made','offer_declined','employed','resigned','dismissed','contract_completed','suspended_unpaid')),
  ADD COLUMN IF NOT EXISTS skill_rating integer NOT NULL DEFAULT 50 CHECK (skill_rating >= 0 AND skill_rating <= 100),
  ADD COLUMN IF NOT EXISTS activity_rating integer NOT NULL DEFAULT 50 CHECK (activity_rating >= 0 AND activity_rating <= 100),
  ADD COLUMN IF NOT EXISTS suitability_rating integer NOT NULL DEFAULT 50 CHECK (suitability_rating >= 0 AND suitability_rating <= 100),
  ADD COLUMN IF NOT EXISTS performance_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacity_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_service_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_paid_week_start date,
  ADD COLUMN IF NOT EXISTS unpaid_wages numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.company_weekly_finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  gross_revenue numeric NOT NULL DEFAULT 0,
  staff_wage_costs numeric NOT NULL DEFAULT 0,
  property_costs numeric NOT NULL DEFAULT 0,
  utilities numeric NOT NULL DEFAULT 0,
  maintenance numeric NOT NULL DEFAULT 0,
  marketing_costs numeric NOT NULL DEFAULT 0,
  other_costs numeric NOT NULL DEFAULT 0,
  total_costs numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  balance_before numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  unpaid_amount numeric NOT NULL DEFAULT 0,
  performance_modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processed','processed_with_unpaid_costs','failed')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_company_weekly_finance_company_week ON public.company_weekly_finance_records(company_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_company_weekly_finance_status ON public.company_weekly_finance_records(processing_status, week_start);

CREATE TABLE IF NOT EXISTS public.company_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_title text NOT NULL,
  staff_category text NOT NULL CHECK (staff_category IN ('manager','assistant_manager','customer_service','sales','marketing','finance','security','technician','cleaner','specialist')),
  description text,
  positions_available integer NOT NULL DEFAULT 1 CHECK (positions_available > 0),
  positions_filled integer NOT NULL DEFAULT 0 CHECK (positions_filled >= 0),
  required_skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimum_skill_levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  weekly_wage numeric NOT NULL CHECK (weekly_wage >= 0),
  contract_duration_weeks integer,
  is_permanent boolean NOT NULL DEFAULT true,
  working_expectations text,
  location_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  closes_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','filled','cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.company_vacancies(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  suitability_score integer NOT NULL DEFAULT 0 CHECK (suitability_score >= 0 AND suitability_score <= 100),
  status text NOT NULL DEFAULT 'application_submitted' CHECK (status IN ('application_submitted','application_withdrawn','application_rejected','offer_made','offer_declined','employed','resigned','dismissed','contract_completed','suspended_unpaid')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decided_at timestamptz,
  employment_id uuid REFERENCES public.company_employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_job_applications_one_open_idx
  ON public.company_job_applications(vacancy_id, applicant_profile_id)
  WHERE status IN ('application_submitted','offer_made');
CREATE INDEX IF NOT EXISTS idx_company_vacancies_open ON public.company_vacancies(status, location_city_id, weekly_wage DESC);
CREATE INDEX IF NOT EXISTS idx_company_applications_company_status ON public.company_job_applications(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_applications_applicant ON public.company_job_applications(applicant_profile_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_employees_one_active_player_company_idx
  ON public.company_employees(company_id, profile_id)
  WHERE status = 'active' AND contract_status IN ('employed','suspended_unpaid');

ALTER TABLE public.company_weekly_finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners view weekly finances" ON public.company_weekly_finance_records FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

CREATE POLICY "Anyone can browse open company vacancies" ON public.company_vacancies FOR SELECT TO authenticated USING (status = 'open' OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "Company owners manage vacancies" ON public.company_vacancies FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()) AND weekly_wage >= 0);

CREATE POLICY "Applicants and owners view applications" ON public.company_job_applications FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = applicant_profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
CREATE POLICY "Players apply to open company vacancies" ON public.company_job_applications FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = applicant_profile_id AND p.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.company_vacancies v WHERE v.id = vacancy_id AND v.status = 'open' AND v.positions_filled < v.positions_available)
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
CREATE POLICY "Applicants withdraw applications" ON public.company_job_applications FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = applicant_profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.process_company_weekly_finances(p_week_start date DEFAULT date_trunc('week', timezone('utc', now()))::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_row record;
  cfg record;
  week_end date := p_week_start + 6;
  wage_cost numeric;
  revenue numeric;
  total_cost numeric;
  net numeric;
  before_balance numeric;
  after_balance numeric;
  unpaid numeric;
  modifier jsonb;
  processed_count integer := 0;
BEGIN
  FOR company_row IN SELECT * FROM public.companies WHERE status = 'active' AND is_bankrupt = false LOOP
    INSERT INTO public.company_weekly_finance_records(company_id, week_start, week_end, processing_status)
    VALUES (company_row.id, p_week_start, week_end, 'pending')
    ON CONFLICT (company_id, week_start) DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT * INTO cfg FROM public.company_type_definitions WHERE type_key = company_row.company_type;
    SELECT COALESCE(SUM(COALESCE(weekly_wage, salary, 0)), 0) INTO wage_cost
    FROM public.company_employees
    WHERE company_id = company_row.id AND status = 'active' AND contract_status = 'employed';

    modifier := jsonb_build_object(
      'qualityModifier', GREATEST(0.25, LEAST(1.5, company_row.quality_score / 100.0)),
      'reputationModifier', GREATEST(0.75, LEAST(1.35, 1 + company_row.reputation_score / 400.0)),
      'staffMultiplier', public.apply_player_staff_bonus(company_row.id),
      'financialHealthPenalty', GREATEST(0, LEAST(0.35, company_row.recent_unpaid_amount / GREATEST(COALESCE(cfg.base_weekly_revenue, 12000), 1) * 0.08)),
      'randomVariation', (COALESCE(cfg.random_variation_min, 0.95) + COALESCE(cfg.random_variation_max, 1.05)) / 2
    );

    revenue := ROUND(LEAST(COALESCE(cfg.weekly_revenue_cap, 75000), COALESCE(cfg.base_weekly_revenue, 12000) * (modifier->>'qualityModifier')::numeric * (modifier->>'reputationModifier')::numeric * (modifier->>'staffMultiplier')::numeric * (1 - (modifier->>'financialHealthPenalty')::numeric) * (modifier->>'randomVariation')::numeric));
    total_cost := wage_cost + COALESCE(cfg.weekly_property_cost, 2500) + COALESCE(cfg.weekly_utilities_cost, 700) + COALESCE(cfg.weekly_maintenance_cost, 1000) + COALESCE(cfg.weekly_marketing_cost, 0) + COALESCE(cfg.weekly_other_cost, 500) + COALESCE(company_row.weekly_operating_costs, 0);
    net := revenue - total_cost;
    before_balance := company_row.balance;
    after_balance := GREATEST(0, before_balance + net);
    unpaid := GREATEST(0, -(before_balance + net));

    UPDATE public.companies SET
      balance = after_balance,
      recent_unpaid_amount = unpaid,
      financial_warning_count = CASE WHEN unpaid > 0 THEN financial_warning_count + 1 ELSE 0 END,
      performance_score = GREATEST(0, LEAST(100, performance_score + CASE WHEN unpaid > 0 THEN -5 WHEN net > 0 THEN 1 ELSE -1 END)),
      last_weekly_finance_at = timezone('utc', now())
    WHERE id = company_row.id;

    IF unpaid = 0 THEN
      UPDATE public.profiles p
      SET cash = COALESCE(p.cash, 0) + paid.weekly_wage
      FROM (
        SELECT profile_id, COALESCE(weekly_wage, salary, 0) AS weekly_wage
        FROM public.company_employees
        WHERE company_id = company_row.id AND status = 'active' AND contract_status = 'employed' AND employee_type = 'player' AND profile_id IS NOT NULL
      ) paid
      WHERE p.id = paid.profile_id;

      INSERT INTO public.company_transactions(company_id, transaction_type, amount, description, related_entity_type)
      SELECT company_row.id, 'salary', -COALESCE(weekly_wage, salary, 0), 'Weekly wage paid for ' || p_week_start::text, 'company_employee'
      FROM public.company_employees
      WHERE company_id = company_row.id AND status = 'active' AND contract_status = 'employed' AND COALESCE(weekly_wage, salary, 0) > 0;
    END IF;

    UPDATE public.company_employees SET
      last_paid_week_start = CASE WHEN unpaid = 0 THEN p_week_start ELSE last_paid_week_start END,
      unpaid_wages = CASE WHEN unpaid = 0 THEN 0 ELSE unpaid_wages + COALESCE(weekly_wage, salary, 0) END,
      contract_status = CASE WHEN unpaid > 0 AND employee_type = 'player' THEN 'suspended_unpaid' ELSE contract_status END
    WHERE company_id = company_row.id AND status = 'active' AND contract_status = 'employed';

    INSERT INTO public.company_transactions(company_id, transaction_type, amount, description, related_entity_type)
    VALUES (company_row.id, CASE WHEN net >= 0 THEN 'income' ELSE 'expense' END, net, 'Weekly company finance run ' || p_week_start::text, 'company_weekly_finance_record');

    UPDATE public.company_weekly_finance_records SET
      gross_revenue = revenue, staff_wage_costs = wage_cost, property_costs = COALESCE(cfg.weekly_property_cost, 2500), utilities = COALESCE(cfg.weekly_utilities_cost, 700), maintenance = COALESCE(cfg.weekly_maintenance_cost, 1000), marketing_costs = COALESCE(cfg.weekly_marketing_cost, 0), other_costs = COALESCE(cfg.weekly_other_cost, 500) + COALESCE(company_row.weekly_operating_costs, 0), total_costs = total_cost, net_profit = net, balance_before = before_balance, balance_after = after_balance, unpaid_amount = unpaid, performance_modifiers = modifier, processing_status = CASE WHEN unpaid > 0 THEN 'processed_with_unpaid_costs' ELSE 'processed' END, processed_at = timezone('utc', now())
    WHERE company_id = company_row.id AND week_start = p_week_start;
    processed_count := processed_count + 1;
  END LOOP;
  RETURN processed_count;
END;
$$;

COMMENT ON FUNCTION public.process_company_weekly_finances(date) IS 'Idempotent weekly company finance processor. Duplicate company/week runs are blocked by company_weekly_finance_records unique constraint.';
