-- Add missing cooldown_days column to pr_media_offers
ALTER TABLE public.pr_media_offers ADD COLUMN IF NOT EXISTS cooldown_days INT DEFAULT 30;

-- Add entity_id column to sponsorship_offers and link to sponsorship_entities
ALTER TABLE public.sponsorship_offers ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES sponsorship_entities(id);
ALTER TABLE public.sponsorship_offers ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'endorsement';
ALTER TABLE public.sponsorship_offers ADD COLUMN IF NOT EXISTS payout NUMERIC;
ALTER TABLE public.sponsorship_offers ADD COLUMN IF NOT EXISTS terms JSONB DEFAULT '{}';
ALTER TABLE public.sponsorship_offers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Backfill entity_id from band_id for existing offers
UPDATE sponsorship_offers so
SET entity_id = se.id
FROM sponsorship_entities se
WHERE so.band_id = se.band_id AND so.entity_id IS NULL;