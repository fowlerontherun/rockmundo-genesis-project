-- Finance Phase 8B.7: immediately close the generic band-expense transfer endpoint.
-- This migration does not start Phase 8C. It narrows the Phase 8B.6 prototype so that
-- browsers can preview funding only; payment must be invoked by future trusted,
-- feature-specific booking wrappers that calculate price and destination server-side.

DROP FUNCTION IF EXISTS public.confirm_band_expense_funding(uuid,text,uuid,uuid,bigint,char,text,uuid,text);
DROP FUNCTION IF EXISTS public.preview_band_expense_funding(uuid,text,uuid,bigint,char,text,uuid);
DROP FUNCTION IF EXISTS public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,char(3),text,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.resolve_and_pay_band_expense(uuid,text,uuid,uuid,bigint,char,text,uuid,uuid,text);

CREATE OR REPLACE FUNCTION public.preview_band_expense_funding(
  p_band_id uuid,
  p_expense_type text,
  p_expense_id uuid,
  p_amount_minor bigint,
  p_currency_code char(3),
  p_requested_payment_source text,
  p_personal_bank_account_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pid uuid:=public.current_player_profile_id();
  treasury uuid;
  band_bal bigint:=0;
  ba public.bank_accounts;
  fa public.financial_accounts;
  personal_bal bigint:=0;
  band_part bigint:=0;
  personal_part bigint:=0;
  can_use_band boolean;
  is_member boolean;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile required'; END IF;
  IF p_amount_minor<=0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_currency_code IS NULL OR length(trim(p_currency_code::text))<>3 THEN RAISE EXCEPTION 'three-character currency code required'; END IF;
  IF p_requested_payment_source NOT IN ('band_only','personal_only','band_then_personal_shortfall') THEN RAISE EXCEPTION 'unsupported payment source'; END IF;

  is_member:=EXISTS(SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active');
  can_use_band:=public.user_has_band_finance_permission(p_band_id,pid,'pay_band_expenses'::public.band_finance_permission);

  SELECT id, available_balance_minor INTO treasury, band_bal
  FROM public.financial_accounts
  WHERE owner_type='band'
    AND owner_id=p_band_id
    AND currency_code=p_currency_code
    AND account_status='active'
    AND metadata->>'account_role'='band_treasury'
  ORDER BY is_primary DESC, created_at
  LIMIT 1;

  IF p_personal_bank_account_id IS NOT NULL THEN
    SELECT * INTO ba FROM public.bank_accounts WHERE id=p_personal_bank_account_id;
    SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id;
    IF ba.owner_type='player' AND ba.owner_id=pid AND ba.status='active' AND fa.account_status='active' AND ba.currency_code=p_currency_code THEN
      personal_bal:=fa.available_balance_minor;
    END IF;
  END IF;

  IF p_requested_payment_source='band_only' THEN band_part:=LEAST(p_amount_minor,COALESCE(band_bal,0)); personal_part:=0;
  ELSIF p_requested_payment_source='personal_only' THEN band_part:=0; personal_part:=p_amount_minor;
  ELSE band_part:=LEAST(p_amount_minor,COALESCE(band_bal,0)); personal_part:=p_amount_minor-band_part;
  END IF;

  RETURN jsonb_build_object(
    'status',CASE
      WHEN NOT is_member THEN 'permission_denied'
      WHEN treasury IS NULL THEN 'band_treasury_missing'
      WHEN band_part>0 AND NOT can_use_band THEN 'permission_denied'
      WHEN p_requested_payment_source='band_only' AND COALESCE(band_bal,0)<p_amount_minor THEN 'insufficient_band_funds'
      WHEN personal_part>0 AND personal_bal<personal_part THEN 'insufficient_personal_funds'
      ELSE 'ready'
    END,
    'totalAmountMinor',p_amount_minor,
    'bandAvailableMinor',COALESCE(band_bal,0),
    'shortfallMinor',GREATEST(0,p_amount_minor-COALESCE(band_bal,0)),
    'currencyCode',p_currency_code,
    'personalPaymentEligible',is_member AND p_personal_bank_account_id IS NOT NULL,
    'bandFundedAmountMinor',band_part,
    'personalAmountMinor',personal_part,
    'personalAvailableBalanceMinor',personal_bal,
    'resultingBandBalanceMinor',COALESCE(band_bal,0)-band_part,
    'resultingPersonalBalanceMinor',personal_bal-personal_part,
    'permission',jsonb_build_object('member',is_member,'useBandFunds',can_use_band),
    'requiresTrustedBookingConfirmation',true
  );
END $$;

CREATE OR REPLACE FUNCTION public.resolve_and_pay_band_expense_internal(
  p_band_id uuid,
  p_expense_type text,
  p_expense_id uuid,
  p_destination_account_id uuid,
  p_amount_minor bigint,
  p_currency_code char(3),
  p_requested_payment_source text,
  p_personal_bank_account_id uuid,
  p_initiating_player_id uuid,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'band expense payments must use trusted feature-specific booking functions' USING ERRCODE='42501';
END $$;

COMMENT ON FUNCTION public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,char(3),text,uuid,uuid,text)
  IS 'Internal-only Phase 8B.7 guard. Feature-specific booking functions must calculate destination, amount and permission before payment.';

CREATE OR REPLACE FUNCTION public.confirm_band_expense_funding(
  p_band_id uuid,
  p_expense_type text,
  p_expense_id uuid,
  p_amount_minor bigint,
  p_currency_code char(3),
  p_requested_payment_source text,
  p_personal_bank_account_id uuid,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN jsonb_build_object(
    'status','requires_feature_booking_confirmation',
    'message','Generic band expense confirmation is disabled. Use a trusted booking-specific confirmation RPC that derives amount and destination server-side.',
    'expenseType',p_expense_type,
    'expenseId',p_expense_id
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,char(3),text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,char(3),text,uuid,uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.preview_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid), public.confirm_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid), public.confirm_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid,text) TO authenticated;
