-- DikCok: Short-form video platform for bands

-- Video templates catalog
CREATE TABLE dikcok_video_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Advanced')),
  unlock_requirement TEXT,
  duration_hint TEXT,
  signature_effects TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-created videos
CREATE TABLE dikcok_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL,
  video_type_id UUID NOT NULL REFERENCES dikcok_video_types(id),
  track_id UUID REFERENCES songs(id),
  title TEXT NOT NULL,
  description TEXT,
  views INTEGER DEFAULT 0,
  hype_gained INTEGER DEFAULT 0,
  fan_gain INTEGER DEFAULT 0,
  trending_tag TEXT,
  engagement_velocity TEXT DEFAULT 'Niche' CHECK (engagement_velocity IN ('Exploding', 'Trending', 'Stable', 'Niche')),
  best_for_feeds TEXT[] DEFAULT ARRAY['ForYou'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DikCok challenges
CREATE TABLE dikcok_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  requirements TEXT[],
  rewards TEXT[],
  sponsor TEXT,
  cross_game_hook TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge participation
CREATE TABLE dikcok_challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES dikcok_challenges(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES dikcok_videos(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, video_id)
);

-- Fan missions for bands
CREATE TABLE dikcok_fan_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  target_count INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  rewards TEXT[],
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video reactions (likes, shares, duets)
CREATE TABLE dikcok_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES dikcok_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'share', 'duet')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, user_id, reaction_type)
);

-- Video comments
CREATE TABLE dikcok_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES dikcok_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trending forecasts
CREATE TABLE dikcok_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_tag TEXT NOT NULL,
  prediction_window TEXT NOT NULL,
  projected_outcome TEXT NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  wager_range TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dikcok_video_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_fan_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikcok_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Video types are public
CREATE POLICY "Video types are viewable by everyone" ON dikcok_video_types
  FOR SELECT USING (true);

-- Videos: viewable by everyone, creatable by authenticated users
CREATE POLICY "Videos are viewable by everyone" ON dikcok_videos
  FOR SELECT USING (true);

CREATE POLICY "Users can create videos for their bands" ON dikcok_videos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = dikcok_videos.band_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their band's videos" ON dikcok_videos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = dikcok_videos.band_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their band's videos" ON dikcok_videos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = dikcok_videos.band_id
      AND user_id = auth.uid()
    )
  );

-- Challenges: viewable by everyone
CREATE POLICY "Challenges are viewable by everyone" ON dikcok_challenges
  FOR SELECT USING (true);

-- Challenge entries: viewable by everyone, creatable by band members
CREATE POLICY "Challenge entries are viewable by everyone" ON dikcok_challenge_entries
  FOR SELECT USING (true);

CREATE POLICY "Users can enter challenges for their bands" ON dikcok_challenge_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_id = dikcok_challenge_entries.band_id
      AND user_id = auth.uid()
    )
  );

-- Fan missions: viewable by everyone
CREATE POLICY "Fan missions are viewable by everyone" ON dikcok_fan_missions
  FOR SELECT USING (true);

-- Reactions: users can manage their own
CREATE POLICY "Users can view all reactions" ON dikcok_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own reactions" ON dikcok_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON dikcok_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Comments: viewable by everyone, users manage their own
CREATE POLICY "Comments are viewable by everyone" ON dikcok_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON dikcok_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON dikcok_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON dikcok_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Forecasts: viewable by everyone
CREATE POLICY "Forecasts are viewable by everyone" ON dikcok_forecasts
  FOR SELECT USING (true);

-- Update trigger for videos
CREATE TRIGGER update_dikcok_videos_updated_at
  BEFORE UPDATE ON dikcok_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update video views counter
CREATE OR REPLACE FUNCTION increment_dikcok_video_views(p_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE dikcok_videos
  SET views = views + 1
  WHERE id = p_video_id;
END;
$$;

-- Insert seed data for video types
INSERT INTO dikcok_video_types (name, category, description, difficulty, unlock_requirement, duration_hint, signature_effects) VALUES
('Dance Challenge', 'Performance', 'Choreographed routine to your track', 'Easy', 'None', '15-30 seconds', ARRAY['Fast cuts', 'Mirror effect', 'Speed ramp']),
('Lip Sync Battle', 'Performance', 'Dramatic lip-sync performance', 'Easy', 'None', '20-45 seconds', ARRAY['Closeup shots', 'Dramatic lighting', 'Text overlay']),
('Behind the Scenes', 'Documentary', 'Show your creative process', 'Easy', 'None', '30-60 seconds', ARRAY['Timelapse', 'Voiceover', 'Candid shots']),
('Acoustic Session', 'Music', 'Stripped-down acoustic version', 'Medium', '5 fans', '45-90 seconds', ARRAY['Warm filter', 'Natural lighting', 'Single take']),
('Fan Duet', 'Collaboration', 'Collaborate with a fan', 'Medium', '50 fans', '30-60 seconds', ARRAY['Split screen', 'Harmony visualization', 'Reaction shots']),
('Music Video Snippet', 'Production', 'High-production teaser clip', 'Advanced', '100 fans', '15-30 seconds', ARRAY['Cinematic grade', 'VFX', 'Professional cuts']),
('Genre Mashup', 'Creative', 'Blend your track with another genre', 'Advanced', '200 fans', '30-60 seconds', ARRAY['Audio splice', 'Style transition', 'Genre markers']),
('Fan Story Feature', 'Community', 'Showcase fan stories', 'Medium', '20 fans', '45-75 seconds', ARRAY['Fan clips', 'Testimonials', 'Montage'])