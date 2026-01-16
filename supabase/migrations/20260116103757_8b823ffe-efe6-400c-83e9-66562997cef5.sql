-- Add missing columns to jam_sessions
ALTER TABLE jam_sessions 
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_xp_awarded INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mood_score INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS synergy_score INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS gifted_song_id UUID REFERENCES songs(id);

-- Add instrument skill slug to participants
ALTER TABLE jam_session_participants
  ADD COLUMN IF NOT EXISTS instrument_skill_slug TEXT;

-- Create jam_session_outcomes table for detailed per-participant results
CREATE TABLE IF NOT EXISTS jam_session_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  chemistry_gained INTEGER NOT NULL DEFAULT 0,
  skill_slug TEXT,
  skill_xp_gained INTEGER NOT NULL DEFAULT 0,
  gifted_song_id UUID REFERENCES songs(id),
  performance_rating INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, participant_id)
);

-- Create jam_gifted_song_log table for weekly limit tracking
CREATE TABLE IF NOT EXISTS jam_gifted_song_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE jam_session_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jam_gifted_song_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for jam_session_outcomes
CREATE POLICY "Users can view outcomes for sessions they participated in" 
ON jam_session_outcomes FOR SELECT 
USING (
  participant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR session_id IN (
    SELECT js.id FROM jam_sessions js
    WHERE js.host_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "System can insert outcomes" 
ON jam_session_outcomes FOR INSERT 
WITH CHECK (true);

-- RLS policies for jam_gifted_song_log
CREATE POLICY "Users can view their gifted song logs" 
ON jam_gifted_song_log FOR SELECT 
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert gifted song logs" 
ON jam_gifted_song_log FOR INSERT 
WITH CHECK (true);