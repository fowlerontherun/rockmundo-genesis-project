-- Add extended audio columns to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS extended_audio_url text,
ADD COLUMN IF NOT EXISTS extended_audio_generated_at timestamptz,
ADD COLUMN IF NOT EXISTS is_extended_featured boolean DEFAULT false;

-- Create chart_featured_songs table for tracking weekly featured songs
CREATE TABLE IF NOT EXISTS public.chart_featured_songs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid REFERENCES public.songs(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL,
  chart_type text NOT NULL,
  chart_position integer NOT NULL,
  featured_week date NOT NULL,
  extended_generated boolean DEFAULT false,
  released_to_streaming boolean DEFAULT false,
  streaming_release_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(song_id, featured_week)
);

-- Enable RLS
ALTER TABLE public.chart_featured_songs ENABLE ROW LEVEL SECURITY;

-- Admin can do everything using get_user_role function
CREATE POLICY "Admins can manage featured songs" ON public.chart_featured_songs
  FOR ALL USING (
    (SELECT public.get_user_role(auth.uid())) = 'admin'
  );

-- Everyone can view featured songs
CREATE POLICY "Anyone can view featured songs" ON public.chart_featured_songs
  FOR SELECT USING (true);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_chart_featured_songs_week ON public.chart_featured_songs(featured_week);
CREATE INDEX IF NOT EXISTS idx_chart_featured_songs_song ON public.chart_featured_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_songs_extended_audio ON public.songs(extended_audio_url) WHERE extended_audio_url IS NOT NULL;