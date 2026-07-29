-- Extend the established artist-owned songs schema without replacing it.
-- The base schema creates public.songs with artist_id ownership, public-read RLS
-- and an updated_at trigger. Preserve those contracts and add only missing
-- compatibility fields used by later features.
DO $$
BEGIN
  IF to_regclass('public.songs') IS NULL THEN
    RAISE EXCEPTION 'songs_missing_before_legacy_compatibility_migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'songs'
      AND column_name = 'artist_id'
  ) THEN
    RAISE EXCEPTION 'canonical_song_artist_id_missing';
  END IF;
END
$$;

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyrics text,
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS streams bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_position integer;

-- Retain compatibility fields expected by the original equipment UI.
ALTER TABLE public.player_equipment
  ADD COLUMN IF NOT EXISTS equipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.player_equipment
SET equipped = coalesce(equipped, is_equipped, false),
    condition = coalesce(condition, 100),
    created_at = coalesce(created_at, purchased_at, now())
WHERE equipped IS NULL
   OR condition IS NULL
   OR created_at IS NULL;

-- The main character table is public.profiles. public.player_profiles is a much
-- later social projection and must not be referenced here.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fans integer NOT NULL DEFAULT 0;

-- Preserve the legacy gig history table without touching the canonical gigs.
CREATE TABLE IF NOT EXISTS public.gig_performances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  performance_score integer,
  earnings numeric(12,2),
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_performances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gig performances"
  ON public.gig_performances;
CREATE POLICY "Users can view their own gig performances"
  ON public.gig_performances
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own gig performances"
  ON public.gig_performances;
CREATE POLICY "Users can create their own gig performances"
  ON public.gig_performances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add the legacy skill aliases without resetting any existing progression.
ALTER TABLE public.player_skills
  ADD COLUMN IF NOT EXISTS creativity integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS technical integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS business integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS marketing integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS composition integer NOT NULL DEFAULT 10;

-- Song ownership policies and the updated_at trigger remain owned by the base
-- schema. Do not create user_id policies or a second trigger here.