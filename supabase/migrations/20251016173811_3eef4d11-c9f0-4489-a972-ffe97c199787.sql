-- Create recording_sessions table
CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  band_id UUID REFERENCES bands(id),
  studio_id UUID NOT NULL REFERENCES city_studios(id),
  producer_id UUID NOT NULL REFERENCES recording_producers(id),
  song_id UUID NOT NULL REFERENCES songs(id),
  duration_hours INTEGER NOT NULL DEFAULT 4,
  total_cost INTEGER NOT NULL,
  quality_improvement INTEGER DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'in_progress',
  scheduled_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_end TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create orchestra_bookings table
CREATE TABLE IF NOT EXISTS orchestra_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
  orchestra_type VARCHAR NOT NULL,
  musician_count INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  quality_bonus INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestra_bookings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for recording_sessions  
CREATE POLICY "Users can view their own recording sessions"
ON recording_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM band_members WHERE band_id = recording_sessions.band_id
));

CREATE POLICY "Users can create their own recording sessions"
ON recording_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM band_members WHERE band_id = recording_sessions.band_id
));

CREATE POLICY "Users can update their own recording sessions"
ON recording_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM band_members WHERE band_id = recording_sessions.band_id
));

-- Add RLS policies for orchestra_bookings
CREATE POLICY "Users can view their orchestra bookings"
ON orchestra_bookings
FOR SELECT
TO authenticated
USING (session_id IN (
  SELECT id FROM recording_sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create orchestra bookings"
ON orchestra_bookings
FOR INSERT
TO authenticated
WITH CHECK (session_id IN (
  SELECT id FROM recording_sessions WHERE user_id = auth.uid()
));

-- Add policy for viewing producers
CREATE POLICY "Anyone can view recording producers"
ON recording_producers
FOR SELECT
TO public
USING (true);