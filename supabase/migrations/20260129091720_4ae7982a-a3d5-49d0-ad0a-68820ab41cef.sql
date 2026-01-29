-- ==============================================
-- LEGENDARY MASTERS OVERHAUL
-- ==============================================

-- Add new columns to education_mentors
ALTER TABLE education_mentors
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS available_day integer CHECK (available_day >= 0 AND available_day <= 6),
  ADD COLUMN IF NOT EXISTS lore_biography text,
  ADD COLUMN IF NOT EXISTS lore_achievement text,
  ADD COLUMN IF NOT EXISTS discovery_hint text,
  ADD COLUMN IF NOT EXISTS is_discoverable boolean DEFAULT true;

-- Remove skill requirement (make all mentors accessible, barrier is cost + location)
UPDATE education_mentors SET required_skill_value = 0;

-- Create discovery tracking table
CREATE TABLE IF NOT EXISTS player_master_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES education_mentors(id) ON DELETE CASCADE,
  discovered_at timestamptz DEFAULT now(),
  discovery_method text CHECK (discovery_method IN ('exploration', 'npc_hint', 'achievement', 'friend_tip', 'admin_grant')),
  discovery_metadata jsonb DEFAULT '{}',
  UNIQUE(profile_id, mentor_id)
);

-- Enable RLS
ALTER TABLE player_master_discoveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discoveries
CREATE POLICY "Users can view own discoveries" 
  ON player_master_discoveries FOR SELECT 
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own discoveries"
  ON player_master_discoveries FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_master_discoveries_profile ON player_master_discoveries(profile_id);
CREATE INDEX IF NOT EXISTS idx_master_discoveries_mentor ON player_master_discoveries(mentor_id);
CREATE INDEX IF NOT EXISTS idx_education_mentors_city ON education_mentors(city_id);
CREATE INDEX IF NOT EXISTS idx_education_mentors_day ON education_mentors(available_day);

-- Function to discover a master
CREATE OR REPLACE FUNCTION discover_master(
  p_profile_id uuid,
  p_mentor_id uuid,
  p_method text DEFAULT 'exploration',
  p_metadata jsonb DEFAULT '{}'
) RETURNS boolean AS $$
BEGIN
  INSERT INTO player_master_discoveries (profile_id, mentor_id, discovery_method, discovery_metadata)
  VALUES (p_profile_id, p_mentor_id, p_method, p_metadata)
  ON CONFLICT (profile_id, mentor_id) DO NOTHING;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if a master is discovered
CREATE OR REPLACE FUNCTION is_master_discovered(
  p_profile_id uuid,
  p_mentor_id uuid
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM player_master_discoveries
    WHERE profile_id = p_profile_id AND mentor_id = p_mentor_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION discover_master TO authenticated;
GRANT EXECUTE ON FUNCTION is_master_discovered TO authenticated;