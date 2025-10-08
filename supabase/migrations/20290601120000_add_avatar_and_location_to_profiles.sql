-- Ensure the profiles table has fields required by the frontend
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS current_location text;

-- Make sure PostgREST picks up the schema change right away
NOTIFY pgrst, 'reload schema';
