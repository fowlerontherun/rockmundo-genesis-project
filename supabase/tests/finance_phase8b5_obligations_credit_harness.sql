-- Finance Phase 8B.5 universal obligations, debt recovery and credit history harness.
-- Run against a disposable Supabase database after migrations are applied.

BEGIN;

DO $$
BEGIN
  ASSERT to_regclass('public.financial_obligations') IS NOT NULL, 'financial_obligations table exists';
  ASSERT to_regclass('public.financial_obligation_schedule') IS NOT NULL, 'financial_obligation_schedule table exists';
  ASSERT to_regclass('public.financial_obligation_attempts') IS NOT NULL, 'financial_obligation_attempts table exists';
  ASSERT to_regclass('public.financial_obligation_events') IS NOT NULL, 'financial_obligation_events table exists';
  ASSERT to_regclass('public.financial_obligation_status_history') IS NOT NULL, 'financial_obligation_status_history table exists';
  ASSERT to_regclass('public.debt_records') IS NOT NULL, 'debt_records table exists';
  ASSERT to_regclass('public.player_credit_history') IS NOT NULL, 'player_credit_history table exists';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_due_financial_obligations'), 'universal scheduler RPC exists';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_due_mortgage_repayments'), 'legacy mortgage scheduler delegates to universal scheduler';
  ASSERT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_financial_obligation_from_mortgage'), 'mortgages produce obligations';
  ASSERT EXISTS (SELECT 1 FROM public.financial_obligation_policies WHERE obligation_type='mortgage' AND default_grace_period_days=7 AND max_attempts=3), 'mortgage retry/grace policy is seeded';
  ASSERT EXISTS (SELECT 1 FROM public.financial_obligation_policies WHERE obligation_type='insurance' AND default_grace_period_days=0 AND max_attempts=1), 'insurance immediate cancellation/default policy is seeded';
END $$;

-- Workflow coverage checklist for seeded integration databases:
-- 1. Successful payment: create an active obligation with funded payment/recipient accounts, schedule due today,
--    call process_due_financial_obligations as service_role, assert schedule paid, attempt succeeded and transaction balances reconcile.
-- 2. Failed payment: underfund the payment account, call process_financial_obligation_payment, assert failed attempt records
--    balance_at_attempt_minor and remaining_shortfall_minor.
-- 3. Retry and grace period: keep the due date inside grace_expires_at and assert obligation status moves to grace_period,
--    then retry after funding and assert status returns active.
-- 4. Escalation/collection: exceed max_attempts or grace_expires_at and assert debt_records plus debt_created events exist.
-- 5. Credit score update: use a player-owned obligation and assert player_credit_history rows and player_credit_scores recalculation.
-- 6. Obligation cancellation/completion: call set_financial_obligation_status and exhaust all schedule lines, asserting
--    status history and completed_at/cancelled events.
-- 7. Mortgage replacement: complete a mortgage and assert mortgage_schedule_lines are mirrored into
--    financial_obligation_schedule while recurring_financial_obligations is marked cancelled.

ROLLBACK;
