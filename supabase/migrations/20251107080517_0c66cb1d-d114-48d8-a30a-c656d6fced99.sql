-- Add missing columns to label_releases
ALTER TABLE label_releases 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS promotion_budget INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS masters_cost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS territory_strategy TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add missing columns to label_deal_types  
ALTER TABLE label_deal_types
ADD COLUMN IF NOT EXISTS default_artist_royalty INTEGER,
ADD COLUMN IF NOT EXISTS default_label_royalty INTEGER,
ADD COLUMN IF NOT EXISTS includes_advance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_term_months INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS default_release_quota INTEGER DEFAULT 3;

-- Update existing deal types with default values
UPDATE label_deal_types 
SET 
  default_artist_royalty = royalty_artist_pct,
  default_label_royalty = 100 - royalty_artist_pct,
  includes_advance = (advance_max > 0),
  default_term_months = 24,
  default_release_quota = 3
WHERE default_artist_royalty IS NULL;