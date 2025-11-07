-- Add territories and royalty_label_pct to contracts
ALTER TABLE artist_label_contracts
ADD COLUMN IF NOT EXISTS territories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS royalty_label_pct INTEGER;

-- Calculate royalty_label_pct as 100 - royalty_artist_pct
UPDATE artist_label_contracts
SET royalty_label_pct = 100 - royalty_artist_pct
WHERE royalty_label_pct IS NULL;

-- Add masters_owned_by_artist to deal types
ALTER TABLE label_deal_types
ADD COLUMN IF NOT EXISTS masters_owned_by_artist BOOLEAN DEFAULT false;

-- Add focus_genre to roster slots
ALTER TABLE label_roster_slots
ADD COLUMN IF NOT EXISTS focus_genre TEXT;