-- Enforce request-level idempotency in the database, not a racing read.
-- Existing duplicates must be reconciled before this migration can succeed.
CREATE UNIQUE INDEX IF NOT EXISTS experience_ledger_action_txn_unique
 ON public.experience_ledger(profile_id,activity_type,(metadata->>'transaction_ref'))
 WHERE (metadata->>'transaction_ref') IS NOT NULL
 AND (metadata->>'transaction_ref') <> '';
