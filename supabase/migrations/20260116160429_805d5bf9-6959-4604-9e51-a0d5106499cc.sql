-- Add home_city_id to bands table for regional rankings
ALTER TABLE bands 
ADD COLUMN IF NOT EXISTS home_city_id uuid REFERENCES cities(id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bands_home_city ON bands(home_city_id);