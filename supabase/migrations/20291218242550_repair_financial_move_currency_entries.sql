-- The hardened movement primitive pre-dated the final NOT NULL currency column
-- on financial_ledger_entries. Preserve its idempotency guarantees while
-- writing complete multi-currency transaction and ledger data.

CREATE OR REPLACE FUNCTION public._move_financial_account_money(
  p_source uuid,
  p_destination uuid,
  p_amount bigint,
  p_category public.financial_transaction_category,
  p_description text,
  p_key text,
  p_profile uuid,
  p_related_type text DEFAULT NULL,
  p_related_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_account public.financial_accounts%ROWTYPE;
  destination_account public.financial_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  transaction_id uuid;
  transaction_currency char(3);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF p_key IS NULL OR length(btrim(p_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));

  SELECT * INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.status <> 'completed'
      OR existing_transaction.created_by_profile_id IS DISTINCT FROM p_profile
      OR existing_transaction.source_account_id IS DISTINCT FROM p_source
      OR existing_transaction.destination_account_id IS DISTINCT FROM p_destination
      OR existing_transaction.net_amount_minor IS DISTINCT FROM p_amount THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN existing_transaction.id;
  END IF;

  PERFORM 1
  FROM public.financial_accounts
  WHERE id IN (p_source, p_destination)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO source_account
  FROM public.financial_accounts
  WHERE id = p_source;

  SELECT * INTO destination_account
  FROM public.financial_accounts
  WHERE id = p_destination;

  IF source_account.id IS NULL
    OR destination_account.id IS NULL
    OR source_account.id = destination_account.id THEN
    RAISE EXCEPTION 'account_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.account_status <> 'active'
    OR destination_account.account_status <> 'active' THEN
    RAISE EXCEPTION 'account_not_active' USING ERRCODE = 'P0001';
  END IF;

  transaction_currency := COALESCE(source_account.currency_code, source_account.default_currency_code);
  IF transaction_currency IS DISTINCT FROM
    COALESCE(destination_account.currency_code, destination_account.default_currency_code) THEN
    RAISE EXCEPTION 'currency_mismatch_no_conversion' USING ERRCODE = 'P0001';
  END IF;
  IF source_account.available_balance_minor < p_amount THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.financial_transactions (
    transaction_category,
    status,
    currency_code,
    gross_amount_minor,
    net_amount_minor,
    source_account_id,
    destination_account_id,
    related_entity_type,
    related_entity_id,
    description,
    idempotency_key,
    created_by_user_id,
    created_by_profile_id,
    created_by_actor,
    completed_at,
    source_currency_code,
    destination_currency_code,
    source_amount_minor,
    destination_amount_minor,
    metadata
  ) VALUES (
    p_category,
    'completed',
    transaction_currency,
    p_amount,
    p_amount,
    source_account.id,
    destination_account.id,
    p_related_type,
    p_related_id,
    p_description,
    p_key,
    auth.uid(),
    p_profile,
    COALESCE(auth.uid()::text, 'system'),
    now(),
    transaction_currency,
    transaction_currency,
    p_amount,
    p_amount,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO transaction_id;

  UPDATE public.financial_accounts
  SET current_balance_minor = current_balance_minor - p_amount,
      updated_at = now()
  WHERE id = source_account.id;

  UPDATE public.financial_accounts
  SET current_balance_minor = current_balance_minor + p_amount,
      updated_at = now()
  WHERE id = destination_account.id;

  INSERT INTO public.financial_ledger_entries (
    transaction_id,
    account_id,
    entry_direction,
    amount_minor,
    balance_before_minor,
    balance_after_minor,
    currency_code
  ) VALUES
    (
      transaction_id,
      source_account.id,
      'debit',
      p_amount,
      source_account.current_balance_minor,
      source_account.current_balance_minor - p_amount,
      transaction_currency
    ),
    (
      transaction_id,
      destination_account.id,
      'credit',
      p_amount,
      destination_account.current_balance_minor,
      destination_account.current_balance_minor + p_amount,
      transaction_currency
    );

  RETURN transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public._move_financial_account_money(
  uuid, uuid, bigint, public.financial_transaction_category, text, text,
  uuid, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._move_financial_account_money(
  uuid, uuid, bigint, public.financial_transaction_category, text, text,
  uuid, text, uuid, jsonb
) TO service_role;

NOTIFY pgrst, 'reload schema';
