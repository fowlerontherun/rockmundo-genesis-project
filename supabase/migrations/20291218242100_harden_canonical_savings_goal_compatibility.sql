-- Compatibility hardening for deployments that received the temporary
-- profile_id-based savings_goals facade, plus deadlock-safe savings transfers.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'savings_goals'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.sync_savings_goal_legacy_profile_id()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        NEW.profile_id := COALESCE(NEW.profile_id, NEW.owner_id);
        NEW.owner_type := COALESCE(NEW.owner_type, 'player'::public.financial_owner_type);
        NEW.owner_id := COALESCE(NEW.owner_id, NEW.profile_id);
        RETURN NEW;
      END;
      $body$
    $fn$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_savings_goal_legacy_profile_id ON public.savings_goals';
    EXECUTE $trigger$
      CREATE TRIGGER trg_sync_savings_goal_legacy_profile_id
      BEFORE INSERT OR UPDATE ON public.savings_goals
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_savings_goal_legacy_profile_id()
    $trigger$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fund_my_savings_goal(
  p_goal_id uuid,
  p_source_kind text,
  p_source_account_id uuid,
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
  goal public.savings_goals%ROWTYPE;
  goal_account public.financial_accounts%ROWTYPE;
  source_account public.financial_accounts%ROWTYPE;
  bank public.bank_accounts%ROWTYPE;
  existing_transaction public.financial_transactions%ROWTYPE;
  transaction_id uuid;
  new_goal_balance bigint;
  new_source_balance bigint;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.preview_my_savings_goal_funding(
    p_goal_id,
    p_source_kind,
    p_source_account_id,
    p_amount_minor
  );

  SELECT * INTO goal
  FROM public.savings_goals
  WHERE id = p_goal_id
    AND owner_type = 'player'
    AND owner_id = profile_id
  FOR UPDATE;

  IF goal.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO goal_account
  FROM public.financial_accounts
  WHERE id = goal.financial_account_id
    AND owner_type = 'player'
    AND owner_id = profile_id;

  IF goal_account.id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_account_missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO existing_transaction
  FROM public.financial_transactions
  WHERE idempotency_key = p_idempotency_key;

  IF existing_transaction.id IS NOT NULL THEN
    IF existing_transaction.destination_account_id IS DISTINCT FROM goal_account.id
      OR existing_transaction.gross_amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'goalId', goal.id,
      'transactionId', existing_transaction.id,
      'currencyCode', goal.currency_code,
      'goalBalanceMinor', goal_account.current_balance_minor,
      'targetMinor', goal.target_minor,
      'completed', goal_account.current_balance_minor >= goal.target_minor,
      'idempotent', true
    );
  END IF;

  IF p_source_kind = 'wallet' THEN
    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = profile_id
      AND is_primary
      AND account_status = 'active';
  ELSIF p_source_kind = 'bank' THEN
    SELECT * INTO bank
    FROM public.bank_accounts
    WHERE id = p_source_account_id
      AND owner_type = 'player'
      AND owner_id = profile_id;

    IF bank.id IS NULL THEN
      RAISE EXCEPTION 'source_account_missing' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO source_account
    FROM public.financial_accounts
    WHERE id = bank.linked_finance_account_id
      AND account_status = 'active';
  ELSE
    RAISE EXCEPTION 'source_kind_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF source_account.id IS NULL THEN
    RAISE EXCEPTION 'source_account_missing' USING ERRCODE = 'P0001';
  END IF;

  -- _move_financial_account_money owns deterministic account locking. Do not
  -- pre-lock the source and destination in request order here.
  transaction_id := public._move_financial_account_money(
    source_account.id,
    goal_account.id,
    p_amount_minor,
    'bank_transfer',
    'Savings goal contribution',
    p_idempotency_key,
    profile_id,
    'savings_goal',
    goal.id,
    jsonb_build_object(
      'classification', 'internal_savings_transfer',
      'source_kind', p_source_kind,
      'commercial_revenue', false
    )
  );

  SELECT current_balance_minor
  INTO new_goal_balance
  FROM public.financial_accounts
  WHERE id = goal_account.id;

  SELECT current_balance_minor
  INTO new_source_balance
  FROM public.financial_accounts
  WHERE id = source_account.id;

  UPDATE public.savings_goals
  SET current_minor = new_goal_balance,
      status = CASE WHEN new_goal_balance >= target_minor THEN 'completed' ELSE 'active' END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_funded_at', now())
  WHERE id = goal.id;

  IF p_source_kind = 'wallet' THEN
    UPDATE public.profiles
    SET cash = new_source_balance / 100
    WHERE id = profile_id;
  END IF;

  RETURN jsonb_build_object(
    'goalId', goal.id,
    'transactionId', transaction_id,
    'currencyCode', goal.currency_code,
    'sourceBalanceMinor', new_source_balance,
    'goalBalanceMinor', new_goal_balance,
    'targetMinor', goal.target_minor,
    'completed', new_goal_balance >= goal.target_minor,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fund_my_savings_goal(uuid,text,uuid,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_my_savings_goal(uuid,text,uuid,bigint,text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';