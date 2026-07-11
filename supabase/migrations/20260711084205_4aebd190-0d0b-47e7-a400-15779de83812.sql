
CREATE TABLE public.company_vacancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  description TEXT,
  staff_category TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  is_permanent BOOLEAN NOT NULL DEFAULT true,
  positions_available INTEGER NOT NULL DEFAULT 1,
  positions_filled INTEGER NOT NULL DEFAULT 0,
  weekly_wage NUMERIC NOT NULL DEFAULT 0,
  required_skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  minimum_skill_levels JSONB NOT NULL DEFAULT '{}'::jsonb,
  location_city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  expected_activity_level TEXT NOT NULL DEFAULT 'regular',
  status TEXT NOT NULL DEFAULT 'draft',
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_vacancies TO authenticated;
GRANT SELECT ON public.company_vacancies TO anon;
GRANT ALL ON public.company_vacancies TO service_role;
ALTER TABLE public.company_vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view open vacancies" ON public.company_vacancies
  FOR SELECT USING (status = 'open' OR EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = company_vacancies.company_id AND c.owner_id = auth.uid()
  ));
CREATE POLICY "Company owners manage vacancies" ON public.company_vacancies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = company_vacancies.company_id AND c.owner_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = company_vacancies.company_id AND c.owner_id = auth.uid()
  ));
CREATE INDEX idx_company_vacancies_company ON public.company_vacancies(company_id);
CREATE INDEX idx_company_vacancies_status ON public.company_vacancies(status);

CREATE TABLE public.company_weekly_finance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  gross_revenue NUMERIC NOT NULL DEFAULT 0,
  staff_wage_costs NUMERIC NOT NULL DEFAULT 0,
  total_costs NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  unpaid_amount NUMERIC NOT NULL DEFAULT 0,
  performance_modifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'processed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_weekly_finance_records TO authenticated;
GRANT ALL ON public.company_weekly_finance_records TO service_role;
ALTER TABLE public.company_weekly_finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owners can view weekly finance records" ON public.company_weekly_finance_records
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = company_weekly_finance_records.company_id AND c.owner_id = auth.uid()
  ));
CREATE POLICY "Service role manages weekly finance records" ON public.company_weekly_finance_records
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_company_weekly_finance_company_week ON public.company_weekly_finance_records(company_id, week_start DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER trg_company_vacancies_updated_at BEFORE UPDATE ON public.company_vacancies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_company_weekly_finance_records_updated_at BEFORE UPDATE ON public.company_weekly_finance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
