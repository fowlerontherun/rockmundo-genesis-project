-- Finance Regression Repair 2: forward repair for deployed band treasury RPCs.
-- Audit note: PR #1250 deployed the initial 20260720201000 Phase 8B.10
-- function definitions. PRs #1251/#1252 edited that historical migration, but
-- editing an already-applied Supabase migration does not update existing
-- databases. This migration reapplies the repaired definitions forward so
-- production, staging, and clean reset databases converge on the same behavior.

CREATE OR REPLACE FUNCTION public.get_band_treasury_dashboard(p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_player_profile_id();
  primary_currency char(3) := 'GBP'::char(3);
  active_member boolean := false;
  can_detail boolean := false;
  band_exists boolean := false;
BEGIN
  IF pid IS NULL THEN
    RETURN jsonb_build_object('status','profile_missing','primaryCurrencyCode','GBP','treasuries','[]'::jsonb,'contributions','[]'::jsonb);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.bands b WHERE b.id = p_band_id) INTO band_exists;
  IF NOT band_exists THEN
    RETURN jsonb_build_object('status','band_missing','primaryCurrencyCode','GBP','treasuries','[]'::jsonb,'contributions','[]'::jsonb);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = p_band_id
      AND bm.profile_id = pid
      AND COALESCE(bm.member_status,'active') = 'active'
  ) INTO active_member;

  IF NOT active_member THEN
    RETURN jsonb_build_object('status','permission_denied','primaryCurrencyCode','GBP','treasuries','[]'::jsonb,'contributions','[]'::jsonb);
  END IF;

  can_detail := public.user_has_band_finance_permission(p_band_id,pid,'view_detailed_income_expenses'::public.band_finance_permission);

  SELECT COALESCE(
    (SELECT COALESCE(fa.currency_code, fa.default_currency_code) FROM public.financial_accounts fa WHERE fa.owner_type='band' AND fa.owner_id=p_band_id AND fa.account_status='active' ORDER BY fa.is_primary DESC, fa.created_at LIMIT 1),
    'GBP'::char(3)
  ) INTO primary_currency;

  primary_currency := COALESCE(primary_currency, 'GBP'::char(3));

  RETURN jsonb_build_object(
    'status', CASE WHEN EXISTS (SELECT 1 FROM public.financial_accounts fa WHERE fa.owner_type='band' AND fa.owner_id=p_band_id AND fa.account_status='active') THEN 'ok' ELSE 'treasury_missing' END,
    'primaryCurrencyCode', primary_currency,
    'treasuries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'accountId', fa.id,
        'currencyCode', COALESCE(fa.currency_code, fa.default_currency_code),
        'currentBalanceMinor', fa.current_balance_minor,
        'availableBalanceMinor', fa.available_balance_minor,
        'isPrimary', COALESCE(fa.is_primary,false)
      ) ORDER BY (COALESCE(fa.currency_code, fa.default_currency_code)=primary_currency) DESC, fa.is_primary DESC, fa.created_at)
      FROM public.financial_accounts fa
      WHERE fa.owner_type='band' AND fa.owner_id=p_band_id AND fa.account_status='active'
    ),'[]'::jsonb),
    'contributions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', contribution_rows.id,
        'amountMinor', contribution_rows.amount_minor,
        'currencyCode', contribution_rows.currency_code,
        'contributionType', contribution_rows.contribution_type,
        'refundableStatus', contribution_rows.refundable_status,
        'notes', contribution_rows.notes,
        'createdAt', contribution_rows.created_at,
        'contributorDisplayName', COALESCE(p.display_name,p.username,'Band member'),
        'contributorAvatarUrl', p.avatar_url
      ) ORDER BY contribution_rows.created_at DESC)
      FROM (
        SELECT c.id, c.amount_minor, c.currency_code, c.contribution_type, c.refundable_status, c.notes, c.created_at, c.contributing_player_id
        FROM public.band_financial_contributions c
        WHERE c.band_id=p_band_id AND (can_detail OR c.contributing_player_id=pid)
        ORDER BY c.created_at DESC
        LIMIT 25
      ) contribution_rows
      LEFT JOIN public.profiles p ON p.id=contribution_rows.contributing_player_id
    ),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.preview_my_band_contribution(p_band_id uuid,p_bank_account_id uuid,p_amount_minor bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pid uuid:=public.current_player_profile_id(); ba public.bank_accounts; fa public.financial_accounts; treasury public.financial_accounts; eligibility jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RAISE EXCEPTION 'band_missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'not_band_member'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id;
  IF ba.id IS NULL OR ba.owner_type <> 'player' OR ba.owner_id <> pid THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id;
  SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND COALESCE(currency_code, default_currency_code)=ba.currency_code AND account_status='active' ORDER BY is_primary DESC, created_at LIMIT 1;
  IF treasury.id IS NULL THEN RAISE EXCEPTION 'band_treasury_missing'; END IF;
  eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code);
  RETURN jsonb_build_object('sourceAccountDisplay',COALESCE(NULLIF(ba.metadata->>'display_name',''),'Personal account') || ' ' || COALESCE(NULLIF(ba.metadata->>'masked_account_number',''),'•••• ' || right(ba.id::text,4)),'currencyCode',ba.currency_code,'currentPersonalBalanceMinor',fa.available_balance_minor,'amountMinor',p_amount_minor,'resultingPersonalBalanceMinor',fa.available_balance_minor-p_amount_minor,'destinationTreasuryName',treasury.account_name,'currentTreasuryBalanceMinor',treasury.available_balance_minor,'resultingTreasuryBalanceMinor',treasury.available_balance_minor+p_amount_minor,'eligible',(eligibility->>'eligible')::boolean,'ineligibleReason',eligibility->>'reason','warningText','This contribution is not automatically repayable and does not grant additional band ownership or voting rights.');
END $$;

REVOKE EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) TO authenticated, service_role;
