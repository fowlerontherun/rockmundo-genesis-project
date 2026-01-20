-- Add setlist_id column to band_rehearsals to support setlist rehearsals
ALTER TABLE public.band_rehearsals 
ADD COLUMN setlist_id uuid REFERENCES public.setlists(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_band_rehearsals_setlist_id ON public.band_rehearsals(setlist_id);

-- Add comment for clarity
COMMENT ON COLUMN public.band_rehearsals.setlist_id IS 'Optional: When rehearsing an entire setlist, this references the setlist. Mutually exclusive with selected_song_id.';