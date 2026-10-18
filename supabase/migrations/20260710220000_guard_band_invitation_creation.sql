ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_invitation_send_denied';

ALTER TABLE public.band_invitations
  -- Message constraint is defined by subsequent 23:00 migration (280 chars).
  ADD CONSTRAINT band_invitations_instrument_role_length CHECK (char_length(btrim(instrument_role)) BETWEEN 1 AND 50) NOT VALID,
  ADD CONSTRAINT band_invitations_vocal_role_length CHECK (vocal_role IS NULL OR char_length(btrim(vocal_role)) BETWEEN 1 AND 50) NOT VALID;

CREATE INDEX IF NOT EXISTS band_invitations_pending_target_idx
  ON public.band_invitations (band_id, invited_user_id, status, created_at DESC);

-- This 22:00 migration's two helper definitions were replaced by the 23:00
-- implementation, which has a different argument contract. Define those
-- signatures only once in the subsequent version to make fresh replay legal.

DROP POLICY IF EXISTS "Band leaders can create invitations" ON public.band_invitations;
CREATE POLICY "Band invitation creation uses guarded RPC"
ON public.band_invitations FOR INSERT
WITH CHECK (false);
