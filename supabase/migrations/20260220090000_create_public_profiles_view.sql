BEGIN;

-- Restrict direct profile reads to the profile owner
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profile owners can view their data" ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- The September 2025 public_profiles view has extra demographic and
-- location fields. CREATE OR REPLACE VIEW cannot remove existing columns
-- (SQLSTATE 42P16), so explicitly replace this view's interface on replay.
-- Do not CASCADE: any unexpected dependent objects should fail loudly.
-- Dropping the view also drops earlier anon grants; restore both read roles.
DROP VIEW IF EXISTS public.public_profiles;

-- Expose only the six approved public fields; private gameplay/finance data
-- and demographic attributes remain restricted to the owning profile.
CREATE VIEW public.public_profiles AS
SELECT
  id,
  user_id,
  username,
  display_name,
  avatar_url,
  bio
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMIT;
