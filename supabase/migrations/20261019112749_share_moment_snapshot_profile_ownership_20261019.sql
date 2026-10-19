-- Applied directly to the live Supabase project on 2026-10-19
-- (migration version 20261019112749).
--
-- Snapshots must belong to a character controlled by the logged-in user.
-- The original RLS policies restricted user_id but accepted an arbitrary
-- profile_id, allowing a player to forge a card under another character.
-- Only insert/update checks change; existing select/delete policies and
-- historical cards whose profile has since been deleted remain accessible.

ALTER POLICY "share snapshots insert own"
ON public.share_moment_snapshots
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS own_profile
    WHERE own_profile.id = share_moment_snapshots.profile_id
      AND own_profile.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "share snapshots update own"
ON public.share_moment_snapshots
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS own_profile
    WHERE own_profile.id = share_moment_snapshots.profile_id
      AND own_profile.user_id = (SELECT auth.uid())
  )
);
