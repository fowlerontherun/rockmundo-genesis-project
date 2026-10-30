-- Award settlement is the only trusted creator of award_show_prize earnings.
-- The existing member-insert policy previously let band members mint
-- a forged award-show prize by writing directly to band_earnings.
-- Only the SECURITY DEFINER award_admin_finalize_show RPC may insert that
-- source. All other existing member-written earnings retain the same scope.

DROP POLICY IF EXISTS "Authenticated users can insert earnings"
  ON public.band_earnings;

CREATE POLICY "Authenticated users can insert earnings"
  ON public.band_earnings
  FOR INSERT TO authenticated
  WITH CHECK (
    source <> 'award_show_prize'
    AND EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = band_earnings.band_id
        AND bm.user_id = (select auth.uid())
    )
  );

COMMENT ON POLICY "Authenticated users can insert earnings"
  ON public.band_earnings IS
  'Member-written earnings cannot impersonate authoritative awards prize payments; only the awards finalizer may write award_show_prize via its privileged server transaction.';
