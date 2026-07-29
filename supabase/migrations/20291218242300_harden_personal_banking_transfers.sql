-- Harden personal banking transfers without changing the public RPC signatures.
-- Every replay is scoped to the selected active character and must match the
-- original source, destination and amount before a completed result is returned.

CREATE OR REPLACE FUNCTION public.deposit_my_wallet_to_bank(
  p_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  bank_account public.bank_accounts%ROWTYPE;
  wallet_account public.financial_accounts%ROWTYPE;
  deposit_account public.financial_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  transaction_id uuid;
  currency_code char(3);
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF mod(p_amount_minor, 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  -- Serialise retries using the same browser operation key.
  PERFORM pg_advisory_xact_lock(hashtextextended('wallet-bank-deposit:' || p_idempotency_key, 0));

  SELECT *
  INTO bank_account
  FROM public.bank_accounts
  WHERE id = p_bank_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id
  FOR UPDATE;

  IF bank_account.id IS NULL THEN
    RAISE EXCEPTION 'bank_account_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO deposit_account
  FROM public.financial_accounts
  WHERE id = bank_account.linked_finance_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  SELECT *
  INTO wallet_account
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary
  ORDER BY created_at, id
  LIMIT 1;

  IF deposit_account.id IS NULL OR wallet_account.id IS NULL THEN
    RAISE EXCEPTION 'canonical_account_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.status <> 'completed'
      OR existing_transaction.created_by_profile_id IS DISTINCT FROM profile_id
      OR existing_transaction.source_account_id IS DISTINCT FROM wallet_account.id
      OR existing_transaction.destination_account_id IS DISTINCT FROM deposit_account.id
      OR existing_transaction.net_amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET cash = wallet_account.current_balance_minor / 100
    WHERE id = profile_id;

    RETURN jsonb_build_object(
      'transactionId', existing_transaction.id,
      'currencyCode', existing_transaction.currency_code,
      'walletBalanceMinor', wallet_account.current_balance_minor,
      'bankBalanceMinor', deposit_account.current_balance_minor,
      'idempotent', true
    );
  END IF;

  IF bank_account.status <> 'active'
    OR deposit_account.account_status <> 'active'
    OR wallet_account.account_status <> 'active'
    OR coalesce(bank_account.deposit_restrictions, '{}'::jsonb) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'bank_account_cannot_receive_deposit' USING ERRCODE = 'P0001';
  END IF;

  currency_code := coalesce(wallet_account.currency_code, wallet_account.default_currency_code);
  IF currency_code IS DISTINCT FROM bank_account.currency_code
    OR coalesce(deposit_account.currency_code, deposit_account.default_currency_code) IS DISTINCT FROM bank_account.currency_code THEN
    RAISE EXCEPTION 'currency_mismatch_no_conversion' USING ERRCODE = 'P0001';
  END IF;

  transaction_id := public._move_financial_account_money(
    wallet_account.id,
    deposit_account.id,
    p_amount_minor,
    'bank_transfer'::public.financial_transaction_category,
    'Wallet to bank',
    p_idempotency_key,
    profile_id,
    'bank_account',
    bank_account.id,
    jsonb_build_object(
      'classification', 'transfer',
      'transfer_kind', 'wallet_to_bank'
    )
  );

  SELECT * INTO wallet_account FROM public.financial_accounts WHERE id = wallet_account.id;
  SELECT * INTO deposit_account FROM public.financial_accounts WHERE id = deposit_account.id;

  UPDATE public.profiles
  SET cash = wallet_account.current_balance_minor / 100
  WHERE id = profile_id;

  RETURN jsonb_build_object(
    'transactionId', transaction_id,
    'currencyCode', currency_code,
    'walletBalanceMinor', wallet_account.current_balance_minor,
    'bankBalanceMinor', deposit_account.current_balance_minor,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_my_bank_to_wallet(
  p_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  bank_account public.bank_accounts%ROWTYPE;
  wallet_account public.financial_accounts%ROWTYPE;
  withdrawal_account public.financial_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  eligibility jsonb;
  transaction_id uuid;
  currency_code char(3);
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF mod(p_amount_minor, 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bank-wallet-withdrawal:' || p_idempotency_key, 0));

  SELECT *
  INTO bank_account
  FROM public.bank_accounts
  WHERE id = p_bank_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id
  FOR UPDATE;

  IF bank_account.id IS NULL THEN
    RAISE EXCEPTION 'bank_account_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO withdrawal_account
  FROM public.financial_accounts
  WHERE id = bank_account.linked_finance_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  SELECT *
  INTO wallet_account
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary
  ORDER BY created_at, id
  LIMIT 1;

  IF withdrawal_account.id IS NULL OR wallet_account.id IS NULL THEN
    RAISE EXCEPTION 'canonical_account_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.status <> 'completed'
      OR existing_transaction.created_by_profile_id IS DISTINCT FROM profile_id
      OR existing_transaction.source_account_id IS DISTINCT FROM withdrawal_account.id
      OR existing_transaction.destination_account_id IS DISTINCT FROM wallet_account.id
      OR existing_transaction.net_amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET cash = wallet_account.current_balance_minor / 100
    WHERE id = profile_id;

    RETURN jsonb_build_object(
      'transactionId', existing_transaction.id,
      'currencyCode', existing_transaction.currency_code,
      'walletBalanceMinor', wallet_account.current_balance_minor,
      'bankBalanceMinor', withdrawal_account.current_balance_minor,
      'idempotent', true
    );
  END IF;

  currency_code := coalesce(wallet_account.currency_code, wallet_account.default_currency_code);
  IF bank_account.status <> 'active'
    OR withdrawal_account.account_status <> 'active'
    OR wallet_account.account_status <> 'active'
    OR currency_code IS DISTINCT FROM bank_account.currency_code
    OR coalesce(withdrawal_account.currency_code, withdrawal_account.default_currency_code) IS DISTINCT FROM bank_account.currency_code THEN
    RAISE EXCEPTION 'bank_account_cannot_withdraw' USING ERRCODE = 'P0001';
  END IF;

  eligibility := public.is_bank_account_eligible_for_outgoing_payment(
    bank_account.id,
    p_amount_minor,
    bank_account.currency_code
  );
  IF NOT coalesce((eligibility->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'bank_account_cannot_withdraw' USING ERRCODE = 'P0001';
  END IF;

  transaction_id := public._move_financial_account_money(
    withdrawal_account.id,
    wallet_account.id,
    p_amount_minor,
    'bank_transfer'::public.financial_transaction_category,
    'Bank to wallet',
    p_idempotency_key,
    profile_id,
    'bank_account',
    bank_account.id,
    jsonb_build_object(
      'classification', 'transfer',
      'transfer_kind', 'bank_to_wallet'
    )
  );

  SELECT * INTO wallet_account FROM public.financial_accounts WHERE id = wallet_account.id;
  SELECT * INTO withdrawal_account FROM public.financial_accounts WHERE id = withdrawal_account.id;

  UPDATE public.profiles
  SET cash = wallet_account.current_balance_minor / 100
  WHERE id = profile_id;

  RETURN jsonb_build_object(
    'transactionId', transaction_id,
    'currencyCode', currency_code,
    'walletBalanceMinor', wallet_account.current_balance_minor,
    'bankBalanceMinor', withdrawal_account.current_balance_minor,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_between_my_bank_accounts(
  p_source_bank_account_id uuid,
  p_destination_bank_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid := public.current_active_player_profile_id();
  source_bank public.bank_accounts%ROWTYPE;
  destination_bank public.bank_accounts%ROWTYPE;
  source_account public.financial_accounts%ROWTYPE;
  destination_account public.financial_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  eligibility jsonb;
  transaction_id uuid;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF p_source_bank_account_id IS NULL
    OR p_destination_bank_account_id IS NULL
    OR p_source_bank_account_id = p_destination_bank_account_id THEN
    RAISE EXCEPTION 'bank_transfer_accounts_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bank-account-transfer:' || p_idempotency_key, 0));

  -- Keep bank-row locking deterministic as well as the underlying finance locks.
  PERFORM 1
  FROM public.bank_accounts
  WHERE id IN (p_source_bank_account_id, p_destination_bank_account_id)
  ORDER BY id
  FOR UPDATE;

  SELECT *
  INTO source_bank
  FROM public.bank_accounts
  WHERE id = p_source_bank_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  SELECT *
  INTO destination_bank
  FROM public.bank_accounts
  WHERE id = p_destination_bank_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  IF source_bank.id IS NULL OR destination_bank.id IS NULL THEN
    RAISE EXCEPTION 'bank_transfer_accounts_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO source_account
  FROM public.financial_accounts
  WHERE id = source_bank.linked_finance_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  SELECT *
  INTO destination_account
  FROM public.financial_accounts
  WHERE id = destination_bank.linked_finance_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  IF source_account.id IS NULL OR destination_account.id IS NULL THEN
    RAISE EXCEPTION 'canonical_account_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.status <> 'completed'
      OR existing_transaction.created_by_profile_id IS DISTINCT FROM profile_id
      OR existing_transaction.source_account_id IS DISTINCT FROM source_account.id
      OR existing_transaction.destination_account_id IS DISTINCT FROM destination_account.id
      OR existing_transaction.net_amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'transactionId', existing_transaction.id,
      'currencyCode', existing_transaction.currency_code,
      'sourceBalanceMinor', source_account.current_balance_minor,
      'destinationBalanceMinor', destination_account.current_balance_minor,
      'idempotent', true
    );
  END IF;

  IF source_bank.status <> 'active'
    OR destination_bank.status <> 'active'
    OR source_account.account_status <> 'active'
    OR destination_account.account_status <> 'active'
    OR source_bank.currency_code IS DISTINCT FROM destination_bank.currency_code
    OR coalesce(source_account.currency_code, source_account.default_currency_code) IS DISTINCT FROM source_bank.currency_code
    OR coalesce(destination_account.currency_code, destination_account.default_currency_code) IS DISTINCT FROM destination_bank.currency_code THEN
    RAISE EXCEPTION 'bank_transfer_accounts_invalid_or_currency_mismatch' USING ERRCODE = 'P0001';
  END IF;

  eligibility := public.is_bank_account_eligible_for_outgoing_payment(
    source_bank.id,
    p_amount_minor,
    source_bank.currency_code
  );
  IF NOT coalesce((eligibility->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'source_account_cannot_transfer' USING ERRCODE = 'P0001';
  END IF;

  transaction_id := public._move_financial_account_money(
    source_account.id,
    destination_account.id,
    p_amount_minor,
    'bank_transfer'::public.financial_transaction_category,
    'Bank account transfer',
    p_idempotency_key,
    profile_id,
    'bank_account',
    destination_bank.id,
    jsonb_build_object(
      'classification', 'transfer',
      'transfer_kind', 'bank_to_bank',
      'source_bank_account_id', source_bank.id,
      'destination_bank_account_id', destination_bank.id
    )
  );

  SELECT * INTO source_account FROM public.financial_accounts WHERE id = source_account.id;
  SELECT * INTO destination_account FROM public.financial_accounts WHERE id = destination_account.id;

  RETURN jsonb_build_object(
    'transactionId', transaction_id,
    'currencyCode', source_bank.currency_code,
    'sourceBalanceMinor', source_account.current_balance_minor,
    'destinationBalanceMinor', destination_account.current_balance_minor,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_my_wallet_to_bank(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_my_bank_to_wallet(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_between_my_bank_accounts(uuid, uuid, bigint, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.deposit_my_wallet_to_bank(uuid, bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_my_bank_to_wallet(uuid, bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_between_my_bank_accounts(uuid, uuid, bigint, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
