BEGIN;

-- Member-controlled preferences use narrowly scoped SECURITY DEFINER RPCs
-- (for example update_band_member_roles and set_band_member_travel).  Do not
-- let a member rewrite the rest of their roster row and promote themselves to
-- a management role.
DROP POLICY IF EXISTS "Band member updates are authorised"
  ON public.band_members;
CREATE POLICY "Band managers can update member records"
ON public.band_members
FOR UPDATE TO authenticated
USING (
  public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
)
WITH CHECK (
  public.can_manage_band_invitations(band_id, (SELECT auth.uid()))
);

NOTIFY pgrst, 'reload schema';

COMMIT;
