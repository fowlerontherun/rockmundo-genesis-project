-- Ensure PostgREST sees the gender column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender public.profile_gender NOT NULL DEFAULT 'prefer_not_to_say';

NOTIFY pgrst, 'reload schema';
