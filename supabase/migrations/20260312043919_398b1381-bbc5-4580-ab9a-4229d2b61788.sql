-- Fix company_type CHECK constraint to match frontend values
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_company_type_check 
  CHECK (company_type IN ('holding', 'label', 'security', 'factory', 'logistics', 'venue', 'rehearsal', 'recording_studio'));