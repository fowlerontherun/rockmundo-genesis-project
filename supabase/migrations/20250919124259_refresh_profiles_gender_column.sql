-- Ensure the gender column exists on profiles and refresh PostgREST schema cache
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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender public.profile_gender NOT NULL DEFAULT 'prefer_not_to_say';

UPDATE public.profiles
SET gender = COALESCE(gender, 'prefer_not_to_say')
WHERE gender IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN gender SET DEFAULT 'prefer_not_to_say',
  ALTER COLUMN gender SET NOT NULL;

NOTIFY pgrst, 'reload schema';
