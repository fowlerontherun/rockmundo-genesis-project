
-- Add offer-system columns to player_modeling_contracts
ALTER TABLE public.player_modeling_contracts
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_reason text;

-- Ensure 'pending' and 'declined' are valid statuses (status is text, no enum constraint)
-- Set default for new offers
