-- POV Clip Templates table for concert viewer
CREATE TABLE public.pov_clip_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_role text NOT NULL CHECK (instrument_role IN ('guitarist', 'bassist', 'drummer', 'vocalist', 'keyboardist')),
  clip_type text NOT NULL CHECK (clip_type IN ('playing', 'crowd_look', 'stage_scan', 'solo_focus', 'intro', 'outro')),
  description text,
  camera_position jsonb DEFAULT '{"x": 0, "y": 0, "z": 0}',
  duration_range int[] DEFAULT ARRAY[3, 8],
  energy_level text DEFAULT 'medium' CHECK (energy_level IN ('low', 'medium', 'high', 'climax')),
  overlays text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_pov_clip_templates_role ON public.pov_clip_templates(instrument_role);
CREATE INDEX idx_pov_clip_templates_energy ON public.pov_clip_templates(energy_level);

-- Enable RLS
ALTER TABLE public.pov_clip_templates ENABLE ROW LEVEL SECURITY;

-- Allow all users to read POV clip templates
CREATE POLICY "Anyone can view POV clip templates"
  ON public.pov_clip_templates
  FOR SELECT
  USING (true);

-- Insert default POV clip templates
INSERT INTO public.pov_clip_templates (instrument_role, clip_type, description, energy_level, overlays) VALUES
  -- Guitarist clips
  ('guitarist', 'playing', 'Looking down at fretboard while playing', 'medium', ARRAY['stage_lights']),
  ('guitarist', 'solo_focus', 'Intense focus on guitar solo', 'high', ARRAY['lens_flare', 'sweat_drops']),
  ('guitarist', 'crowd_look', 'Glancing up at the crowd', 'medium', ARRAY['crowd_hands', 'stage_lights']),
  ('guitarist', 'stage_scan', 'Scanning across the stage', 'low', ARRAY['haze']),
  
  -- Bassist clips
  ('bassist', 'playing', 'Looking down at bass neck', 'medium', ARRAY['stage_lights']),
  ('bassist', 'crowd_look', 'Nodding to the rhythm while watching crowd', 'medium', ARRAY['crowd_hands']),
  ('bassist', 'stage_scan', 'Looking at drummer for timing', 'low', ARRAY['haze']),
  
  -- Drummer clips
  ('drummer', 'playing', 'Sticks hitting snare and hi-hat', 'high', ARRAY['sweat_drops']),
  ('drummer', 'crowd_look', 'Looking through cymbals at crowd', 'medium', ARRAY['crowd_hands', 'lens_flare']),
  ('drummer', 'solo_focus', 'Intense drum fill moment', 'climax', ARRAY['lens_flare', 'sweat_drops', 'strobe']),
  
  -- Vocalist clips
  ('vocalist', 'playing', 'Holding microphone, facing crowd', 'medium', ARRAY['stage_lights', 'crowd_hands']),
  ('vocalist', 'crowd_look', 'Reaching out to crowd', 'high', ARRAY['crowd_hands', 'lens_flare']),
  ('vocalist', 'intro', 'Walking onto stage', 'low', ARRAY['haze', 'stage_lights']),
  ('vocalist', 'outro', 'Final bow, crowd cheering', 'high', ARRAY['confetti', 'crowd_hands']),
  
  -- Keyboardist clips
  ('keyboardist', 'playing', 'Hands moving across keys', 'medium', ARRAY['stage_lights']),
  ('keyboardist', 'crowd_look', 'Looking up from synth at audience', 'medium', ARRAY['crowd_hands']),
  ('keyboardist', 'stage_scan', 'Watching other band members', 'low', ARRAY['haze']);