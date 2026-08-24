-- Extend financial tracking for labels, contracts, and releases
ALTER TABLE labels
  ADD COLUMN IF NOT EXISTS operating_budget NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_reserves NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_revenue_target NUMERIC(14,2) DEFAULT 0;

ALTER TABLE artist_label_contracts
  ADD COLUMN IF NOT EXISTS lifetime_gross_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_artist_payout NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_label_profit NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_statement_at TIMESTAMPTZ;

ALTER TABLE label_releases
  ADD COLUMN IF NOT EXISTS streaming_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS digital_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physical_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_revenue NUMERIC(14,2) DEFAULT 0;
