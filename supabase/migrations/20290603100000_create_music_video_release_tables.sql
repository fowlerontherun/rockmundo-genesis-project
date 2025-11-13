-- Create table to store music video configuration per release
CREATE TABLE public.music_video_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid REFERENCES releases(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid REFERENCES bands(id) ON DELETE SET NULL,
  theme text NOT NULL,
  art_style text NOT NULL,
  budget_tier text NOT NULL,
  budget_amount integer NOT NULL DEFAULT 0,
  image_quality text NOT NULL,
  cast_option text NOT NULL,
  cast_quality text,
  location_style text,
  production_notes text,
  youtube_video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Store external metrics captured for each music video
CREATE TABLE public.music_video_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  music_video_id uuid NOT NULL REFERENCES music_video_configs(id) ON DELETE CASCADE,
  youtube_video_id text,
  youtube_views bigint DEFAULT 0,
  chart_name text,
  chart_position integer,
  chart_velocity integer,
  mtv_program text,
  mtv_spins integer DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT music_video_metrics_music_video_id_key UNIQUE (music_video_id)
);

-- Enable row level security
ALTER TABLE public.music_video_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_video_metrics ENABLE ROW LEVEL SECURITY;

-- Allow artists and band members to access their configurations
CREATE POLICY "Users can view their music video configs"
ON public.music_video_configs FOR SELECT
USING (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage their music video configs"
ON public.music_video_configs FOR ALL
USING (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

-- Allow metrics access through parent ownership
CREATE POLICY "Users can view their music video metrics"
ON public.music_video_metrics FOR SELECT
USING (
  music_video_id IN (
    SELECT id FROM music_video_configs
    WHERE auth.uid() = user_id
      OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage their music video metrics"
ON public.music_video_metrics FOR ALL
USING (
  music_video_id IN (
    SELECT id FROM music_video_configs
    WHERE auth.uid() = user_id
      OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

-- Keep timestamps fresh
CREATE TRIGGER update_music_video_configs_updated_at
BEFORE UPDATE ON public.music_video_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_music_video_metrics_updated_at
BEFORE UPDATE ON public.music_video_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
