-- Phase 1: Company Tax Records table
CREATE TABLE IF NOT EXISTS public.company_tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_period TEXT NOT NULL,
  gross_revenue NUMERIC DEFAULT 0,
  deductible_expenses NUMERIC DEFAULT 0,
  taxable_income NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0.15,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on company_tax_records
ALTER TABLE public.company_tax_records ENABLE ROW LEVEL SECURITY;

-- Owners can view their company tax records
CREATE POLICY "Owners can view own company tax records"
ON public.company_tax_records
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_tax_records.company_id 
    AND owner_id = auth.uid()
  )
);

-- Owners can update (pay) their tax records
CREATE POLICY "Owners can update own company tax records"
ON public.company_tax_records
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_tax_records.company_id 
    AND owner_id = auth.uid()
  )
);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to company tax records"
ON public.company_tax_records FOR ALL
TO anon
USING (false);

-- Phase 2: Add auto_pay_taxes to company_settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'company_settings' 
    AND column_name = 'auto_pay_taxes'
  ) THEN
    ALTER TABLE public.company_settings ADD COLUMN auto_pay_taxes BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Phase 3: Create trigger function to auto-create subsidiary entities
CREATE OR REPLACE FUNCTION public.create_subsidiary_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Security Firm
  IF NEW.company_type = 'security' THEN
    INSERT INTO public.security_firms (company_id, name, license_level, equipment_quality, reputation, guards_max_capacity)
    VALUES (NEW.id, NEW.name || ' Security', 1, 1, 50, 10);
  -- Merch Factory
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO public.merch_factories (company_id, name, city_id, factory_type, quality_level, production_capacity, worker_count, operating_costs_daily)
    VALUES (NEW.id, NEW.name || ' Manufacturing', NEW.headquarters_city_id, 'apparel', 1, 100, 5, 500);
  -- Logistics Company (check if table exists)
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO public.logistics_companies (company_id, name, license_tier, fleet_capacity, operating_radius_km, reputation_score)
    VALUES (NEW.id, NEW.name || ' Logistics', 1, 5, 500, 50);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail the company creation
  RAISE WARNING 'Could not create subsidiary entity for %: %', NEW.company_type, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS after_company_insert_create_subsidiary ON public.companies;

-- Create the trigger
CREATE TRIGGER after_company_insert_create_subsidiary
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.create_subsidiary_entity();

-- Index for tax records
CREATE INDEX IF NOT EXISTS idx_company_tax_records_company_id ON public.company_tax_records(company_id);
CREATE INDEX IF NOT EXISTS idx_company_tax_records_status ON public.company_tax_records(status);
CREATE INDEX IF NOT EXISTS idx_company_tax_records_due_date ON public.company_tax_records(due_date);