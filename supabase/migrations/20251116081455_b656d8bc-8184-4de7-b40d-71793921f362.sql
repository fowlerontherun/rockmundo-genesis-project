-- Phase 3: Player Instruments & Achievements
-- Add missing columns for player instruments tracking
CREATE TABLE IF NOT EXISTS player_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  skill_level INTEGER NOT NULL DEFAULT 0,
  experience_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, instrument)
);

-- Enable RLS
ALTER TABLE player_instruments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_instruments
CREATE POLICY "Users can view all player instruments"
  ON player_instruments FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own instruments"
  ON player_instruments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instruments"
  ON player_instruments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Phase 4: Music Video System
-- The original June 2025 music-video migrations ran before releases/bands/band_members
-- existed on a clean database. Create the complete intended schema here, after those
-- dependencies are available, so fresh resets match evolved/deployed databases.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_enum') THEN
    CREATE TYPE public.video_status_enum AS ENUM (
      'draft',
      'planned',
      'in_production',
      'post_production',
      'released',
      'archived'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS music_video_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE SET NULL,
  band_id UUID REFERENCES bands(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  theme TEXT NOT NULL,
  art_style TEXT NOT NULL,
  budget_tier TEXT NOT NULL,
  image_quality TEXT NOT NULL,
  cast_option TEXT NOT NULL,
  cast_quality TEXT,
  location_style TEXT,
  production_notes TEXT,
  youtube_video_url TEXT,
  budget_amount INTEGER NOT NULL DEFAULT 0,
  production_value_score INTEGER NOT NULL DEFAULT 0,
  youtube_views BIGINT NOT NULL DEFAULT 0,
  chart_position INTEGER,
  chart_velocity INTEGER NOT NULL DEFAULT 0,
  mtv_spins INTEGER NOT NULL DEFAULT 0,
  status public.video_status_enum NOT NULL DEFAULT 'planned',
  target_release_date DATE,
  shoot_start_date DATE,
  shoot_end_date DATE,
  primary_platform TEXT,
  kpi_view_target BIGINT,
  kpi_chart_target TEXT,
  sync_strategy TEXT NOT NULL DEFAULT 'manual',
  release_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR band_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS music_video_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  music_video_id UUID NOT NULL REFERENCES music_video_configs(id) ON DELETE CASCADE,
  youtube_video_id TEXT,
  youtube_views BIGINT DEFAULT 0,
  chart_name TEXT,
  chart_position INTEGER,
  chart_velocity INTEGER,
  mtv_program TEXT,
  mtv_spins INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  platform TEXT,
  views_target BIGINT,
  chart_target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT music_video_metrics_music_video_id_key UNIQUE (music_video_id)
);

ALTER TABLE music_video_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_video_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own music videos"
  ON music_video_configs FOR SELECT
  USING (
    auth.uid() = user_id OR
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create their own music videos"
  ON music_video_configs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()) AND user_id IS NULL)
  );

CREATE POLICY "Users can update their own music videos"
  ON music_video_configs FOR UPDATE
  USING (
    auth.uid() = user_id OR
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their music video metrics"
  ON music_video_metrics FOR SELECT
  USING (
    music_video_id IN (
      SELECT id FROM music_video_configs
      WHERE auth.uid() = user_id
         OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage their music video metrics"
  ON music_video_metrics FOR ALL
  USING (
    music_video_id IN (
      SELECT id FROM music_video_configs
      WHERE auth.uid() = user_id
         OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    music_video_id IN (
      SELECT id FROM music_video_configs
      WHERE auth.uid() = user_id
         OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    )
  );

-- Phase 5: Training & Personal Gear Systems
-- Create player_personal_gear table
CREATE TABLE IF NOT EXISTS player_personal_gear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gear_type TEXT NOT NULL,
  gear_name TEXT NOT NULL,
  quality_rating INTEGER NOT NULL DEFAULT 50,
  condition_rating INTEGER NOT NULL DEFAULT 100,
  purchase_cost INTEGER,
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  stat_boosts JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE player_personal_gear ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_personal_gear
CREATE POLICY "Users can manage their own gear"
  ON player_personal_gear FOR ALL
  USING (auth.uid() = user_id);

-- Create player_training_sessions table
CREATE TABLE IF NOT EXISTS player_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'practice',
  duration_hours INTEGER NOT NULL DEFAULT 1,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  focus_area TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE player_training_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_training_sessions
CREATE POLICY "Users can view their own training sessions"
  ON player_training_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training sessions"
  ON player_training_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training sessions"
  ON player_training_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_instruments_user_id ON player_instruments(user_id);
CREATE INDEX IF NOT EXISTS idx_music_video_configs_user_id ON music_video_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_music_video_configs_band_id ON music_video_configs(band_id);
CREATE INDEX IF NOT EXISTS idx_music_video_configs_song_id ON music_video_configs(song_id);
CREATE INDEX IF NOT EXISTS idx_music_video_configs_release_id ON music_video_configs(release_id);
CREATE INDEX IF NOT EXISTS idx_music_video_metrics_video_id ON music_video_metrics(music_video_id);
CREATE INDEX IF NOT EXISTS idx_player_personal_gear_user_id ON player_personal_gear(user_id);
CREATE INDEX IF NOT EXISTS idx_player_training_sessions_user_id ON player_training_sessions(user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_player_instruments_updated_at
  BEFORE UPDATE ON player_instruments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_music_video_configs_updated_at
  BEFORE UPDATE ON music_video_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_music_video_metrics_updated_at
  BEFORE UPDATE ON music_video_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_personal_gear_updated_at
  BEFORE UPDATE ON player_personal_gear
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_training_sessions_updated_at
  BEFORE UPDATE ON player_training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();