-- Make the existing performance-item execution path physically writable.
-- Historical schemas left gig_song_performances.song_id NOT NULL and, on some
-- databases, pointed performance_item_id at the superseded catalogue table.

ALTER TABLE public.gig_song_performances
  ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'song',
  ADD COLUMN IF NOT EXISTS performance_item_id uuid,
  ADD COLUMN IF NOT EXISTS performance_item_name text,
  ALTER COLUMN song_id DROP NOT NULL,
  ALTER COLUMN item_type SET DEFAULT 'song';

ALTER TABLE public.gig_song_performances
  DROP CONSTRAINT IF EXISTS gig_song_performances_performance_item_id_fkey;

ALTER TABLE public.gig_song_performances
  ADD CONSTRAINT gig_song_performances_performance_item_id_fkey
  FOREIGN KEY (performance_item_id)
  REFERENCES public.performance_items_catalog(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.gig_song_performances
  DROP CONSTRAINT IF EXISTS gig_song_performances_item_identity_check;

-- Preserve inconsistent historic rows for report compatibility while making
-- every new result identify exactly one canonical setlist item.
ALTER TABLE public.gig_song_performances
  ADD CONSTRAINT gig_song_performances_item_identity_check
  CHECK (
    (COALESCE(item_type, 'song') = 'song' AND song_id IS NOT NULL AND performance_item_id IS NULL)
    OR
    (item_type = 'performance_item' AND song_id IS NULL AND performance_item_id IS NOT NULL)
  )
  NOT VALID;

CREATE INDEX IF NOT EXISTS gig_song_performances_performance_item_idx
  ON public.gig_song_performances (performance_item_id)
  WHERE performance_item_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
