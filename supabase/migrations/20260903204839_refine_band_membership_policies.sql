BEGIN;

-- Supabase's default privilege hooks can add explicit API-role grants in
-- addition to PUBLIC.  Trigger-only helpers must never be callable as RPCs.
REVOKE ALL ON FUNCTION public.guard_active_band_membership()
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.can_receive_band_invitation(uuid, uuid)
  FROM anon, authenticated;

-- Cover the character history and legacy account fallback lookups used by the
-- application and membership guards.
CREATE INDEX IF NOT EXISTS band_applications_applicant_created_idx
  ON public.band_applications (applicant_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS band_members_user_id_idx
  ON public.band_members (user_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Band application participants can view"
  ON public.band_applications;
CREATE POLICY "Band application participants can view"
ON public.band_applications
FOR SELECT TO authenticated
USING (
  public.profile_belongs_to_current_user(applicant_profile_id)
  OR public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Band invitation participants can view"
  ON public.band_invitations;
CREATE POLICY "Band invitation participants can view"
ON public.band_invitations
FOR SELECT TO authenticated
USING (
  invited_user_id = (SELECT auth.uid())
  OR public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Founders can create their membership"
  ON public.band_members;
CREATE POLICY "Founders can create their membership"
ON public.band_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.profile_belongs_to_current_user(profile_id)
  AND NOT COALESCE(is_touring_member, false)
  AND lower(COALESCE(role, '')) IN ('founder', 'leader')
  AND EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.id = band_members.band_id
      AND b.leader_id = band_members.profile_id
  )
);

-- Preserve the existing member self-update behaviour and leader controls while
-- avoiding multiple permissive policies for each operation.
DROP POLICY IF EXISTS "Members can update their own membership"
  ON public.band_members;
DROP POLICY IF EXISTS "Band managers can update members"
  ON public.band_members;
DROP POLICY IF EXISTS "Band member updates are authorised"
  ON public.band_members;
CREATE POLICY "Band member updates are authorised"
ON public.band_members
FOR UPDATE TO authenticated
USING (
  public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
  OR user_id = (SELECT auth.uid())
  OR profile_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
  OR user_id = (SELECT auth.uid())
  OR profile_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Band managers can remove members"
  ON public.band_members;
DROP POLICY IF EXISTS "Members can leave bands"
  ON public.band_members;
DROP POLICY IF EXISTS "Band member removals are authorised"
  ON public.band_members;
CREATE POLICY "Band member removals are authorised"
ON public.band_members
FOR DELETE TO authenticated
USING (
  public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
  OR (
    public.profile_belongs_to_current_user(profile_id)
    AND lower(COALESCE(role, '')) NOT IN ('founder', 'leader')
    AND NOT COALESCE(is_touring_member, false)
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
