-- Phase 1: Clear existing jam session data and update schema

-- Clear existing jam session data (in correct order due to foreign keys)
DELETE FROM jam_session_outcomes;
DELETE FROM jam_session_participants;
DELETE FROM jam_session_messages;
DELETE FROM jam_sessions;

-- Add new columns to jam_sessions for venue booking and cost tracking
ALTER TABLE jam_sessions 
ADD COLUMN IF NOT EXISTS rehearsal_room_id UUID REFERENCES rehearsal_rooms(id),
ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS total_cost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS creator_profile_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cost_per_participant INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- Add new columns to jam_session_participants for cost and participation tracking
ALTER TABLE jam_session_participants 
ADD COLUMN IF NOT EXISTS cost_paid INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS participation_percentage INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS reward_multiplier NUMERIC(3,2) DEFAULT 1.00;

-- Create jam_session_chat table for dedicated session chat
CREATE TABLE IF NOT EXISTS jam_session_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'chat',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create jam_session_commentary table for live commentary events
CREATE TABLE IF NOT EXISTS jam_session_commentary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  commentary TEXT NOT NULL,
  participant_id UUID REFERENCES profiles(id),
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE jam_session_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE jam_session_commentary ENABLE ROW LEVEL SECURITY;

-- RLS policies for jam_session_chat (using correct column name jam_session_id)
CREATE POLICY "Users can view chat in sessions they participate in"
ON jam_session_chat FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jam_session_participants jsp
    WHERE jsp.jam_session_id = jam_session_chat.session_id
    AND jsp.profile_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in sessions they participate in"
ON jam_session_chat FOR INSERT
WITH CHECK (
  auth.uid() = profile_id
  AND EXISTS (
    SELECT 1 FROM jam_session_participants jsp
    WHERE jsp.jam_session_id = jam_session_chat.session_id
    AND jsp.profile_id = auth.uid()
  )
);

-- RLS policies for jam_session_commentary
CREATE POLICY "Anyone can view session commentary"
ON jam_session_commentary FOR SELECT
USING (true);

CREATE POLICY "Service role can insert commentary"
ON jam_session_commentary FOR INSERT
WITH CHECK (true);

-- Enable realtime for chat and commentary
ALTER PUBLICATION supabase_realtime ADD TABLE jam_session_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE jam_session_commentary;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jam_session_chat_session ON jam_session_chat(session_id);
CREATE INDEX IF NOT EXISTS idx_jam_session_chat_created ON jam_session_chat(created_at);
CREATE INDEX IF NOT EXISTS idx_jam_session_commentary_session ON jam_session_commentary(session_id);
CREATE INDEX IF NOT EXISTS idx_jam_session_commentary_created ON jam_session_commentary(created_at);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_room ON jam_sessions(rehearsal_room_id);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_scheduled ON jam_sessions(scheduled_start);