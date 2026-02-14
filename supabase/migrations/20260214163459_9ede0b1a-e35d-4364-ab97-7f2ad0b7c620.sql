-- Add expires_at to artist_label_contracts for offer expiry deadlines
ALTER TABLE public.artist_label_contracts
ADD COLUMN expires_at timestamptz NULL;

-- Set default expiry for existing offered contracts (7 days from created_at)
UPDATE public.artist_label_contracts
SET expires_at = created_at::timestamptz + interval '7 days'
WHERE status = 'offered' AND expires_at IS NULL;