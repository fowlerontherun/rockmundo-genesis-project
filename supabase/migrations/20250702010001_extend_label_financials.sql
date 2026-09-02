-- Extend financial tracking for labels, contracts, and releases.
-- These tables were introduced later in the historical migration sequence, so a
-- clean database rebuild must safely defer this work until the label schema exists.
DO $$
BEGIN
  IF to_regclass('public.labels') IS NOT NULL THEN
    ALTER TABLE public.labels
      ADD COLUMN IF NOT EXISTS operating_budget NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cash_reserves NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS annual_revenue_target NUMERIC(14,2) DEFAULT 0;
  ELSE
    RAISE NOTICE 'Deferring label financial columns until public.labels exists';
  END IF;

  IF to_regclass('public.artist_label_contracts') IS NOT NULL THEN
    ALTER TABLE public.artist_label_contracts
      ADD COLUMN IF NOT EXISTS lifetime_gross_revenue NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lifetime_artist_payout NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lifetime_label_profit NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_statement_at TIMESTAMPTZ;
  ELSE
    RAISE NOTICE 'Deferring contract financial columns until public.artist_label_contracts exists';
  END IF;

  IF to_regclass('public.label_releases') IS NOT NULL THEN
    ALTER TABLE public.label_releases
      ADD COLUMN IF NOT EXISTS streaming_revenue NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS digital_revenue NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS physical_revenue NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sync_revenue NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS other_revenue NUMERIC(14,2) DEFAULT 0;
  ELSE
    RAISE NOTICE 'Deferring release financial columns until public.label_releases exists';
  END IF;
END
$$;
