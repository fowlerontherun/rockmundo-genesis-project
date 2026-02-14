
-- Create song_covers table for cover song licensing
CREATE TABLE public.song_covers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  covering_band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  original_band_id UUID REFERENCES public.bands(id),
  original_user_id UUID REFERENCES auth.users(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('flat_fee', 'royalty_split')),
  flat_fee_amount NUMERIC DEFAULT 0,
  royalty_percentage NUMERIC DEFAULT 50,
  cover_quality NUMERIC DEFAULT 0,
  skill_multiplier NUMERIC DEFAULT 0,
  licensed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(original_song_id, covering_band_id)
);

-- Enable RLS
ALTER TABLE public.song_covers ENABLE ROW LEVEL SECURITY;

-- Players can view all covers (public info)
CREATE POLICY "Anyone can view song covers"
  ON public.song_covers FOR SELECT
  USING (true);

-- Band members can create covers for their band
CREATE POLICY "Band members can create covers"
  ON public.song_covers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = song_covers.covering_band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Band members can delete their band's covers
CREATE POLICY "Band members can delete their covers"
  ON public.song_covers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = song_covers.covering_band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX idx_song_covers_original_song ON public.song_covers(original_song_id);
CREATE INDEX idx_song_covers_covering_band ON public.song_covers(covering_band_id);
CREATE INDEX idx_song_covers_original_band ON public.song_covers(original_band_id);
