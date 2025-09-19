BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_of_birth uuid REFERENCES public.cities(id);

COMMENT ON COLUMN public.profiles.city_of_birth IS 'City where the player character was born';

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
  age
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Ensure PostgREST becomes aware of the new column immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
