
-- Create NPC mentors table
CREATE TABLE public.jam_npc_mentors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  genre_affinity TEXT,
  buff_type TEXT NOT NULL DEFAULT 'xp_boost',
  buff_value NUMERIC NOT NULL DEFAULT 0.1,
  rarity TEXT NOT NULL DEFAULT 'common',
  avatar_emoji TEXT DEFAULT '🎵',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jam_npc_mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NPC mentors"
  ON public.jam_npc_mentors FOR SELECT
  TO authenticated
  USING (true);

-- Add NPC fields to jam_sessions
ALTER TABLE public.jam_sessions
  ADD COLUMN npc_mentor_id UUID REFERENCES public.jam_npc_mentors(id),
  ADD COLUMN npc_mentor_name TEXT,
  ADD COLUMN npc_buff_type TEXT,
  ADD COLUMN npc_buff_value NUMERIC DEFAULT 0;

-- Seed NPC mentors
INSERT INTO public.jam_npc_mentors (name, description, genre_affinity, buff_type, buff_value, rarity, avatar_emoji) VALUES
  ('Rick Thunderstone', 'Legendary rock producer who drops in to share riff secrets.', 'Rock', 'xp_boost', 0.25, 'legendary', '🎸'),
  ('DJ Spinoza', 'Underground electronic pioneer with an ear for synergy.', 'Electronic', 'synergy_boost', 15, 'rare', '🎧'),
  ('Mama Blues', 'Soulful blues queen who lifts everyone''s spirits.', 'Blues', 'mood_boost', 20, 'rare', '🎤'),
  ('Professor Keys', 'Jazz virtuoso and music theory genius.', 'Jazz', 'skill_xp_boost', 0.30, 'uncommon', '🎹'),
  ('MC Flowstate', 'Hip-hop lyricist who gets the creative juices flowing.', 'Hip Hop', 'gift_chance_boost', 0.01, 'legendary', '🎙️'),
  ('Luna Strings', 'Indie folk artist with ethereal arrangements.', 'Folk', 'xp_boost', 0.15, 'common', '🪕'),
  ('Tommy Two-Sticks', 'Punk drummer with infectious energy.', 'Punk', 'mood_boost', 15, 'common', '🥁'),
  ('Countess Crescendo', 'Classical crossover star who elevates every session.', 'Classical', 'synergy_boost', 10, 'uncommon', '🎻'),
  ('Blaze Reddington', 'Metal shredder who pushes skill boundaries.', 'Metal', 'skill_xp_boost', 0.20, 'uncommon', '🔥'),
  ('Sunny Vega', 'Pop hitmaker who sprinkles commercial magic.', 'Pop', 'gift_chance_boost', 0.005, 'rare', '✨'),
  ('Old Man River', 'Country legend with decades of wisdom.', 'Country', 'xp_boost', 0.20, 'common', '🤠'),
  ('Zara Bassline', 'R&B groove specialist who tightens the rhythm section.', 'R&B', 'synergy_boost', 12, 'uncommon', '🎶');
