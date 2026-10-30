-- Restore admin creation of award shows; read-only public access is preserved.
-- Does not change live shows or ceremony status.
DROP POLICY IF EXISTS "Award administrators can create shows" ON public.award_shows;
CREATE POLICY "Award administrators can create shows"
  ON public.award_shows FOR INSERT TO authenticated
  WITH CHECK (COALESCE(public.has_role(auth.uid(), 'admin'), false));
GRANT INSERT ON public.award_shows TO authenticated;
