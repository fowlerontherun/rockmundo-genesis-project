
-- Add category column to company_transactions for better tracking
ALTER TABLE public.company_transactions 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Add tax_type to company_tax_records for corporate vs city tax distinction
ALTER TABLE public.company_tax_records 
ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'corporate';

-- Add penalty_amount for overdue taxes
ALTER TABLE public.company_tax_records 
ADD COLUMN IF NOT EXISTS penalty_amount numeric DEFAULT 0;

-- Set realistic weekly_operating_costs for all existing companies based on type
UPDATE public.companies SET weekly_operating_costs = CASE company_type
  WHEN 'holding' THEN 2500
  WHEN 'label' THEN 8000
  WHEN 'security' THEN 3500
  WHEN 'factory' THEN 6000
  WHEN 'logistics' THEN 4500
  WHEN 'venue' THEN 7000
  WHEN 'rehearsal' THEN 2000
  WHEN 'recording_studio' THEN 5000
  ELSE 1000
END
WHERE weekly_operating_costs = 0 OR weekly_operating_costs IS NULL;

-- Create index on company_transactions for faster financial queries
CREATE INDEX IF NOT EXISTS idx_company_transactions_company_type 
ON public.company_transactions(company_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_company_transactions_created 
ON public.company_transactions(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_tax_records_company_status 
ON public.company_tax_records(company_id, status);
