-- Add the dedicated category in its own migration so PostgreSQL can commit the
-- enum value before later functions reference it.
ALTER TYPE public.financial_transaction_category
  ADD VALUE IF NOT EXISTS 'charity_donation';
