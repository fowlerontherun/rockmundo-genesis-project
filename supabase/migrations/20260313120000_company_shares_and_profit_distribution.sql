-- Company shares, transfer offers, and annual profit distributions

CREATE TABLE IF NOT EXISTS public.company_shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_share_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id uuid,
  to_user_id uuid NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  price_per_share numeric NOT NULL DEFAULT 0 CHECK (price_per_share >= 0),
  total_price numeric NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  transfer_type text NOT NULL CHECK (transfer_type IN ('sale', 'gift', 'issuance')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_profit_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  game_year integer NOT NULL CHECK (game_year > 0),
  distributed_profit numeric NOT NULL CHECK (distributed_profit >= 0),
  distributed_at timestamptz NOT NULL DEFAULT now(),
  distributed_by uuid NOT NULL,
  UNIQUE(company_id, game_year)
);

CREATE INDEX IF NOT EXISTS idx_company_shareholders_company_id ON public.company_shareholders(company_id);
CREATE INDEX IF NOT EXISTS idx_company_profit_distributions_company_year ON public.company_profit_distributions(company_id, game_year);

ALTER TABLE public.company_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_share_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profit_distributions ENABLE ROW LEVEL SECURITY;

-- shareholders policies
DROP POLICY IF EXISTS "View shareholders for visible companies" ON public.company_shareholders;
CREATE POLICY "View shareholders for visible companies"
ON public.company_shareholders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_shareholders.company_id
    AND (c.owner_id = auth.uid() OR company_shareholders.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Manage shareholders for owned companies" ON public.company_shareholders;
CREATE POLICY "Manage shareholders for owned companies"
ON public.company_shareholders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_shareholders.company_id
      AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_shareholders.company_id
      AND c.owner_id = auth.uid()
  )
);

-- transfer visibility
DROP POLICY IF EXISTS "View share transfers for participant" ON public.company_share_transfers;
CREATE POLICY "View share transfers for participant"
ON public.company_share_transfers
FOR SELECT
USING (
  from_user_id = auth.uid() OR to_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_share_transfers.company_id
      AND c.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Insert share transfers for owned companies" ON public.company_share_transfers;
CREATE POLICY "Insert share transfers for owned companies"
ON public.company_share_transfers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_share_transfers.company_id
      AND c.owner_id = auth.uid()
  )
);

-- profit distribution policies
DROP POLICY IF EXISTS "View distributions for participant" ON public.company_profit_distributions;
CREATE POLICY "View distributions for participant"
ON public.company_profit_distributions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_shareholders sh
    WHERE sh.company_id = company_profit_distributions.company_id
      AND sh.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_profit_distributions.company_id
      AND c.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Insert distributions for owned companies" ON public.company_profit_distributions;
CREATE POLICY "Insert distributions for owned companies"
ON public.company_profit_distributions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_profit_distributions.company_id
      AND c.owner_id = auth.uid()
  )
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_company_shareholders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_shareholders_updated_at ON public.company_shareholders;
CREATE TRIGGER trg_company_shareholders_updated_at
BEFORE UPDATE ON public.company_shareholders
FOR EACH ROW
EXECUTE FUNCTION public.set_company_shareholders_updated_at();

-- Seed an initial 100 shares for each existing company owner (if none exist)
INSERT INTO public.company_shareholders (company_id, user_id, shares)
SELECT c.id, c.owner_id, 100
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_shareholders s WHERE s.company_id = c.id
);
