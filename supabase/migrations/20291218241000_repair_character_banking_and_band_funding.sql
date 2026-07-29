-- Repair character banking and direct band funding regressions.
-- Character wallets are authoritative for account currency, and every band must
-- receive the default finance policy/role rows required for voluntary funding.

CREATE OR REPLACE FUNCTION public.ensure_band_finance_defaults(p_band_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_band_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.bands WHERE id = p_band_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.band_finance_policies (band_id)
  VALUES (p_band_id)
  ON CONFLICT (band_id) DO NOTHING;

  INSERT INTO public.band_finance_role_permissions (
    band_id,
    role_code,
    permission
  )
  SELECT
    p_band_id,
    defaults.role_code,
    defaults.permission::public.band_finance_permission
  FROM (
    VALUES
      ('leader', 'view_band_balance'),
      ('leader', 'view_transaction_history'),
      ('leader', 'view_detailed_income_expenses'),
      ('leader', 'create_member_contribution_requests'),
      ('leader', 'make_voluntary_contributions'),
      ('leader', 'request_reimbursement'),
      ('leader', 'approve_reimbursements'),
      ('leader', 'schedule_payments'),
      ('leader', 'pay_band_expenses'),
      ('leader', 'change_revenue_split_rules'),
      ('leader', 'withdraw_band_funds'),
      ('leader', 'perform_emergency_payments'),
      ('manager', 'view_band_balance'),
      ('manager', 'view_transaction_history'),
      ('manager', 'view_detailed_income_expenses'),
      ('manager', 'schedule_payments'),
      ('manager', 'approve_reimbursements'),
      ('manager', 'pay_band_expenses'),
      ('manager', 'request_reimbursement'),
      ('manager', 'make_voluntary_contributions'),
      ('treasurer', 'view_band_balance'),
      ('treasurer', 'view_transaction_history'),
      ('treasurer', 'view_detailed_income_expenses'),
      ('treasurer', 'schedule_payments'),
      ('treasurer', 'approve_reimbursements'),
      ('treasurer', 'pay_band_expenses'),
      ('treasurer', 'request_reimbursement'),
      ('treasurer', 'make_voluntary_contributions'),
      ('member', 'view_band_balance'),
      ('member', 'make_voluntary_contributions'),
      ('member', 'request_reimbursement')
  ) AS defaults(role_code, permission)
  ON CONFLICT (band_id, role_code, permission) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_band_finance_defaults_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_band_finance_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_band_finance_defaults ON public.bands;
CREATE TRIGGER trg_seed_band_finance_defaults
AFTER INSERT ON public.bands
FOR EACH ROW
EXECUTE FUNCTION public.seed_band_finance_defaults_after_insert();

SELECT public.ensure_band_finance_defaults(id)
FROM public.bands;

CREATE OR REPLACE FUNCTION public.get_my_band_funding_sources(p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.current_active_player_profile_id();
  v_sources jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.band_members
    WHERE band_id = p_band_id
      AND profile_id = v_profile_id
      AND coalesce(member_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'not_band_member' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ensure_band_finance_defaults(p_band_id);

  IF NOT public.user_has_band_finance_permission(
    p_band_id,
    v_profile_id,
    'make_voluntary_contributions'::public.band_finance_permission
  ) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      source
      ORDER BY
        CASE source->>'sourceKind' WHEN 'wallet' THEN 0 ELSE 1 END,
        CASE WHEN coalesce((source->>'eligible')::boolean, false) THEN 0 ELSE 1 END,
        source->>'displayName'
    ),
    '[]'::jsonb
  )
  INTO v_sources
  FROM (
    SELECT jsonb_build_object(
      'sourceKind', 'wallet',
      'sourceAccountId', NULL,
      'displayName', 'Character wallet',
      'accountType', 'wallet',
      'currencyCode', coalesce(currency_code, default_currency_code),
      'availableBalanceMinor', available_balance_minor,
      'eligible', account_status = 'active' AND available_balance_minor > 0,
      'ineligibleReason', CASE
        WHEN account_status <> 'active' THEN 'Wallet is unavailable'
        WHEN available_balance_minor <= 0 THEN 'Wallet has no available funds'
        ELSE NULL
      END
    ) AS source
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = v_profile_id
      AND is_primary

    UNION ALL

    SELECT jsonb_build_object(
      'sourceKind', 'bank',
      'sourceAccountId', bank.id,
      'displayName', coalesce(
        nullif(bank.metadata->>'display_name', ''),
        initcap(replace(bank.account_type::text, '_', ' ')) || ' account'
      ),
      'accountType', bank.account_type,
      'currencyCode', bank.currency_code,
      'availableBalanceMinor', finance.available_balance_minor,
      'eligible', coalesce((eligibility.result->>'eligible')::boolean, false),
      'ineligibleReason', eligibility.result->>'reason'
    ) AS source
    FROM public.bank_accounts bank
    JOIN public.financial_accounts finance
      ON finance.id = bank.linked_finance_account_id
    CROSS JOIN LATERAL (
      SELECT public.is_bank_account_eligible_for_outgoing_payment(
        bank.id,
        NULL,
        bank.currency_code
      ) AS result
    ) eligibility
    WHERE bank.owner_type = 'player'
      AND bank.owner_id = v_profile_id
  ) available_sources;

  RETURN jsonb_build_object(
    'status', 'ok',
    'profileId', v_profile_id,
    'sources', v_sources
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.open_my_bank_account(
  p_account_type public.bank_account_type,
  p_nickname text,
  p_initial_amount_minor bigint,
  p_term_months integer,
  p_currency_code char(3),
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.current_active_player_profile_id();
  v_wallet public.financial_accounts%ROWTYPE;
  v_currency char(3);
  v_provider_id uuid;
  v_finance_account_id uuid;
  v_bank_account_id uuid;
  v_transaction_id uuid;
  v_restrictions jsonb := '{}'::jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(p_initial_amount_minor, 0) < 0
    OR mod(coalesce(p_initial_amount_minor, 0), 100) <> 0 THEN
    RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units' USING ERRCODE = 'P0001';
  END IF;

  SELECT id
  INTO v_bank_account_id
  FROM public.bank_accounts
  WHERE metadata->>'opening_idempotency_key' = p_idempotency_key
    AND owner_type = 'player'
    AND owner_id = v_profile_id;

  IF v_bank_account_id IS NOT NULL THEN
    RETURN (
      SELECT jsonb_build_object(
        'accountId', bank.id,
        'currencyCode', bank.currency_code,
        'balanceMinor', finance.current_balance_minor,
        'idempotent', true
      )
      FROM public.bank_accounts bank
      JOIN public.financial_accounts finance
        ON finance.id = bank.linked_finance_account_id
      WHERE bank.id = v_bank_account_id
    );
  END IF;

  SELECT *
  INTO v_wallet
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = v_profile_id
    AND is_primary
    AND account_status = 'active'
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'active_wallet_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_currency := coalesce(v_wallet.currency_code, v_wallet.default_currency_code);
  IF v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'wallet_currency_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF v_wallet.available_balance_minor < coalesce(p_initial_amount_minor, 0) THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  SELECT id
  INTO v_provider_id
  FROM public.banking_providers
  WHERE status = 'active'
    AND v_currency = ANY(supported_currencies)
  ORDER BY provider_code
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'banking_provider_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF p_account_type = 'fixed_deposit' THEN
    IF coalesce(p_term_months, 0) <= 0 THEN
      RAISE EXCEPTION 'fixed_deposit_term_required' USING ERRCODE = 'P0001';
    END IF;
    v_restrictions := jsonb_build_object(
      'locked_until', (current_date + make_interval(months => p_term_months))::text
    );
  END IF;

  INSERT INTO public.financial_accounts (
    owner_type,
    owner_id,
    account_name,
    account_status,
    current_balance_minor,
    default_currency_code,
    currency_code,
    is_primary,
    metadata
  ) VALUES (
    'player',
    v_profile_id,
    coalesce(nullif(btrim(p_nickname), ''), initcap(replace(p_account_type::text, '_', ' ')) || ' account'),
    'active',
    0,
    v_currency,
    v_currency,
    false,
    jsonb_build_object(
      'account_role', 'bank_deposit',
      'display_name', nullif(btrim(p_nickname), '')
    )
  )
  RETURNING id INTO v_finance_account_id;

  INSERT INTO public.bank_accounts (
    provider_id,
    owner_type,
    owner_id,
    linked_finance_account_id,
    account_type,
    currency_code,
    status,
    opened_at,
    withdrawal_restrictions,
    metadata
  ) VALUES (
    v_provider_id,
    'player',
    v_profile_id,
    v_finance_account_id,
    p_account_type,
    v_currency,
    'active',
    now(),
    v_restrictions,
    jsonb_build_object(
      'display_name', nullif(btrim(p_nickname), ''),
      'opening_idempotency_key', p_idempotency_key,
      'requested_currency_code', p_currency_code
    )
  )
  RETURNING id INTO v_bank_account_id;

  IF coalesce(p_initial_amount_minor, 0) > 0 THEN
    v_transaction_id := public._move_financial_account_money(
      v_wallet.id,
      v_finance_account_id,
      p_initial_amount_minor,
      'administrative_adjustment',
      'Wallet opening deposit',
      p_idempotency_key || ':deposit',
      v_profile_id,
      'bank_account',
      v_bank_account_id,
      jsonb_build_object('classification', 'transfer')
    );
  END IF;

  UPDATE public.profiles
  SET cash = (v_wallet.current_balance_minor - coalesce(p_initial_amount_minor, 0)) / 100
  WHERE id = v_profile_id;

  RETURN jsonb_build_object(
    'accountId', v_bank_account_id,
    'transactionId', v_transaction_id,
    'currencyCode', v_currency,
    'walletBalanceMinor', v_wallet.current_balance_minor - coalesce(p_initial_amount_minor, 0),
    'balanceMinor', coalesce(p_initial_amount_minor, 0),
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_band_finance_defaults(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_band_finance_defaults_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_band_funding_sources(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_my_bank_account(public.bank_account_type, text, bigint, integer, char(3), text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_band_funding_sources(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_my_bank_account(public.bank_account_type, text, bigint, integer, char(3), text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';