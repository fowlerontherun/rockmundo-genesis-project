-- Keep mayor travel levies distinguishable from ordinary travel fares in the
-- canonical finance ledger. This is a separate migration so PostgreSQL commits the
-- enum value before the following travel authority starts using it.
ALTER TYPE public.financial_transaction_category
  ADD VALUE IF NOT EXISTS 'travel_tax';
