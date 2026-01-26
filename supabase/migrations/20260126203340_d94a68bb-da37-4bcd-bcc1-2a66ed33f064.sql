-- Create enums for collaboration status and compensation type
CREATE TYPE collaboration_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE collaboration_compensation_type AS ENUM ('none', 'flat_fee', 'royalty');

-- Create songwriting_collaborations table
CREATE TABLE public.songwriting_collaborations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status collaboration_status NOT NULL DEFAULT 'pending',
  is_band_member BOOLEAN NOT NULL DEFAULT false,
  compensation_type collaboration_compensation_type NOT NULL DEFAULT 'none',
  flat_fee_amount NUMERIC(10, 2),
  royalty_percentage NUMERIC(5, 2),
  fee_paid BOOLEAN NOT NULL DEFAULT false,
  contribution_notes TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate invitations to same person for same project
  CONSTRAINT unique_project_invitee UNIQUE (project_id, invitee_profile_id),
  
  -- Ensure flat_fee_amount is set when compensation_type is flat_fee
  CONSTRAINT valid_flat_fee CHECK (
    (compensation_type != 'flat_fee') OR (flat_fee_amount IS NOT NULL AND flat_fee_amount >= 50 AND flat_fee_amount <= 10000)
  ),
  
  -- Ensure royalty_percentage is set when compensation_type is royalty
  CONSTRAINT valid_royalty CHECK (
    (compensation_type != 'royalty') OR (royalty_percentage IS NOT NULL AND royalty_percentage >= 5 AND royalty_percentage <= 50)
  )
);

-- Create collaboration_payments audit table
CREATE TABLE public.collaboration_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaboration_id UUID NOT NULL REFERENCES public.songwriting_collaborations(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id),
  payee_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(10, 2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'flat_fee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.songwriting_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for songwriting_collaborations

-- Inviters can view their own invitations
CREATE POLICY "Inviters can view own invitations"
  ON public.songwriting_collaborations
  FOR SELECT
  USING (auth.uid() = inviter_user_id);

-- Invitees can view invitations addressed to them
CREATE POLICY "Invitees can view their invitations"
  ON public.songwriting_collaborations
  FOR SELECT
  USING (invitee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Inviters can create invitations for their projects
CREATE POLICY "Inviters can create invitations"
  ON public.songwriting_collaborations
  FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_user_id
    AND project_id IN (SELECT id FROM public.songwriting_projects WHERE user_id = auth.uid())
  );

-- Inviters can update/cancel their invitations
CREATE POLICY "Inviters can update own invitations"
  ON public.songwriting_collaborations
  FOR UPDATE
  USING (auth.uid() = inviter_user_id);

-- Invitees can respond to invitations (update status)
CREATE POLICY "Invitees can respond to invitations"
  ON public.songwriting_collaborations
  FOR UPDATE
  USING (invitee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Inviters can delete their pending invitations
CREATE POLICY "Inviters can delete pending invitations"
  ON public.songwriting_collaborations
  FOR DELETE
  USING (auth.uid() = inviter_user_id AND status = 'pending');

-- RLS Policies for collaboration_payments
CREATE POLICY "Users can view payments they're involved in"
  ON public.collaboration_payments
  FOR SELECT
  USING (
    auth.uid() = payer_user_id 
    OR payee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert payments"
  ON public.collaboration_payments
  FOR INSERT
  WITH CHECK (auth.uid() = payer_user_id);

-- Create indexes for performance
CREATE INDEX idx_collaborations_project ON public.songwriting_collaborations(project_id);
CREATE INDEX idx_collaborations_inviter ON public.songwriting_collaborations(inviter_user_id);
CREATE INDEX idx_collaborations_invitee ON public.songwriting_collaborations(invitee_profile_id);
CREATE INDEX idx_collaborations_status ON public.songwriting_collaborations(status);
CREATE INDEX idx_payments_collaboration ON public.collaboration_payments(collaboration_id);

-- Updated_at trigger
CREATE TRIGGER update_songwriting_collaborations_updated_at
  BEFORE UPDATE ON public.songwriting_collaborations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();