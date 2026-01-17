-- ============================================
-- VIP Company System - Phase 1: Core Infrastructure
-- ============================================

-- Companies table: Parent entity for all business types
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  company_type TEXT NOT NULL CHECK (company_type IN ('holding', 'label', 'security', 'factory', 'venue', 'rehearsal')),
  parent_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  headquarters_city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  is_bankrupt BOOLEAN NOT NULL DEFAULT false,
  bankruptcy_date TIMESTAMPTZ,
  founded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'bankrupt', 'dissolved')),
  reputation_score INTEGER NOT NULL DEFAULT 0,
  weekly_operating_costs NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company employees table
CREATE TABLE public.company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ceo', 'manager', 'accountant', 'security_guard', 'technician', 'producer', 'promoter', 'receptionist')),
  salary NUMERIC NOT NULL DEFAULT 0,
  hired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
  performance_rating INTEGER DEFAULT 50 CHECK (performance_rating >= 0 AND performance_rating <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, profile_id)
);

-- Company transactions table for financial tracking
CREATE TABLE public.company_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer_in', 'transfer_out', 'salary', 'investment', 'dividend')),
  amount NUMERIC NOT NULL,
  description TEXT,
  related_entity_id UUID,
  related_entity_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_companies_owner ON public.companies(owner_id);
CREATE INDEX idx_companies_parent ON public.companies(parent_company_id);
CREATE INDEX idx_companies_type ON public.companies(company_type);
CREATE INDEX idx_companies_status ON public.companies(status);
CREATE INDEX idx_company_employees_company ON public.company_employees(company_id);
CREATE INDEX idx_company_employees_profile ON public.company_employees(profile_id);
CREATE INDEX idx_company_transactions_company ON public.company_transactions(company_id);
CREATE INDEX idx_company_transactions_date ON public.company_transactions(created_at);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_transactions ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Users can view their own companies"
  ON public.companies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view companies they work for"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      JOIN public.profiles p ON p.id = ce.profile_id
      WHERE ce.company_id = companies.id AND p.user_id = auth.uid() AND ce.status = 'active'
    )
  );

CREATE POLICY "VIP users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (
    owner_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND is_vip = true
    )
  );

CREATE POLICY "Owners can update their companies"
  ON public.companies FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their companies"
  ON public.companies FOR DELETE
  USING (owner_id = auth.uid());

-- Company employees policies
CREATE POLICY "Company owners can view employees"
  ON public.company_employees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_employees.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view their own employment"
  ON public.company_employees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = company_employees.profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can manage employees"
  ON public.company_employees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_employees.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update employees"
  ON public.company_employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_employees.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can remove employees"
  ON public.company_employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_employees.company_id AND c.owner_id = auth.uid()
    )
  );

-- Company transactions policies
CREATE POLICY "Company owners can view transactions"
  ON public.company_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_transactions.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can create transactions"
  ON public.company_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = company_transactions.company_id AND c.owner_id = auth.uid()
    )
  );

-- Add updated_at trigger for companies
CREATE OR REPLACE FUNCTION public.update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_companies_updated_at();

CREATE TRIGGER update_company_employees_updated_at
  BEFORE UPDATE ON public.company_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_companies_updated_at();

-- Add comments
COMMENT ON TABLE public.companies IS 'VIP-owned business entities including holding companies and subsidiaries';
COMMENT ON TABLE public.company_employees IS 'Players employed by companies';
COMMENT ON TABLE public.company_transactions IS 'Financial transactions for company accounting';