-- Add company ownership fields to labels table (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labels' AND column_name = 'company_id') THEN
    ALTER TABLE public.labels ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add additional business fields to labels
ALTER TABLE public.labels 
ADD COLUMN IF NOT EXISTS operating_budget NUMERIC(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_overhead NUMERIC(12,2) DEFAULT 5000,
ADD COLUMN IF NOT EXISTS royalty_default_pct NUMERIC(5,2) DEFAULT 15,
ADD COLUMN IF NOT EXISTS advance_pool NUMERIC(14,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS marketing_budget NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS a_and_r_budget NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS distribution_deal TEXT DEFAULT 'independent',
ADD COLUMN IF NOT EXISTS distribution_cut_pct NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue_lifetime NUMERIC(16,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_expenses_lifetime NUMERIC(16,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_subsidiary BOOLEAN DEFAULT false;

-- Create label financial transactions table
CREATE TABLE IF NOT EXISTS public.label_financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('revenue', 'expense', 'advance', 'royalty_payment', 'marketing', 'overhead', 'distribution', 'transfer')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  related_release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  related_band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  related_contract_id UUID REFERENCES public.artist_label_contracts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create label staff table
CREATE TABLE IF NOT EXISTS public.label_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('a_and_r', 'marketing', 'promoter', 'accountant', 'legal', 'producer', 'manager')),
  skill_level NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (skill_level >= 1 AND skill_level <= 5),
  specialty_genre TEXT,
  salary_monthly NUMERIC(10,2) NOT NULL DEFAULT 3000,
  hired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  performance_rating NUMERIC(3,2) DEFAULT 3.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create label distribution deals table
CREATE TABLE IF NOT EXISTS public.label_distribution_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  distributor_name TEXT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('digital', 'physical', 'full')),
  revenue_share_pct NUMERIC(5,2) NOT NULL,
  advance_amount NUMERIC(12,2) DEFAULT 0,
  minimum_releases INTEGER,
  territories TEXT[] DEFAULT ARRAY['worldwide'],
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.label_financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_distribution_deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for label_financial_transactions
CREATE POLICY "Label owners can view transactions"
  ON public.label_financial_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_financial_transactions.label_id 
    AND l.owner_id = auth.uid()
  ));

CREATE POLICY "Label owners can manage transactions"
  ON public.label_financial_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_financial_transactions.label_id 
    AND l.owner_id = auth.uid()
  ));

-- RLS Policies for label_staff
CREATE POLICY "Label owners can view staff"
  ON public.label_staff FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_staff.label_id 
    AND l.owner_id = auth.uid()
  ));

CREATE POLICY "Label owners can manage staff"
  ON public.label_staff FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_staff.label_id 
    AND l.owner_id = auth.uid()
  ));

-- RLS Policies for label_distribution_deals
CREATE POLICY "Label owners can view distribution deals"
  ON public.label_distribution_deals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_distribution_deals.label_id 
    AND l.owner_id = auth.uid()
  ));

CREATE POLICY "Label owners can manage distribution deals"
  ON public.label_distribution_deals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.labels l
    WHERE l.id = label_distribution_deals.label_id 
    AND l.owner_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_label_financial_transactions_label ON public.label_financial_transactions(label_id);
CREATE INDEX IF NOT EXISTS idx_label_financial_transactions_type ON public.label_financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_label_staff_label ON public.label_staff(label_id);
CREATE INDEX IF NOT EXISTS idx_label_distribution_deals_label ON public.label_distribution_deals(label_id);
CREATE INDEX IF NOT EXISTS idx_labels_company ON public.labels(company_id);

-- Trigger for updated_at
CREATE TRIGGER update_label_distribution_deals_updated_at
  BEFORE UPDATE ON public.label_distribution_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();