
-- Add negotiation tracking columns to artist_label_contracts
ALTER TABLE public.artist_label_contracts
ADD COLUMN IF NOT EXISTS counter_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_action_by text NOT NULL DEFAULT 'label',
ADD COLUMN IF NOT EXISTS original_advance numeric NULL,
ADD COLUMN IF NOT EXISTS original_royalty_pct numeric NULL,
ADD COLUMN IF NOT EXISTS original_single_quota integer NULL,
ADD COLUMN IF NOT EXISTS original_album_quota integer NULL;

-- Add check constraint for last_action_by
ALTER TABLE public.artist_label_contracts
ADD CONSTRAINT chk_last_action_by CHECK (last_action_by IN ('label', 'artist'));

-- Add check constraint for counter_count
ALTER TABLE public.artist_label_contracts
ADD CONSTRAINT chk_counter_count CHECK (counter_count >= 0 AND counter_count <= 3);
