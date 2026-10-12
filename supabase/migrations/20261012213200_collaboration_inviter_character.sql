-- Preserve the exact inviter character rather than resolving the current active character.
ALTER TABLE public.songwriting_collaborations
  ADD COLUMN IF NOT EXISTS inviter_profile_id uuid REFERENCES public.profiles(id);
UPDATE public.songwriting_collaborations sc
SET inviter_profile_id = sp.profile_id
FROM public.songwriting_projects sp
WHERE sc.project_id = sp.id AND sp.user_id = sc.inviter_user_id
  AND sc.inviter_profile_id IS NULL;
CREATE INDEX IF NOT EXISTS songwriting_collaborations_inviter_profile
  ON public.songwriting_collaborations(inviter_profile_id);
