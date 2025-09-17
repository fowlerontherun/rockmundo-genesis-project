BEGIN;

-- Restrict direct profile reads to the profile owner
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profile owners can view their data" ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Expose a sanitized view that omits financial/gameplay stats
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  user_id,
  username,
  display_name,
  avatar_url,
  bio
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

COMMIT;
