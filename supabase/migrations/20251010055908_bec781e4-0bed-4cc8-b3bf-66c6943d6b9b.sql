-- Add auto_clock_in column to player_employment table
ALTER TABLE player_employment
ADD COLUMN IF NOT EXISTS auto_clock_in BOOLEAN DEFAULT false;