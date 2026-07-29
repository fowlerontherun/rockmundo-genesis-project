-- Repair deployed collaborator constraints without rewriting existing song data.
CREATE OR REPLACE FUNCTION public.song_collaborator_splits_valid(
  p_co_writers text[],
  p_split_percentages numeric[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT
    cardinality(p_co_writers) = cardinality(p_split_percentages)
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_split_percentages) AS split(value)
      WHERE split.value < 0 OR split.value > 100
    )
    AND COALESCE((
      SELECT SUM(split.value)
      FROM unnest(p_split_percentages) AS split(value)
    ), 0) <= 100;
$$;

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS co_writers text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS split_percentages numeric[] NOT NULL DEFAULT '{}'::numeric[];

DO $$
BEGIN
  ALTER TABLE public.songs
    DROP CONSTRAINT IF EXISTS songs_collaborator_splits_match,
    DROP CONSTRAINT IF EXISTS songs_split_percentages_total;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.songs'::regclass
      AND conname = 'songs_collaborator_splits_valid'
  ) THEN
    ALTER TABLE public.songs
      ADD CONSTRAINT songs_collaborator_splits_valid
      CHECK (public.song_collaborator_splits_valid(co_writers, split_percentages))
      NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT songs_collaborator_splits_valid ON public.songs IS
  'Collaborator names and shares must align; each share is 0-100 and the total is at most 100. Existing legacy rows remain unvalidated until reviewed.';
