-- Tighten recruitment application history visibility discovered by the Phase 3 PR 05 RLS harness.
-- The original manager select policy did not require active membership and used case-sensitive role checks.
DROP POLICY IF EXISTS "Leaders can view band applications" ON public.band_applications;
DROP POLICY IF EXISTS "Current recruitment managers can view band applications" ON public.band_applications;
CREATE POLICY "Current recruitment managers can view band applications"
  ON public.band_applications FOR SELECT TO authenticated
  USING (public.can_manage_band_invitations(band_id, auth.uid()));
