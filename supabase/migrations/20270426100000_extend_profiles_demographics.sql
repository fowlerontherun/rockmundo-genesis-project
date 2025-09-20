BEGIN;

-- Ensure the profile_gender enum exists with all expected values
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

-- Add any missing profile columns used by the application
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender public.profile_gender,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS city_of_birth uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS current_city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS health integer;

-- Apply defaults and constraints expected by the UI
UPDATE public.profiles
SET gender = COALESCE(gender, 'prefer_not_to_say')
WHERE gender IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN gender SET DEFAULT 'prefer_not_to_say',
  ALTER COLUMN gender SET NOT NULL;

UPDATE public.profiles
SET age = COALESCE(age, 16)
WHERE age IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN age SET DEFAULT 16,
  ALTER COLUMN age SET NOT NULL;

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

UPDATE public.profiles
SET current_location = COALESCE(current_location, 'Unknown')
WHERE current_location IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN current_location SET DEFAULT 'Unknown',
  ALTER COLUMN current_location SET NOT NULL;

UPDATE public.profiles
SET health = COALESCE(health, 100)
WHERE health IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN health SET DEFAULT 100,
  ALTER COLUMN health SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_health_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_health_check CHECK (health BETWEEN 0 AND 100);
  END IF;
END $$;

-- Make the new schema available to the API without a restart
NOTIFY pgrst, 'reload schema';

COMMIT;
