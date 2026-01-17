-- Phase 2: Holding Company & Subsidiaries
-- Add company_id to labels table for company ownership
ALTER TABLE public.labels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Company settings table for dividend and reinvestment policies
CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  auto_pay_salaries BOOLEAN DEFAULT true,
  dividend_payout_percent INTEGER DEFAULT 0 CHECK (dividend_payout_percent >= 0 AND dividend_payout_percent <= 100),
  reinvestment_percent INTEGER DEFAULT 100 CHECK (reinvestment_percent >= 0 AND reinvestment_percent <= 100),
  allow_subsidiary_creation BOOLEAN DEFAULT true,
  max_subsidiaries INTEGER DEFAULT 10,
  notification_threshold_low NUMERIC DEFAULT 10000,
  notification_threshold_critical NUMERIC DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_settings
CREATE POLICY "Company owners can view their settings"
  ON public.company_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_settings.company_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update their settings"
  ON public.company_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_settings.company_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can insert their settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_settings.company_id
      AND c.owner_id = auth.uid()
    )
  );

-- Index for faster label lookups by company
CREATE INDEX IF NOT EXISTS idx_labels_company_id ON public.labels(company_id);

-- Trigger to auto-create company_settings when a company is created
CREATE OR REPLACE FUNCTION public.handle_company_settings_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_company_settings_trigger ON public.companies;
CREATE TRIGGER create_company_settings_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_company_settings_creation();

-- Backfill settings for existing companies
INSERT INTO public.company_settings (company_id)
SELECT id FROM public.companies
WHERE id NOT IN (SELECT company_id FROM public.company_settings)
ON CONFLICT (company_id) DO NOTHING;