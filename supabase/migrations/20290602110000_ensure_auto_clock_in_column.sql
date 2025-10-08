-- Ensure player employment supports automatic clock-ins
ALTER TABLE public.player_employment
ADD COLUMN IF NOT EXISTS auto_clock_in BOOLEAN NOT NULL DEFAULT false;

-- Backfill any existing records that might have null values
UPDATE public.player_employment
SET auto_clock_in = false
WHERE auto_clock_in IS NULL;
