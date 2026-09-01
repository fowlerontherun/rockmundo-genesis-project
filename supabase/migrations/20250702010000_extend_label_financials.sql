-- Extend financial tracking for labels, contracts, and releases.
--
-- Historical ordering note: this migration predates the canonical label schema
-- (20250917090000_create_label_system.sql). On a fresh replay the target tables
-- do not exist yet, so defer the extension; a later forward repair applies the
-- same columns once the base schema is present. Existing databases that already
-- have the tables can still receive the historical extension idempotently.
DO $$
BEGIN
  IF to_regclass('public.labels') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE public.labels
        ADD COLUMN IF NOT EXISTS operating_budget NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cash_reserves NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS annual_revenue_target NUMERIC(14,2) DEFAULT 0
    $sql$;
  ELSE
    RAISE NOTICE 'Deferred label financial fields until public.labels exists';
  END IF;

  IF to_regclass('public.artist_label_contracts') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE public.artist_label_contracts
        ADD COLUMN IF NOT EXISTS lifetime_gross_revenue NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lifetime_artist_payout NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lifetime_label_profit NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_statement_at TIMESTAMPTZ
    $sql$;
  ELSE
    RAISE NOTICE 'Deferred contract financial fields until public.artist_label_contracts exists';
  END IF;

  IF to_regclass('public.label_releases') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE public.label_releases
        ADD COLUMN IF NOT EXISTS streaming_revenue NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS digital_revenue NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS physical_revenue NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sync_revenue NUMERIC(14,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_revenue NUMERIC(14,2) DEFAULT 0
    $sql$;
  ELSE
    RAISE NOTICE 'Deferred release financial fields until public.label_releases exists';
  END IF;
END
$$;
