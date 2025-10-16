-- Add song familiarity tracking table
CREATE TABLE IF NOT EXISTS public.band_song_familiarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  familiarity_minutes INTEGER NOT NULL DEFAULT 0,
  familiarity_percentage INTEGER GENERATED ALWAYS AS (LEAST(100, (familiarity_minutes * 100) / 60)) STORED,
  last_rehearsed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(band_id, song_id)
);

-- Enable RLS
ALTER TABLE public.band_song_familiarity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Band members can view their song familiarity"
  ON public.band_song_familiarity FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can update their song familiarity"
  ON public.band_song_familiarity FOR INSERT
  WITH CHECK (
    band_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can update familiarity"
  ON public.band_song_familiarity FOR UPDATE
  USING (
    band_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    )
  );

-- Add selected_song_id to band_rehearsals table
ALTER TABLE public.band_rehearsals 
ADD COLUMN IF NOT EXISTS selected_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL;

-- Add familiarity_gained column to track what was gained in this rehearsal
ALTER TABLE public.band_rehearsals 
ADD COLUMN IF NOT EXISTS familiarity_gained INTEGER DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_band_song_familiarity_band 
  ON public.band_song_familiarity(band_id);
CREATE INDEX IF NOT EXISTS idx_band_song_familiarity_song 
  ON public.band_song_familiarity(song_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_band_song_familiarity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_band_song_familiarity_timestamp
  BEFORE UPDATE ON public.band_song_familiarity
  FOR EACH ROW
  EXECUTE FUNCTION update_band_song_familiarity_updated_at();