BEGIN;

-- Ensure the profile_gender enum contains all expected values
DO $$
BEGIN
  CREATE TYPE public.profile_gender AS ENUM (
    'female',
    'male',
    'non_binary',
    'other',
    'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add requested demographic fields to player profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender public.profile_gender,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS city_of_birth uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS current_city uuid REFERENCES public.cities(id);

-- Backfill defaults so existing rows satisfy new constraints
UPDATE public.profiles
SET gender = COALESCE(gender, 'prefer_not_to_say');

ALTER TABLE public.profiles
  ALTER COLUMN gender SET DEFAULT 'prefer_not_to_say',
  ALTER COLUMN gender SET NOT NULL;

UPDATE public.profiles
SET age = COALESCE(age, 16);

ALTER TABLE public.profiles
  ALTER COLUMN age SET DEFAULT 16,
  ALTER COLUMN age SET NOT NULL;

-- Guard against unrealistic age values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_age_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_check CHECK (age BETWEEN 13 AND 120);
  END IF;
END $$;

-- Update the public profile view so consumers can access the new data
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  user_id,
  username,
  display_name,
  avatar_url,
  bio,
  gender,
  city_of_birth,
  age,
  current_city
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Ensure PostgREST becomes aware of the schema changes immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
