-- Add columns to track advance recoupment progress on contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS advance_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS recouped_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Initialize new columns for existing contract rows
UPDATE public.contracts
SET
  advance_balance = advance_payment::NUMERIC(12,2),
  recouped_amount = 0
WHERE advance_balance = 0;
