-- Finance Phase 6: multi-currency accounts, FX rates, conversion, international settlement and reporting.
-- Reference-rate architecture: rates are stored as active/historical currency pairs, with USD
-- seeded as the internal reference currency for generated rates. Account balances remain in
-- their actual account currency and are never replaced by reporting-currency equivalents.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'currency_conversion';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'currency_conversion_fee';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'currency_rounding_adjustment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'international_transfer';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'foreign_gig_income';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'foreign_company_revenue';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'international_payroll';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'realised_currency_gain';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'realised_currency_loss';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'foreign_tax_withholding';

DO $$ BEGIN CREATE TYPE public.currency_definition_status AS ENUM ('draft','active','suspended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.exchange_rate_status AS ENUM ('scheduled','active','superseded','suspended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.currency_volatility_tier AS ENUM ('very_low','low','moderate','high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.currency_conversion_status AS ENUM ('quoted','completed','failed','reversed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.international_transfer_status AS ENUM ('quoted','confirmed','processing','completed','failed','reversed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.currency_settlement_policy AS ENUM ('preserve_recipient_currency','preserve_sender_currency','explicit_currency_selection','retain_local_currency','convert_immediately','convert_above_threshold','manual_conversion','split_retained_converted','employer_bears_conversion','employee_bears_conversion','no_conversion'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.currency_event_status AS ENUM ('scheduled','active','expired','cancelled','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.currency_definitions (
  currency_code char(3) PRIMARY KEY,
  display_name text NOT NULL,
  symbol text NOT NULL,
  minor_unit_precision smallint NOT NULL DEFAULT 2 CHECK (minor_unit_precision BETWEEN 0 AND 6),
  status public.currency_definition_status NOT NULL DEFAULT 'draft',
  default_formatting_locale text NOT NULL DEFAULT 'en-US',
  minimum_transferable_minor bigint NOT NULL DEFAULT 1 CHECK (minimum_transferable_minor > 0),
  maximum_supported_minor bigint NOT NULL DEFAULT 900000000000000 CHECK (maximum_supported_minor > minimum_transferable_minor),
  exchange_enabled boolean NOT NULL DEFAULT true,
  effective_start_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  CONSTRAINT currency_definitions_code CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT currency_definitions_dates CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

CREATE TABLE IF NOT EXISTS public.country_currency_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_profile_id uuid NOT NULL REFERENCES public.country_economic_profiles(id) ON DELETE CASCADE,
  currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code),
  effective_start_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date date,
  assigned_by_profile_id uuid REFERENCES public.profiles(id),
  reason text NOT NULL DEFAULT 'Finance Phase 6 country currency seed',
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT country_currency_assignment_dates CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS country_currency_active_idx ON public.country_currency_assignments(country_profile_id) WHERE effective_end_date IS NULL;

ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS currency_code char(3);
UPDATE public.financial_accounts SET currency_code = COALESCE(currency_code, default_currency_code, 'USD');
ALTER TABLE public.financial_accounts ALTER COLUMN currency_code SET NOT NULL;
DO $$ BEGIN ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_currency_code_format CHECK (currency_code ~ '^[A-Z]{3}$'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS account_purpose text NOT NULL DEFAULT 'operating';
ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS reporting_currency_code char(3);
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_owner_currency_purpose_primary_idx ON public.financial_accounts(owner_type, owner_id, currency_code, account_purpose) WHERE account_status='active' AND is_primary AND owner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_system_currency_purpose_idx ON public.financial_accounts(account_name, currency_code, account_purpose) WHERE account_status='active' AND owner_type='system';

ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS source_currency_code char(3);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS destination_currency_code char(3);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS source_amount_minor bigint;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS destination_amount_minor bigint;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS exchange_rate numeric(30,12);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS exchange_rate_source text;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS exchange_rate_timestamp timestamptz;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS conversion_fee_minor bigint NOT NULL DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS rounding_adjustment_minor bigint NOT NULL DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS reporting_currency_code char(3);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS reporting_amount_minor bigint;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS related_conversion_id uuid;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS exchange_rate_version_id uuid;
UPDATE public.financial_transactions SET source_currency_code=COALESCE(source_currency_code,currency_code), destination_currency_code=COALESCE(destination_currency_code,currency_code), source_amount_minor=COALESCE(source_amount_minor,net_amount_minor), destination_amount_minor=COALESCE(destination_amount_minor,net_amount_minor) WHERE source_currency_code IS NULL OR destination_currency_code IS NULL;

ALTER TABLE public.financial_ledger_entries ADD COLUMN IF NOT EXISTS currency_code char(3);
UPDATE public.financial_ledger_entries e SET currency_code = COALESCE(e.currency_code, a.currency_code, t.currency_code, 'USD') FROM public.financial_accounts a, public.financial_transactions t WHERE e.account_id=a.id AND e.transaction_id=t.id AND e.currency_code IS NULL;
ALTER TABLE public.financial_ledger_entries ALTER COLUMN currency_code SET NOT NULL;
DO $$ BEGIN ALTER TABLE public.financial_ledger_entries ADD CONSTRAINT financial_ledger_entries_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code),
  quote_currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code),
  rate numeric(30,12) NOT NULL CHECK (rate > 0),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  rate_source text NOT NULL DEFAULT 'admin_seed',
  calculation_method text NOT NULL DEFAULT 'reference_currency_seed',
  status public.exchange_rate_status NOT NULL DEFAULT 'scheduled',
  volatility_tier public.currency_volatility_tier NOT NULL DEFAULT 'low',
  rate_version integer NOT NULL DEFAULT 1,
  created_by_profile_id uuid REFERENCES public.profiles(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  CONSTRAINT exchange_rates_pair CHECK (base_currency_code <> quote_currency_code),
  CONSTRAINT exchange_rates_dates CHECK (expires_at IS NULL OR expires_at > effective_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_effective_pair_idx ON public.exchange_rates(base_currency_code, quote_currency_code, effective_at);
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_one_active_pair_idx ON public.exchange_rates(base_currency_code, quote_currency_code) WHERE status='active';
DO $$ BEGIN ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_exchange_rate_fk FOREIGN KEY (exchange_rate_version_id) REFERENCES public.exchange_rates(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.exchange_rate_controls (
  currency_code char(3) PRIMARY KEY REFERENCES public.currency_definitions(currency_code),
  max_daily_move_basis_points integer NOT NULL DEFAULT 150 CHECK (max_daily_move_basis_points BETWEEN 0 AND 10000),
  max_weekly_move_basis_points integer NOT NULL DEFAULT 500 CHECK (max_weekly_move_basis_points BETWEEN 0 AND 25000),
  minimum_rate numeric(30,12) NOT NULL DEFAULT 0.000001 CHECK (minimum_rate > 0),
  maximum_rate numeric(30,12) NOT NULL DEFAULT 1000000 CHECK (maximum_rate > minimum_rate),
  smoothing_window_days integer NOT NULL DEFAULT 7 CHECK (smoothing_window_days BETWEEN 1 AND 90),
  volatility_tier public.currency_volatility_tier NOT NULL DEFAULT 'low',
  administrative_freeze boolean NOT NULL DEFAULT false,
  manual_override_rate numeric(30,12),
  manual_override_expires_at timestamptz,
  circuit_breaker_state text NOT NULL DEFAULT 'normal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);

CREATE TABLE IF NOT EXISTS public.currency_conversion_fee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  percentage_fee_basis_points integer NOT NULL DEFAULT 75 CHECK (percentage_fee_basis_points >= 0),
  flat_fee_minor bigint NOT NULL DEFAULT 0 CHECK (flat_fee_minor >= 0),
  minimum_fee_minor bigint NOT NULL DEFAULT 0 CHECK (minimum_fee_minor >= 0),
  maximum_fee_minor bigint CHECK (maximum_fee_minor IS NULL OR maximum_fee_minor >= minimum_fee_minor),
  fee_free_threshold_minor bigint NOT NULL DEFAULT 0,
  preferred_account_discount_basis_points integer NOT NULL DEFAULT 0,
  band_company_discount_basis_points integer NOT NULL DEFAULT 0,
  treasury_exempt boolean NOT NULL DEFAULT true,
  administrative_exempt boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);

CREATE TABLE IF NOT EXISTS public.currency_conversion_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.financial_owner_type NOT NULL,
  owner_id uuid,
  source_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  destination_account_id uuid REFERENCES public.financial_accounts(id),
  source_currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code),
  destination_currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code),
  source_amount_minor bigint NOT NULL CHECK (source_amount_minor > 0),
  exchange_rate_id uuid REFERENCES public.exchange_rates(id),
  exchange_rate numeric(30,12) NOT NULL CHECK (exchange_rate > 0),
  gross_destination_amount_minor bigint NOT NULL CHECK (gross_destination_amount_minor >= 0),
  fee_amount_minor bigint NOT NULL DEFAULT 0 CHECK (fee_amount_minor >= 0),
  rounding_adjustment_minor bigint NOT NULL DEFAULT 0,
  net_destination_amount_minor bigint NOT NULL CHECK (net_destination_amount_minor >= 0),
  quote_expires_at timestamptz NOT NULL,
  rate_timestamp timestamptz NOT NULL,
  status public.currency_conversion_status NOT NULL DEFAULT 'quoted',
  idempotency_key text,
  created_by_profile_id uuid REFERENCES public.profiles(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.currency_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.currency_conversion_quotes(id),
  owner_type public.financial_owner_type NOT NULL,
  owner_id uuid,
  source_transaction_id uuid REFERENCES public.financial_transactions(id),
  destination_transaction_id uuid REFERENCES public.financial_transactions(id),
  fee_transaction_id uuid REFERENCES public.financial_transactions(id),
  source_currency_code char(3) NOT NULL,
  destination_currency_code char(3) NOT NULL,
  source_amount_minor bigint NOT NULL,
  destination_amount_minor bigint NOT NULL,
  fee_amount_minor bigint NOT NULL DEFAULT 0,
  rounding_adjustment_minor bigint NOT NULL DEFAULT 0,
  exchange_rate_id uuid NOT NULL REFERENCES public.exchange_rates(id),
  exchange_rate numeric(30,12) NOT NULL,
  status public.currency_conversion_status NOT NULL DEFAULT 'completed',
  reversal_conversion_id uuid REFERENCES public.currency_conversions(id),
  idempotency_key text NOT NULL UNIQUE,
  realised_gain_loss_minor bigint NOT NULL DEFAULT 0,
  gain_loss_method text NOT NULL DEFAULT 'weighted_average_reporting_basis',
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
DO $$ BEGIN ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_related_conversion_fk FOREIGN KEY (related_conversion_id) REFERENCES public.currency_conversions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.currency_clearing_accounts (
  currency_code char(3) PRIMARY KEY REFERENCES public.currency_definitions(currency_code),
  clearing_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  reserve_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  fee_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  rounding_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  liquidity_model text NOT NULL DEFAULT 'accounting_clearing_only',
  negative_balance_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.international_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  recipient_account_id uuid REFERENCES public.financial_accounts(id),
  sender_currency_code char(3) NOT NULL,
  recipient_currency_code char(3) NOT NULL,
  sender_amount_minor bigint NOT NULL CHECK (sender_amount_minor > 0),
  recipient_amount_minor bigint NOT NULL CHECK (recipient_amount_minor >= 0),
  exchange_rate_id uuid REFERENCES public.exchange_rates(id),
  exchange_rate numeric(30,12),
  fee_amount_minor bigint NOT NULL DEFAULT 0,
  transfer_description text,
  related_entity_type text,
  related_entity_id uuid,
  quote_expires_at timestamptz,
  settlement_policy public.currency_settlement_policy NOT NULL DEFAULT 'preserve_recipient_currency',
  compliance_placeholder jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.international_transfer_status NOT NULL DEFAULT 'quoted',
  transaction_id uuid REFERENCES public.financial_transactions(id),
  conversion_id uuid REFERENCES public.currency_conversions(id),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.owner_currency_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.financial_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  reporting_currency_code char(3) REFERENCES public.currency_definitions(currency_code),
  auto_conversion_preference text NOT NULL DEFAULT 'convert_only_when_required',
  foreign_income_settlement_policy public.currency_settlement_policy NOT NULL DEFAULT 'retain_local_currency',
  preferred_source_currency_code char(3) REFERENCES public.currency_definitions(currency_code),
  maximum_fee_basis_points integer NOT NULL DEFAULT 150,
  minimum_retained_foreign_balance_minor bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS public.foreign_gig_income_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, gig_id uuid, city_id uuid REFERENCES public.cities(id), country_profile_id uuid REFERENCES public.country_economic_profiles(id),
  local_currency_code char(3) NOT NULL, gross_local_amount_minor bigint NOT NULL DEFAULT 0, local_fee_minor bigint NOT NULL DEFAULT 0, local_tax_withheld_minor bigint NOT NULL DEFAULT 0, net_local_amount_minor bigint NOT NULL DEFAULT 0,
  conversion_status text NOT NULL DEFAULT 'retained', conversion_id uuid REFERENCES public.currency_conversions(id), reporting_currency_code char(3), reporting_amount_minor bigint, exchange_rate_id uuid REFERENCES public.exchange_rates(id),
  settlement_policy public.currency_settlement_policy NOT NULL DEFAULT 'retain_local_currency', transaction_id uuid REFERENCES public.financial_transactions(id), created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.international_payroll_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE, employee_profile_id uuid NOT NULL REFERENCES public.profiles(id), contract_currency_code char(3) NOT NULL, gross_salary_minor bigint NOT NULL CHECK (gross_salary_minor > 0), conversion_policy public.currency_settlement_policy NOT NULL DEFAULT 'employer_bears_conversion', rate_date_policy text NOT NULL DEFAULT 'payroll_run_date', fee_payer text NOT NULL DEFAULT 'employer', tax_withholding_currency_code char(3) NOT NULL, net_payment_currency_code char(3) NOT NULL, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT international_payroll_policy CHECK (conversion_policy IN ('employer_bears_conversion','employee_bears_conversion','no_conversion'))
);

CREATE TABLE IF NOT EXISTS public.foreign_tax_reporting_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid REFERENCES public.tax_assessments(id), transaction_id uuid REFERENCES public.financial_transactions(id), original_amount_minor bigint NOT NULL, original_currency_code char(3) NOT NULL, tax_reporting_amount_minor bigint NOT NULL, tax_currency_code char(3) NOT NULL, exchange_rate_id uuid NOT NULL REFERENCES public.exchange_rates(id), applied_rate numeric(30,12) NOT NULL, rate_timestamp timestamptz NOT NULL, rate_version integer NOT NULL, tax_period_id uuid REFERENCES public.tax_periods(id), created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.foreign_tax_withholding_placeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), foreign_jurisdiction text NOT NULL, withholding_type text NOT NULL, original_amount_minor bigint NOT NULL, withheld_amount_minor bigint NOT NULL, currency_code char(3) NOT NULL, exchange_rate_id uuid REFERENCES public.exchange_rates(id), related_transaction_id uuid REFERENCES public.financial_transactions(id), tax_period_id uuid REFERENCES public.tax_periods(id), domestic_credit_eligibility_placeholder text NOT NULL DEFAULT 'not_assessed', created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.realised_currency_gain_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL, owner_id uuid, acquisition_amount_minor bigint NOT NULL, acquisition_currency_code char(3) NOT NULL, acquisition_reporting_value_minor bigint NOT NULL, conversion_amount_minor bigint NOT NULL, conversion_reporting_value_minor bigint NOT NULL, realised_gain_loss_minor bigint NOT NULL, related_conversion_id uuid REFERENCES public.currency_conversions(id), related_transaction_ids uuid[] NOT NULL DEFAULT '{}', calculation_method text NOT NULL DEFAULT 'weighted_average_reporting_basis', created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.currency_exposure_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type public.financial_owner_type NOT NULL, owner_id uuid, reporting_currency_code char(3) NOT NULL, snapshot_at timestamptz NOT NULL DEFAULT timezone('utc',now()), balances jsonb NOT NULL DEFAULT '[]'::jsonb, unrealised_movement_minor bigint NOT NULL DEFAULT 0, largest_positions jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.exchange_rate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), affected_currency_code char(3) REFERENCES public.currency_definitions(currency_code), affected_country_profile_id uuid REFERENCES public.country_economic_profiles(id), start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, direction text NOT NULL CHECK (direction IN ('strengthen','weaken','stabilise','freeze')), maximum_effect_basis_points integer NOT NULL DEFAULT 0 CHECK (maximum_effect_basis_points BETWEEN 0 AND 2500), decay_basis_points integer NOT NULL DEFAULT 0, status public.currency_event_status NOT NULL DEFAULT 'scheduled', event_source text NOT NULL DEFAULT 'admin', explanation text NOT NULL, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT exchange_rate_events_dates CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS public.currency_reserve_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), currency_code char(3) NOT NULL REFERENCES public.currency_definitions(currency_code), clearing_balance_minor bigint NOT NULL, reserve_balance_minor bigint NOT NULL, fee_balance_minor bigint NOT NULL, rounding_balance_minor bigint NOT NULL, snapshot_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.currency_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), action text NOT NULL, entity_type text NOT NULL, entity_id uuid, previous_value jsonb, new_value jsonb, reason text NOT NULL DEFAULT 'not provided', created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.currency_round_minor(p_amount numeric, p_currency char(3)) RETURNS bigint LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE precision smallint; BEGIN SELECT minor_unit_precision INTO precision FROM public.currency_definitions WHERE currency_code=p_currency; IF precision IS NULL THEN RAISE EXCEPTION 'unsupported currency %', p_currency; END IF; RETURN floor(p_amount + 0.5)::bigint; END $$;

CREATE OR REPLACE FUNCTION public.get_or_create_financial_account_for_currency(p_owner_type public.financial_owner_type, p_owner_id uuid, p_currency char(3), p_purpose text DEFAULT 'operating', p_name text DEFAULT NULL, p_primary boolean DEFAULT false)
RETURNS public.financial_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_account public.financial_accounts; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.currency_definitions WHERE currency_code=p_currency AND status='active') THEN RAISE EXCEPTION 'unsupported or inactive currency %', p_currency; END IF;
  IF p_owner_type <> 'system' AND p_owner_id IS NULL THEN RAISE EXCEPTION 'owner_id is required'; END IF;
  SELECT * INTO v_account FROM public.financial_accounts WHERE owner_type=p_owner_type AND ((owner_id=p_owner_id) OR (owner_id IS NULL AND p_owner_id IS NULL)) AND currency_code=p_currency AND account_purpose=p_purpose AND account_status='active' ORDER BY is_primary DESC LIMIT 1;
  IF v_account.id IS NOT NULL THEN RETURN v_account; END IF;
  INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,default_currency_code,currency_code,account_purpose,is_primary,metadata)
  VALUES(p_owner_type,p_owner_id,COALESCE(p_name,initcap(p_owner_type::text)||' '||p_currency||' '||p_purpose||' account'),p_currency,p_currency,p_purpose,p_primary,jsonb_build_object('createdBy','finance_phase6_currency_service')) RETURNING * INTO v_account;
  RETURN v_account;
END $$;

CREATE OR REPLACE FUNCTION public.get_active_exchange_rate(p_base char(3), p_quote char(3), p_at timestamptz DEFAULT timezone('utc',now())) RETURNS public.exchange_rates LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE r public.exchange_rates; inv public.exchange_rates; BEGIN
  IF p_base=p_quote THEN RAISE EXCEPTION 'same-currency rates are not stored'; END IF;
  SELECT * INTO r FROM public.exchange_rates WHERE base_currency_code=p_base AND quote_currency_code=p_quote AND status='active' AND effective_at<=p_at AND (expires_at IS NULL OR expires_at>p_at) ORDER BY effective_at DESC LIMIT 1;
  IF r.id IS NOT NULL THEN RETURN r; END IF;
  SELECT * INTO inv FROM public.exchange_rates WHERE base_currency_code=p_quote AND quote_currency_code=p_base AND status='active' AND effective_at<=p_at AND (expires_at IS NULL OR expires_at>p_at) ORDER BY effective_at DESC LIMIT 1;
  IF inv.id IS NOT NULL THEN inv.rate := (1 / inv.rate); inv.base_currency_code := p_base; inv.quote_currency_code := p_quote; RETURN inv; END IF;
  RAISE EXCEPTION 'missing active exchange rate %/%', p_base, p_quote;
END $$;

CREATE OR REPLACE FUNCTION public.quote_currency_conversion(p_owner_type public.financial_owner_type, p_owner_id uuid, p_source_currency char(3), p_destination_currency char(3), p_source_amount_minor bigint, p_idempotency_key text DEFAULT NULL)
RETURNS public.currency_conversion_quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src public.financial_accounts; dst public.financial_accounts; rate public.exchange_rates; fee_sched record; gross bigint; fee bigint; net bigint; q public.currency_conversion_quotes; BEGIN
  IF p_source_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT * INTO q FROM public.currency_conversion_quotes WHERE idempotency_key=p_idempotency_key AND p_idempotency_key IS NOT NULL; IF q.id IS NOT NULL THEN RETURN q; END IF;
  src := public.get_or_create_financial_account_for_currency(p_owner_type,p_owner_id,p_source_currency,'operating',NULL,true);
  IF src.owner_type <> 'system' AND src.available_balance_minor < p_source_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  dst := public.get_or_create_financial_account_for_currency(p_owner_type,p_owner_id,p_destination_currency,'operating',NULL,false);
  IF p_source_currency=p_destination_currency THEN rate.rate := 1; rate.id := NULL; rate.effective_at := timezone('utc',now()); ELSE rate := public.get_active_exchange_rate(p_source_currency,p_destination_currency); END IF;
  gross := public.currency_round_minor(p_source_amount_minor * rate.rate, p_destination_currency);
  SELECT * INTO fee_sched FROM public.currency_conversion_fee_schedules WHERE status='active' ORDER BY created_at LIMIT 1;
  fee := CASE WHEN p_source_currency=p_destination_currency OR p_owner_type='country' THEN 0 ELSE COALESCE(public.currency_round_minor(gross * COALESCE(fee_sched.percentage_fee_basis_points,75) / 10000.0, p_destination_currency),0) + COALESCE(fee_sched.flat_fee_minor,0) END;
  IF fee_sched.maximum_fee_minor IS NOT NULL THEN fee := LEAST(fee, fee_sched.maximum_fee_minor); END IF; fee := GREATEST(fee, COALESCE(fee_sched.minimum_fee_minor,0)); IF COALESCE(fee_sched.fee_free_threshold_minor,0) > 0 AND p_source_amount_minor <= fee_sched.fee_free_threshold_minor THEN fee := 0; END IF;
  IF fee >= gross AND p_source_currency<>p_destination_currency THEN RAISE EXCEPTION 'fee exceeds converted amount'; END IF; net := GREATEST(0,gross-fee);
  INSERT INTO public.currency_conversion_quotes(owner_type,owner_id,source_account_id,destination_account_id,source_currency_code,destination_currency_code,source_amount_minor,exchange_rate_id,exchange_rate,gross_destination_amount_minor,fee_amount_minor,rounding_adjustment_minor,net_destination_amount_minor,quote_expires_at,rate_timestamp,idempotency_key,metadata)
  VALUES(p_owner_type,p_owner_id,src.id,dst.id,p_source_currency,p_destination_currency,p_source_amount_minor,rate.id,rate.rate,gross,fee,0,net,timezone('utc',now())+interval '5 minutes',COALESCE(rate.effective_at,timezone('utc',now())),p_idempotency_key,jsonb_build_object('serverGenerated',true,'clientRateIgnored',true)) RETURNING * INTO q;
  RETURN q;
END $$;

CREATE OR REPLACE FUNCTION public.execute_currency_conversion(p_quote_id uuid, p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.currency_conversion_quotes; src public.financial_accounts; dst public.financial_accounts; clear_src public.currency_clearing_accounts; clear_dst public.currency_clearing_accounts; conv uuid; tx_src uuid; tx_dst uuid; tx_fee uuid; before_src bigint; before_dst bigint; clear_before bigint; reserve_before bigint; fee_before bigint; BEGIN
  SELECT id INTO conv FROM public.currency_conversions WHERE idempotency_key=p_idempotency_key; IF conv IS NOT NULL THEN RETURN conv; END IF;
  SELECT * INTO q FROM public.currency_conversion_quotes WHERE id=p_quote_id FOR UPDATE; IF q.id IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF; IF q.quote_expires_at <= timezone('utc',now()) THEN UPDATE public.currency_conversion_quotes SET status='expired' WHERE id=q.id; RAISE EXCEPTION 'quote expired'; END IF;
  SELECT * INTO src FROM public.financial_accounts WHERE id=q.source_account_id FOR UPDATE; SELECT * INTO dst FROM public.financial_accounts WHERE id=q.destination_account_id FOR UPDATE;
  IF src.currency_code<>q.source_currency_code OR dst.currency_code<>q.destination_currency_code THEN RAISE EXCEPTION 'account currency mismatch'; END IF; IF src.owner_type <> 'system' AND src.available_balance_minor < q.source_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  SELECT * INTO clear_src FROM public.currency_clearing_accounts WHERE currency_code=q.source_currency_code; SELECT * INTO clear_dst FROM public.currency_clearing_accounts WHERE currency_code=q.destination_currency_code;
  IF clear_src.currency_code IS NULL OR clear_dst.currency_code IS NULL THEN RAISE EXCEPTION 'missing clearing account'; END IF;
  INSERT INTO public.currency_conversions(quote_id,owner_type,owner_id,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,fee_amount_minor,rounding_adjustment_minor,exchange_rate_id,exchange_rate,idempotency_key,metadata) VALUES(q.id,q.owner_type,q.owner_id,q.source_currency_code,q.destination_currency_code,q.source_amount_minor,q.net_destination_amount_minor,q.fee_amount_minor,q.rounding_adjustment_minor,q.exchange_rate_id,q.exchange_rate,p_idempotency_key,jsonb_build_object('ledgerFlow','source->clearing and reserve->destination')) RETURNING id INTO conv;
  before_src:=src.current_balance_minor; SELECT current_balance_minor INTO clear_before FROM public.financial_accounts WHERE id=clear_src.clearing_account_id FOR UPDATE;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,description,idempotency_key,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,exchange_rate,exchange_rate_source,exchange_rate_timestamp,conversion_fee_minor,rounding_adjustment_minor,related_conversion_id,exchange_rate_version_id,metadata) VALUES('currency_conversion','completed',q.source_currency_code,q.source_amount_minor,q.source_amount_minor,src.id,clear_src.clearing_account_id,'Currency conversion source leg',p_idempotency_key||':source','system',timezone('utc',now()),q.source_currency_code,q.source_currency_code,q.source_amount_minor,q.source_amount_minor,q.exchange_rate,'server_exchange_rate',q.rate_timestamp,0,0,conv,q.exchange_rate_id,jsonb_build_object('conversionLeg','source')) RETURNING id INTO tx_src;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-q.source_amount_minor, updated_at=timezone('utc',now()) WHERE id=src.id; UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+q.source_amount_minor, updated_at=timezone('utc',now()) WHERE id=clear_src.clearing_account_id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES(tx_src,src.id,'debit',q.source_amount_minor,before_src,before_src-q.source_amount_minor,q.source_currency_code),(tx_src,clear_src.clearing_account_id,'credit',q.source_amount_minor,clear_before,clear_before+q.source_amount_minor,q.source_currency_code);
  before_dst:=dst.current_balance_minor; SELECT current_balance_minor INTO reserve_before FROM public.financial_accounts WHERE id=clear_dst.reserve_account_id FOR UPDATE;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,fee_amount_minor,net_amount_minor,source_account_id,destination_account_id,description,idempotency_key,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,exchange_rate,exchange_rate_source,exchange_rate_timestamp,conversion_fee_minor,rounding_adjustment_minor,related_conversion_id,exchange_rate_version_id,metadata) VALUES('currency_conversion','completed',q.destination_currency_code,q.gross_destination_amount_minor,q.fee_amount_minor,q.net_destination_amount_minor,clear_dst.reserve_account_id,dst.id,'Currency conversion destination leg',p_idempotency_key||':destination','system',timezone('utc',now()),q.source_currency_code,q.destination_currency_code,q.source_amount_minor,q.net_destination_amount_minor,q.exchange_rate,'server_exchange_rate',q.rate_timestamp,q.fee_amount_minor,q.rounding_adjustment_minor,conv,q.exchange_rate_id,jsonb_build_object('conversionLeg','destination')) RETURNING id INTO tx_dst;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-q.net_destination_amount_minor, updated_at=timezone('utc',now()) WHERE id=clear_dst.reserve_account_id; UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+q.net_destination_amount_minor, updated_at=timezone('utc',now()) WHERE id=dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES(tx_dst,clear_dst.reserve_account_id,'debit',q.net_destination_amount_minor,reserve_before,reserve_before-q.net_destination_amount_minor,q.destination_currency_code),(tx_dst,dst.id,'credit',q.net_destination_amount_minor,before_dst,before_dst+q.net_destination_amount_minor,q.destination_currency_code);
  IF q.fee_amount_minor > 0 THEN SELECT current_balance_minor INTO fee_before FROM public.financial_accounts WHERE id=clear_dst.fee_account_id FOR UPDATE; INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,description,idempotency_key,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,exchange_rate,related_conversion_id,exchange_rate_version_id,metadata) VALUES('currency_conversion_fee','completed',q.destination_currency_code,q.fee_amount_minor,q.fee_amount_minor,clear_dst.reserve_account_id,clear_dst.fee_account_id,'Currency conversion fee',p_idempotency_key||':fee','system',timezone('utc',now()),q.destination_currency_code,q.destination_currency_code,q.fee_amount_minor,q.fee_amount_minor,1,conv,q.exchange_rate_id,jsonb_build_object('visibleFee',true)) RETURNING id INTO tx_fee; UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-q.fee_amount_minor WHERE id=clear_dst.reserve_account_id; UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+q.fee_amount_minor WHERE id=clear_dst.fee_account_id; INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES(tx_fee,clear_dst.reserve_account_id,'debit',q.fee_amount_minor,reserve_before-q.net_destination_amount_minor,reserve_before-q.net_destination_amount_minor-q.fee_amount_minor,q.destination_currency_code),(tx_fee,clear_dst.fee_account_id,'credit',q.fee_amount_minor,fee_before,fee_before+q.fee_amount_minor,q.destination_currency_code); END IF;
  UPDATE public.currency_conversions SET source_transaction_id=tx_src,destination_transaction_id=tx_dst,fee_transaction_id=tx_fee WHERE id=conv; UPDATE public.currency_conversion_quotes SET status='completed' WHERE id=q.id; RETURN conv;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_currency_conversion(p_conversion_id uuid, p_idempotency_key text, p_reason text DEFAULT 'Currency conversion reversal') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.currency_conversions; q public.currency_conversion_quotes; rev uuid; rq public.currency_conversion_quotes; BEGIN
  SELECT id INTO rev FROM public.currency_conversions WHERE idempotency_key=p_idempotency_key; IF rev IS NOT NULL THEN RETURN rev; END IF;
  SELECT * INTO c FROM public.currency_conversions WHERE id=p_conversion_id AND status='completed' FOR UPDATE; IF c.id IS NULL THEN RAISE EXCEPTION 'completed conversion not found'; END IF; IF c.reversal_conversion_id IS NOT NULL THEN RAISE EXCEPTION 'conversion already reversed'; END IF;
  SELECT * INTO q FROM public.currency_conversion_quotes WHERE id=c.quote_id; INSERT INTO public.currency_conversion_quotes(owner_type,owner_id,source_account_id,destination_account_id,source_currency_code,destination_currency_code,source_amount_minor,exchange_rate_id,exchange_rate,gross_destination_amount_minor,fee_amount_minor,rounding_adjustment_minor,net_destination_amount_minor,quote_expires_at,rate_timestamp,status,idempotency_key,metadata) VALUES(c.owner_type,c.owner_id,q.destination_account_id,q.source_account_id,c.destination_currency_code,c.source_currency_code,c.destination_amount_minor,c.exchange_rate_id,(1/c.exchange_rate),c.source_amount_minor,0,0,c.source_amount_minor,timezone('utc',now())+interval '5 minutes',timezone('utc',now()),'quoted',p_idempotency_key||':quote',jsonb_build_object('reversalOf',c.id,'reason',p_reason,'usesOriginalAmounts',true)) RETURNING * INTO rq;
  rev := public.execute_currency_conversion(rq.id,p_idempotency_key); UPDATE public.currency_conversions SET status='reversed', reversal_conversion_id=rev WHERE id=c.id; RETURN rev;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_currency_conversions() RETURNS TABLE(issue_type text, subject_id text, detail jsonb) LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT 'account_without_currency', id::text, jsonb_build_object('ownerType',owner_type,'ownerId',owner_id) FROM public.financial_accounts WHERE currency_code IS NULL
  UNION ALL SELECT 'mixed_currency_ledger_entry', e.id::text, jsonb_build_object('entryCurrency',e.currency_code,'accountCurrency',a.currency_code) FROM public.financial_ledger_entries e JOIN public.financial_accounts a ON a.id=e.account_id WHERE e.currency_code<>a.currency_code
  UNION ALL SELECT 'conversion_without_rate', id::text, to_jsonb(c) FROM public.currency_conversions c WHERE source_currency_code<>destination_currency_code AND exchange_rate_id IS NULL
  UNION ALL SELECT 'cross_currency_transaction_without_destination_amount', id::text, to_jsonb(t) FROM public.financial_transactions t WHERE source_currency_code<>destination_currency_code AND destination_amount_minor IS NULL
  UNION ALL SELECT 'fee_mismatch', c.id::text, jsonb_build_object('conversionFee',c.fee_amount_minor,'quoteFee',q.fee_amount_minor) FROM public.currency_conversions c JOIN public.currency_conversion_quotes q ON q.id=c.quote_id WHERE c.fee_amount_minor<>q.fee_amount_minor
  UNION ALL SELECT 'missing_clearing_entry', c.id::text, to_jsonb(c) FROM public.currency_conversions c WHERE NOT EXISTS (SELECT 1 FROM public.financial_transactions t WHERE t.related_conversion_id=c.id AND t.transaction_category='currency_conversion')
  UNION ALL SELECT 'unsupported_currency_account', a.id::text, to_jsonb(a) FROM public.financial_accounts a LEFT JOIN public.currency_definitions d ON d.currency_code=a.currency_code WHERE d.currency_code IS NULL
  UNION ALL SELECT 'historical_tax_conversion_without_rate_version', f.id::text, to_jsonb(f) FROM public.foreign_tax_reporting_conversions f WHERE exchange_rate_id IS NULL OR rate_version IS NULL;
$$;

CREATE OR REPLACE VIEW public.multi_currency_balance_summary AS
SELECT a.owner_type, a.owner_id, a.currency_code, a.account_purpose, SUM(a.current_balance_minor) actual_balance_minor, SUM(a.reserved_balance_minor) reserved_balance_minor, SUM(a.available_balance_minor) available_balance_minor, COALESCE(p.reporting_currency_code,a.currency_code) reporting_currency_code,
  CASE WHEN COALESCE(p.reporting_currency_code,a.currency_code)=a.currency_code THEN SUM(a.current_balance_minor) ELSE NULL END reporting_equivalent_minor,
  NULL::timestamptz exchange_rate_timestamp, 0::numeric percentage_of_reported_total, max(a.updated_at) recent_movement_at,
  CASE WHEN COALESCE(p.reporting_currency_code,a.currency_code)=a.currency_code THEN false ELSE true END stale_or_missing_rate_warning
FROM public.financial_accounts a LEFT JOIN public.owner_currency_preferences p ON p.owner_type=a.owner_type AND p.owner_id=a.owner_id
WHERE a.account_status='active' GROUP BY a.owner_type,a.owner_id,a.currency_code,a.account_purpose,p.reporting_currency_code;

CREATE OR REPLACE VIEW public.company_foreign_exchange_report AS
SELECT owner_id company_id, currency_code, SUM(actual_balance_minor) balance_minor, SUM(reserved_balance_minor) reserved_minor, SUM(available_balance_minor) available_minor, SUM(reporting_equivalent_minor) reporting_equivalent_minor, bool_or(stale_or_missing_rate_warning) stale_rate_warning FROM public.multi_currency_balance_summary WHERE owner_type='company' GROUP BY owner_id,currency_code;
CREATE OR REPLACE VIEW public.band_foreign_exchange_report AS
SELECT owner_id band_id, currency_code, SUM(actual_balance_minor) balance_minor, SUM(reserved_balance_minor) reserved_minor, SUM(available_balance_minor) available_minor, SUM(reporting_equivalent_minor) reporting_equivalent_minor, bool_or(stale_or_missing_rate_warning) stale_rate_warning FROM public.multi_currency_balance_summary WHERE owner_type='band' GROUP BY owner_id,currency_code;
CREATE OR REPLACE VIEW public.currency_rate_chart_view AS
SELECT base_currency_code, quote_currency_code, rate, effective_at, expires_at, status, volatility_tier, rate_source, calculation_method, rate_version FROM public.exchange_rates WHERE status IN ('active','superseded') ORDER BY base_currency_code, quote_currency_code, effective_at DESC;
CREATE OR REPLACE VIEW public.admin_currency_controls_view AS
SELECT d.currency_code,d.display_name,d.symbol,d.minor_unit_precision,d.status,d.exchange_enabled,c.max_daily_move_basis_points,c.max_weekly_move_basis_points,c.administrative_freeze,c.manual_override_rate,c.manual_override_expires_at,c.circuit_breaker_state FROM public.currency_definitions d LEFT JOIN public.exchange_rate_controls c ON c.currency_code=d.currency_code;

CREATE OR REPLACE FUNCTION public.ensure_phase6_currency_foundations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; code char(3); clear_acct public.financial_accounts; reserve_acct public.financial_accounts; fee_acct public.financial_accounts; rounding_acct public.financial_accounts; n integer:=0; BEGIN
  INSERT INTO public.currency_definitions(currency_code,display_name,symbol,minor_unit_precision,status,default_formatting_locale,minimum_transferable_minor,maximum_supported_minor,exchange_enabled,effective_start_date,metadata) VALUES
  ('USD','United States Dollar','$',2,'active','en-US',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('GBP','Pound Sterling','£',2,'active','en-GB',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('EUR','Euro','€',2,'active','de-DE',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('JPY','Japanese Yen','¥',0,'active','ja-JP',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('CAD','Canadian Dollar','CA$',2,'active','en-CA',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('AUD','Australian Dollar','A$',2,'active','en-AU',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('BRL','Brazilian Real','R$',2,'active','pt-BR',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('SEK','Swedish Krona','kr',2,'active','sv-SE',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('NOK','Norwegian Krone','kr',2,'active','nb-NO',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('DKK','Danish Krone','kr',2,'active','da-DK',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('CHF','Swiss Franc','CHF',2,'active','de-CH',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('PLN','Polish Zloty','zł',2,'active','pl-PL',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}'),('MXN','Mexican Peso','MX$',2,'active','es-MX',1,900000000000000,true,'2026-07-17','{"seed":"finance_phase6"}') ON CONFLICT(currency_code) DO UPDATE SET status='active', exchange_enabled=true;
  INSERT INTO public.currency_conversion_fee_schedules(schedule_name,status,percentage_fee_basis_points,minimum_fee_minor,maximum_fee_minor,metadata) VALUES('default_player_visible_fx_fee','active',75,1,500000,'{"hiddenFees":false}') ON CONFLICT(schedule_name) DO NOTHING;
  FOR r IN SELECT * FROM public.currency_definitions WHERE status='active' LOOP
    INSERT INTO public.exchange_rate_controls(currency_code,volatility_tier) VALUES(r.currency_code, CASE WHEN r.currency_code IN ('USD','GBP','EUR','JPY','CAD','AUD','CHF') THEN 'low'::public.currency_volatility_tier ELSE 'moderate'::public.currency_volatility_tier END) ON CONFLICT(currency_code) DO NOTHING;
    clear_acct := public.get_or_create_financial_account_for_currency('system',NULL,r.currency_code,'fx_clearing','FX clearing '||r.currency_code,false); reserve_acct := public.get_or_create_financial_account_for_currency('system',NULL,r.currency_code,'fx_reserve','FX reserve '||r.currency_code,false); fee_acct := public.get_or_create_financial_account_for_currency('system',NULL,r.currency_code,'fx_fee','FX fee '||r.currency_code,false); rounding_acct := public.get_or_create_financial_account_for_currency('system',NULL,r.currency_code,'fx_rounding','FX rounding '||r.currency_code,false);
    INSERT INTO public.currency_clearing_accounts(currency_code,clearing_account_id,reserve_account_id,fee_account_id,rounding_account_id) VALUES(r.currency_code,clear_acct.id,reserve_acct.id,fee_acct.id,rounding_acct.id) ON CONFLICT(currency_code) DO NOTHING; n:=n+1;
  END LOOP;
  FOR r IN SELECT id,country_name,country_code,primary_currency_code FROM public.country_economic_profiles LOOP
    code := CASE WHEN upper(r.country_name) LIKE '%UNITED KINGDOM%' OR upper(r.country_name) IN ('UK','GB','ENGLAND','SCOTLAND','WALES') THEN 'GBP' WHEN upper(r.country_name) LIKE '%JAPAN%' THEN 'JPY' WHEN upper(r.country_name) LIKE '%CANADA%' THEN 'CAD' WHEN upper(r.country_name) LIKE '%AUSTRALIA%' THEN 'AUD' WHEN upper(r.country_name) LIKE '%BRAZIL%' THEN 'BRL' WHEN upper(r.country_name) LIKE '%SWEDEN%' THEN 'SEK' WHEN upper(r.country_name) LIKE '%NORWAY%' THEN 'NOK' WHEN upper(r.country_name) LIKE '%DENMARK%' THEN 'DKK' WHEN upper(r.country_name) LIKE '%SWITZERLAND%' THEN 'CHF' WHEN upper(r.country_name) LIKE '%POLAND%' THEN 'PLN' WHEN upper(r.country_name) LIKE '%MEXICO%' THEN 'MXN' WHEN upper(r.country_name) LIKE ANY(ARRAY['%FRANCE%','%GERMANY%','%SPAIN%','%ITALY%','%IRELAND%','%NETHERLANDS%','%PORTUGAL%','%BELGIUM%','%AUSTRIA%','%FINLAND%']) THEN 'EUR' ELSE COALESCE(NULLIF(r.primary_currency_code,''),'USD') END;
    IF NOT EXISTS (SELECT 1 FROM public.currency_definitions WHERE currency_code=code) THEN code:='USD'; END IF;
    INSERT INTO public.country_currency_assignments(country_profile_id,currency_code,reason) VALUES(r.id,code,'Finance Phase 6 inferred from supported country') ON CONFLICT DO NOTHING;
    UPDATE public.country_economic_profiles SET primary_currency_code=code WHERE id=r.id; UPDATE public.national_treasury_profiles SET currency_code=code WHERE country_profile_id=r.id; UPDATE public.tax_jurisdictions SET currency_code=code WHERE country_profile_id=r.id AND status='active';
  END LOOP;
  INSERT INTO public.exchange_rates(base_currency_code,quote_currency_code,rate,effective_at,rate_source,calculation_method,status,volatility_tier,rate_version,metadata) VALUES
  ('USD','GBP',0.780000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','EUR',0.920000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','JPY',155.000000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','CAD',1.360000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','AUD',1.500000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','BRL',5.200000000000,'2026-07-17','admin_seed','reference_currency_seed','active','moderate',1,'{"referenceCurrency":"USD"}'),('USD','SEK',10.400000000000,'2026-07-17','admin_seed','reference_currency_seed','active','moderate',1,'{"referenceCurrency":"USD"}'),('USD','NOK',10.600000000000,'2026-07-17','admin_seed','reference_currency_seed','active','moderate',1,'{"referenceCurrency":"USD"}'),('USD','DKK',6.860000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','CHF',0.900000000000,'2026-07-17','admin_seed','reference_currency_seed','active','low',1,'{"referenceCurrency":"USD"}'),('USD','PLN',3.950000000000,'2026-07-17','admin_seed','reference_currency_seed','active','moderate',1,'{"referenceCurrency":"USD"}'),('USD','MXN',17.200000000000,'2026-07-17','admin_seed','reference_currency_seed','active','moderate',1,'{"referenceCurrency":"USD"}') ON CONFLICT(base_currency_code,quote_currency_code,effective_at) DO NOTHING;
  UPDATE public.financial_accounts SET currency_code=COALESCE(currency_code,default_currency_code,'USD'), default_currency_code=COALESCE(currency_code,default_currency_code,'USD');
  UPDATE public.cities c SET primary_currency_code=COALESCE((SELECT cp.primary_currency_code FROM public.country_economic_profiles cp WHERE cp.country_name=c.country OR cp.country_code=c.country LIMIT 1),c.primary_currency_code,'USD');
  RETURN n;
END $$;
SELECT public.ensure_phase6_currency_foundations();

CREATE OR REPLACE FUNCTION public.run_currency_scheduled_rate_processing(p_run_at timestamptz DEFAULT timezone('utc',now())) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE activated integer:=0; expired integer:=0; snaps integer:=0; BEGIN
  UPDATE public.exchange_rates SET status='superseded' WHERE status='active' AND expires_at IS NOT NULL AND expires_at<=p_run_at; GET DIAGNOSTICS expired = ROW_COUNT;
  UPDATE public.exchange_rates r SET status='active' WHERE r.status='scheduled' AND r.effective_at<=p_run_at AND (r.expires_at IS NULL OR r.expires_at>p_run_at) AND NOT EXISTS (SELECT 1 FROM public.exchange_rates a WHERE a.base_currency_code=r.base_currency_code AND a.quote_currency_code=r.quote_currency_code AND a.status='active'); GET DIAGNOSTICS activated = ROW_COUNT;
  UPDATE public.exchange_rate_events SET status='expired' WHERE status='active' AND end_at<=p_run_at;
  INSERT INTO public.currency_reserve_snapshots(currency_code,clearing_balance_minor,reserve_balance_minor,fee_balance_minor,rounding_balance_minor) SELECT c.currency_code, ca.current_balance_minor, ra.current_balance_minor, fa.current_balance_minor, roa.current_balance_minor FROM public.currency_clearing_accounts c JOIN public.financial_accounts ca ON ca.id=c.clearing_account_id JOIN public.financial_accounts ra ON ra.id=c.reserve_account_id JOIN public.financial_accounts fa ON fa.id=c.fee_account_id JOIN public.financial_accounts roa ON roa.id=c.rounding_account_id; GET DIAGNOSTICS snaps = ROW_COUNT;
  RETURN jsonb_build_object('activatedRates',activated,'expiredRates',expired,'reserveSnapshots',snaps,'idempotentWindow','current active pair uniqueness');
END $$;

ALTER TABLE public.currency_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_conversion_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY currency_definitions_public_select ON public.currency_definitions FOR SELECT USING (status IN ('active','suspended'));
CREATE POLICY exchange_rates_public_select ON public.exchange_rates FOR SELECT USING (status IN ('active','superseded'));
CREATE POLICY conversion_quotes_own_player_select ON public.currency_conversion_quotes FOR SELECT USING (owner_type='player' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.user_id=auth.uid()));
CREATE POLICY conversions_own_player_select ON public.currency_conversions FOR SELECT USING (owner_type='player' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.user_id=auth.uid()));
CREATE POLICY international_transfers_own_player_select ON public.international_transfers FOR SELECT USING (EXISTS (SELECT 1 FROM public.financial_accounts a JOIN public.profiles p ON p.id=a.owner_id WHERE p.user_id=auth.uid() AND a.owner_type='player' AND (a.id=sender_account_id OR a.id=recipient_account_id)));
