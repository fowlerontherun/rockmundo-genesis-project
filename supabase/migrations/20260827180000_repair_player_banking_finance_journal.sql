-- Repair the live legacy personal-banking schema and make every wallet change
-- visible to the canonical finance dashboard. The production database still
-- uses profile-owned bank_accounts while the client calls the newer RPC names.

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE public.bank_accounts
        ADD COLUMN IF NOT EXISTS opening_idempotency_key text,
        ADD COLUMN IF NOT EXISTS opening_request jsonb NOT NULL DEFAULT '{}'::jsonb
    $ddl$;

    EXECUTE $ddl$
      CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_profile_opening_key_uidx
        ON public.bank_accounts (profile_id, opening_idempotency_key)
        WHERE opening_idempotency_key IS NOT NULL
    $ddl$;
  END IF;
END;
$migration$;

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS operation_idempotency_key text,
  ADD COLUMN IF NOT EXISTS operation_request jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS bank_transactions_profile_created_idx
  ON public.bank_transactions (profile_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.player_banking_operations (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  operation_type text NOT NULL CHECK (
    operation_type IN ('open_account', 'wallet_deposit', 'wallet_withdrawal', 'account_transfer')
  ),
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (profile_id, idempotency_key)
);

ALTER TABLE public.player_banking_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.player_banking_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.player_banking_operations TO service_role;

-- Resolve the same living, active character as the frontend. Never fall back to
-- a dead character or an arbitrary profile belonging to the auth account.
CREATE OR REPLACE FUNCTION public._caller_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
  SELECT profile.id
  FROM public.profiles profile
  WHERE profile.user_id = auth.uid()
    AND profile.died_at IS NULL
  ORDER BY
    COALESCE(profile.is_active, false) DESC,
    profile.updated_at DESC NULLS LAST,
    profile.created_at DESC,
    profile.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._caller_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._caller_profile_id() TO authenticated, service_role;

-- Post a balanced journal entry for a whole-unit profiles.cash delta. This is
-- the compatibility boundary for older gameplay screens that still write cash
-- directly instead of calling a finance RPC.
CREATE OR REPLACE FUNCTION public._journal_profile_wallet_delta(
  p_profile_id uuid,
  p_delta_minor bigint,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  wallet_id uuid;
  system_id uuid;
  wallet public.financial_accounts%ROWTYPE;
  clearing public.financial_accounts%ROWTYPE;
  transaction_id uuid;
  existing_transaction_id uuid;
  amount_minor bigint := abs(COALESCE(p_delta_minor, 0));
  wallet_after_minor bigint;
  clearing_after_minor bigint;
  classification text := NULLIF(btrim(COALESCE(p_context->>'classification', '')), '');
  display_category text := NULLIF(btrim(COALESCE(p_context->>'display_category', '')), '');
  transaction_description text := NULLIF(btrim(COALESCE(p_context->>'description', '')), '');
  requested_key text := NULLIF(btrim(COALESCE(p_context->>'idempotency_key', '')), '');
  transaction_key text;
  is_external_cash_flow boolean := true;
  transaction_category public.financial_transaction_category := 'administrative_adjustment';
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  IF amount_minor = 0 THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.financial_accounts (
    owner_type,
    owner_id,
    account_name,
    account_status,
    current_balance_minor,
    reserved_balance_minor,
    default_currency_code,
    is_primary,
    metadata
  ) VALUES (
    'player',
    p_profile_id,
    'Personal cash',
    'active',
    0,
    0,
    'USD',
    true,
    jsonb_build_object('profilesCashRole', 'compatibility_projection')
  )
  ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
  DO NOTHING;

  SELECT account.id
  INTO wallet_id
  FROM public.financial_accounts account
  WHERE account.owner_type = 'player'
    AND account.owner_id = p_profile_id
    AND account.is_primary
  ORDER BY account.created_at, account.id
  LIMIT 1;

  SELECT account.id
  INTO system_id
  FROM public.financial_accounts account
  WHERE account.owner_type = 'system'
    AND account.is_primary
  ORDER BY account.created_at, account.id
  LIMIT 1;

  IF system_id IS NULL THEN
    INSERT INTO public.financial_accounts (
      owner_type,
      owner_id,
      account_name,
      account_status,
      current_balance_minor,
      reserved_balance_minor,
      default_currency_code,
      is_primary,
      metadata
    ) VALUES (
      'system',
      NULL,
      'Wallet clearing account',
      'active',
      0,
      0,
      'USD',
      true,
      jsonb_build_object('account_role', 'wallet_clearing')
    )
    ON CONFLICT DO NOTHING;

    SELECT account.id
    INTO system_id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'system'
      AND account.is_primary
    ORDER BY account.created_at, account.id
    LIMIT 1;
  END IF;

  IF wallet_id IS NULL OR system_id IS NULL THEN
    RAISE EXCEPTION 'wallet_account_initialisation_failed' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.financial_accounts account
  WHERE account.id IN (wallet_id, system_id)
  ORDER BY account.id
  FOR UPDATE;

  SELECT * INTO wallet FROM public.financial_accounts WHERE id = wallet_id;
  SELECT * INTO clearing FROM public.financial_accounts WHERE id = system_id;

  wallet_after_minor := wallet.current_balance_minor + p_delta_minor;
  IF wallet_after_minor < 0 OR wallet_after_minor < wallet.reserved_balance_minor THEN
    RAISE EXCEPTION 'insufficient_available_wallet_funds' USING ERRCODE = 'P0001';
  END IF;

  IF classification IS NULL THEN
    classification := CASE WHEN p_delta_minor > 0 THEN 'wallet_income' ELSE 'wallet_outgoing' END;
  END IF;
  IF display_category IS NULL THEN
    display_category := classification;
  END IF;
  IF transaction_description IS NULL THEN
    transaction_description := CASE WHEN p_delta_minor > 0 THEN 'Wallet income' ELSE 'Wallet outgoing' END;
  END IF;

  IF lower(COALESCE(p_context->>'external_cash_flow', '')) IN ('true', 'false') THEN
    is_external_cash_flow := (p_context->>'external_cash_flow')::boolean;
  ELSIF classification IN ('bank_transfer', 'wallet_reconciliation', 'starting_funds') THEN
    is_external_cash_flow := false;
  END IF;

  IF classification = 'starting_funds' THEN
    transaction_category := 'starting_funds';
  END IF;

  transaction_key := CASE
    WHEN requested_key IS NOT NULL
      THEN 'player-cash:' || p_profile_id::text || ':' || requested_key
    ELSE 'player-cash:' || p_profile_id::text || ':' || gen_random_uuid()::text
  END;

  SELECT item.id
  INTO existing_transaction_id
  FROM public.financial_transactions item
  WHERE item.idempotency_key = transaction_key;

  IF existing_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'profile_cash_idempotency_conflict' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.financial_transactions (
    transaction_category,
    status,
    currency_code,
    gross_amount_minor,
    net_amount_minor,
    source_account_id,
    destination_account_id,
    description,
    idempotency_key,
    created_by_user_id,
    created_by_profile_id,
    created_by_actor,
    completed_at,
    metadata
  ) VALUES (
    transaction_category,
    'completed',
    wallet.default_currency_code,
    amount_minor,
    amount_minor,
    CASE WHEN p_delta_minor < 0 THEN wallet.id ELSE clearing.id END,
    CASE WHEN p_delta_minor > 0 THEN wallet.id ELSE clearing.id END,
    transaction_description,
    transaction_key,
    auth.uid(),
    p_profile_id,
    COALESCE(auth.uid()::text, 'system'),
    now(),
    COALESCE(p_context, '{}'::jsonb) || jsonb_build_object(
      'classification', classification,
      'display_category', display_category,
      'external_cash_flow', is_external_cash_flow,
      'source', 'profiles_cash_trigger'
    )
  )
  RETURNING id INTO transaction_id;

  clearing_after_minor := clearing.current_balance_minor - p_delta_minor;

  UPDATE public.financial_accounts
  SET current_balance_minor = wallet_after_minor,
      updated_at = now(),
      metadata = metadata || jsonb_build_object('profilesCashRole', 'compatibility_projection')
  WHERE id = wallet.id;

  UPDATE public.financial_accounts
  SET current_balance_minor = clearing_after_minor,
      updated_at = now()
  WHERE id = clearing.id;

  IF p_delta_minor > 0 THEN
    INSERT INTO public.financial_ledger_entries (
      transaction_id, account_id, entry_direction, amount_minor,
      balance_before_minor, balance_after_minor
    ) VALUES
      (transaction_id, clearing.id, 'debit', amount_minor, clearing.current_balance_minor, clearing_after_minor),
      (transaction_id, wallet.id, 'credit', amount_minor, wallet.current_balance_minor, wallet_after_minor);
  ELSE
    INSERT INTO public.financial_ledger_entries (
      transaction_id, account_id, entry_direction, amount_minor,
      balance_before_minor, balance_after_minor
    ) VALUES
      (transaction_id, wallet.id, 'debit', amount_minor, wallet.current_balance_minor, wallet_after_minor),
      (transaction_id, clearing.id, 'credit', amount_minor, clearing.current_balance_minor, clearing_after_minor);
  END IF;

  RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_cash_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  delta_minor bigint;
  context_text text := current_setting('app.player_cash_context', true);
  context_payload jsonb := '{}'::jsonb;
BEGIN
  IF current_setting('app.skip_profile_cash_finance_sync', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF context_text IS NOT NULL AND btrim(context_text) <> '' THEN
    BEGIN
      context_payload := context_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
      context_payload := '{}'::jsonb;
    END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    delta_minor := round(COALESCE(NEW.cash, 0)::numeric * 100)::bigint;
    context_payload := jsonb_build_object(
      'classification', 'starting_funds',
      'display_category', 'starting_funds',
      'description', 'Starting funds',
      'external_cash_flow', false
    ) || context_payload;
  ELSE
    delta_minor := round(
      (COALESCE(NEW.cash, 0)::numeric - COALESCE(OLD.cash, 0)::numeric) * 100
    )::bigint;
  END IF;

  IF delta_minor <> 0 THEN
    PERFORM public._journal_profile_wallet_delta(NEW.id, delta_minor, context_payload);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_cash_financial_account ON public.profiles;
CREATE TRIGGER trg_sync_profile_cash_financial_account
AFTER INSERT OR UPDATE OF cash ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_cash_financial_account();

-- Canonical finance RPCs update financial_accounts first. Keep the whole-unit
-- profiles.cash compatibility projection current without creating a second
-- transaction when that projection write fires the trigger above.
CREATE OR REPLACE FUNCTION public.sync_primary_financial_account_profile_cash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  previous_skip text := current_setting('app.skip_profile_cash_finance_sync', true);
  projected_cash bigint;
BEGIN
  IF NEW.owner_type <> 'player' OR NOT NEW.is_primary OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  projected_cash := trunc(NEW.current_balance_minor::numeric / 100)::bigint;
  IF EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = NEW.owner_id
      AND profile.cash IS DISTINCT FROM projected_cash
  ) THEN
    PERFORM set_config('app.skip_profile_cash_finance_sync', 'true', true);
    BEGIN
      UPDATE public.profiles SET cash = projected_cash WHERE id = NEW.owner_id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.skip_profile_cash_finance_sync', COALESCE(previous_skip, ''), true);
      RAISE;
    END;
    PERFORM set_config('app.skip_profile_cash_finance_sync', COALESCE(previous_skip, ''), true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_financial_account_profile_cash
  ON public.financial_accounts;
CREATE TRIGGER trg_sync_primary_financial_account_profile_cash
AFTER UPDATE OF current_balance_minor ON public.financial_accounts
FOR EACH ROW
WHEN (
  NEW.owner_type = 'player'::public.financial_owner_type
  AND NEW.is_primary
  AND NEW.current_balance_minor IS DISTINCT FROM OLD.current_balance_minor
)
EXECUTE FUNCTION public.sync_primary_financial_account_profile_cash();

REVOKE ALL ON FUNCTION public._journal_profile_wallet_delta(uuid, bigint, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_cash_financial_account()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_primary_financial_account_profile_cash()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._journal_profile_wallet_delta(uuid, bigint, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_cash_financial_account()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_primary_financial_account_profile_cash()
  TO service_role;

-- Reconcile the live profiles without rewriting player-visible cash. Every
-- repair is a balanced, non-cash-flow journal rather than a silent balance edit.
INSERT INTO public.financial_accounts (
  owner_type,
  owner_id,
  account_name,
  account_status,
  current_balance_minor,
  reserved_balance_minor,
  default_currency_code,
  is_primary,
  metadata
)
SELECT
  'player',
  profile.id,
  'Personal cash',
  'active',
  0,
  0,
  'USD',
  true,
  jsonb_build_object('profilesCashRole', 'compatibility_projection')
FROM public.profiles profile
ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
DO NOTHING;

DO $$
DECLARE
  item record;
  desired_minor bigint;
  delta_minor bigint;
BEGIN
  FOR item IN
    SELECT profile.id, profile.cash, account.current_balance_minor
    FROM public.profiles profile
    JOIN public.financial_accounts account
      ON account.owner_type = 'player'
     AND account.owner_id = profile.id
     AND account.is_primary
  LOOP
    desired_minor := round(COALESCE(item.cash, 0)::numeric * 100)::bigint;
    delta_minor := desired_minor - item.current_balance_minor;
    IF delta_minor <> 0 THEN
      PERFORM public._journal_profile_wallet_delta(
        item.id,
        delta_minor,
        jsonb_build_object(
          'classification', 'wallet_reconciliation',
          'display_category', 'wallet_reconciliation',
          'description', 'Wallet balance reconciliation',
          'external_cash_flow', false
        )
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._claim_player_banking_operation(
  p_profile_id uuid,
  p_idempotency_key text,
  p_operation_type text,
  p_request_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  inserted_count integer := 0;
  existing public.player_banking_operations%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.player_banking_operations (
    profile_id, idempotency_key, operation_type, request_payload
  ) VALUES (
    p_profile_id, btrim(p_idempotency_key), p_operation_type, p_request_payload
  )
  ON CONFLICT (profile_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO existing
  FROM public.player_banking_operations operation
  WHERE operation.profile_id = p_profile_id
    AND operation.idempotency_key = btrim(p_idempotency_key)
  FOR UPDATE;

  IF existing.operation_type IS DISTINCT FROM p_operation_type
    OR existing.request_payload IS DISTINCT FROM p_request_payload THEN
    RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF existing.response_payload IS NULL THEN
    RAISE EXCEPTION 'banking_operation_incomplete' USING ERRCODE = 'P0001';
  END IF;

  RETURN existing.response_payload || jsonb_build_object('idempotent', true);
END;
$$;

CREATE OR REPLACE FUNCTION public._complete_player_banking_operation(
  p_profile_id uuid,
  p_idempotency_key text,
  p_response_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
BEGIN
  UPDATE public.player_banking_operations
  SET response_payload = p_response_payload,
      completed_at = now()
  WHERE profile_id = p_profile_id
    AND idempotency_key = btrim(p_idempotency_key);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'banking_operation_claim_missing' USING ERRCODE = 'P0001';
  END IF;

  RETURN p_response_payload || jsonb_build_object('idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public._claim_player_banking_operation(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._complete_player_banking_operation(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._claim_player_banking_operation(uuid, text, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public._complete_player_banking_operation(uuid, text, jsonb)
  TO service_role;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.open_my_bank_account(
  p_account_type text,
  p_nickname text,
  p_initial_amount_minor bigint,
  p_term_months integer,
  p_currency_code char(3),
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  request_payload jsonb;
  replay jsonb;
  response_payload jsonb;
  cash_major bigint;
  account_id uuid;
  bank_transaction_id uuid;
  annual_rate_bps integer := 0;
  locked_until timestamptz;
  v_currency_code text := upper(btrim(COALESCE(p_currency_code::text, 'USD')));
  normalized_nickname text := NULLIF(btrim(COALESCE(p_nickname, '')), '');
  previous_context text := current_setting('app.player_cash_context', true);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_account_type NOT IN ('current', 'savings', 'fixed_deposit') THEN
    RAISE EXCEPTION 'bank_account_type_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_currency_code !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'currency_code_invalid' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_initial_amount_minor, 0) < 0
    OR mod(COALESCE(p_initial_amount_minor, 0), 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = '22023';
  END IF;
  IF p_account_type = 'fixed_deposit'
    AND (COALESCE(p_term_months, 0) < 3 OR p_term_months > 60) THEN
    RAISE EXCEPTION 'fixed_deposit_term_invalid' USING ERRCODE = '22023';
  END IF;

  request_payload := jsonb_build_object(
    'accountType', p_account_type,
    'nickname', normalized_nickname,
    'initialAmountMinor', COALESCE(p_initial_amount_minor, 0),
    'termMonths', CASE WHEN p_account_type = 'fixed_deposit' THEN p_term_months ELSE NULL END,
    'currencyCode', v_currency_code
  );
  replay := public._claim_player_banking_operation(
    v_profile_id, p_idempotency_key, 'open_account', request_payload
  );
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT profile.cash
  INTO cash_major
  FROM public.profiles profile
  WHERE profile.id = v_profile_id
    AND profile.user_id = auth.uid()
    AND profile.died_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_profile_not_owned' USING ERRCODE = '42501';
  END IF;
  IF round(COALESCE(cash_major, 0)::numeric * 100)::bigint < COALESCE(p_initial_amount_minor, 0) THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  annual_rate_bps := CASE p_account_type
    WHEN 'current' THEN 0
    WHEN 'savings' THEN 250
    ELSE 300 + (p_term_months * 25)
  END;
  IF p_account_type = 'fixed_deposit' THEN
    locked_until := now() + make_interval(months => p_term_months);
  END IF;

  INSERT INTO public.bank_accounts (
    profile_id,
    account_type,
    provider_name,
    currency_code,
    balance_minor,
    annual_rate_bps,
    status,
    maturity_date,
    locked_until,
    nickname,
    opening_idempotency_key,
    opening_request
  ) VALUES (
    v_profile_id,
    p_account_type,
    'RockMundo Bank',
    v_currency_code,
    COALESCE(p_initial_amount_minor, 0),
    annual_rate_bps,
    'active',
    locked_until,
    locked_until,
    normalized_nickname,
    btrim(p_idempotency_key),
    request_payload
  )
  RETURNING id INTO account_id;

  IF COALESCE(p_initial_amount_minor, 0) > 0 THEN
    PERFORM set_config(
      'app.player_cash_context',
      jsonb_build_object(
        'classification', 'bank_transfer',
        'display_category', 'bank_deposit',
        'description', 'Opening deposit to bank account',
        'external_cash_flow', false,
        'idempotency_key', btrim(p_idempotency_key)
      )::text,
      true
    );
    BEGIN
      UPDATE public.profiles
      SET cash = cash - (p_initial_amount_minor / 100)
      WHERE id = v_profile_id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);
      RAISE;
    END;
    PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);

    INSERT INTO public.bank_transactions (
      account_id,
      profile_id,
      tx_type,
      amount_minor,
      balance_after_minor,
      currency_code,
      description,
      operation_idempotency_key,
      operation_request
    ) VALUES (
      account_id,
      v_profile_id,
      'deposit',
      p_initial_amount_minor,
      p_initial_amount_minor,
      v_currency_code,
      'Opening deposit',
      btrim(p_idempotency_key),
      request_payload
    )
    RETURNING id INTO bank_transaction_id;
  END IF;

  response_payload := jsonb_build_object(
    'accountId', account_id,
    'transactionId', bank_transaction_id,
    'currencyCode', v_currency_code,
    'walletBalanceMinor', (cash_major * 100) - COALESCE(p_initial_amount_minor, 0),
    'balanceMinor', COALESCE(p_initial_amount_minor, 0)
  );
  RETURN public._complete_player_banking_operation(
    v_profile_id, p_idempotency_key, response_payload
  );
END;
$$;
$function$;
  END IF;
END;
$legacy$;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.deposit_my_wallet_to_bank(
  p_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  request_payload jsonb;
  replay jsonb;
  response_payload jsonb;
  account public.bank_accounts%ROWTYPE;
  cash_major bigint;
  bank_balance_minor bigint;
  bank_transaction_id uuid;
  previous_context text := current_setting('app.player_cash_context', true);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_amount_minor, 0) <= 0 OR mod(p_amount_minor, 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = '22023';
  END IF;

  request_payload := jsonb_build_object(
    'bankAccountId', p_bank_account_id,
    'amountMinor', p_amount_minor
  );
  replay := public._claim_player_banking_operation(
    v_profile_id, p_idempotency_key, 'wallet_deposit', request_payload
  );
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO account
  FROM public.bank_accounts item
  WHERE item.id = p_bank_account_id
    AND item.profile_id = v_profile_id
  FOR UPDATE;
  IF account.id IS NULL OR account.status <> 'active' THEN
    RAISE EXCEPTION 'bank_account_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT profile.cash INTO cash_major
  FROM public.profiles profile
  WHERE profile.id = v_profile_id AND profile.user_id = auth.uid() AND profile.died_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_profile_not_owned' USING ERRCODE = '42501'; END IF;
  IF cash_major * 100 < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config(
    'app.player_cash_context',
    jsonb_build_object(
      'classification', 'bank_transfer',
      'display_category', 'bank_deposit',
      'description', 'Wallet deposit to bank account',
      'external_cash_flow', false,
      'idempotency_key', btrim(p_idempotency_key)
    )::text,
    true
  );
  BEGIN
    UPDATE public.profiles
    SET cash = cash - (p_amount_minor / 100)
    WHERE id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);
    RAISE;
  END;
  PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);

  UPDATE public.bank_accounts
  SET balance_minor = balance_minor + p_amount_minor,
      updated_at = now()
  WHERE id = account.id
  RETURNING balance_minor INTO bank_balance_minor;

  INSERT INTO public.bank_transactions (
    account_id, profile_id, tx_type, amount_minor, balance_after_minor,
    currency_code, description, operation_idempotency_key, operation_request
  ) VALUES (
    account.id, v_profile_id, 'deposit', p_amount_minor, bank_balance_minor,
    account.currency_code, 'Wallet deposit', btrim(p_idempotency_key), request_payload
  ) RETURNING id INTO bank_transaction_id;

  response_payload := jsonb_build_object(
    'transactionId', bank_transaction_id,
    'currencyCode', account.currency_code,
    'walletBalanceMinor', (cash_major * 100) - p_amount_minor,
    'bankBalanceMinor', bank_balance_minor
  );
  RETURN public._complete_player_banking_operation(v_profile_id, p_idempotency_key, response_payload);
END;
$$;
$function$;
  END IF;
END;
$legacy$;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.withdraw_my_bank_to_wallet(
  p_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  request_payload jsonb;
  replay jsonb;
  response_payload jsonb;
  account public.bank_accounts%ROWTYPE;
  cash_major bigint;
  bank_balance_minor bigint;
  bank_transaction_id uuid;
  previous_context text := current_setting('app.player_cash_context', true);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_amount_minor, 0) <= 0 OR mod(p_amount_minor, 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = '22023';
  END IF;

  request_payload := jsonb_build_object(
    'bankAccountId', p_bank_account_id,
    'amountMinor', p_amount_minor
  );
  replay := public._claim_player_banking_operation(
    v_profile_id, p_idempotency_key, 'wallet_withdrawal', request_payload
  );
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO account
  FROM public.bank_accounts item
  WHERE item.id = p_bank_account_id
    AND item.profile_id = v_profile_id
  FOR UPDATE;
  IF account.id IS NULL OR account.status <> 'active' THEN
    RAISE EXCEPTION 'bank_account_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF account.locked_until IS NOT NULL AND account.locked_until > now() THEN
    RAISE EXCEPTION 'bank_account_locked' USING ERRCODE = 'P0001';
  END IF;
  IF account.balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  SELECT profile.cash INTO cash_major
  FROM public.profiles profile
  WHERE profile.id = v_profile_id AND profile.user_id = auth.uid() AND profile.died_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_profile_not_owned' USING ERRCODE = '42501'; END IF;

  UPDATE public.bank_accounts
  SET balance_minor = balance_minor - p_amount_minor,
      updated_at = now()
  WHERE id = account.id
  RETURNING balance_minor INTO bank_balance_minor;

  PERFORM set_config(
    'app.player_cash_context',
    jsonb_build_object(
      'classification', 'bank_transfer',
      'display_category', 'bank_withdrawal',
      'description', 'Bank withdrawal to wallet',
      'external_cash_flow', false,
      'idempotency_key', btrim(p_idempotency_key)
    )::text,
    true
  );
  BEGIN
    UPDATE public.profiles
    SET cash = cash + (p_amount_minor / 100)
    WHERE id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);
    RAISE;
  END;
  PERFORM set_config('app.player_cash_context', COALESCE(previous_context, ''), true);

  INSERT INTO public.bank_transactions (
    account_id, profile_id, tx_type, amount_minor, balance_after_minor,
    currency_code, description, operation_idempotency_key, operation_request
  ) VALUES (
    account.id, v_profile_id, 'withdrawal', p_amount_minor, bank_balance_minor,
    account.currency_code, 'Withdrawal to wallet', btrim(p_idempotency_key), request_payload
  ) RETURNING id INTO bank_transaction_id;

  response_payload := jsonb_build_object(
    'transactionId', bank_transaction_id,
    'currencyCode', account.currency_code,
    'walletBalanceMinor', (cash_major * 100) + p_amount_minor,
    'bankBalanceMinor', bank_balance_minor
  );
  RETURN public._complete_player_banking_operation(v_profile_id, p_idempotency_key, response_payload);
END;
$$;
$function$;
  END IF;
END;
$legacy$;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.transfer_between_my_bank_accounts(
  p_source_bank_account_id uuid,
  p_destination_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  request_payload jsonb;
  replay jsonb;
  response_payload jsonb;
  source_account public.bank_accounts%ROWTYPE;
  destination_account public.bank_accounts%ROWTYPE;
  source_balance_minor bigint;
  destination_balance_minor bigint;
  bank_transaction_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_amount_minor, 0) <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = '22023';
  END IF;
  IF p_source_bank_account_id = p_destination_bank_account_id THEN
    RAISE EXCEPTION 'bank_transfer_accounts_must_differ' USING ERRCODE = '22023';
  END IF;

  request_payload := jsonb_build_object(
    'sourceBankAccountId', p_source_bank_account_id,
    'destinationBankAccountId', p_destination_bank_account_id,
    'amountMinor', p_amount_minor
  );
  replay := public._claim_player_banking_operation(
    v_profile_id, p_idempotency_key, 'account_transfer', request_payload
  );
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM 1
  FROM public.bank_accounts item
  WHERE item.id IN (p_source_bank_account_id, p_destination_bank_account_id)
  ORDER BY item.id
  FOR UPDATE;

  SELECT * INTO source_account
  FROM public.bank_accounts item
  WHERE item.id = p_source_bank_account_id AND item.profile_id = v_profile_id;
  SELECT * INTO destination_account
  FROM public.bank_accounts item
  WHERE item.id = p_destination_bank_account_id AND item.profile_id = v_profile_id;

  IF source_account.id IS NULL OR destination_account.id IS NULL
    OR source_account.status <> 'active' OR destination_account.status <> 'active' THEN
    RAISE EXCEPTION 'bank_transfer_accounts_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.currency_code <> destination_account.currency_code THEN
    RAISE EXCEPTION 'currency_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.locked_until IS NOT NULL AND source_account.locked_until > now() THEN
    RAISE EXCEPTION 'bank_account_locked' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bank_accounts
  SET balance_minor = balance_minor - p_amount_minor,
      updated_at = now()
  WHERE id = source_account.id
  RETURNING balance_minor INTO source_balance_minor;
  UPDATE public.bank_accounts
  SET balance_minor = balance_minor + p_amount_minor,
      updated_at = now()
  WHERE id = destination_account.id
  RETURNING balance_minor INTO destination_balance_minor;

  INSERT INTO public.bank_transactions (
    account_id, profile_id, tx_type, amount_minor, balance_after_minor,
    currency_code, description, related_account_id,
    operation_idempotency_key, operation_request
  ) VALUES (
    source_account.id, v_profile_id, 'transfer_out', p_amount_minor, source_balance_minor,
    source_account.currency_code, 'Account transfer', destination_account.id,
    btrim(p_idempotency_key), request_payload
  ) RETURNING id INTO bank_transaction_id;

  INSERT INTO public.bank_transactions (
    account_id, profile_id, tx_type, amount_minor, balance_after_minor,
    currency_code, description, related_account_id,
    operation_idempotency_key, operation_request
  ) VALUES (
    destination_account.id, v_profile_id, 'transfer_in', p_amount_minor, destination_balance_minor,
    destination_account.currency_code, 'Account transfer', source_account.id,
    btrim(p_idempotency_key), request_payload
  );

  response_payload := jsonb_build_object(
    'transactionId', bank_transaction_id,
    'currencyCode', source_account.currency_code,
    'sourceBalanceMinor', source_balance_minor,
    'destinationBalanceMinor', destination_balance_minor
  );
  RETURN public._complete_player_banking_operation(v_profile_id, p_idempotency_key, response_payload);
END;
$$;
$function$;
  END IF;
END;
$legacy$;

-- Present one normalised activity stream across canonical wallet entries and
-- legacy bank rows. New wallet deposits/withdrawals are represented by their
-- canonical journal row, so the matching bank row is deliberately de-duplicated.
DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public._profile_finance_activity(
  p_profile_id uuid,
  p_currency_code text
)
RETURNS TABLE (
  activity_id text,
  activity_created_at timestamptz,
  activity_direction text,
  activity_source text,
  activity_amount_minor bigint,
  activity_description text,
  activity_currency_code text,
  activity_source_account_id uuid,
  activity_destination_account_id uuid,
  activity_related_entity_type text,
  activity_related_entity_id uuid,
  activity_external_cash_flow boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
  WITH owned_accounts AS (
    SELECT account.id
    FROM public.financial_accounts account
    WHERE account.owner_type = 'player'
      AND account.owner_id = p_profile_id
  ), canonical AS (
    SELECT
      'finance:' || transaction.id::text AS activity_id,
      transaction.created_at AS activity_created_at,
      CASE
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts) THEN 'transfer'
        WHEN transaction.destination_account_id IN (SELECT id FROM owned_accounts) THEN 'income'
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts) THEN 'expense'
        ELSE 'other'
      END AS activity_direction,
      COALESCE(NULLIF(transaction.metadata->>'display_category', ''), transaction.transaction_category::text) AS activity_source,
      abs(transaction.net_amount_minor) AS activity_amount_minor,
      transaction.description AS activity_description,
      btrim(transaction.currency_code::text) AS activity_currency_code,
      transaction.source_account_id AS activity_source_account_id,
      transaction.destination_account_id AS activity_destination_account_id,
      transaction.related_entity_type AS activity_related_entity_type,
      transaction.related_entity_id AS activity_related_entity_id,
      CASE
        WHEN lower(COALESCE(transaction.metadata->>'external_cash_flow', '')) IN ('true', 'false')
          THEN (transaction.metadata->>'external_cash_flow')::boolean
        WHEN transaction.source_account_id IN (SELECT id FROM owned_accounts)
          AND transaction.destination_account_id IN (SELECT id FROM owned_accounts) THEN false
        WHEN COALESCE(transaction.metadata->>'classification', '') IN (
          'bank_transfer', 'transfer', 'internal_savings_transfer',
          'wallet_reconciliation', 'starting_funds'
        ) THEN false
        WHEN transaction.transaction_category IN (
          'starting_funds'::public.financial_transaction_category,
          'administrative_adjustment'::public.financial_transaction_category
        ) THEN false
        ELSE true
      END AS activity_external_cash_flow
    FROM public.financial_transactions transaction
    WHERE transaction.status = 'completed'
      AND btrim(transaction.currency_code::text) = p_currency_code
      AND (
        transaction.source_account_id IN (SELECT id FROM owned_accounts)
        OR transaction.destination_account_id IN (SELECT id FROM owned_accounts)
      )
  ), legacy_bank AS (
    SELECT
      'bank:' || transaction.id::text AS activity_id,
      transaction.created_at AS activity_created_at,
      CASE
        WHEN transaction.tx_type = 'interest' THEN 'income'
        WHEN transaction.tx_type IN ('fee', 'band_deposit') THEN 'expense'
        ELSE 'transfer'
      END AS activity_direction,
      transaction.tx_type AS activity_source,
      abs(transaction.amount_minor) AS activity_amount_minor,
      transaction.description AS activity_description,
      transaction.currency_code AS activity_currency_code,
      CASE WHEN transaction.tx_type IN ('withdrawal', 'transfer_out', 'fee', 'band_deposit')
        THEN transaction.account_id ELSE transaction.related_account_id END AS activity_source_account_id,
      CASE WHEN transaction.tx_type IN ('deposit', 'transfer_in', 'interest', 'goal_contribution')
        THEN transaction.account_id ELSE transaction.related_account_id END AS activity_destination_account_id,
      CASE WHEN transaction.related_band_id IS NOT NULL THEN 'band' ELSE NULL END AS activity_related_entity_type,
      transaction.related_band_id AS activity_related_entity_id,
      transaction.tx_type IN ('interest', 'fee', 'band_deposit') AS activity_external_cash_flow
    FROM public.bank_transactions transaction
    WHERE transaction.profile_id = p_profile_id
      AND transaction.currency_code = p_currency_code
      AND transaction.tx_type <> 'transfer_in'
      AND NOT (
        transaction.tx_type IN ('deposit', 'withdrawal')
        AND transaction.operation_idempotency_key IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.financial_transactions canonical_transaction
          WHERE canonical_transaction.idempotency_key =
            'player-cash:' || p_profile_id::text || ':' || transaction.operation_idempotency_key
        )
      )
  )
  SELECT * FROM canonical
  UNION ALL
  SELECT * FROM legacy_bank;
$$;
$function$;
  END IF;
END;
$legacy$;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.get_banking_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_currency_code text := 'USD';
  cash_minor bigint := 0;
  bank_minor bigint := 0;
  savings_minor bigint := 0;
  locked_minor bigint := 0;
  goal_minor bigint := 0;
  income_minor bigint := 0;
  expenses_minor bigint := 0;
  accounts jsonb := '[]'::jsonb;
  goals jsonb := '[]'::jsonb;
  recent_activity jsonb := '[]'::jsonb;
  largest_expenses jsonb := '[]'::jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'accounts', accounts,
      'loans', '[]'::jsonb,
      'creditProfile', jsonb_build_object(
        'band', 'Building',
        'positiveFactors', jsonb_build_array('Create a character to start banking.'),
        'negativeFactors', '[]'::jsonb
      ),
      'recentActivity', recent_activity,
      'savingsSummary', jsonb_build_object(
        'netWorthMinor', 0, 'cashMinor', 0, 'savingsMinor', 0,
        'lockedDepositsMinor', 0, 'monthlyInterestMinor', 0,
        'interestEarnedYtdMinor', 0, 'currencyCode', v_currency_code
      ),
      'cashFlowAnalytics', jsonb_build_object(
        'incomeMinor', 0, 'expensesMinor', 0, 'savingsRateBps', 0,
        'financialHealth', 'building', 'largestExpenseCategories', '[]'::jsonb
      ),
      'savingsGoals', goals,
      'notifications', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(btrim(account.default_currency_code::text), 'USD')
  INTO v_currency_code
  FROM public.financial_accounts account
  WHERE account.owner_type = 'player'
    AND account.owner_id = v_profile_id
    AND account.is_primary
  ORDER BY account.created_at, account.id
  LIMIT 1;
  v_currency_code := COALESCE(v_currency_code, 'USD');

  SELECT round(COALESCE(profile.cash, 0)::numeric * 100)::bigint
  INTO cash_minor
  FROM public.profiles profile
  WHERE profile.id = v_profile_id;
  cash_minor := COALESCE(cash_minor, 0);

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', account.id,
      'accountType', account.account_type,
      'currencyCode', account.currency_code,
      'balanceMinor', account.balance_minor,
      'availableBalanceMinor', account.balance_minor,
      'providerName', account.provider_name,
      'nickname', account.nickname,
      'restrictionSummary', CASE
        WHEN account.status <> 'active' THEN initcap(account.status)
        WHEN account.locked_until IS NOT NULL AND account.locked_until > now()
          THEN 'Locked until ' || to_char(account.locked_until, 'YYYY-MM-DD')
        ELSE NULL
      END,
      'annualRateBps', account.annual_rate_bps
    ) ORDER BY account.created_at, account.id), '[]'::jsonb),
    COALESCE(sum(account.balance_minor), 0),
    COALESCE(sum(account.balance_minor) FILTER (WHERE account.account_type = 'savings'), 0),
    COALESCE(sum(account.balance_minor) FILTER (WHERE account.account_type = 'fixed_deposit'), 0)
  INTO accounts, bank_minor, savings_minor, locked_minor
  FROM public.bank_accounts account
  WHERE account.profile_id = v_profile_id
    AND account.status <> 'closed'
    AND account.currency_code = v_currency_code;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', goal.id,
      'name', goal.name,
      'targetMinor', goal.target_minor,
      'currentMinor', goal.current_minor,
      'currencyCode', goal.currency_code,
      'completionBps', LEAST(10000, floor(goal.current_minor::numeric * 10000 / NULLIF(goal.target_minor, 0))::integer),
      'projectedCompletionDate', goal.target_date
    ) ORDER BY goal.created_at, goal.id), '[]'::jsonb),
    COALESCE(sum(goal.current_minor), 0)
  INTO goals, goal_minor
  FROM public.savings_goals goal
  WHERE goal.profile_id = v_profile_id
    AND goal.status = 'active'
    AND goal.currency_code = v_currency_code;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', activity.activity_id,
    'description', activity.activity_description,
    'amountMinor', activity.activity_amount_minor,
    'currencyCode', activity.activity_currency_code,
    'createdAt', activity.activity_created_at,
    'txType', activity.activity_source
  ) ORDER BY activity.activity_created_at DESC, activity.activity_id DESC), '[]'::jsonb)
  INTO recent_activity
  FROM (
    SELECT *
    FROM public._profile_finance_activity(v_profile_id, v_currency_code)
    ORDER BY activity_created_at DESC, activity_id DESC
    LIMIT 25
  ) activity;

  SELECT
    COALESCE(sum(activity.activity_amount_minor) FILTER (
      WHERE activity.activity_direction = 'income' AND activity.activity_external_cash_flow
    ), 0),
    COALESCE(sum(activity.activity_amount_minor) FILTER (
      WHERE activity.activity_direction = 'expense' AND activity.activity_external_cash_flow
    ), 0)
  INTO income_minor, expenses_minor
  FROM public._profile_finance_activity(v_profile_id, v_currency_code) activity
  WHERE activity.activity_created_at >= now() - interval '30 days';

  SELECT COALESCE(jsonb_agg(jsonb_build_array(category, amount_minor) ORDER BY amount_minor DESC), '[]'::jsonb)
  INTO largest_expenses
  FROM (
    SELECT activity.activity_source AS category, sum(activity.activity_amount_minor)::bigint AS amount_minor
    FROM public._profile_finance_activity(v_profile_id, v_currency_code) activity
    WHERE activity.activity_external_cash_flow
      AND activity.activity_direction = 'expense'
      AND activity.activity_created_at >= now() - interval '30 days'
    GROUP BY activity.activity_source
    ORDER BY amount_minor DESC
    LIMIT 5
  ) expense_category;

  RETURN jsonb_build_object(
    'accounts', accounts,
    'loans', '[]'::jsonb,
    'creditProfile', jsonb_build_object(
      'band', CASE
        WHEN expenses_minor = 0 AND income_minor = 0 THEN 'Building'
        WHEN income_minor >= expenses_minor THEN 'Stable'
        ELSE 'Watch'
      END,
      'positiveFactors', CASE WHEN income_minor > expenses_minor
        THEN jsonb_build_array('Income exceeded outgoings over the last 30 days.')
        ELSE '[]'::jsonb END,
      'negativeFactors', CASE WHEN expenses_minor > income_minor
        THEN jsonb_build_array('Outgoings exceeded income over the last 30 days.')
        ELSE '[]'::jsonb END
    ),
    'recentActivity', recent_activity,
    'savingsSummary', jsonb_build_object(
      'netWorthMinor', cash_minor + bank_minor + goal_minor,
      'cashMinor', cash_minor,
      'savingsMinor', savings_minor + goal_minor,
      'lockedDepositsMinor', locked_minor,
      'monthlyInterestMinor', 0,
      'interestEarnedYtdMinor', 0,
      'currencyCode', v_currency_code
    ),
    'cashFlowAnalytics', jsonb_build_object(
      'incomeMinor', income_minor,
      'expensesMinor', expenses_minor,
      'savingsRateBps', CASE WHEN income_minor > 0
        THEN greatest(-10000, least(10000, floor((income_minor - expenses_minor)::numeric * 10000 / income_minor)::integer))
        ELSE 0 END,
      'financialHealth', CASE
        WHEN income_minor = 0 AND expenses_minor = 0 THEN 'building'
        WHEN income_minor >= expenses_minor THEN 'healthy'
        ELSE 'outgoings_exceed_income'
      END,
      'largestExpenseCategories', largest_expenses
    ),
    'savingsGoals', goals,
    'notifications', '[]'::jsonb
  );
END;
$$;
$function$;
  END IF;
END;
$legacy$;

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $function$
CREATE OR REPLACE FUNCTION public.get_my_finance_command_center(
  p_transaction_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  row_limit integer := least(greatest(COALESCE(p_transaction_limit, 100), 1), 250);
  banking_dashboard jsonb;
  v_currency_code text := 'USD';
  cash_minor bigint := 0;
  personal_accounts_minor bigint := 0;
  total_invested_minor bigint := 0;
  investment_value_minor bigint := 0;
  total_loans_minor bigint := 0;
  total_earnings_minor bigint := 0;
  total_expenses_minor bigint := 0;
  monthly_income_minor bigint := 0;
  monthly_expenses_minor bigint := 0;
  transactions_json jsonb := '[]'::jsonb;
  monthly_ledger_json jsonb := '[]'::jsonb;
  earnings_by_source_json jsonb := '{}'::jsonb;
  investments_json jsonb := '[]'::jsonb;
  loans_json jsonb := '[]'::jsonb;
  bands_json jsonb := '[]'::jsonb;
  other_currency_balances_json jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = v_profile_id AND profile.user_id = auth.uid() AND profile.died_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active_profile_not_owned' USING ERRCODE = '42501';
  END IF;

  banking_dashboard := public.get_banking_dashboard();
  v_currency_code := COALESCE(banking_dashboard #>> '{savingsSummary,currencyCode}', 'USD');

  SELECT round(COALESCE(profile.cash, 0)::numeric * 100)::bigint
  INTO cash_minor
  FROM public.profiles profile
  WHERE profile.id = v_profile_id;
  cash_minor := COALESCE(cash_minor, 0);

  SELECT cash_minor
    + COALESCE((
        SELECT sum(account.balance_minor)
        FROM public.bank_accounts account
        WHERE account.profile_id = v_profile_id
          AND account.status <> 'closed'
          AND account.currency_code = v_currency_code
      ), 0)
    + COALESCE((
        SELECT sum(goal.current_minor)
        FROM public.savings_goals goal
        WHERE goal.profile_id = v_profile_id
          AND goal.status = 'active'
          AND goal.currency_code = v_currency_code
      ), 0)
  INTO personal_accounts_minor;

  SELECT
    COALESCE(sum(investment.invested_amount)::bigint * 100, 0),
    COALESCE(sum(investment.current_value)::bigint * 100, 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', investment.id,
      'name', investment.investment_name,
      'category', COALESCE(investment.category, 'general'),
      'investedMinor', investment.invested_amount::bigint * 100,
      'currentValueMinor', investment.current_value::bigint * 100,
      'growthRate', COALESCE(investment.growth_rate, 0),
      'purchasedAt', investment.purchased_at,
      'notes', investment.notes,
      'currencyCode', v_currency_code
    ) ORDER BY investment.purchased_at DESC NULLS LAST, investment.id), '[]'::jsonb)
  INTO total_invested_minor, investment_value_minor, investments_json
  FROM public.player_investments investment
  WHERE investment.profile_id = v_profile_id;

  SELECT
    COALESCE(sum(loan.remaining_balance)::bigint * 100, 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', loan.id,
      'providerName', COALESCE(loan.loan_name, 'Lender'),
      'status', COALESCE(loan.status, 'active'),
      'principalMinor', COALESCE(loan.principal, 0)::bigint * 100,
      'outstandingMinor', COALESCE(loan.remaining_balance, 0)::bigint * 100,
      'currencyCode', v_currency_code,
      'interestRateBps', round(COALESCE(loan.interest_rate, 0) * 100)::integer,
      'scheduledPaymentMinor', COALESCE(loan.weekly_payment, 0)::bigint * 100,
      'nextPaymentDate', loan.due_date,
      'maturityDate', loan.due_date,
      'purpose', 'personal_loan'
    ) ORDER BY loan.due_date NULLS LAST, loan.id), '[]'::jsonb)
  INTO total_loans_minor, loans_json
  FROM public.player_loans loan
  WHERE loan.profile_id = v_profile_id
    AND COALESCE(loan.status, 'active') NOT IN ('paid_off', 'closed', 'cancelled');

  SELECT
    COALESCE(sum(activity.activity_amount_minor) FILTER (
      WHERE activity.activity_direction = 'income' AND activity.activity_external_cash_flow
    ), 0),
    COALESCE(sum(activity.activity_amount_minor) FILTER (
      WHERE activity.activity_direction = 'expense' AND activity.activity_external_cash_flow
    ), 0)
  INTO total_earnings_minor, total_expenses_minor
  FROM public._profile_finance_activity(v_profile_id, v_currency_code) activity;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', activity.activity_id,
    'createdAt', activity.activity_created_at,
    'direction', activity.activity_direction,
    'source', activity.activity_source,
    'amountMinor', activity.activity_amount_minor,
    'description', activity.activity_description,
    'currencyCode', activity.activity_currency_code,
    'category', activity.activity_source,
    'sourceAccountId', activity.activity_source_account_id,
    'destinationAccountId', activity.activity_destination_account_id,
    'relatedEntityType', activity.activity_related_entity_type,
    'relatedEntityId', activity.activity_related_entity_id,
    'externalCashFlow', activity.activity_external_cash_flow
  ) ORDER BY activity.activity_created_at DESC, activity.activity_id DESC), '[]'::jsonb)
  INTO transactions_json
  FROM (
    SELECT *
    FROM public._profile_finance_activity(v_profile_id, v_currency_code)
    ORDER BY activity_created_at DESC, activity_id DESC
    LIMIT row_limit
  ) activity;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  ), monthly AS (
    SELECT
      month.month_start,
      COALESCE(sum(activity.activity_amount_minor) FILTER (
        WHERE activity.activity_direction = 'income' AND activity.activity_external_cash_flow
      ), 0)::bigint AS income_minor,
      COALESCE(sum(activity.activity_amount_minor) FILTER (
        WHERE activity.activity_direction = 'expense' AND activity.activity_external_cash_flow
      ), 0)::bigint AS expenses_minor
    FROM months month
    LEFT JOIN public._profile_finance_activity(v_profile_id, v_currency_code) activity
      ON date_trunc('month', activity.activity_created_at) = month.month_start
    GROUP BY month.month_start
    ORDER BY month.month_start
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'monthKey', to_char(month_start, 'YYYY-MM'),
      'month', to_char(month_start, 'Mon'),
      'incomeMinor', income_minor,
      'expensesMinor', expenses_minor,
      'currencyCode', v_currency_code
    ) ORDER BY month_start), '[]'::jsonb),
    COALESCE(round(avg(income_minor))::bigint, 0),
    COALESCE(round(avg(expenses_minor))::bigint, 0)
  INTO monthly_ledger_json, monthly_income_minor, monthly_expenses_minor
  FROM monthly;

  SELECT COALESCE(jsonb_object_agg(source, amount_minor), '{}'::jsonb)
  INTO earnings_by_source_json
  FROM (
    SELECT activity.activity_source AS source, sum(activity.activity_amount_minor)::bigint AS amount_minor
    FROM public._profile_finance_activity(v_profile_id, v_currency_code) activity
    WHERE activity.activity_direction = 'income'
      AND activity.activity_external_cash_flow
    GROUP BY activity.activity_source
  ) income_source;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'currencyCode', grouped.currency_code,
    'balanceMinor', grouped.balance_minor,
    'availableBalanceMinor', grouped.balance_minor
  ) ORDER BY grouped.currency_code), '[]'::jsonb)
  INTO other_currency_balances_json
  FROM (
    SELECT account.currency_code, sum(account.balance_minor)::bigint AS balance_minor
    FROM public.bank_accounts account
    WHERE account.profile_id = v_profile_id
      AND account.status <> 'closed'
      AND account.currency_code <> v_currency_code
    GROUP BY account.currency_code
  ) grouped;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', band.id,
    'name', band.name,
    'memberCount', (
      SELECT count(*)::integer
      FROM public.band_members counted_member
      WHERE counted_member.band_id = band.id
        AND COALESCE(counted_member.member_status, 'active') = 'active'
    ),
    'treasuries', jsonb_build_array(jsonb_build_object(
      'accountId', band.id,
      'currencyCode', v_currency_code,
      'balanceMinor', COALESCE(band.band_balance, 0)::bigint * 100,
      'availableBalanceMinor', COALESCE(band.band_balance, 0)::bigint * 100
    ))
  ) ORDER BY band.name, band.id), '[]'::jsonb)
  INTO bands_json
  FROM public.band_members membership
  JOIN public.bands band ON band.id = membership.band_id
  WHERE membership.profile_id = v_profile_id
    AND COALESCE(membership.member_status, 'active') = 'active';

  RETURN jsonb_build_object(
    'status', 'ok',
    'profileId', v_profile_id,
    'currencyCode', v_currency_code,
    'banking', banking_dashboard,
    'summary', jsonb_build_object(
      'cashMinor', cash_minor,
      'personalAccountsMinor', personal_accounts_minor,
      'totalInvestedMinor', total_invested_minor,
      'investmentValueMinor', investment_value_minor,
      'totalLoansMinor', total_loans_minor,
      'netWorthMinor', personal_accounts_minor + investment_value_minor - total_loans_minor,
      'totalEarningsMinor', total_earnings_minor,
      'totalExpensesMinor', total_expenses_minor,
      'monthlyIncomeMinor', monthly_income_minor,
      'monthlyExpensesMinor', monthly_expenses_minor
    ),
    'transactions', transactions_json,
    'monthlyLedger', monthly_ledger_json,
    'earningsBySource', earnings_by_source_json,
    'investments', investments_json,
    'loans', loans_json,
    'bands', bands_json,
    'otherCurrencyBalances', other_currency_balances_json
  );
END;
$$;
$function$;
  END IF;
END;
$legacy$;

-- All balance mutations now run through authenticated RPCs. Keep direct reads
-- available to the owner while removing browser-side balance tampering.
REVOKE ALL ON TABLE public.bank_accounts FROM anon;
REVOKE ALL ON TABLE public.bank_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.bank_accounts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.bank_transactions FROM authenticated;
GRANT SELECT ON TABLE public.bank_accounts, public.bank_transactions TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.create_bank_account(text,text,bigint,integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_bank_account(text,text,bigint,integer) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.bank_deposit_from_cash(uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.bank_deposit_from_cash(uuid,bigint) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.bank_withdraw_to_cash(uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.bank_withdraw_to_cash(uuid,bigint) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.bank_transfer(uuid,uuid,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.bank_transfer(uuid,uuid,bigint) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

DO $permissions$
BEGIN
  IF to_regprocedure(
    'public.open_my_bank_account(text,text,bigint,integer,character,text)'
  ) IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.open_my_bank_account(text,text,bigint,integer,char(3),text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.open_my_bank_account(text,text,bigint,integer,char(3),text) TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.deposit_my_wallet_to_bank(uuid,bigint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.deposit_my_wallet_to_bank(uuid,bigint,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.deposit_my_wallet_to_bank(uuid,bigint,text) TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.withdraw_my_bank_to_wallet(uuid,bigint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.withdraw_my_bank_to_wallet(uuid,bigint,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.withdraw_my_bank_to_wallet(uuid,bigint,text) TO authenticated, service_role';
  END IF;

  IF to_regprocedure(
    'public.transfer_between_my_bank_accounts(uuid,uuid,bigint,text)'
  ) IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.transfer_between_my_bank_accounts(uuid,uuid,bigint,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.transfer_between_my_bank_accounts(uuid,uuid,bigint,text) TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public._profile_finance_activity(uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public._profile_finance_activity(uuid,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public._profile_finance_activity(uuid,text) TO service_role';
  END IF;

  IF to_regprocedure('public.get_banking_dashboard()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_banking_dashboard() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_banking_dashboard() TO authenticated, service_role';
  END IF;

  IF to_regprocedure('public.get_my_finance_command_center(integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_my_finance_command_center(integer) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_my_finance_command_center(integer) TO authenticated, service_role';
  END IF;
END;
$permissions$;

NOTIFY pgrst, 'reload schema';
