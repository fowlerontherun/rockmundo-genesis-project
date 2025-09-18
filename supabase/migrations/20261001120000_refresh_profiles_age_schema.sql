BEGIN;

-- Ensure age column exists with proper constraints and defaults
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE public.profiles
  ALTER COLUMN age SET DEFAULT 16;

UPDATE public.profiles
SET age = COALESCE(age, 16);

ALTER TABLE public.profiles
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

-- Refresh PostgREST schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
