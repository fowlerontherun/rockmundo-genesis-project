-- Reconcile the canonical band invitation columns for databases where the
-- historical October compatibility migration was already recorded.

ALTER TABLE public.band_invitations
  ADD COLUMN IF NOT EXISTS inviter_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instrument_role varchar,
  ADD COLUMN IF NOT EXISTS vocal_role varchar,
  ADD COLUMN IF NOT EXISTS message text;

UPDATE public.band_invitations
SET
  inviter_user_id = COALESCE(inviter_user_id, inviter_id),
  invited_user_id = COALESCE(invited_user_id, invitee_id),
  instrument_role = COALESCE(NULLIF(btrim(instrument_role), ''), NULLIF(btrim(role), ''), 'Guitar')
WHERE inviter_user_id IS NULL
   OR invited_user_id IS NULL
   OR instrument_role IS NULL
   OR btrim(instrument_role) = '';

ALTER TABLE public.band_invitations
  ALTER COLUMN instrument_role SET DEFAULT 'Guitar',
  ALTER COLUMN instrument_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.band_invitations WHERE inviter_user_id IS NULL
  ) THEN
    ALTER TABLE public.band_invitations
      ALTER COLUMN inviter_user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.band_invitations WHERE invited_user_id IS NULL
  ) THEN
    ALTER TABLE public.band_invitations
      ALTER COLUMN invited_user_id SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS band_invitations_invited_user_idx
  ON public.band_invitations (invited_user_id);
CREATE INDEX IF NOT EXISTS band_invitations_inviter_created_idx
  ON public.band_invitations (inviter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS band_invitations_band_status_idx
  ON public.band_invitations (band_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS band_invitations_one_pending_per_user_band_idx
  ON public.band_invitations (band_id, invited_user_id)
  WHERE status = 'pending' AND invited_user_id IS NOT NULL;

ALTER TABLE public.band_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band invitations are viewable by everyone"
  ON public.band_invitations;
DROP POLICY IF EXISTS "Band members can view their band invitations"
  ON public.band_invitations;
CREATE POLICY "Band members can view their band invitations"
  ON public.band_invitations
  FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_invitations.band_id
        AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_invitations.band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders can create invitations"
  ON public.band_invitations;
CREATE POLICY "Band leaders can create invitations"
  ON public.band_invitations
  FOR INSERT
  WITH CHECK (
    inviter_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_invitations.band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Invited users can respond to invitations"
  ON public.band_invitations;
CREATE POLICY "Invited users can respond to invitations"
  ON public.band_invitations
  FOR UPDATE
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "Band leaders can update invitations"
  ON public.band_invitations;
CREATE POLICY "Band leaders can update invitations"
  ON public.band_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_invitations.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_invitations.band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders can cancel invitations"
  ON public.band_invitations;
CREATE POLICY "Band leaders can cancel invitations"
  ON public.band_invitations
  FOR DELETE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_invitations.band_id
        AND b.leader_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
