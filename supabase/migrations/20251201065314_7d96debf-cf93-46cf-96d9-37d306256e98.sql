-- Create festival_participants table (references game_events not festivals)
CREATE TABLE IF NOT EXISTS festival_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES game_events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('headliner', 'co_headliner', 'supporting', 'opener')),
  performance_date DATE,
  payout_amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, band_id)
);

-- Create festival_revenue_streams table
CREATE TABLE IF NOT EXISTS festival_revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES game_events(id) ON DELETE CASCADE,
  stream_type TEXT NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE festival_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_revenue_streams ENABLE ROW LEVEL SECURITY;

-- Policies for festival_participants
CREATE POLICY "Anyone can view festival participants"
  ON festival_participants FOR SELECT
  USING (true);

CREATE POLICY "Band leaders can manage their participations"
  ON festival_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bands b
      WHERE b.id = festival_participants.band_id
      AND b.leader_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all participations"
  ON festival_participants FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies for festival_revenue_streams
CREATE POLICY "Anyone can view festival revenue"
  ON festival_revenue_streams FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage festival revenue"
  ON festival_revenue_streams FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_festival_participants_event 
  ON festival_participants(event_id, status);
CREATE INDEX IF NOT EXISTS idx_festival_participants_band 
  ON festival_participants(band_id);
CREATE INDEX IF NOT EXISTS idx_festival_revenue_event 
  ON festival_revenue_streams(event_id);