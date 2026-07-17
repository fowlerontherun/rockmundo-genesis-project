-- Finance Phase 2: player and band finance management, treasury policy, splits and recurring obligations.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'rent';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'subscription';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'education_fee';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'food_lifestyle';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'band_reimbursement';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'band_distribution';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'recurring_obligation';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'tax_withholding';

DO $$ BEGIN
  CREATE TYPE public.band_finance_permission AS ENUM (
    'view_band_balance','view_transaction_history','view_detailed_income_expenses','create_member_contribution_requests',
    'make_voluntary_contributions','request_reimbursement','approve_reimbursements','schedule_payments','pay_band_expenses',
    'change_revenue_split_rules','withdraw_band_funds','perform_emergency_payments'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.band_revenue_split_method AS ENUM ('equal','custom_percentage','role_weighted','retain_all','reserve_then_distribute'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.band_withdrawal_status AS ENUM ('draft','submitted','awaiting_approval','approved','rejected','paid','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reimbursement_status AS ENUM ('submitted','awaiting_approval','approved','rejected','paid','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.distribution_batch_status AS ENUM ('calculated','awaiting_approval','approved','processing','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recurring_obligation_frequency AS ENUM ('daily','weekly','monthly','custom_interval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recurring_obligation_status AS ENUM ('active','paused','cancelled','overdue','failed','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tax_filing_status AS ENUM ('open','estimated','filed','paid','overdue','adjusted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.band_finance_policies (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  minimum_reserve_minor bigint NOT NULL DEFAULT 0 CHECK (minimum_reserve_minor >= 0),
  member_withdrawals_allowed boolean NOT NULL DEFAULT false,
  withdrawals_require_approval boolean NOT NULL DEFAULT true,
  approvals_required_above_threshold integer NOT NULL DEFAULT 1 CHECK (approvals_required_above_threshold >= 1),
  approval_threshold_minor bigint NOT NULL DEFAULT 10000 CHECK (approval_threshold_minor >= 0),
  spending_approval_threshold_minor bigint NOT NULL DEFAULT 25000 CHECK (spending_approval_threshold_minor >= 0),
  automatic_distribution_frequency text NOT NULL DEFAULT 'manual',
  revenue_split_method public.band_revenue_split_method NOT NULL DEFAULT 'retain_all',
  revenue_split_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  contribution_policy jsonb NOT NULL DEFAULT '{"voluntary":true,"ownership_implication":false}'::jsonb,
  reimbursement_policy jsonb NOT NULL DEFAULT '{"enabled":true,"requires_approval":true}'::jsonb,
  emergency_spending_rules jsonb NOT NULL DEFAULT '{"enabled":true,"notify_after_payment":true}'::jsonb,
  member_visibility_level text NOT NULL DEFAULT 'summary',
  eligible_income_categories text[] NOT NULL DEFAULT ARRAY['gig_payment','ticket_sale','festival_payment','merchandise_revenue','streaming_royalty'],
  participant_eligibility_mode text NOT NULL DEFAULT 'active_members',
  updated_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.band_finance_role_permissions (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  permission public.band_finance_permission NOT NULL,
  granted_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (band_id, role_code, permission)
);

CREATE TABLE IF NOT EXISTS public.band_member_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), category text NOT NULL DEFAULT 'voluntary', note text, transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.band_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, requesting_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), reason text NOT NULL, related_entity_type text, related_entity_id uuid, status public.band_withdrawal_status NOT NULL DEFAULT 'draft',
  required_approvals integer NOT NULL DEFAULT 1, approver_profile_ids uuid[] NOT NULL DEFAULT '{}', reviewed_at timestamptz, paid_at timestamptz, transaction_id uuid REFERENCES public.financial_transactions(id),
  rejection_reason text, expires_at timestamptz, idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.band_reimbursement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), category text NOT NULL, description text NOT NULL, related_entity_type text, related_entity_id uuid, evidence_reference text,
  status public.reimbursement_status NOT NULL DEFAULT 'submitted', approver_profile_id uuid REFERENCES public.profiles(id), transaction_id uuid REFERENCES public.financial_transactions(id), paid_at timestamptz,
  idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.band_distribution_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL,
  eligible_gross_income_minor bigint NOT NULL DEFAULT 0, deductions_minor bigint NOT NULL DEFAULT 0, reserve_retained_minor bigint NOT NULL DEFAULT 0, distributable_amount_minor bigint NOT NULL DEFAULT 0,
  split_method public.band_revenue_split_method NOT NULL, status public.distribution_batch_status NOT NULL DEFAULT 'calculated', idempotency_key text NOT NULL UNIQUE,
  approved_at timestamptz, paid_at timestamptz, linked_transaction_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT band_distribution_batch_period CHECK (period_end >= period_start), CONSTRAINT band_distribution_batch_balanced CHECK (eligible_gross_income_minor - deductions_minor - reserve_retained_minor = distributable_amount_minor)
);
CREATE TABLE IF NOT EXISTS public.band_distribution_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.band_distribution_batches(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0), percentage_basis_points integer CHECK (percentage_basis_points IS NULL OR (percentage_basis_points >= 0 AND percentage_basis_points <= 10000)), transaction_id uuid REFERENCES public.financial_transactions(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(batch_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.recurring_financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL, owner_account_id uuid REFERENCES public.financial_accounts(id),
  expense_category public.financial_transaction_category NOT NULL, description text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency_code char(3) NOT NULL DEFAULT 'USD',
  frequency public.recurring_obligation_frequency NOT NULL, custom_interval_days integer CHECK (custom_interval_days IS NULL OR custom_interval_days > 0), next_due_date date NOT NULL, related_entity_type text, related_entity_id uuid,
  auto_pay_enabled boolean NOT NULL DEFAULT true, grace_period_days integer NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0), priority integer NOT NULL DEFAULT 100, status public.recurring_obligation_status NOT NULL DEFAULT 'active',
  cancellable_by_owner boolean NOT NULL DEFAULT true, last_attempted_at timestamptz, last_paid_at timestamptz, failure_count integer NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(owner_type, owner_id, related_entity_type, related_entity_id, expense_category)
);
CREATE TABLE IF NOT EXISTS public.recurring_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES public.recurring_financial_obligations(id) ON DELETE CASCADE, due_date date NOT NULL, amount_minor bigint NOT NULL, status text NOT NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, error_code text, error_message text, attempted_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.weekly_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL, opening_balance_minor bigint NOT NULL DEFAULT 0, closing_balance_minor bigint NOT NULL DEFAULT 0, total_income_minor bigint NOT NULL DEFAULT 0, total_expenses_minor bigint NOT NULL DEFAULT 0,
  net_cash_flow_minor bigint GENERATED ALWAYS AS (total_income_minor - total_expenses_minor) STORED, reserved_funds_minor bigint NOT NULL DEFAULT 0, outstanding_obligations_minor bigint NOT NULL DEFAULT 0, taxable_income_minor bigint NOT NULL DEFAULT 0, tax_withheld_minor bigint NOT NULL DEFAULT 0,
  top_income_category text, top_expense_category text, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(owner_type, owner_id, period_start, period_end)
);
CREATE TABLE IF NOT EXISTS public.tax_period_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL, tax_jurisdiction text,
  tax_period text NOT NULL, taxable_income_minor bigint NOT NULL DEFAULT 0, non_taxable_income_minor bigint NOT NULL DEFAULT 0, deductible_expenses_minor bigint NOT NULL DEFAULT 0, tax_withheld_minor bigint NOT NULL DEFAULT 0,
  tax_paid_minor bigint NOT NULL DEFAULT 0, estimated_liability_minor bigint, filing_status public.tax_filing_status NOT NULL DEFAULT 'open', last_calculated_at timestamptz, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(owner_type, owner_id, tax_period)
);
CREATE TABLE IF NOT EXISTS public.finance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid, previous_value jsonb, new_value jsonb, reason text, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO public.band_finance_policies (band_id)
SELECT id FROM public.bands ON CONFLICT (band_id) DO NOTHING;
INSERT INTO public.band_finance_role_permissions (band_id, role_code, permission)
SELECT b.id, role_code, permission::public.band_finance_permission FROM public.bands b CROSS JOIN (VALUES
 ('leader','view_band_balance'),('leader','view_transaction_history'),('leader','view_detailed_income_expenses'),('leader','create_member_contribution_requests'),('leader','make_voluntary_contributions'),('leader','request_reimbursement'),('leader','approve_reimbursements'),('leader','schedule_payments'),('leader','pay_band_expenses'),('leader','change_revenue_split_rules'),('leader','withdraw_band_funds'),('leader','perform_emergency_payments'),
 ('manager','view_band_balance'),('manager','view_transaction_history'),('manager','view_detailed_income_expenses'),('manager','schedule_payments'),('manager','approve_reimbursements'),('manager','pay_band_expenses'),('manager','request_reimbursement'),('manager','make_voluntary_contributions'),
 ('treasurer','view_band_balance'),('treasurer','view_transaction_history'),('treasurer','view_detailed_income_expenses'),('treasurer','schedule_payments'),('treasurer','approve_reimbursements'),('treasurer','pay_band_expenses'),('treasurer','request_reimbursement'),('treasurer','make_voluntary_contributions'),
 ('member','view_band_balance'),('member','make_voluntary_contributions'),('member','request_reimbursement')
) AS defaults(role_code, permission) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_has_band_finance_permission(p_band_id uuid, p_profile_id uuid, p_permission public.band_finance_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm JOIN public.band_finance_role_permissions rp ON rp.band_id=bm.band_id AND rp.role_code=COALESCE(NULLIF(bm.role,''),'member')
    WHERE bm.band_id=p_band_id AND bm.profile_id=p_profile_id AND rp.permission=p_permission
  ) OR EXISTS (SELECT 1 FROM public.bands b WHERE b.id=p_band_id AND b.leader_id=p_profile_id AND p_permission IS NOT NULL);
$$;

ALTER TABLE public.band_finance_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_member_contributions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_withdrawal_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_reimbursement_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_distribution_batches ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_distribution_allocations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.recurring_financial_obligations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.weekly_financial_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.tax_period_summaries ENABLE ROW LEVEL SECURITY; ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY band_finance_policy_member_select ON public.band_finance_policies FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=band_id AND p.user_id=auth.uid()));
CREATE POLICY band_contributions_member_select ON public.band_member_contributions FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=band_id AND p.user_id=auth.uid()));
CREATE POLICY band_withdrawal_member_select ON public.band_withdrawal_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=band_id AND p.user_id=auth.uid()));
CREATE POLICY band_reimbursement_member_select ON public.band_reimbursement_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=band_id AND p.user_id=auth.uid()));
CREATE POLICY recurring_owner_select ON public.recurring_financial_obligations FOR SELECT USING ((owner_type='player' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.user_id=auth.uid())) OR (owner_type='band' AND EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=owner_id AND p.user_id=auth.uid())));
