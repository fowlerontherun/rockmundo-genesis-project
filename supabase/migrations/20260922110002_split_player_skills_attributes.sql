BEGIN;

-- Drop legacy constraints to prepare for the new scaling rules
ALTER TABLE public.player_skills
  DROP CONSTRAINT IF EXISTS player_skills_value_bounds_check,
  DROP CONSTRAINT IF EXISTS player_skills_total_points_check;

-- Scale existing instrument skills to the new 0-100 range
UPDATE public.player_skills
SET
  guitar = LEAST(GREATEST(COALESCE(guitar, 0) * 10, 0), 100),
  vocals = LEAST(GREATEST(COALESCE(vocals, 0) * 10, 0), 100),
  drums = LEAST(GREATEST(COALESCE(drums, 0) * 10, 0), 100),
  bass = LEAST(GREATEST(COALESCE(bass, 0) * 10, 0), 100),
  performance = LEAST(GREATEST(COALESCE(performance, 0) * 10, 0), 100),
  songwriting = LEAST(GREATEST(COALESCE(songwriting, 0) * 10, 0), 100);

-- Create the dedicated attributes table with wider 0-1000 ranges
CREATE TABLE IF NOT EXISTS public.player_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  composition integer NOT NULL DEFAULT 100,
  creativity integer NOT NULL DEFAULT 100,
  business integer NOT NULL DEFAULT 100,
  marketing integer NOT NULL DEFAULT 100,
  technical integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_attributes
  ADD CONSTRAINT player_attributes_value_bounds CHECK (
    composition BETWEEN 0 AND 1000 AND
    creativity BETWEEN 0 AND 1000 AND
    business BETWEEN 0 AND 1000 AND
    marketing BETWEEN 0 AND 1000 AND
    technical BETWEEN 0 AND 1000
  );

ALTER TABLE public.player_attributes
  ADD CONSTRAINT player_attributes_user_id_key UNIQUE (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_attributes_profile_id_unique
  ON public.player_attributes (profile_id)
  WHERE profile_id IS NOT NULL;

-- Migrate the legacy attribute data out of player_skills
INSERT INTO public.player_attributes (
  user_id,
  profile_id,
  composition,
  creativity,
  business,
  marketing,
  technical
)
SELECT
  user_id,
  profile_id,
  LEAST(GREATEST(COALESCE(composition, 0) * 100, 0), 1000),
  LEAST(GREATEST(COALESCE(creativity, 0) * 100, 0), 1000),
  LEAST(GREATEST(COALESCE(business, 0) * 100, 0), 1000),
  LEAST(GREATEST(COALESCE(marketing, 0) * 100, 0), 1000),
  LEAST(GREATEST(COALESCE(technical, 0) * 100, 0), 1000)
FROM public.player_skills
ON CONFLICT (user_id) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  composition = EXCLUDED.composition,
  creativity = EXCLUDED.creativity,
  business = EXCLUDED.business,
  marketing = EXCLUDED.marketing,
  technical = EXCLUDED.technical,
  updated_at = now();

-- Remove the migrated attribute columns from player_skills
ALTER TABLE public.player_skills
  DROP COLUMN IF EXISTS composition,
  DROP COLUMN IF EXISTS creativity,
  DROP COLUMN IF EXISTS business,
  DROP COLUMN IF EXISTS marketing,
  DROP COLUMN IF EXISTS technical;

-- Set new defaults aligned with the 0-100 instrument scale
ALTER TABLE public.player_skills
  ALTER COLUMN guitar SET DEFAULT 10,
  ALTER COLUMN vocals SET DEFAULT 10,
  ALTER COLUMN drums SET DEFAULT 10,
  ALTER COLUMN bass SET DEFAULT 10,
  ALTER COLUMN performance SET DEFAULT 10,
  ALTER COLUMN songwriting SET DEFAULT 10;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_instrument_bounds CHECK (
    guitar BETWEEN 0 AND 100 AND
    vocals BETWEEN 0 AND 100 AND
    drums BETWEEN 0 AND 100 AND
    bass BETWEEN 0 AND 100 AND
    performance BETWEEN 0 AND 100 AND
    songwriting BETWEEN 0 AND 100
  );

-- Secure the new table with RLS similar to player_skills
ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Attributes are viewable by everyone"
  ON public.player_attributes FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can update their own attributes"
  ON public.player_attributes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own attributes"
  ON public.player_attributes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER IF NOT EXISTS update_player_attributes_updated_at
  BEFORE UPDATE ON public.player_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
