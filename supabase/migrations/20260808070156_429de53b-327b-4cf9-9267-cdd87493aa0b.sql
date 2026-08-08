-- =========================
-- Band treasuries (accounts)
-- =========================
CREATE TABLE IF NOT EXISTS public.band_treasuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  currency_code text NOT NULL DEFAULT 'USD',
  balance_minor bigint NOT NULL DEFAULT 0,
  reserved_balance_minor bigint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, currency_code)
);

GRANT SELECT ON public.band_treasuries TO authenticated;
GRANT ALL ON public.band_treasuries TO service_role;
ALTER TABLE public.band_treasuries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view treasuries" ON public.band_treasuries;
CREATE POLICY "Band members can view treasuries"
ON public.band_treasuries FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.band_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.band_id = band_treasuries.band_id AND p.user_id = auth.uid()
));

CREATE TABLE IF NOT EXISTS public.band_treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  treasury_id uuid NOT NULL REFERENCES public.band_treasuries(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code text NOT NULL,
  source_kind text,
  category text NOT NULL DEFAULT 'band_contribution',
  note text,
  idempotency_key text UNIQUE,
  balance_after_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.band_treasury_transactions TO authenticated;
GRANT ALL ON public.band_treasury_transactions TO service_role;
ALTER TABLE public.band_treasury_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view treasury transactions" ON public.band_treasury_transactions;
CREATE POLICY "Band members can view treasury transactions"
ON public.band_treasury_transactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.band_members m
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.band_id = band_treasury_transactions.band_id AND p.user_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS idx_band_treasury_tx_band_created
  ON public.band_treasury_transactions (band_id, created_at DESC);

-- Backfill treasuries from the legacy projection
INSERT INTO public.band_treasuries (band_id, currency_code, balance_minor, is_primary)
SELECT b.id, 'USD', GREATEST(COALESCE(b.band_balance, 0), 0)::bigint * 100, true
FROM public.bands b
ON CONFLICT (band_id, currency_code) DO NOTHING;

-- =========================
-- Helpers
-- =========================
CREATE OR REPLACE FUNCTION public._band_active_member(p_band_id uuid, p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members m
    WHERE m.band_id = p_band_id
      AND m.profile_id = p_profile_id
      AND COALESCE(m.member_status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public._get_or_create_band_treasury(p_band_id uuid, p_currency_code text)
RETURNS public.band_treasuries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.band_treasuries;
BEGIN
  SELECT * INTO v_row FROM public.band_treasuries
   WHERE band_id = p_band_id AND currency_code = p_currency_code FOR UPDATE;
  IF v_row.id IS NULL THEN
    INSERT INTO public.band_treasuries (band_id, currency_code, balance_minor, is_primary)
    VALUES (p_band_id, p_currency_code, 0,
      NOT EXISTS (SELECT 1 FROM public.band_treasuries WHERE band_id = p_band_id))
    RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END; $$;

-- =========================
-- Dashboard
-- =========================
CREATE OR REPLACE FUNCTION public.get_band_treasury_dashboard(p_band_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_member boolean;
  v_primary text;
  v_treasuries jsonb;
  v_contributions jsonb;
BEGIN
  v_member := public._band_active_member(p_band_id, v_profile);
  IF NOT v_member THEN
    RETURN jsonb_build_object('status','not_band_member','canViewBalance',false,'canViewDetails',false,
      'primaryCurrencyCode','USD','treasuries','[]'::jsonb,'contributions','[]'::jsonb);
  END IF;

  SELECT COALESCE(
    (SELECT t.currency_code FROM public.band_treasuries t
      WHERE t.band_id = p_band_id ORDER BY t.is_primary DESC, t.balance_minor DESC LIMIT 1),
    'USD') INTO v_primary;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'currencyCode', t.currency_code,
    'balanceMinor', t.balance_minor,
    'reservedBalanceMinor', t.reserved_balance_minor,
    'availableBalanceMinor', t.balance_minor - t.reserved_balance_minor,
    'isPrimary', t.is_primary
  ) ORDER BY t.is_primary DESC, t.currency_code), '[]'::jsonb)
  INTO v_treasuries FROM public.band_treasuries t WHERE t.band_id = p_band_id;

  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_contributions FROM (
    SELECT jsonb_build_object(
      'id', tx.id,
      'direction', tx.direction,
      'amountMinor', tx.amount_minor,
      'currencyCode', tx.currency_code,
      'category', tx.category,
      'sourceKind', tx.source_kind,
      'note', tx.note,
      'createdAt', tx.created_at,
      'contributorName', pr.display_name,
      'balanceAfterMinor', tx.balance_after_minor
    ) AS x
    FROM public.band_treasury_transactions tx
    LEFT JOIN public.profiles pr ON pr.id = tx.profile_id
    WHERE tx.band_id = p_band_id
    ORDER BY tx.created_at DESC
    LIMIT 50
  ) s;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_treasuries = '[]'::jsonb THEN 'treasury_missing' ELSE 'ok' END,
    'canViewBalance', true,
    'canViewDetails', true,
    'primaryCurrencyCode', v_primary,
    'treasuries', v_treasuries,
    'contributions', v_contributions
  );
END; $$;

-- =========================
-- Funding sources
-- =========================
CREATE OR REPLACE FUNCTION public.get_my_band_funding_sources(p_band_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_cash bigint;
  v_currency text;
  v_sources jsonb;
BEGIN
  IF NOT public._band_active_member(p_band_id, v_profile) THEN
    RAISE EXCEPTION 'not_band_member';
  END IF;

  SELECT COALESCE(p.cash, 0) INTO v_cash FROM public.profiles p WHERE p.id = v_profile;
  SELECT COALESCE(
    (SELECT t.currency_code FROM public.band_treasuries t WHERE t.band_id = p_band_id
      ORDER BY t.is_primary DESC LIMIT 1), 'USD') INTO v_currency;

  v_sources := jsonb_build_array(jsonb_build_object(
    'sourceKind','wallet',
    'sourceAccountId', NULL,
    'displayName','Character wallet',
    'accountType','wallet',
    'currencyCode', v_currency,
    'availableBalanceMinor', COALESCE(v_cash,0) * 100,
    'eligible', COALESCE(v_cash,0) > 0,
    'ineligibleReason', CASE WHEN COALESCE(v_cash,0) > 0 THEN NULL ELSE 'No wallet funds available' END
  ));

  SELECT v_sources || COALESCE(jsonb_agg(jsonb_build_object(
    'sourceKind','bank',
    'sourceAccountId', a.id,
    'displayName', COALESCE(a.nickname, a.provider_name, 'Bank account'),
    'accountType', a.account_type,
    'currencyCode', a.currency_code,
    'availableBalanceMinor', a.balance_minor,
    'eligible', a.balance_minor > 0
      AND a.currency_code = v_currency
      AND (a.locked_until IS NULL OR a.locked_until <= now()),
    'ineligibleReason', CASE
      WHEN a.currency_code <> v_currency THEN 'currency_mismatch'
      WHEN a.locked_until IS NOT NULL AND a.locked_until > now() THEN 'Account is locked'
      WHEN a.balance_minor <= 0 THEN 'No available balance'
      ELSE NULL END
  ) ORDER BY a.balance_minor DESC), '[]'::jsonb)
  INTO v_sources
  FROM public.bank_accounts a
  WHERE a.profile_id = v_profile AND COALESCE(a.status,'active') = 'active';

  RETURN jsonb_build_object('primaryCurrencyCode', v_currency, 'sources', v_sources);
END; $$;

-- =========================
-- Preview + confirm
-- =========================
CREATE OR REPLACE FUNCTION public.preview_my_band_funding(
  p_band_id uuid, p_source_kind text, p_source_account_id uuid, p_amount_minor bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_currency text;
  v_balance bigint;
  v_display text;
  v_treasury public.band_treasuries;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF NOT public._band_active_member(p_band_id, v_profile) THEN RAISE EXCEPTION 'not_band_member'; END IF;

  SELECT COALESCE(
    (SELECT t.currency_code FROM public.band_treasuries t WHERE t.band_id = p_band_id
      ORDER BY t.is_primary DESC LIMIT 1), 'USD') INTO v_currency;
  SELECT * INTO v_treasury FROM public.band_treasuries
    WHERE band_id = p_band_id AND currency_code = v_currency;

  IF p_source_kind = 'wallet' THEN
    SELECT COALESCE(p.cash,0) * 100 INTO v_balance FROM public.profiles p WHERE p.id = v_profile;
    v_display := 'Character wallet';
    IF p_amount_minor % 100 <> 0 THEN RAISE EXCEPTION 'wallet_whole_units_only'; END IF;
  ELSE
    SELECT a.balance_minor, COALESCE(a.nickname, a.provider_name, 'Bank account'), a.currency_code
      INTO v_balance, v_display, v_currency
    FROM public.bank_accounts a
    WHERE a.id = p_source_account_id AND a.profile_id = v_profile
      AND COALESCE(a.status,'active') = 'active';
    IF v_balance IS NULL THEN RAISE EXCEPTION 'source_not_found'; END IF;
  END IF;

  IF v_balance < p_amount_minor THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  RETURN jsonb_build_object(
    'sourceDisplay', v_display,
    'currencyCode', v_currency,
    'sourceBalanceMinor', v_balance,
    'amountMinor', p_amount_minor,
    'resultingSourceBalanceMinor', v_balance - p_amount_minor,
    'treasuryBalanceMinor', COALESCE(v_treasury.balance_minor, 0),
    'resultingTreasuryBalanceMinor', COALESCE(v_treasury.balance_minor, 0) + p_amount_minor,
    'treasuryWillBeCreated', v_treasury.id IS NULL
  );
END; $$;

CREATE OR REPLACE FUNCTION public.fund_my_band(
  p_band_id uuid, p_source_kind text, p_source_account_id uuid,
  p_amount_minor bigint, p_note text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_currency text;
  v_balance bigint;
  v_treasury public.band_treasuries;
  v_existing public.band_treasury_transactions;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF NOT public._band_active_member(p_band_id, v_profile) THEN RAISE EXCEPTION 'not_band_member'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.band_treasury_transactions WHERE idempotency_key = p_idempotency_key;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('idempotent', true, 'transactionId', v_existing.id,
        'newBandTreasuryBalanceMinor', v_existing.balance_after_minor);
    END IF;
  END IF;

  IF p_source_kind = 'wallet' THEN
    IF p_amount_minor % 100 <> 0 THEN RAISE EXCEPTION 'wallet_whole_units_only'; END IF;
    SELECT COALESCE(
      (SELECT t.currency_code FROM public.band_treasuries t WHERE t.band_id = p_band_id
        ORDER BY t.is_primary DESC LIMIT 1), 'USD') INTO v_currency;

    UPDATE public.profiles SET cash = cash - (p_amount_minor / 100)
     WHERE id = v_profile AND COALESCE(cash,0) >= (p_amount_minor / 100)
     RETURNING COALESCE(cash,0) * 100 INTO v_balance;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  ELSE
    UPDATE public.bank_accounts
       SET balance_minor = balance_minor - p_amount_minor, updated_at = now()
     WHERE id = p_source_account_id AND profile_id = v_profile
       AND COALESCE(status,'active') = 'active'
       AND (locked_until IS NULL OR locked_until <= now())
       AND balance_minor >= p_amount_minor
     RETURNING balance_minor, currency_code INTO v_balance, v_currency;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  END IF;

  v_treasury := public._get_or_create_band_treasury(p_band_id, v_currency);

  UPDATE public.band_treasuries
     SET balance_minor = balance_minor + p_amount_minor, updated_at = now()
   WHERE id = v_treasury.id
   RETURNING * INTO v_treasury;

  INSERT INTO public.band_treasury_transactions (
    band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
    source_kind, category, note, idempotency_key, balance_after_minor)
  VALUES (p_band_id, v_treasury.id, v_profile, 'credit', p_amount_minor, v_currency,
    p_source_kind, 'band_contribution', p_note, p_idempotency_key, v_treasury.balance_minor);

  IF v_treasury.is_primary THEN
    UPDATE public.bands SET band_balance = (v_treasury.balance_minor / 100)::int WHERE id = p_band_id;
  END IF;

  RETURN jsonb_build_object(
    'idempotent', false,
    'newBandTreasuryBalanceMinor', v_treasury.balance_minor,
    'newPlayerAvailableBalanceMinor', v_balance,
    'currencyCode', v_currency
  );
END; $$;

-- Legacy-compatible wrappers used by Band Finances tab
CREATE OR REPLACE FUNCTION public.preview_my_band_contribution(
  p_band_id uuid, p_bank_account_id uuid, p_amount_minor bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.preview_my_band_funding(p_band_id, 'bank', p_bank_account_id, p_amount_minor);
$$;

CREATE OR REPLACE FUNCTION public.contribute_my_personal_funds_to_band(
  p_band_id uuid, p_bank_account_id uuid, p_amount_minor bigint,
  p_idempotency_key text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.fund_my_band(p_band_id, 'bank', p_bank_account_id, p_amount_minor, p_note, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.get_my_eligible_band_contribution_accounts(
  p_band_id uuid, p_currency_code text DEFAULT 'USD')
RETURNS TABLE(id uuid, provider_name text, account_type text, currency_code text, balance_minor bigint, nickname text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id, a.provider_name, a.account_type, a.currency_code, a.balance_minor, a.nickname
  FROM public.bank_accounts a
  WHERE a.profile_id = public._caller_profile_id()
    AND COALESCE(a.status,'active') = 'active'
    AND a.currency_code = COALESCE(p_currency_code, 'USD')
    AND (a.locked_until IS NULL OR a.locked_until <= now())
    AND public._band_active_member(p_band_id, a.profile_id)
  ORDER BY a.balance_minor DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_band_funding_sources(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_my_band_funding(uuid, text, uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_my_band(uuid, text, uuid, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid, uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid, uuid, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid, text) TO authenticated;