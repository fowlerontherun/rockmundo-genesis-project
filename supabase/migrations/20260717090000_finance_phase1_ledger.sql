-- Finance Phase 1: unified accounts, transaction ledger and audit foundation.
-- Money is stored as integer minor units (USD cents by default); legacy profile.cash,
-- bands.band_balance and companies.balance remain as deprecated compatibility mirrors.

CREATE TYPE public.financial_owner_type AS ENUM ('player','band','company','venue','city','country','system');
CREATE TYPE public.financial_account_status AS ENUM ('active','suspended','archived');
CREATE TYPE public.financial_transaction_status AS ENUM ('pending','completed','failed','reversed');
CREATE TYPE public.financial_entry_direction AS ENUM ('debit','credit');
CREATE TYPE public.financial_transaction_category AS ENUM (
  'starting_funds','administrative_adjustment','player_to_player_transfer','band_contribution','band_withdrawal',
  'wage_payment','ticket_sale','gig_payment','festival_payment','recording_studio_payment','rehearsal_payment',
  'travel_cost','accommodation_cost','equipment_purchase','equipment_sale','equipment_repair','merchandise_revenue',
  'merchandise_production_cost','streaming_royalty','song_release_royalty','company_revenue','company_operating_expense',
  'refund','tax_placeholder','system_fee'
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.financial_owner_type NOT NULL,
  owner_id uuid,
  account_name text NOT NULL,
  account_status public.financial_account_status NOT NULL DEFAULT 'active',
  current_balance_minor bigint NOT NULL DEFAULT 0,
  reserved_balance_minor bigint NOT NULL DEFAULT 0,
  available_balance_minor bigint GENERATED ALWAYS AS (current_balance_minor - reserved_balance_minor) STORED,
  default_currency_code char(3) NOT NULL DEFAULT 'USD',
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT financial_accounts_owner_id_required CHECK (owner_type = 'system' OR owner_id IS NOT NULL),
  CONSTRAINT financial_accounts_balances_nonnegative CHECK ((owner_type = 'system' OR current_balance_minor >= 0) AND reserved_balance_minor >= 0 AND (owner_type = 'system' OR reserved_balance_minor <= current_balance_minor)),
  CONSTRAINT financial_accounts_currency_format CHECK (default_currency_code ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_primary_owner_idx ON public.financial_accounts(owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_primary_system_idx ON public.financial_accounts(account_name) WHERE is_primary AND owner_type = 'system';
CREATE INDEX IF NOT EXISTS financial_accounts_owner_idx ON public.financial_accounts(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_category public.financial_transaction_category NOT NULL,
  status public.financial_transaction_status NOT NULL DEFAULT 'pending',
  currency_code char(3) NOT NULL DEFAULT 'USD',
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  fee_amount_minor bigint NOT NULL DEFAULT 0 CHECK (fee_amount_minor >= 0),
  tax_amount_minor bigint NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor > 0),
  source_account_id uuid REFERENCES public.financial_accounts(id),
  destination_account_id uuid REFERENCES public.financial_accounts(id),
  related_entity_type text,
  related_entity_id uuid,
  description text,
  idempotency_key text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id),
  created_by_profile_id uuid REFERENCES public.profiles(id),
  created_by_actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz,
  reversed_transaction_id uuid REFERENCES public.financial_transactions(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT financial_transactions_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_transactions_has_account CHECK (source_account_id IS NOT NULL OR destination_account_id IS NOT NULL),
  CONSTRAINT financial_transactions_no_self_transfer CHECK (source_account_id IS NULL OR destination_account_id IS NULL OR source_account_id <> destination_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_idempotency_idx ON public.financial_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS financial_transactions_created_idx ON public.financial_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS financial_transactions_source_idx ON public.financial_transactions(source_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_transactions_destination_idx ON public.financial_transactions(destination_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_transactions_category_idx ON public.financial_transactions(transaction_category, created_at DESC);

CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  entry_direction public.financial_entry_direction NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  balance_before_minor bigint NOT NULL,
  balance_after_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS financial_ledger_entries_transaction_idx ON public.financial_ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS financial_ledger_entries_account_idx ON public.financial_ledger_entries(account_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_completed_financial_transaction_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'reversed' AND NEW.reversed_transaction_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('completed','reversed') THEN RAISE EXCEPTION 'Completed financial transactions are immutable'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_completed_financial_transaction_update ON public.financial_transactions;
CREATE TRIGGER trg_prevent_completed_financial_transaction_update BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_financial_transaction_update();

CREATE OR REPLACE FUNCTION public.get_or_create_primary_financial_account(p_owner_type public.financial_owner_type, p_owner_id uuid, p_name text DEFAULT NULL, p_currency char(3) DEFAULT 'USD')
RETURNS public.financial_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account public.financial_accounts;
BEGIN
  IF p_owner_type <> 'system' AND p_owner_id IS NULL THEN RAISE EXCEPTION 'owner_id is required'; END IF;
  INSERT INTO public.financial_accounts(owner_type, owner_id, account_name, default_currency_code, is_primary)
  VALUES (p_owner_type, p_owner_id, COALESCE(p_name, initcap(p_owner_type::text) || ' operating account'), p_currency, true)
  ON CONFLICT DO NOTHING;
  SELECT * INTO v_account FROM public.financial_accounts WHERE is_primary AND owner_type = p_owner_type AND (owner_id = p_owner_id OR (owner_id IS NULL AND p_owner_id IS NULL)) LIMIT 1;
  RETURN v_account;
END; $$;

CREATE OR REPLACE FUNCTION public.finance_transfer(
  p_source_owner_type public.financial_owner_type,
  p_source_owner_id uuid,
  p_destination_owner_type public.financial_owner_type,
  p_destination_owner_id uuid,
  p_amount_minor bigint,
  p_category public.financial_transaction_category,
  p_description text,
  p_idempotency_key text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_created_by_profile_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.financial_accounts; dst public.financial_accounts; tx uuid; src_before bigint; dst_before bigint;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF tx IS NOT NULL THEN RAISE LOG 'finance_duplicate_idempotency key=%', p_idempotency_key; RETURN tx; END IF;
  src := public.get_or_create_primary_financial_account(p_source_owner_type, p_source_owner_id, NULL, 'USD');
  dst := public.get_or_create_primary_financial_account(p_destination_owner_type, p_destination_owner_id, NULL, 'USD');
  IF src.id = dst.id THEN RAISE EXCEPTION 'self transfers are not allowed'; END IF;
  SELECT * INTO src FROM public.financial_accounts WHERE id = src.id FOR UPDATE;
  SELECT * INTO dst FROM public.financial_accounts WHERE id = dst.id FOR UPDATE;
  IF src.account_status <> 'active' OR dst.account_status <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF src.owner_type <> 'system' AND src.available_balance_minor < p_amount_minor THEN RAISE LOG 'finance_insufficient_funds account=% amount=%', src.id, p_amount_minor; RAISE EXCEPTION 'insufficient funds'; END IF;
  src_before := src.current_balance_minor; dst_before := dst.current_balance_minor;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,metadata)
  VALUES (p_category,'completed','USD',p_amount_minor,p_amount_minor,src.id,dst.id,p_related_entity_type,p_related_entity_id,p_description,p_idempotency_key,auth.uid(),p_created_by_profile_id,COALESCE(auth.uid()::text,'system'),timezone('utc',now()),p_metadata) RETURNING id INTO tx;
  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor - p_amount_minor, updated_at = timezone('utc', now()) WHERE id = src.id;
  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor + p_amount_minor, updated_at = timezone('utc', now()) WHERE id = dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor) VALUES
    (tx, src.id, 'debit', p_amount_minor, src_before, src_before - p_amount_minor),
    (tx, dst.id, 'credit', p_amount_minor, dst_before, dst_before + p_amount_minor);
  RETURN tx;
END; $$;

CREATE OR REPLACE FUNCTION public.finance_credit_owner(p_owner_type public.financial_owner_type, p_owner_id uuid, p_amount_minor bigint, p_category public.financial_transaction_category, p_description text, p_idempotency_key text, p_created_by_profile_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.finance_transfer('system', NULL, p_owner_type, p_owner_id, p_amount_minor, p_category, p_description, p_idempotency_key, NULL, NULL, p_created_by_profile_id, p_metadata);
END; $$;

CREATE OR REPLACE FUNCTION public.finance_debit_owner(p_owner_type public.financial_owner_type, p_owner_id uuid, p_amount_minor bigint, p_category public.financial_transaction_category, p_description text, p_idempotency_key text, p_created_by_profile_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.finance_transfer(p_owner_type, p_owner_id, 'system', NULL, p_amount_minor, p_category, p_description, p_idempotency_key, NULL, NULL, p_created_by_profile_id, p_metadata);
END; $$;

CREATE OR REPLACE FUNCTION public.finance_reserve_owner(p_owner_type public.financial_owner_type, p_owner_id uuid, p_amount_minor bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.financial_accounts;
BEGIN
  acct := public.get_or_create_primary_financial_account(p_owner_type, p_owner_id, NULL, 'USD');
  UPDATE public.financial_accounts SET reserved_balance_minor = reserved_balance_minor + p_amount_minor, updated_at = timezone('utc', now()) WHERE id = acct.id AND account_status='active' AND available_balance_minor >= p_amount_minor;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient available funds to reserve'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.finance_release_reserve_owner(p_owner_type public.financial_owner_type, p_owner_id uuid, p_amount_minor bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.financial_accounts;
BEGIN
  acct := public.get_or_create_primary_financial_account(p_owner_type, p_owner_id, NULL, 'USD');
  UPDATE public.financial_accounts SET reserved_balance_minor = reserved_balance_minor - p_amount_minor, updated_at = timezone('utc', now()) WHERE id = acct.id AND reserved_balance_minor >= p_amount_minor;
  IF NOT FOUND THEN RAISE EXCEPTION 'reserved balance is too low'; END IF;
END; $$;


CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(p_transaction_id uuid, p_idempotency_key text, p_reason text DEFAULT 'Reversal', p_created_by_profile_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE original public.financial_transactions; reversal uuid;
BEGIN
  SELECT id INTO reversal FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF reversal IS NOT NULL THEN RAISE LOG 'finance_duplicate_idempotency key=%', p_idempotency_key; RETURN reversal; END IF;
  SELECT * INTO original FROM public.financial_transactions WHERE id = p_transaction_id AND status = 'completed' FOR UPDATE;
  IF original.id IS NULL THEN RAISE EXCEPTION 'completed transaction not found'; END IF;
  IF original.source_account_id IS NULL OR original.destination_account_id IS NULL THEN RAISE EXCEPTION 'only transfers can be automatically reversed'; END IF;
  SELECT public.finance_transfer(dst.owner_type, dst.owner_id, src.owner_type, src.owner_id, original.net_amount_minor, 'refund', COALESCE(p_reason, 'Reversal'), p_idempotency_key, original.related_entity_type, original.related_entity_id, p_created_by_profile_id, jsonb_build_object('reverses', original.id)) INTO reversal
  FROM public.financial_accounts src, public.financial_accounts dst
  WHERE src.id = original.source_account_id AND dst.id = original.destination_account_id;
  UPDATE public.financial_transactions SET status = 'reversed', reversed_transaction_id = reversal WHERE id = original.id;
  RAISE LOG 'finance_reversal original=% reversal=%', original.id, reversal;
  RETURN reversal;
END; $$;

CREATE OR REPLACE VIEW public.financial_account_integrity_issues AS
WITH entry_sums AS (
  SELECT account_id, COALESCE(SUM(CASE WHEN entry_direction='credit' THEN amount_minor ELSE -amount_minor END),0) balance_from_entries
  FROM public.financial_ledger_entries GROUP BY account_id
), tx_sums AS (
  SELECT t.id, COALESCE(SUM(CASE WHEN e.entry_direction='debit' THEN e.amount_minor ELSE 0 END),0) debits, COALESCE(SUM(CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE 0 END),0) credits, COUNT(e.id) entry_count
  FROM public.financial_transactions t LEFT JOIN public.financial_ledger_entries e ON e.transaction_id=t.id WHERE t.status='completed' GROUP BY t.id
)
SELECT 'ledger_imbalance' issue_type, id::text subject_id FROM tx_sums WHERE debits <> credits
UNION ALL SELECT 'completed_without_entries', id::text FROM tx_sums WHERE entry_count = 0
UNION ALL SELECT 'account_balance_mismatch', a.id::text FROM public.financial_accounts a LEFT JOIN entry_sums s ON s.account_id=a.id WHERE a.owner_type <> 'system' AND a.current_balance_minor <> COALESCE(s.balance_from_entries,0)
UNION ALL SELECT 'orphaned_owner', a.id::text FROM public.financial_accounts a WHERE a.owner_type='player' AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=a.owner_id);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_accounts_own_player_select ON public.financial_accounts FOR SELECT USING (owner_type='player' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=owner_id AND p.user_id=auth.uid()));
CREATE POLICY financial_transactions_own_player_select ON public.financial_transactions FOR SELECT USING (EXISTS (SELECT 1 FROM public.financial_accounts a JOIN public.profiles p ON p.id=a.owner_id WHERE p.user_id=auth.uid() AND a.owner_type='player' AND (a.id=source_account_id OR a.id=destination_account_id)));
CREATE POLICY financial_ledger_own_player_select ON public.financial_ledger_entries FOR SELECT USING (EXISTS (SELECT 1 FROM public.financial_accounts a JOIN public.profiles p ON p.id=a.owner_id WHERE p.user_id=auth.uid() AND a.owner_type='player' AND a.id=account_id));

-- Idempotent migration of legacy balances into primary accounts and opening ledger entries.
DO $$ DECLARE r record; BEGIN
  PERFORM public.get_or_create_primary_financial_account('system', NULL, 'RockMundo system settlement account', 'USD');
  FOR r IN SELECT id, COALESCE(cash,0)::bigint amount FROM public.profiles LOOP
    PERFORM public.finance_credit_owner('player', r.id, r.amount * 100, 'starting_funds', 'Migrated legacy player cash balance', 'legacy-player-cash-' || r.id, r.id, jsonb_build_object('legacy_field','profiles.cash'));
  END LOOP;
  FOR r IN SELECT id, COALESCE(band_balance,0)::bigint amount FROM public.bands LOOP
    PERFORM public.finance_credit_owner('band', r.id, r.amount * 100, 'starting_funds', 'Migrated legacy band balance', 'legacy-band-balance-' || r.id, NULL, jsonb_build_object('legacy_field','bands.band_balance'));
  END LOOP;
  IF to_regclass('public.companies') IS NOT NULL THEN
    FOR r IN EXECUTE 'SELECT id, COALESCE(balance,0)::bigint amount FROM public.companies' LOOP
      PERFORM public.finance_credit_owner('company', r.id, r.amount * 100, 'starting_funds', 'Migrated legacy company balance', 'legacy-company-balance-' || r.id, NULL, jsonb_build_object('legacy_field','companies.balance'));
    END LOOP;
  END IF;
END $$;
