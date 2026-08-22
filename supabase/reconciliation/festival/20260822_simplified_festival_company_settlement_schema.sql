-- Clean-build parity for production migration 20260822104919.
-- Apply after 20260822_simplified_festival_post_bootstrap.sql.

ALTER TABLE public.festival_simplified_edition_results
  ADD COLUMN IF NOT EXISTS settlement_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_transaction_id uuid REFERENCES public.company_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS company_balance_before_minor bigint,
  ADD COLUMN IF NOT EXISTS company_balance_after_minor bigint,
  ADD COLUMN IF NOT EXISTS company_reputation_before integer,
  ADD COLUMN IF NOT EXISTS company_reputation_after integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_transactions_simplified_festival_result
ON public.company_transactions(related_entity_type, related_entity_id, category)
WHERE related_entity_type = 'festival_simplified_result'
  AND category = 'festival_settlement';
