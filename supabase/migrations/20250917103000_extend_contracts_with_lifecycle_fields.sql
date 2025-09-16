-- Extend contracts table with lifecycle metadata
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_option text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS termination_reason text;

-- Backfill new columns for existing contracts
UPDATE public.contracts
SET
  end_date = COALESCE(end_date, signed_at + make_interval(months => duration_months)),
  renewal_option = COALESCE(renewal_option, 'manual');
