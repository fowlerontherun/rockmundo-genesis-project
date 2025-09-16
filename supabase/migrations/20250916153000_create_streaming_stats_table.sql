-- Create streaming_stats table for tracking per-song streaming performance
CREATE TABLE IF NOT EXISTS public.streaming_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL,
  user_id uuid NOT NULL,
  total_streams integer NOT NULL DEFAULT 0,
  total_revenue numeric(12,2) NOT NULL DEFAULT 0,
  platform_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT streaming_stats_song_id_fkey
    FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE,
  CONSTRAINT streaming_stats_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT streaming_stats_song_unique UNIQUE (song_id)
);

-- Ensure faster lookups by song and user
CREATE INDEX IF NOT EXISTS idx_streaming_stats_song_id ON public.streaming_stats(song_id);
CREATE INDEX IF NOT EXISTS idx_streaming_stats_user_id ON public.streaming_stats(user_id);

-- Enable row level security
ALTER TABLE public.streaming_stats ENABLE ROW LEVEL SECURITY;

-- Policies to allow users to manage their own streaming stats
CREATE POLICY "Users can view their streaming stats"
  ON public.streaming_stats
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their streaming stats"
  ON public.streaming_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their streaming stats"
  ON public.streaming_stats
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their streaming stats"
  ON public.streaming_stats
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.update_streaming_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_streaming_stats_updated_at ON public.streaming_stats;
CREATE TRIGGER update_streaming_stats_updated_at
BEFORE UPDATE ON public.streaming_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_streaming_stats_updated_at();
