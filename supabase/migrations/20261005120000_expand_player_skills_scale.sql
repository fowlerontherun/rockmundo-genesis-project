-- Expand player skill range to support 0-1000 scale
BEGIN;

ALTER TABLE public.player_skills
  DROP CONSTRAINT IF EXISTS player_skills_value_bounds_check;

UPDATE public.player_skills
SET
  guitar = LEAST(GREATEST(COALESCE(guitar, 0), 0), 100) * 10,
  vocals = LEAST(GREATEST(COALESCE(vocals, 0), 0), 100) * 10,
  drums = LEAST(GREATEST(COALESCE(drums, 0), 0), 100) * 10,
  bass = LEAST(GREATEST(COALESCE(bass, 0), 0), 100) * 10,
  performance = LEAST(GREATEST(COALESCE(performance, 0), 0), 100) * 10,
  songwriting = LEAST(GREATEST(COALESCE(songwriting, 0), 0), 100) * 10,
  composition = LEAST(GREATEST(COALESCE(composition, 0), 0), 100) * 10,
  technical = LEAST(GREATEST(COALESCE(technical, 0), 0), 100) * 10;

ALTER TABLE public.player_skills
  ALTER COLUMN guitar SET DEFAULT 100,
  ALTER COLUMN vocals SET DEFAULT 100,
  ALTER COLUMN drums SET DEFAULT 100,
  ALTER COLUMN bass SET DEFAULT 100,
  ALTER COLUMN performance SET DEFAULT 100,
  ALTER COLUMN songwriting SET DEFAULT 100,
  ALTER COLUMN composition SET DEFAULT 100,
  ALTER COLUMN technical SET DEFAULT 100;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_value_bounds_check CHECK (
    guitar BETWEEN 0 AND 1000 AND
    vocals BETWEEN 0 AND 1000 AND
    drums BETWEEN 0 AND 1000 AND
    bass BETWEEN 0 AND 1000 AND
    performance BETWEEN 0 AND 1000 AND
    songwriting BETWEEN 0 AND 1000 AND
    composition BETWEEN 0 AND 1000 AND
    technical BETWEEN 0 AND 1000
  );

COMMIT;
