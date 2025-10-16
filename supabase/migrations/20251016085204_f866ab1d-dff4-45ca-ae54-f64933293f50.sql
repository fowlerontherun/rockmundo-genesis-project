-- Add slot configuration to venues table
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS slots_per_day integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS slot_config jsonb DEFAULT '{
  "kids": {"enabled": true, "attendance_multiplier": 0.3, "payment_multiplier": 0.5},
  "opening": {"enabled": true, "attendance_multiplier": 0.5, "payment_multiplier": 0.6},
  "support": {"enabled": true, "attendance_multiplier": 0.75, "payment_multiplier": 0.8},
  "headline": {"enabled": true, "attendance_multiplier": 1.0, "payment_multiplier": 1.0}
}'::jsonb;

-- Add slot information to gigs table
ALTER TABLE gigs 
ADD COLUMN IF NOT EXISTS time_slot varchar,
ADD COLUMN IF NOT EXISTS slot_start_time time,
ADD COLUMN IF NOT EXISTS slot_end_time time,
ADD COLUMN IF NOT EXISTS slot_attendance_multiplier numeric DEFAULT 1.0;

-- Create band activity lockouts table
CREATE TABLE IF NOT EXISTS band_activity_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  activity_type varchar NOT NULL,
  locked_until timestamp with time zone NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on band_activity_lockouts
ALTER TABLE band_activity_lockouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for band_activity_lockouts
CREATE POLICY "Band members can view their lockouts"
ON band_activity_lockouts FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can create lockouts"
ON band_activity_lockouts FOR INSERT
WITH CHECK (true);

-- Create index for active lockouts
CREATE INDEX IF NOT EXISTS idx_band_lockouts_band_active 
ON band_activity_lockouts(band_id, locked_until);

-- Create index for checking slot availability (without predicate)
CREATE INDEX IF NOT EXISTS idx_gigs_venue_date_slot 
ON gigs(venue_id, scheduled_date, time_slot, status);