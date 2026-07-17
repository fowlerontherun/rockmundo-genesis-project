-- Finance Phase 3: company operating accounts, employment contracts, payroll and performance.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'product_sale';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'service_sale';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'venue_booking_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'ticket_commission';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'studio_booking_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'rehearsal_booking_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'education_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'transport_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'management_commission';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'label_commission';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'advertising_service_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'payroll';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'utilities';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'maintenance';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'licence_fee';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'professional_services';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'supplier_payment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'owner_investment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'owner_withdrawal';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'dividend';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'asset_purchase';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'asset_sale';

DO $$ BEGIN CREATE TYPE public.company_financial_health AS ENUM ('healthy','watch','cash_constrained','payroll_risk','delinquent','critical','insolvent','suspended','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.company_operating_tier AS ENUM ('micro','small','medium','large','major'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.company_employee_type AS ENUM ('npc','player'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.employment_contract_status AS ENUM ('draft','offered','accepted','active','suspended','notice_period','ended','terminated','rejected','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_advertisement_status AS ENUM ('draft','published','paused','filled','closed','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_application_status AS ENUM ('submitted','under_review','shortlisted','offered','accepted','rejected','withdrawn','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.company_payroll_status AS ENUM ('calculated','awaiting_funds','scheduled','processing','paid','partially_failed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.owner_withdrawal_status AS ENUM ('requested','approved','paid','blocked','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dividend_status AS ENUM ('draft','approved','processing','paid','blocked','cancelled','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.recurring_financial_obligations DROP CONSTRAINT IF EXISTS recurring_financial_obligations_owner_type_check;
ALTER TABLE public.recurring_financial_obligations ADD CONSTRAINT recurring_financial_obligations_owner_type_check CHECK (owner_type IN ('player','band','company'));

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS operating_tier public.company_operating_tier NOT NULL DEFAULT 'micro';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS calculated_quality_score integer NOT NULL DEFAULT 50 CHECK (calculated_quality_score BETWEEN 0 AND 100);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS operating_performance_score integer NOT NULL DEFAULT 50 CHECK (operating_performance_score BETWEEN 0 AND 100);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS financial_health public.company_financial_health NOT NULL DEFAULT 'healthy';

CREATE TABLE IF NOT EXISTS public.company_financial_profiles (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_health public.company_financial_health NOT NULL DEFAULT 'healthy', accounting_period text NOT NULL DEFAULT 'weekly', opening_balance_minor bigint NOT NULL DEFAULT 0,
  closing_balance_minor bigint NOT NULL DEFAULT 0, current_liabilities_minor bigint NOT NULL DEFAULT 0, overdue_liabilities_minor bigint NOT NULL DEFAULT 0,
  cash_reserve_target_minor bigint NOT NULL DEFAULT 0, owner_capital_minor bigint NOT NULL DEFAULT 0, retained_earnings_minor bigint NOT NULL DEFAULT 0,
  last_processed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS public.company_cost_profiles (
  company_type text PRIMARY KEY, operating_tier public.company_operating_tier NOT NULL DEFAULT 'micro', base_weekly_operating_cost_minor bigint NOT NULL DEFAULT 0,
  base_rent_minor bigint NOT NULL DEFAULT 0, utility_multiplier numeric(8,4) NOT NULL DEFAULT 1, maintenance_multiplier numeric(8,4) NOT NULL DEFAULT 1,
  minimum_staffing jsonb NOT NULL DEFAULT '{}'::jsonb, max_staff integer NOT NULL DEFAULT 3, cash_reserve_weeks integer NOT NULL DEFAULT 4,
  revenue_categories text[] NOT NULL DEFAULT ARRAY['company_revenue'], updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS public.employment_role_definitions (
  role_key text PRIMARY KEY, role_name text NOT NULL, eligible_company_types text[] NOT NULL, relevant_skills text[] NOT NULL DEFAULT '{}', required_minimum_skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_npc_effectiveness integer NOT NULL DEFAULT 45, max_npc_effectiveness integer NOT NULL DEFAULT 72, max_player_effectiveness integer NOT NULL DEFAULT 95,
  max_positions integer NOT NULL DEFAULT 1, salary_guidance_minor bigint NOT NULL DEFAULT 50000, required_weekly_activity text NOT NULL DEFAULT 'recent_activity',
  contribution_weights jsonb NOT NULL DEFAULT '{"quality":1,"revenue":0,"cost_reduction":0,"satisfaction":1}'::jsonb, permission_keys text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS public.company_employment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, employee_type public.company_employee_type NOT NULL,
  employee_profile_id uuid REFERENCES public.profiles(id), role_key text NOT NULL REFERENCES public.employment_role_definitions(role_key), salary_amount_minor bigint NOT NULL CHECK (salary_amount_minor >= 0),
  salary_frequency public.recurring_obligation_frequency NOT NULL DEFAULT 'weekly', contract_start date NOT NULL DEFAULT CURRENT_DATE, contract_end date, probation_end date,
  working_expectation text NOT NULL DEFAULT 'weekly contribution', required_weekly_activity text NOT NULL DEFAULT 'recent_activity', performance_bonus_minor bigint NOT NULL DEFAULT 0,
  commission_basis_points integer NOT NULL DEFAULT 0 CHECK (commission_basis_points BETWEEN 0 AND 10000), notice_period_days integer NOT NULL DEFAULT 7,
  status public.employment_contract_status NOT NULL DEFAULT 'draft', created_by_profile_id uuid REFERENCES public.profiles(id), accepted_at timestamptz, ended_at timestamptz,
  termination_reason text, idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT player_contract_requires_profile CHECK (employee_type='npc' OR employee_profile_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.company_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, contract_id uuid REFERENCES public.company_employment_contracts(id) ON DELETE SET NULL,
  employee_type public.company_employee_type NOT NULL, profile_id uuid REFERENCES public.profiles(id), role_key text NOT NULL REFERENCES public.employment_role_definitions(role_key), npc_display_name text,
  skill_rating integer NOT NULL DEFAULT 50 CHECK (skill_rating BETWEEN 0 AND 100), reliability integer NOT NULL DEFAULT 70 CHECK (reliability BETWEEN 0 AND 100), performance_score integer NOT NULL DEFAULT 50 CHECK (performance_score BETWEEN 0 AND 100),
  quality_contribution numeric(8,2) NOT NULL DEFAULT 0, activity_status text NOT NULL DEFAULT 'unknown', hired_at timestamptz NOT NULL DEFAULT timezone('utc', now()), last_active_at timestamptz, status text NOT NULL DEFAULT 'active', metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.company_employees ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.company_employment_contracts(id) ON DELETE SET NULL;
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS employee_type public.company_employee_type NOT NULL DEFAULT 'player';
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS role_key text REFERENCES public.employment_role_definitions(role_key);
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS npc_display_name text;
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS skill_rating integer NOT NULL DEFAULT 50 CHECK (skill_rating BETWEEN 0 AND 100);
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS reliability integer NOT NULL DEFAULT 70 CHECK (reliability BETWEEN 0 AND 100);
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS performance_score integer NOT NULL DEFAULT 50 CHECK (performance_score BETWEEN 0 AND 100);
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS quality_contribution numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS activity_status text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.company_employees ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.company_employees SET role_key = CASE role WHEN 'accountant' THEN 'accountant' WHEN 'technician' THEN 'sound_engineer' WHEN 'producer' THEN 'sound_engineer' WHEN 'promoter' THEN 'marketing_manager' WHEN 'receptionist' THEN 'customer_service' ELSE 'company_manager' END WHERE role_key IS NULL;
ALTER TABLE public.company_employees ALTER COLUMN role_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS company_active_player_employee_idx ON public.company_employees(company_id, profile_id, role_key) WHERE employee_type='player' AND status='active';

CREATE TABLE IF NOT EXISTS public.company_job_advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, role_key text NOT NULL REFERENCES public.employment_role_definitions(role_key),
  title text NOT NULL, description text NOT NULL, salary_amount_minor bigint NOT NULL CHECK (salary_amount_minor >= 0), salary_frequency public.recurring_obligation_frequency NOT NULL DEFAULT 'weekly',
  required_skills jsonb NOT NULL DEFAULT '{}'::jsonb, recommended_skills text[] NOT NULL DEFAULT '{}', expected_activity text NOT NULL DEFAULT 'recent weekly activity', number_of_positions integer NOT NULL DEFAULT 1,
  application_deadline timestamptz, start_date date, status public.job_advertisement_status NOT NULL DEFAULT 'draft', created_by_profile_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS public.company_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_advertisement_id uuid NOT NULL REFERENCES public.company_job_advertisements(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  application_note text, skills_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, reputation_snapshot integer NOT NULL DEFAULT 0, availability text, status public.job_application_status NOT NULL DEFAULT 'submitted',
  reviewed_at timestamptz, reviewer_profile_id uuid REFERENCES public.profiles(id), rejection_reason text, linked_contract_id uuid REFERENCES public.company_employment_contracts(id), submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(job_advertisement_id, profile_id)
);
CREATE TABLE IF NOT EXISTS public.company_payroll_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL,
  gross_pay_minor bigint NOT NULL DEFAULT 0, bonus_minor bigint NOT NULL DEFAULT 0, commission_minor bigint NOT NULL DEFAULT 0, deductions_minor bigint NOT NULL DEFAULT 0, tax_withholding_minor bigint NOT NULL DEFAULT 0,
  net_pay_minor bigint NOT NULL DEFAULT 0, status public.company_payroll_status NOT NULL DEFAULT 'calculated', idempotency_key text NOT NULL UNIQUE, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(company_id, period_start, period_end)
);
CREATE TABLE IF NOT EXISTS public.company_payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.company_payroll_batches(id) ON DELETE CASCADE, contract_id uuid REFERENCES public.company_employment_contracts(id), employee_id uuid REFERENCES public.company_employees(id),
  employee_profile_id uuid REFERENCES public.profiles(id), gross_pay_minor bigint NOT NULL DEFAULT 0, bonus_minor bigint NOT NULL DEFAULT 0, commission_minor bigint NOT NULL DEFAULT 0, deductions_minor bigint NOT NULL DEFAULT 0, tax_withholding_minor bigint NOT NULL DEFAULT 0,
  net_pay_minor bigint NOT NULL DEFAULT 0, status public.company_payroll_status NOT NULL DEFAULT 'calculated', transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, error_message text
);
CREATE TABLE IF NOT EXISTS public.company_wage_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, payroll_line_id uuid REFERENCES public.company_payroll_lines(id), employee_profile_id uuid REFERENCES public.profiles(id),
  amount_owed_minor bigint NOT NULL CHECK (amount_owed_minor > 0), original_due_date date NOT NULL, payment_attempts integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'outstanding', paid_transaction_id uuid REFERENCES public.financial_transactions(id), created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.company_capital_contributions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), profile_id uuid NOT NULL REFERENCES public.profiles(id), amount_minor bigint NOT NULL CHECK(amount_minor>0), transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()));
CREATE TABLE IF NOT EXISTS public.company_owner_withdrawal_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), profile_id uuid NOT NULL REFERENCES public.profiles(id), amount_minor bigint NOT NULL CHECK(amount_minor>0), status public.owner_withdrawal_status NOT NULL DEFAULT 'requested', block_reason text, transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), paid_at timestamptz);
CREATE TABLE IF NOT EXISTS public.company_dividend_declarations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id), amount_minor bigint NOT NULL CHECK(amount_minor>0), status public.dividend_status NOT NULL DEFAULT 'draft', approved_by_profile_id uuid REFERENCES public.profiles(id), idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), paid_at timestamptz);
CREATE TABLE IF NOT EXISTS public.company_dividend_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dividend_id uuid NOT NULL REFERENCES public.company_dividend_declarations(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id), amount_minor bigint NOT NULL CHECK(amount_minor>=0), ownership_basis_points integer NOT NULL DEFAULT 10000, transaction_id uuid REFERENCES public.financial_transactions(id), UNIQUE(dividend_id, profile_id));
CREATE TABLE IF NOT EXISTS public.company_weekly_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL, opening_cash_minor bigint NOT NULL DEFAULT 0, closing_cash_minor bigint NOT NULL DEFAULT 0, revenue_minor bigint NOT NULL DEFAULT 0, expenses_minor bigint NOT NULL DEFAULT 0, payroll_minor bigint NOT NULL DEFAULT 0, operating_profit_minor bigint NOT NULL DEFAULT 0, net_cash_flow_minor bigint NOT NULL DEFAULT 0, outstanding_liabilities_minor bigint NOT NULL DEFAULT 0, employee_count integer NOT NULL DEFAULT 0, open_vacancies integer NOT NULL DEFAULT 0, avg_employee_performance integer NOT NULL DEFAULT 0, quality_score integer NOT NULL DEFAULT 50, operating_performance_score integer NOT NULL DEFAULT 50, reputation_score integer NOT NULL DEFAULT 50, financial_health public.company_financial_health NOT NULL DEFAULT 'healthy', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(company_id, period_start, period_end));
CREATE TABLE IF NOT EXISTS public.company_finance_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), action text NOT NULL, company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, related_entity_type text, related_entity_id uuid, previous_value jsonb, new_value jsonb, reason text, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()));

INSERT INTO public.company_cost_profiles(company_type, base_weekly_operating_cost_minor, base_rent_minor, max_staff, revenue_categories) VALUES
('venue',150000,70000,8,ARRAY['venue_booking_revenue','ticket_commission']),('recording_studio',120000,50000,6,ARRAY['studio_booking_revenue']),('rehearsal',65000,30000,4,ARRAY['rehearsal_booking_revenue']),('factory',90000,40000,6,ARRAY['product_sale','merchandise_production_revenue']),('logistics',100000,25000,6,ARRAY['transport_revenue']),('label',80000,20000,8,ARRAY['label_commission']),('management',55000,15000,5,ARRAY['management_commission']),('security',70000,20000,5,ARRAY['service_sale']),('holding',25000,10000,3,ARRAY['company_revenue']) ON CONFLICT (company_type) DO NOTHING;
INSERT INTO public.employment_role_definitions(role_key, role_name, eligible_company_types, relevant_skills, base_npc_effectiveness, max_positions, salary_guidance_minor, contribution_weights, permission_keys) VALUES
('company_manager','Company Manager',ARRAY['venue','recording_studio','rehearsal','factory','logistics','label','management','security','holding'],ARRAY['business','leadership'],55,1,90000,'{"quality":1,"revenue":1,"cost_reduction":1,"satisfaction":1}'::jsonb,ARRAY['view_finance_summary','publish_jobs','review_applications']),
('accountant','Accountant',ARRAY['venue','recording_studio','rehearsal','factory','logistics','label','management','security','holding'],ARRAY['business'],50,1,65000,'{"quality":0,"revenue":0,"cost_reduction":1,"satisfaction":0}'::jsonb,ARRAY['view_finance_summary','view_payroll']),
('marketing_manager','Marketing Manager',ARRAY['venue','recording_studio','rehearsal','factory','logistics','label','management'],ARRAY['marketing','social'],48,2,70000,'{"quality":0,"revenue":1,"cost_reduction":0,"satisfaction":1}'::jsonb,ARRAY[]::text[]),
('sound_engineer','Sound Engineer',ARRAY['venue','recording_studio','rehearsal'],ARRAY['production','sound'],52,4,75000,'{"quality":2,"revenue":0,"cost_reduction":0,"satisfaction":1}'::jsonb,ARRAY[]::text[]),
('customer_service','Customer Service Worker',ARRAY['venue','rehearsal','factory','logistics','security'],ARRAY['social'],45,4,45000,'{"quality":0,"revenue":0,"cost_reduction":0,"satisfaction":2}'::jsonb,ARRAY[]::text[]) ON CONFLICT (role_key) DO NOTHING;

INSERT INTO public.company_financial_profiles(company_id, closing_balance_minor, cash_reserve_target_minor)
SELECT c.id, COALESCE(c.balance,0)::bigint * 100, COALESCE(cp.base_weekly_operating_cost_minor,25000)*COALESCE(cp.cash_reserve_weeks,4) FROM public.companies c LEFT JOIN public.company_cost_profiles cp ON cp.company_type=c.company_type ON CONFLICT (company_id) DO NOTHING;
INSERT INTO public.recurring_financial_obligations(owner_type, owner_id, expense_category, description, amount_minor, frequency, next_due_date, related_entity_type, related_entity_id, metadata)
SELECT 'company', c.id, 'company_operating_expense', 'Weekly operating costs for '||c.name, GREATEST(COALESCE(cp.base_weekly_operating_cost_minor,25000),1), 'weekly', CURRENT_DATE + 7, 'company', c.id, jsonb_build_object('phase','finance_phase3','cost_profile',c.company_type)
FROM public.companies c LEFT JOIN public.company_cost_profiles cp ON cp.company_type=c.company_type ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.company_finance_summary(p_company_id uuid, p_period_start date, p_period_end date)
RETURNS TABLE(category text, direction text, amount_minor bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.transaction_category::text, CASE WHEN a.id=t.destination_account_id THEN 'revenue_or_inflow' ELSE 'expense_or_outflow' END,
         COALESCE(SUM(t.net_amount_minor),0)::bigint
  FROM public.financial_transactions t JOIN public.financial_accounts a ON a.owner_type='company' AND a.owner_id=p_company_id AND (a.id=t.source_account_id OR a.id=t.destination_account_id)
  WHERE t.status='completed' AND t.created_at::date BETWEEN p_period_start AND p_period_end GROUP BY 1,2;
$$;

CREATE OR REPLACE FUNCTION public.company_record_service_revenue(p_company_id uuid, p_customer_profile_id uuid, p_amount_minor bigint, p_category public.financial_transaction_category, p_related_entity_type text, p_related_entity_id uuid, p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_category NOT IN ('company_revenue','product_sale','service_sale','venue_booking_revenue','studio_booking_revenue','rehearsal_booking_revenue','education_revenue','transport_revenue','management_commission','label_commission') THEN RAISE EXCEPTION 'unsupported company revenue category'; END IF;
  RETURN public.finance_transfer('player', p_customer_profile_id, 'company', p_company_id, p_amount_minor, p_category, 'Company service revenue', p_idempotency_key, p_related_entity_type, p_related_entity_id, p_customer_profile_id, '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.company_process_payroll(p_company_id uuid, p_period_start date, p_period_end date, p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b uuid; total bigint; available bigint; c record; line_id uuid; tx uuid;
BEGIN
  SELECT id INTO b FROM public.company_payroll_batches WHERE idempotency_key=p_idempotency_key; IF b IS NOT NULL THEN RETURN b; END IF;
  INSERT INTO public.company_payroll_batches(company_id,period_start,period_end,idempotency_key,status) VALUES(p_company_id,p_period_start,p_period_end,p_idempotency_key,'calculated') RETURNING id INTO b;
  FOR c IN SELECT ec.id contract_id, ce.id employee_id, ec.employee_profile_id, ec.salary_amount_minor + ec.performance_bonus_minor AS net_pay FROM public.company_employment_contracts ec LEFT JOIN public.company_employees ce ON ce.contract_id=ec.id WHERE ec.company_id=p_company_id AND ec.status IN ('accepted','active') LOOP
    INSERT INTO public.company_payroll_lines(batch_id,contract_id,employee_id,employee_profile_id,gross_pay_minor,bonus_minor,net_pay_minor,status,idempotency_key) VALUES(b,c.contract_id,c.employee_id,c.employee_profile_id,c.net_pay,0,c.net_pay,'calculated',p_idempotency_key||'-'||c.contract_id) RETURNING id INTO line_id;
  END LOOP;
  SELECT COALESCE(SUM(net_pay_minor),0) INTO total FROM public.company_payroll_lines WHERE batch_id=b;
  UPDATE public.company_payroll_batches SET gross_pay_minor=total, net_pay_minor=total WHERE id=b;
  SELECT available_balance_minor INTO available FROM public.financial_accounts WHERE owner_type='company' AND owner_id=p_company_id AND is_primary LIMIT 1;
  IF COALESCE(available,0) < total THEN
    INSERT INTO public.company_wage_liabilities(company_id,payroll_line_id,employee_profile_id,amount_owed_minor,original_due_date)
    SELECT p_company_id,id,employee_profile_id,net_pay_minor,p_period_end FROM public.company_payroll_lines WHERE batch_id=b ON CONFLICT DO NOTHING;
    UPDATE public.company_payroll_batches SET status='awaiting_funds' WHERE id=b; UPDATE public.companies SET financial_health='payroll_risk' WHERE id=p_company_id; RETURN b;
  END IF;
  FOR c IN SELECT * FROM public.company_payroll_lines WHERE batch_id=b LOOP
    IF c.employee_profile_id IS NOT NULL THEN SELECT public.finance_transfer('company',p_company_id,'player',c.employee_profile_id,c.net_pay_minor,'payroll','Company payroll',c.idempotency_key,'company_payroll_line',c.id,NULL,'{}'::jsonb) INTO tx; ELSE SELECT public.finance_debit_owner('company',p_company_id,c.net_pay_minor,'payroll','NPC payroll',c.idempotency_key,NULL,'{}'::jsonb) INTO tx; END IF;
    UPDATE public.company_payroll_lines SET status='paid', transaction_id=tx WHERE id=c.id;
  END LOOP;
  UPDATE public.company_payroll_batches SET status='paid', processed_at=timezone('utc',now()) WHERE id=b; RETURN b;
END; $$;
