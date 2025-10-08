-- Add auto clock in preference to player employment
ALTER TABLE public.player_employment
ADD COLUMN IF NOT EXISTS auto_clock_in BOOLEAN NOT NULL DEFAULT false;
