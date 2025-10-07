-- Create band invitations table
CREATE TABLE public.band_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invited_user_id UUID NOT NULL,
  instrument_role VARCHAR NOT NULL DEFAULT 'Guitar',
  vocal_role VARCHAR,
  message TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_active_invitation UNIQUE (band_id, invited_user_id, status)
);

-- Enable RLS
ALTER TABLE public.band_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Band members can view invitations for their band
CREATE POLICY "Band members can view their band invitations"
ON public.band_invitations
FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
  OR invited_user_id = auth.uid()
);

-- Policy: Band leaders can create invitations
CREATE POLICY "Band leaders can create invitations"
ON public.band_invitations
FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT id FROM public.bands WHERE leader_id = auth.uid()
  )
  AND inviter_user_id = auth.uid()
);

-- Policy: Invited users can update their own invitations (accept/reject)
CREATE POLICY "Invited users can respond to invitations"
ON public.band_invitations
FOR UPDATE
USING (invited_user_id = auth.uid());

-- Policy: Band leaders can cancel pending invitations
CREATE POLICY "Band leaders can cancel invitations"
ON public.band_invitations
FOR DELETE
USING (
  band_id IN (
    SELECT id FROM public.bands WHERE leader_id = auth.uid()
  )
  AND status = 'pending'
);

-- Add index for performance
CREATE INDEX idx_band_invitations_invited_user ON public.band_invitations(invited_user_id);
CREATE INDEX idx_band_invitations_band_status ON public.band_invitations(band_id, status);