-- Add collaborator and split columns to songs
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS co_writers text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS split_percentages numeric[] NOT NULL DEFAULT '{}'::numeric[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'songs_collaborator_splits_match'
      AND conrelid = 'public.songs'::regclass
  ) THEN
    ALTER TABLE public.songs
      ADD CONSTRAINT songs_collaborator_splits_match
      CHECK (
        COALESCE(array_length(co_writers, 1), 0) = COALESCE(array_length(split_percentages, 1), 0)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'songs_split_percentages_total'
      AND conrelid = 'public.songs'::regclass
  ) THEN
    ALTER TABLE public.songs
      ADD CONSTRAINT songs_split_percentages_total
      CHECK (
        COALESCE((SELECT SUM(value) FROM unnest(split_percentages) AS value), 0) <= 100
      );
  END IF;
END
$$;
