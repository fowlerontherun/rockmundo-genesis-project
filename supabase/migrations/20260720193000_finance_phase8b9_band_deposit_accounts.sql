-- Finance Phase 8B.9: secure band contribution account discovery and current-player deposit wrapper.

CREATE OR REPLACE FUNCTION public.get_my_eligible_band_contribution_accounts(
  p_band_id uuid,
  p_currency_code char(3) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_player_profile_id();
  active_member boolean;
  personal_count integer;
  eligible_count integer;
  mismatch_count integer;
  accounts jsonb;
BEGIN
  IF pid IS NULL THEN
    RETURN jsonb_build_object('status','profile_missing','accounts','[]'::jsonb,'message','An active player profile is required.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = p_band_id
      AND bm.profile_id = pid
      AND COALESCE(bm.member_status,'active') = 'active'
  ) INTO active_member;
  IF NOT active_member THEN
    RETURN jsonb_build_object('status','not_band_member','accounts','[]'::jsonb,'message','Active band membership is required.');
  END IF;

  SELECT count(*) INTO personal_count
  FROM public.bank_accounts ba
  WHERE ba.owner_type = 'player' AND ba.owner_id = pid;

  SELECT count(*) INTO mismatch_count
  FROM public.bank_accounts ba
  JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id
  WHERE ba.owner_type = 'player'
    AND ba.owner_id = pid
    AND ba.status = 'active'
    AND fa.account_status = 'active'
    AND p_currency_code IS NOT NULL
    AND ba.currency_code <> p_currency_code;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ba.id,
    'displayName', COALESCE(NULLIF(ba.metadata->>'display_name',''), initcap(replace(ba.account_type::text, '_', ' ')) || ' Account'),
    'providerName', COALESCE(bp.brand_name, 'Bank account'),
    'accountType', ba.account_type,
    'maskedAccountNumber', COALESCE(NULLIF(ba.metadata->>'masked_account_number',''), NULLIF(ba.metadata->>'account_mask',''), '•••• ' || right(ba.id::text, 4)),
    'currencyCode', ba.currency_code,
    'currentBalanceMinor', fa.current_balance_minor,
    'availableBalanceMinor', fa.available_balance_minor,
    'isPrimary', COALESCE(fa.is_primary, false),
    'eligible', true,
    'ineligibleReason', NULL
  ) ORDER BY COALESCE(fa.is_primary,false) DESC, ba.opened_at NULLS LAST, ba.created_at), '[]'::jsonb), count(*)
  INTO accounts, eligible_count
  FROM public.bank_accounts ba
  JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id
  LEFT JOIN public.banking_providers bp ON bp.id = ba.provider_id
  WHERE ba.owner_type = 'player'
    AND ba.owner_id = pid
    AND ba.status = 'active'
    AND fa.account_status = 'active'
    AND fa.available_balance_minor IS NOT NULL
    AND (p_currency_code IS NULL OR ba.currency_code = p_currency_code)
    AND ba.withdrawal_restrictions = '{}'::jsonb;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN personal_count = 0 THEN 'no_personal_accounts'
      WHEN eligible_count = 0 AND mismatch_count > 0 THEN 'currency_mismatch'
      WHEN eligible_count = 0 THEN 'no_eligible_accounts'
      ELSE 'ok'
    END,
    'accounts', accounts,
    'message', CASE
      WHEN personal_count = 0 THEN 'No personal bank accounts were found.'
      WHEN eligible_count = 0 AND mismatch_count > 0 THEN 'No personal accounts match the requested treasury currency.'
      WHEN eligible_count = 0 THEN 'No eligible active personal accounts were found.'
      ELSE NULL
    END
  );
END $$;

CREATE OR REPLACE FUNCTION public.contribute_my_personal_funds_to_band(
  p_band_id uuid,
  p_bank_account_id uuid,
  p_amount_minor bigint,
  p_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_player_profile_id();
  ba public.bank_accounts;
  fa public.financial_accounts;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  SELECT * INTO fa FROM public.financial_accounts WHERE id = ba.linked_finance_account_id FOR UPDATE;
  IF ba.id IS NULL OR ba.owner_type <> 'player' OR ba.owner_id <> pid OR ba.status <> 'active' OR fa.account_status <> 'active' THEN
    RAISE EXCEPTION 'personal_account_invalid';
  END IF;
  IF fa.available_balance_minor < p_amount_minor THEN RAISE EXCEPTION 'insufficient_personal_funds'; END IF;
  RETURN public.contribute_personal_funds_to_band(p_band_id, p_bank_account_id, p_amount_minor, p_idempotency_key, p_note);
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid,uuid,bigint,text,text) TO authenticated;
