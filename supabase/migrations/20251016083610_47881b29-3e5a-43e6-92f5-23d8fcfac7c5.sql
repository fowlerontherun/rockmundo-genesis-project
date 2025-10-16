-- Create setlists table
CREATE TABLE public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  setlist_type VARCHAR NOT NULL DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create setlist_songs junction table
CREATE TABLE public.setlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(setlist_id, song_id),
  UNIQUE(setlist_id, position)
);

-- Add columns to gigs table
ALTER TABLE public.gigs 
ADD COLUMN IF NOT EXISTS setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ticket_price INTEGER,
ADD COLUMN IF NOT EXISTS estimated_attendance INTEGER,
ADD COLUMN IF NOT EXISTS estimated_revenue INTEGER;

-- Enable RLS
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for setlists
CREATE POLICY "Band members can view their setlists"
ON public.setlists FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Band members can create setlists"
ON public.setlists FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Band members can update their setlists"
ON public.setlists FOR UPDATE
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Band members can delete their setlists"
ON public.setlists FOR DELETE
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

-- RLS Policies for setlist_songs
CREATE POLICY "Band members can view setlist songs"
ON public.setlist_songs FOR SELECT
USING (
  setlist_id IN (
    SELECT id FROM public.setlists WHERE band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Band members can add songs to setlists"
ON public.setlist_songs FOR INSERT
WITH CHECK (
  setlist_id IN (
    SELECT id FROM public.setlists WHERE band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Band members can update setlist songs"
ON public.setlist_songs FOR UPDATE
USING (
  setlist_id IN (
    SELECT id FROM public.setlists WHERE band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Band members can remove songs from setlists"
ON public.setlist_songs FOR DELETE
USING (
  setlist_id IN (
    SELECT id FROM public.setlists WHERE band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
);

-- Add updated_at trigger for setlists
CREATE TRIGGER update_setlists_updated_at
BEFORE UPDATE ON public.setlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_setlist_songs_setlist_id ON public.setlist_songs(setlist_id);
CREATE INDEX idx_setlist_songs_position ON public.setlist_songs(setlist_id, position);
CREATE INDEX idx_setlists_band_id ON public.setlists(band_id);