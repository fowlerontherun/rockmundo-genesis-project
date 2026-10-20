BEGIN;

-- Earlier clean-room schemas do not yet carry the character gender field;
-- the public view below requires it. Preserve the canonical production type.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

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
