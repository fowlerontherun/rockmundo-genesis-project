-- Balance versioning registry (corrected forward version of 20260713090001)
DO $$ BEGIN CREATE TYPE public.balance_version_status AS ENUM ('draft','validating','valid','invalid','approved','scheduled','active','retired','rolled_back'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.balance_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_key text NOT NULL UNIQUE, name text NOT NULL, description text,
  status public.balance_version_status NOT NULL DEFAULT 'draft', parent_version_id uuid REFERENCES public.balance_versions(id),
  config jsonb NOT NULL, schema_version integer NOT NULL DEFAULT 1, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), validated_at timestamptz, activated_at timestamptz, retired_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT balance_versions_config_object CHECK (jsonb_typeof(config) = 'object'));
CREATE UNIQUE INDEX IF NOT EXISTS balance_versions_one_active_global ON public.balance_versions ((status)) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS public.balance_validation_results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), balance_version_id uuid NOT NULL REFERENCES public.balance_versions(id), status text NOT NULL, issues jsonb NOT NULL DEFAULT '[]'::jsonb, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.balance_simulation_results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), balance_version_id uuid NOT NULL REFERENCES public.balance_versions(id), scenario_set text NOT NULL, status text NOT NULL, summary jsonb NOT NULL DEFAULT '{}'::jsonb, report_path text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.balance_rollouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), balance_version_id uuid NOT NULL REFERENCES public.balance_versions(id), status text NOT NULL, scheduled_for timestamptz, activated_at timestamptz, cancelled_at timestamptz, actor_id uuid, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.balance_audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), balance_version_id uuid REFERENCES public.balance_versions(id), action text NOT NULL, actor_id uuid, change_summary text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT ON public.balance_versions, public.balance_validation_results, public.balance_simulation_results, public.balance_rollouts, public.balance_audit_log TO authenticated;
GRANT ALL ON public.balance_versions, public.balance_validation_results, public.balance_simulation_results, public.balance_rollouts, public.balance_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_activated_balance_version_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF old.status IN ('active','retired','rolled_back') AND (new.config IS DISTINCT FROM old.config OR new.version_key IS DISTINCT FROM old.version_key OR new.schema_version IS DISTINCT FROM old.schema_version) THEN RAISE EXCEPTION 'Activated balance versions are immutable'; END IF; RETURN new; END; $$;
DROP TRIGGER IF EXISTS trg_prevent_activated_balance_version_mutation ON public.balance_versions;
CREATE TRIGGER trg_prevent_activated_balance_version_mutation BEFORE UPDATE ON public.balance_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_activated_balance_version_mutation();
CREATE OR REPLACE FUNCTION public.prevent_activated_balance_version_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF old.status IN ('active','retired','rolled_back') THEN RAISE EXCEPTION 'Activated balance versions cannot be deleted'; END IF; RETURN old; END; $$;
DROP TRIGGER IF EXISTS trg_prevent_activated_balance_version_delete ON public.balance_versions;
CREATE TRIGGER trg_prevent_activated_balance_version_delete BEFORE DELETE ON public.balance_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_activated_balance_version_delete();

ALTER TABLE public.balance_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.balance_validation_results ENABLE ROW LEVEL SECURITY; ALTER TABLE public.balance_simulation_results ENABLE ROW LEVEL SECURITY; ALTER TABLE public.balance_rollouts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.balance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view balance versions" ON public.balance_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view balance validations" ON public.balance_validation_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view balance simulations" ON public.balance_simulation_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view balance rollouts" ON public.balance_rollouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view balance audit" ON public.balance_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DO $$ BEGIN
  IF to_regclass('public.player_xp_ledger') IS NOT NULL THEN ALTER TABLE public.player_xp_ledger ADD COLUMN IF NOT EXISTS balance_version_key text, ADD COLUMN IF NOT EXISTS balance_snapshot jsonb; END IF;
  IF to_regclass('public.songs') IS NOT NULL THEN ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS balance_version_key text, ADD COLUMN IF NOT EXISTS balance_snapshot jsonb; END IF;
  IF to_regclass('public.recording_sessions') IS NOT NULL THEN ALTER TABLE public.recording_sessions ADD COLUMN IF NOT EXISTS balance_version_key text, ADD COLUMN IF NOT EXISTS balance_snapshot jsonb; END IF;
  IF to_regclass('public.gig_outcomes') IS NOT NULL THEN ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS balance_version_key text, ADD COLUMN IF NOT EXISTS balance_snapshot jsonb; END IF;
END $$;

-- Band finance rules (corrected forward version of 20260717120001)
DO $$ BEGIN CREATE TYPE public.band_finance_permission AS ENUM ('view_band_balance','view_transaction_history','view_detailed_income_expenses','create_member_contribution_requests','make_voluntary_contributions','request_reimbursement','approve_reimbursements','schedule_payments','pay_band_expenses','change_revenue_split_rules','withdraw_band_funds','perform_emergency_payments'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
  member_withdrawals_allowed boolean NOT NULL DEFAULT false, withdrawals_require_approval boolean NOT NULL DEFAULT true,
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
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.band_finance_role_permissions (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, role_code text NOT NULL, permission public.band_finance_permission NOT NULL,
  granted_by_profile_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (band_id, role_code, permission));
CREATE TABLE IF NOT EXISTS public.band_member_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), category text NOT NULL DEFAULT 'voluntary', note text, transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.band_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, requesting_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), reason text NOT NULL, related_entity_type text, related_entity_id uuid, status public.band_withdrawal_status NOT NULL DEFAULT 'draft',
  required_approvals integer NOT NULL DEFAULT 1, approver_profile_ids uuid[] NOT NULL DEFAULT '{}', reviewed_at timestamptz, paid_at timestamptz, transaction_id uuid REFERENCES public.financial_transactions(id),
  rejection_reason text, expires_at timestamptz, idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.band_reimbursement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), category text NOT NULL, description text NOT NULL, related_entity_type text, related_entity_id uuid, evidence_reference text,
  status public.reimbursement_status NOT NULL DEFAULT 'submitted', approver_profile_id uuid REFERENCES public.profiles(id), transaction_id uuid REFERENCES public.financial_transactions(id), paid_at timestamptz,
  idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.band_distribution_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL,
  eligible_gross_income_minor bigint NOT NULL DEFAULT 0, deductions_minor bigint NOT NULL DEFAULT 0, reserve_retained_minor bigint NOT NULL DEFAULT 0, distributable_amount_minor bigint NOT NULL DEFAULT 0,
  split_method public.band_revenue_split_method NOT NULL, status public.distribution_batch_status NOT NULL DEFAULT 'calculated', idempotency_key text NOT NULL UNIQUE,
  approved_at timestamptz, paid_at timestamptz, linked_transaction_ids uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_distribution_batch_period CHECK (period_end >= period_start),
  CONSTRAINT band_distribution_batch_balanced CHECK (eligible_gross_income_minor - deductions_minor - reserve_retained_minor = distributable_amount_minor));
CREATE TABLE IF NOT EXISTS public.band_distribution_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.band_distribution_batches(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0), percentage_basis_points integer CHECK (percentage_basis_points IS NULL OR (percentage_basis_points BETWEEN 0 AND 10000)), transaction_id uuid REFERENCES public.financial_transactions(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id, profile_id));
CREATE TABLE IF NOT EXISTS public.recurring_financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL, owner_account_id uuid REFERENCES public.financial_accounts(id),
  expense_category public.financial_transaction_category NOT NULL, description text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency_code char(3) NOT NULL DEFAULT 'USD',
  frequency public.recurring_obligation_frequency NOT NULL, custom_interval_days integer CHECK (custom_interval_days IS NULL OR custom_interval_days > 0), next_due_date date NOT NULL, related_entity_type text, related_entity_id uuid,
  auto_pay_enabled boolean NOT NULL DEFAULT true, grace_period_days integer NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0), priority integer NOT NULL DEFAULT 100, status public.recurring_obligation_status NOT NULL DEFAULT 'active',
  cancellable_by_owner boolean NOT NULL DEFAULT true, last_attempted_at timestamptz, last_paid_at timestamptz, failure_count integer NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_type, owner_id, related_entity_type, related_entity_id, expense_category));
CREATE TABLE IF NOT EXISTS public.recurring_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES public.recurring_financial_obligations(id) ON DELETE CASCADE, due_date date NOT NULL, amount_minor bigint NOT NULL, status text NOT NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, error_code text, error_message text, attempted_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.weekly_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL, opening_balance_minor bigint NOT NULL DEFAULT 0, closing_balance_minor bigint NOT NULL DEFAULT 0, total_income_minor bigint NOT NULL DEFAULT 0, total_expenses_minor bigint NOT NULL DEFAULT 0,
  net_cash_flow_minor bigint GENERATED ALWAYS AS (total_income_minor - total_expenses_minor) STORED, reserved_funds_minor bigint NOT NULL DEFAULT 0, outstanding_obligations_minor bigint NOT NULL DEFAULT 0, taxable_income_minor bigint NOT NULL DEFAULT 0, tax_withheld_minor bigint NOT NULL DEFAULT 0,
  top_income_category text, top_expense_category text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_type, owner_id, period_start, period_end));
CREATE TABLE IF NOT EXISTS public.tax_period_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL CHECK (owner_type IN ('player','band')), owner_id uuid NOT NULL, tax_jurisdiction text,
  tax_period text NOT NULL, taxable_income_minor bigint NOT NULL DEFAULT 0, non_taxable_income_minor bigint NOT NULL DEFAULT 0, deductible_expenses_minor bigint NOT NULL DEFAULT 0, tax_withheld_minor bigint NOT NULL DEFAULT 0,
  tax_paid_minor bigint NOT NULL DEFAULT 0, estimated_liability_minor bigint, filing_status public.tax_filing_status NOT NULL DEFAULT 'open', last_calculated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_type, owner_id, tax_period));
CREATE TABLE IF NOT EXISTS public.finance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid, previous_value jsonb, new_value jsonb, reason text, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb);

GRANT SELECT ON public.band_finance_policies, public.band_finance_role_permissions, public.band_member_contributions, public.band_withdrawal_requests, public.band_reimbursement_requests, public.band_distribution_batches, public.band_distribution_allocations, public.recurring_financial_obligations, public.recurring_payment_attempts, public.weekly_financial_snapshots, public.tax_period_summaries, public.finance_audit_events TO authenticated;
GRANT ALL ON public.band_finance_policies, public.band_finance_role_permissions, public.band_member_contributions, public.band_withdrawal_requests, public.band_reimbursement_requests, public.band_distribution_batches, public.band_distribution_allocations, public.recurring_financial_obligations, public.recurring_payment_attempts, public.weekly_financial_snapshots, public.tax_period_summaries, public.finance_audit_events TO service_role;

INSERT INTO public.band_finance_policies (band_id) SELECT id FROM public.bands ON CONFLICT (band_id) DO NOTHING;
INSERT INTO public.band_finance_role_permissions (band_id, role_code, permission)
SELECT b.id, d.role_code, d.permission::public.band_finance_permission FROM public.bands b CROSS JOIN (VALUES
 ('leader','view_band_balance'),('leader','view_transaction_history'),('leader','view_detailed_income_expenses'),('leader','create_member_contribution_requests'),('leader','make_voluntary_contributions'),('leader','request_reimbursement'),('leader','approve_reimbursements'),('leader','schedule_payments'),('leader','pay_band_expenses'),('leader','change_revenue_split_rules'),('leader','withdraw_band_funds'),('leader','perform_emergency_payments'),
 ('member','view_band_balance'),('member','make_voluntary_contributions'),('member','request_reimbursement')) AS d(role_code, permission)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_band_finance_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.band_finance_policies (band_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.band_finance_role_permissions (band_id, role_code, permission)
  SELECT NEW.id, d.r, d.p::public.band_finance_permission FROM (VALUES
   ('leader','view_band_balance'),('leader','view_transaction_history'),('leader','view_detailed_income_expenses'),('leader','create_member_contribution_requests'),('leader','make_voluntary_contributions'),('leader','request_reimbursement'),('leader','approve_reimbursements'),('leader','schedule_payments'),('leader','pay_band_expenses'),('leader','change_revenue_split_rules'),('leader','withdraw_band_funds'),('leader','perform_emergency_payments'),
   ('member','view_band_balance'),('member','make_voluntary_contributions'),('member','request_reimbursement')) d(r,p)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ensure_band_finance_defaults() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ensure_band_finance_defaults ON public.bands;
CREATE TRIGGER trg_ensure_band_finance_defaults AFTER INSERT ON public.bands FOR EACH ROW EXECUTE FUNCTION public.ensure_band_finance_defaults();

-- Is the signed-in account a member (any character) of this band?
CREATE OR REPLACE FUNCTION public.is_band_finance_viewer(p_band_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = p_band_id AND (bm.user_id = auth.uid() OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
      OR EXISTS (SELECT 1 FROM public.bands b JOIN public.profiles p ON p.id = b.leader_id WHERE b.id = p_band_id AND p.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.user_has_band_finance_permission(p_band_id uuid, p_profile_id uuid, p_permission public.band_finance_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bands b WHERE b.id = p_band_id AND b.leader_id = p_profile_id)
      OR EXISTS (SELECT 1 FROM public.band_members bm JOIN public.band_finance_role_permissions rp ON rp.band_id = bm.band_id
                 AND rp.role_code = CASE WHEN lower(coalesce(bm.role,'')) IN ('leader','manager','treasurer') THEN lower(bm.role) ELSE 'member' END
                 WHERE bm.band_id = p_band_id AND bm.profile_id = p_profile_id AND rp.permission = p_permission);
$$;

ALTER TABLE public.band_finance_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_finance_role_permissions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_member_contributions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_withdrawal_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_reimbursement_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_distribution_batches ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_distribution_allocations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.recurring_financial_obligations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.recurring_payment_attempts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.weekly_financial_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.tax_period_summaries ENABLE ROW LEVEL SECURITY; ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members view finance policy" ON public.band_finance_policies FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view finance permissions" ON public.band_finance_role_permissions FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view contributions" ON public.band_member_contributions FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view withdrawals" ON public.band_withdrawal_requests FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view reimbursements" ON public.band_reimbursement_requests FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view distributions" ON public.band_distribution_batches FOR SELECT TO authenticated USING (public.is_band_finance_viewer(band_id));
CREATE POLICY "Band members view allocations" ON public.band_distribution_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.band_distribution_batches x WHERE x.id = batch_id AND public.is_band_finance_viewer(x.band_id)));
CREATE POLICY "Owners view recurring obligations" ON public.recurring_financial_obligations FOR SELECT TO authenticated USING ((owner_type = 'player' AND owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR (owner_type = 'band' AND public.is_band_finance_viewer(owner_id)));
CREATE POLICY "Owners view payment attempts" ON public.recurring_payment_attempts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_financial_obligations o WHERE o.id = obligation_id AND ((o.owner_type = 'player' AND o.owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR (o.owner_type = 'band' AND public.is_band_finance_viewer(o.owner_id)))));
CREATE POLICY "Owners view weekly snapshots" ON public.weekly_financial_snapshots FOR SELECT TO authenticated USING ((owner_type = 'player' AND owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR (owner_type = 'band' AND public.is_band_finance_viewer(owner_id)));
CREATE POLICY "Owners view tax summaries" ON public.tax_period_summaries FOR SELECT TO authenticated USING ((owner_type = 'player' AND owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR (owner_type = 'band' AND public.is_band_finance_viewer(owner_id)));
CREATE POLICY "Actors view own finance audit" ON public.finance_audit_events FOR SELECT TO authenticated USING (actor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));