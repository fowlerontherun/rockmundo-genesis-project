-- Add missing cooldown_days column to pr_media_offers
ALTER TABLE public.pr_media_offers ADD COLUMN IF NOT EXISTS cooldown_days INT DEFAULT 30;

-- sponsorship_offers is created later in the historical migration sequence.
-- Preserve this legacy enrichment for databases where the table already
-- existed, but do not abort a clean replay when it does not yet exist.
DO $$
BEGIN
  IF to_regclass('public.sponsorship_offers') IS NOT NULL THEN
    ALTER TABLE public.sponsorship_offers
      ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES sponsorship_entities(id),
      ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'endorsement',
      ADD COLUMN IF NOT EXISTS payout NUMERIC,
      ADD COLUMN IF NOT EXISTS terms JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

    -- Backfill entity_id from band_id only on legacy shapes that still expose
    -- band_id. Later canonical creation already includes entity_id directly.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sponsorship_offers'
        AND column_name = 'band_id'
    ) THEN
      UPDATE sponsorship_offers so
      SET entity_id = se.id
      FROM sponsorship_entities se
      WHERE so.band_id = se.band_id AND so.entity_id IS NULL;
    END IF;
  END IF;
END $$;