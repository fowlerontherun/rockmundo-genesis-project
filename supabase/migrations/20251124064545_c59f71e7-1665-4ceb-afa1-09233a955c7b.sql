-- Create stage templates table
CREATE TABLE IF NOT EXISTS stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL CHECK (size IN ('local', 'small', 'medium', 'large', 'festival')),
  capacity_min INTEGER NOT NULL DEFAULT 50,
  capacity_max INTEGER NOT NULL DEFAULT 500,
  gltf_asset_path TEXT,
  spline_scene_url TEXT,
  camera_offset JSONB DEFAULT '{"x": 0, "y": 1.6, "z": 5}'::jsonb,
  default_light_profile_id UUID,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create animation sets table
CREATE TABLE IF NOT EXISTS animation_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  clip_idle TEXT,
  clip_playing TEXT,
  clip_intro TEXT,
  clip_outro TEXT,
  clip_big_chorus TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create band avatar presets table
CREATE TABLE IF NOT EXISTS band_avatar_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  member_index INTEGER NOT NULL,
  avatar_model_path TEXT,
  instrument_type TEXT,
  gear_model_path TEXT,
  default_animation_set_id UUID REFERENCES animation_sets(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(band_id, member_index)
);

-- Create crowd animation presets table
CREATE TABLE IF NOT EXISTS crowd_animation_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  animation_clip_path TEXT,
  intensity NUMERIC(3,2) CHECK (intensity >= 0 AND intensity <= 1) DEFAULT 0.5,
  energy_level INTEGER CHECK (energy_level >= 0 AND energy_level <= 100) DEFAULT 50,
  allowed_in_zones TEXT[] DEFAULT ARRAY['front', 'mid', 'back'],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create crowd instances table
CREATE TABLE IF NOT EXISTS crowd_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_template_id UUID REFERENCES stage_templates(id) ON DELETE CASCADE,
  crowd_zone TEXT NOT NULL,
  density NUMERIC(3,2) CHECK (density >= 0 AND density <= 1) DEFAULT 0.7,
  max_instances INTEGER DEFAULT 100,
  animation_profile_id UUID REFERENCES crowd_animation_presets(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create band merch assets table
CREATE TABLE IF NOT EXISTS band_merch_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  logo_texture_path TEXT,
  tshirt_color_variants TEXT[] DEFAULT ARRAY['#000000', '#FFFFFF'],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(band_id)
);

-- Create gig stage instances table
CREATE TABLE IF NOT EXISTS gig_stage_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID REFERENCES gigs(id) ON DELETE CASCADE,
  stage_template_id UUID REFERENCES stage_templates(id),
  crowd_mood_weights JSONB DEFAULT '{"bored": 0.2, "jumping": 0.2, "handsUp": 0.2, "bouncing": 0.2, "tired": 0.1, "ecstatic": 0.1}'::jsonb,
  performance_quality INTEGER CHECK (performance_quality >= 0 AND performance_quality <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gig_id)
);

-- Add triggers for updated_at
CREATE TRIGGER update_stage_templates_updated_at
  BEFORE UPDATE ON stage_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_animation_sets_updated_at
  BEFORE UPDATE ON animation_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_band_avatar_presets_updated_at
  BEFORE UPDATE ON band_avatar_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crowd_animation_presets_updated_at
  BEFORE UPDATE ON crowd_animation_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crowd_instances_updated_at
  BEFORE UPDATE ON crowd_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_band_merch_assets_updated_at
  BEFORE UPDATE ON band_merch_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gig_stage_instances_updated_at
  BEFORE UPDATE ON gig_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE animation_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_avatar_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_animation_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_merch_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_stage_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active stage templates"
  ON stage_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage stage templates"
  ON stage_templates FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view animation sets"
  ON animation_sets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage animation sets"
  ON animation_sets FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view band avatar presets"
  ON band_avatar_presets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage their band avatar presets"
  ON band_avatar_presets FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view crowd animation presets"
  ON crowd_animation_presets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage crowd animation presets"
  ON crowd_animation_presets FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view crowd instances"
  ON crowd_instances FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage crowd instances"
  ON crowd_instances FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view band merch assets"
  ON band_merch_assets FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage their band merch assets"
  ON band_merch_assets FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view gig stage instances"
  ON gig_stage_instances FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage gig stage instances"
  ON gig_stage_instances FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Insert default crowd animation presets
INSERT INTO crowd_animation_presets (name, intensity, energy_level) VALUES
  ('Bored', 0.2, 10),
  ('Jumping', 0.8, 80),
  ('HandsUp', 0.9, 90),
  ('Bouncing', 0.6, 60),
  ('Tired', 0.1, 5),
  ('Ecstatic', 1.0, 100);

-- Insert a default stage template
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max) VALUES
  ('Small Club Stage', 'small-club', 'small', 50, 200);