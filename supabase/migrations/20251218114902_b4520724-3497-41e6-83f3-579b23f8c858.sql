-- Add city_id to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);
CREATE INDEX IF NOT EXISTS idx_jobs_city_id ON jobs(city_id);

-- Update player_employment default for auto_clock_in
ALTER TABLE player_employment ALTER COLUMN auto_clock_in SET DEFAULT true;