-- Restore character charity donations through the canonical financial ledger.
-- The browser may choose a charity and amount, but profile authority, wallet,
-- currency and rewards are all resolved and applied in one database transaction.

ALTER TABLE public.charity_donations
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS currency_code char(3),
  ADD COLUMN IF NOT EXISTS financial_transaction_id uuid REFERENCES public.financial_transactions(id),
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.charity_donations
SET amount_minor = COALESCE(amount_minor, GREATEST(amount, 0)::bigint * 100),
    currency_code = COALESCE(currency_code, 'USD'),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'legacy_projection', true,
      'legacy_amount_major', amount
    )
WHERE amount_minor IS NULL OR currency_code IS NULL;

ALTER TABLE public.charity_donations
  ALTER COLUMN amount_minor SET NOT NULL,
  ALTER COLUMN currency_code SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.charity_donations
    ADD CONSTRAINT charity_donations_currency_format
    CHECK (currency_code ~ '^[A-Z]{3}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS charity_donations_transaction_unique_idx
  ON public.charity_donations(financial_transaction_id)
  WHERE financial_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS charity_donations_idempotency_unique_idx
  ON public.charity_donations(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP POLICY IF EXISTS "Users can insert own donations" ON public.charity_donations;
REVOKE INSERT, UPDATE, DELETE ON public.charity_donations FROM anon, authenticated;
GRANT SELECT ON public.charity_donations TO authenticated;

CREATE OR REPLACE FUNCTION public.make_my_charity_donation(
  p_charity_id uuid,
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
  charity public.charity_organizations%ROWTYPE;
  wallet public.financial_accounts%ROWTYPE;
  charity_account public.financial_accounts%ROWTYPE;
  existing_donation public.charity_donations%ROWTYPE;
  reputation public.player_reputation%ROWTYPE;
  transaction_id uuid;
  donation_id uuid;
  currency char(3);
  amount_major bigint;
  fame_reward integer;
  requested_reputation_reward integer;
  applied_reputation_reward integer;
  previous_attitude integer;
  new_attitude integer;
  wallet_balance_minor bigint;
BEGIN
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive' USING ERRCODE = 'P0001';
  END IF;
  IF mod(p_amount_minor, 100) <> 0 THEN
    RAISE EXCEPTION 'donation_amount_must_be_whole_major_units' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  SELECT * INTO existing_donation
  FROM public.charity_donations
  WHERE idempotency_key = p_idempotency_key;

  IF existing_donation.id IS NOT NULL THEN
    IF existing_donation.profile_id IS DISTINCT FROM profile_id
      OR existing_donation.charity_id IS DISTINCT FROM p_charity_id
      OR existing_donation.amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = 'P0001';
    END IF;

    SELECT current_balance_minor INTO wallet_balance_minor
    FROM public.financial_accounts
    WHERE owner_type = 'player'
      AND owner_id = profile_id
      AND is_primary
      AND account_status = 'active'
    ORDER BY created_at
    LIMIT 1;

    RETURN jsonb_build_object(
      'donationId', existing_donation.id,
      'transactionId', existing_donation.financial_transaction_id,
      'charityId', existing_donation.charity_id,
      'currencyCode', existing_donation.currency_code,
      'amountMinor', existing_donation.amount_minor,
      'walletBalanceMinor', COALESCE(wallet_balance_minor, 0),
      'fameGained', existing_donation.fame_gained,
      'reputationGained', existing_donation.reputation_gained,
      'idempotent', true
    );
  END IF;

  SELECT * INTO charity
  FROM public.charity_organizations
  WHERE id = p_charity_id
    AND is_active
  FOR SHARE;

  IF charity.id IS NULL THEN
    RAISE EXCEPTION 'charity_not_found_or_inactive' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO wallet
  FROM public.financial_accounts
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary
    AND account_status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF wallet.id IS NULL THEN
    RAISE EXCEPTION 'character_wallet_missing' USING ERRCODE = 'P0001';
  END IF;

  currency := COALESCE(wallet.currency_code, wallet.default_currency_code);
  IF wallet.available_balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient_funds' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.financial_accounts(
    owner_type,
    owner_id,
    account_name,
    account_status,
    current_balance_minor,
    reserved_balance_minor,
    default_currency_code,
    currency_code,
    account_purpose,
    is_primary,
    metadata
  ) VALUES (
    'system',
    NULL,
    'Charity clearing ' || currency,
    'active',
    0,
    0,
    currency,
    currency,
    'charity_clearing',
    false,
    jsonb_build_object('account_role', 'charity_clearing', 'currency_code', currency)
  )
  ON CONFLICT DO NOTHING;

  SELECT * INTO charity_account
  FROM public.financial_accounts
  WHERE owner_type = 'system'
    AND account_status = 'active'
    AND account_name = 'Charity clearing ' || currency
    AND currency_code = currency
    AND account_purpose = 'charity_clearing'
  ORDER BY created_at
  LIMIT 1;

  IF charity_account.id IS NULL THEN
    RAISE EXCEPTION 'charity_clearing_account_missing' USING ERRCODE = 'P0001';
  END IF;

  amount_major := p_amount_minor / 100;
  fame_reward := GREATEST(0, floor((amount_major::numeric * charity.fame_bonus_pct) / 100)::integer);
  requested_reputation_reward := GREATEST(
    0,
    floor((amount_major::numeric * charity.reputation_boost) / 100)::integer
  );

  INSERT INTO public.player_reputation(profile_id)
  VALUES (profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT * INTO reputation
  FROM public.player_reputation
  WHERE player_reputation.profile_id = make_my_charity_donation.profile_id
  FOR UPDATE;

  previous_attitude := reputation.attitude_score;
  new_attitude := LEAST(100, previous_attitude + requested_reputation_reward);
  applied_reputation_reward := new_attitude - previous_attitude;

  transaction_id := public._move_financial_account_money(
    wallet.id,
    charity_account.id,
    p_amount_minor,
    'charity_donation',
    'Donation to ' || charity.name,
    p_idempotency_key,
    profile_id,
    'charity_organization',
    charity.id,
    jsonb_build_object(
      'classification', 'charity_donation',
      'charity_name', charity.name,
      'charity_category', charity.category,
      'commercial_revenue', false,
      'tax_deduction_pct', charity.tax_deduction_pct
    )
  );

  UPDATE public.profiles
  SET cash = (
        SELECT current_balance_minor / 100
        FROM public.financial_accounts
        WHERE id = wallet.id
      ),
      fame = COALESCE(fame, 0) + fame_reward,
      updated_at = now()
  WHERE id = profile_id;

  UPDATE public.player_reputation
  SET attitude_score = new_attitude,
      last_updated_at = now()
  WHERE player_reputation.profile_id = make_my_charity_donation.profile_id;

  IF applied_reputation_reward > 0 THEN
    INSERT INTO public.reputation_events(
      profile_id,
      event_type,
      event_source,
      source_id,
      axis,
      change_amount,
      previous_value,
      new_value,
      reason,
      metadata
    ) VALUES (
      profile_id,
      'charity_donation',
      'charity',
      charity.id,
      'attitude',
      applied_reputation_reward,
      previous_attitude,
      new_attitude,
      'Supported ' || charity.name,
      jsonb_build_object(
        'fame_delta', fame_reward,
        'requested_reputation_delta', requested_reputation_reward,
        'amount_minor', p_amount_minor,
        'currency_code', currency,
        'transaction_id', transaction_id
      )
    );
  END IF;

  INSERT INTO public.charity_donations(
    profile_id,
    charity_id,
    amount,
    amount_minor,
    currency_code,
    fame_gained,
    reputation_gained,
    financial_transaction_id,
    idempotency_key,
    metadata
  ) VALUES (
    profile_id,
    charity.id,
    amount_major::integer,
    p_amount_minor,
    currency,
    fame_reward,
    applied_reputation_reward,
    transaction_id,
    p_idempotency_key,
    jsonb_build_object(
      'reward_axis', 'attitude',
      'requested_reputation_gained', requested_reputation_reward,
      'tax_deduction_pct', charity.tax_deduction_pct
    )
  )
  RETURNING id INTO donation_id;

  SELECT current_balance_minor INTO wallet_balance_minor
  FROM public.financial_accounts
  WHERE id = wallet.id;

  RETURN jsonb_build_object(
    'donationId', donation_id,
    'transactionId', transaction_id,
    'charityId', charity.id,
    'charityName', charity.name,
    'currencyCode', currency,
    'amountMinor', p_amount_minor,
    'walletBalanceMinor', wallet_balance_minor,
    'fameGained', fame_reward,
    'reputationGained', applied_reputation_reward,
    'requestedReputationGained', requested_reputation_reward,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.make_my_charity_donation(uuid, bigint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_my_charity_donation(uuid, bigint, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
