-- Finance band treasury consolidation: forward-only repair for PRs 1249-1252.

CREATE OR REPLACE FUNCTION public.current_active_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.is_active, false) = true
    AND p.died_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_active_player_profile_id()
$$;

CREATE OR REPLACE FUNCTION public.is_bank_account_eligible_for_outgoing_payment(
  p_bank_account_id uuid,
  p_amount_minor bigint DEFAULT NULL,
  p_currency_code char(3) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ba public.bank_accounts;
  fa public.financial_accounts;
  reason text := NULL;
BEGIN
  SELECT * INTO ba FROM public.bank_accounts WHERE id = p_bank_account_id;
  IF ba.id IS NULL THEN RETURN jsonb_build_object('eligible', false, 'reason', 'account_not_found'); END IF;
  SELECT * INTO fa FROM public.financial_accounts WHERE id = ba.linked_finance_account_id;
  IF ba.linked_finance_account_id IS NULL OR fa.id IS NULL THEN reason := 'account_unlinked'; END IF;
  IF reason IS NULL AND ba.status <> 'active' THEN reason := 'account_closed'; END IF;
  IF reason IS NULL AND fa.account_status <> 'active' THEN reason := 'account_frozen'; END IF;
  IF reason IS NULL AND COALESCE((ba.withdrawal_restrictions->>'withdrawals_disabled')::boolean, false) THEN reason := 'withdrawals_disabled'; END IF;
  IF reason IS NULL AND COALESCE((ba.withdrawal_restrictions->>'under_review')::boolean, false) THEN reason := 'account_under_review'; END IF;
  IF reason IS NULL AND p_currency_code IS NOT NULL AND ba.currency_code <> p_currency_code THEN reason := 'currency_mismatch'; END IF;
  IF reason IS NULL AND p_amount_minor IS NOT NULL AND fa.available_balance_minor < p_amount_minor THEN reason := 'insufficient_available_balance'; END IF;
  RETURN jsonb_build_object('eligible', reason IS NULL, 'reason', reason);
END $$;

REVOKE EXECUTE ON FUNCTION public.is_bank_account_eligible_for_outgoing_payment(uuid,bigint,char(3)) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_bank_account_eligible_for_outgoing_payment(uuid,bigint,char(3)) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_eligible_band_contribution_accounts(p_band_id uuid, p_currency_code char(3) DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid := public.current_active_player_profile_id();
  currency char(3) := p_currency_code;
  personal_count integer; eligible_count integer; mismatch_count integer; accounts jsonb;
BEGIN
  IF pid IS NULL THEN RETURN jsonb_build_object('status','profile_missing','accounts','[]'::jsonb,'message','An active player profile is required.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RETURN jsonb_build_object('status','band_missing','accounts','[]'::jsonb,'message','Band not found.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RETURN jsonb_build_object('status','not_band_member','accounts','[]'::jsonb,'message','Active band membership is required.'); END IF;
  currency := COALESCE(currency, (SELECT COALESCE(fa.currency_code, fa.default_currency_code) FROM public.financial_accounts fa WHERE fa.owner_type='band' AND fa.owner_id=p_band_id AND fa.account_status='active' AND fa.metadata->>'account_role'='band_treasury' ORDER BY fa.is_primary DESC, fa.created_at LIMIT 1), 'GBP'::char(3));
  SELECT count(*) INTO personal_count FROM public.bank_accounts ba WHERE ba.owner_type='player' AND ba.owner_id=pid;
  SELECT count(*) INTO mismatch_count FROM public.bank_accounts ba WHERE ba.owner_type='player' AND ba.owner_id=pid AND ba.status='active' AND ba.currency_code<>currency;
  WITH candidates AS (
    SELECT ba.*, fa.current_balance_minor, fa.available_balance_minor, fa.is_primary, bp.brand_name,
           public.is_bank_account_eligible_for_outgoing_payment(ba.id, NULL, currency) AS eligibility
    FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id LEFT JOIN public.banking_providers bp ON bp.id=ba.provider_id
    WHERE ba.owner_type='player' AND ba.owner_id=pid
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'displayName',COALESCE(NULLIF(metadata->>'display_name',''),initcap(replace(account_type::text,'_',' '))||' Account'),'providerName',COALESCE(brand_name,'Bank account'),'accountType',account_type,'maskedAccountNumber',COALESCE(NULLIF(metadata->>'masked_account_number',''),NULLIF(metadata->>'account_mask',''),'•••• '||right(id::text,4)),'currencyCode',currency_code,'currentBalanceMinor',current_balance_minor,'availableBalanceMinor',available_balance_minor,'isPrimary',COALESCE(is_primary,false),'eligible',(eligibility->>'eligible')::boolean,'ineligibleReason',eligibility->>'reason') ORDER BY COALESCE(is_primary,false) DESC, opened_at NULLS LAST, created_at) FILTER (WHERE (eligibility->>'eligible')::boolean),'[]'::jsonb), count(*) FILTER (WHERE (eligibility->>'eligible')::boolean)
  INTO accounts, eligible_count FROM candidates;
  RETURN jsonb_build_object('status', CASE WHEN personal_count=0 THEN 'no_personal_accounts' WHEN eligible_count=0 AND mismatch_count>0 THEN 'currency_mismatch' WHEN eligible_count=0 THEN 'no_eligible_accounts' ELSE 'ok' END, 'accounts', accounts, 'message', NULL);
END $$;

CREATE OR REPLACE FUNCTION public.get_band_treasury_dashboard(p_band_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.current_active_player_profile_id(); primary_currency char(3) := 'GBP'; can_balance boolean := false; can_detail boolean := false; has_treasury boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RETURN jsonb_build_object('status','band_missing','canViewBalance',false,'canViewDetails',false,'primaryCurrencyCode','GBP','treasuries','[]'::jsonb,'contributions','[]'::jsonb); END IF;
  SELECT COALESCE((metadata->>'primary_operating_currency')::char(3),'GBP'::char(3)) INTO primary_currency FROM public.bands WHERE id=p_band_id;
  IF pid IS NULL THEN RETURN jsonb_build_object('status','profile_missing','canViewBalance',false,'canViewDetails',false,'primaryCurrencyCode',primary_currency,'treasuries','[]'::jsonb,'contributions','[]'::jsonb); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RETURN jsonb_build_object('status','not_band_member','canViewBalance',false,'canViewDetails',false,'primaryCurrencyCode',primary_currency,'treasuries','[]'::jsonb,'contributions','[]'::jsonb); END IF;
  can_balance := public.user_has_band_finance_permission(p_band_id,pid,'view_band_balance'::public.band_finance_permission);
  can_detail := public.user_has_band_finance_permission(p_band_id,pid,'view_detailed_income_expenses'::public.band_finance_permission) OR public.user_has_band_finance_permission(p_band_id,pid,'view_transaction_history'::public.band_finance_permission);
  IF NOT can_balance THEN RETURN jsonb_build_object('status','permission_denied','canViewBalance',false,'canViewDetails',can_detail,'primaryCurrencyCode',primary_currency,'treasuries','[]'::jsonb,'contributions','[]'::jsonb); END IF;
  SELECT EXISTS(SELECT 1 FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND account_status='active' AND metadata->>'account_role'='band_treasury') INTO has_treasury;
  SELECT COALESCE((SELECT COALESCE(currency_code, default_currency_code) FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND account_status='active' AND metadata->>'account_role'='band_treasury' ORDER BY is_primary DESC, created_at LIMIT 1), primary_currency) INTO primary_currency;
  RETURN jsonb_build_object('status',CASE WHEN has_treasury THEN 'ok' ELSE 'treasury_missing' END,'canViewBalance',true,'canViewDetails',can_detail,'primaryCurrencyCode',primary_currency,'treasuries',COALESCE((SELECT jsonb_agg(jsonb_build_object('accountId',fa.id,'currencyCode',COALESCE(fa.currency_code,fa.default_currency_code),'currentBalanceMinor',fa.current_balance_minor,'reservedBalanceMinor',fa.reserved_balance_minor,'availableBalanceMinor',fa.available_balance_minor,'isPrimary',COALESCE(fa.is_primary,false)) ORDER BY (COALESCE(fa.currency_code,fa.default_currency_code)=primary_currency) DESC, fa.is_primary DESC, fa.created_at) FROM public.financial_accounts fa WHERE fa.owner_type='band' AND fa.owner_id=p_band_id AND fa.account_status='active' AND fa.metadata->>'account_role'='band_treasury'),'[]'::jsonb),'contributions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'currencyCode',r.currency_code,'contributionType',r.contribution_type,'refundableStatus',r.refundable_status,'notes',r.notes,'createdAt',r.created_at,'contributorDisplayName',CASE WHEN can_detail THEN COALESCE(p.display_name,p.username,'Band member') ELSE 'Band member' END,'contributorAvatarUrl',CASE WHEN can_detail THEN p.avatar_url ELSE NULL END) ORDER BY r.created_at DESC) FROM (SELECT * FROM public.band_financial_contributions c WHERE c.band_id=p_band_id AND (can_detail OR c.contributing_player_id=pid) ORDER BY c.created_at DESC LIMIT 25) r LEFT JOIN public.profiles p ON p.id=r.contributing_player_id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.preview_my_band_contribution(p_band_id uuid,p_bank_account_id uuid,p_amount_minor bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); ba public.bank_accounts; fa public.financial_accounts; treasury public.financial_accounts; eligibility jsonb; will_create boolean:=false;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RAISE EXCEPTION 'band_missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'not_band_member'; END IF;
  IF NOT public.user_has_band_finance_permission(p_band_id,pid,'make_voluntary_contributions'::public.band_finance_permission) THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id; IF ba.id IS NULL OR ba.owner_type<>'player' OR ba.owner_id<>pid THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id; IF fa.id IS NULL THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code); IF NOT (eligibility->>'eligible')::boolean THEN RAISE EXCEPTION '%', eligibility->>'reason'; END IF;
  SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND currency_code=ba.currency_code AND account_status='active' AND metadata->>'account_role'='band_treasury' ORDER BY is_primary DESC, created_at LIMIT 1;
  will_create := treasury.id IS NULL;
  RETURN jsonb_build_object('sourceAccountDisplay',COALESCE(NULLIF(ba.metadata->>'display_name',''),'Personal account')||' '||COALESCE(NULLIF(ba.metadata->>'masked_account_number',''),'•••• '||right(ba.id::text,4)),'currencyCode',ba.currency_code,'currentPersonalBalanceMinor',fa.available_balance_minor,'amountMinor',p_amount_minor,'resultingPersonalBalanceMinor',fa.available_balance_minor-p_amount_minor,'destinationTreasuryName',COALESCE(treasury.account_name,'Band treasury'),'treasuryWillBeCreated',will_create,'currentTreasuryBalanceMinor',COALESCE(treasury.available_balance_minor,0),'resultingTreasuryBalanceMinor',COALESCE(treasury.available_balance_minor,0)+p_amount_minor,'eligible',true,'ineligibleReason',NULL,'warningText','This contribution is not automatically repayable and does not grant additional band ownership or voting rights.');
END $$;

CREATE OR REPLACE FUNCTION public.contribute_my_personal_funds_to_band(p_band_id uuid,p_bank_account_id uuid,p_amount_minor bigint,p_note text DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); ba public.bank_accounts; eligibility jsonb; day_total bigint; result jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF p_amount_minor > 100000000 THEN RAISE EXCEPTION 'maximum_transaction_amount_exceeded'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RAISE EXCEPTION 'band_missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'not_band_member'; END IF;
  IF NOT public.user_has_band_finance_permission(p_band_id,pid,'make_voluntary_contributions'::public.band_finance_permission) THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id FOR UPDATE; IF ba.id IS NULL OR ba.owner_type<>'player' OR ba.owner_id<>pid THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code); IF NOT (eligibility->>'eligible')::boolean THEN RAISE EXCEPTION '%', eligibility->>'reason'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO day_total FROM public.band_financial_contributions WHERE contributing_player_id=pid AND created_at>=date_trunc('day',timezone('utc',now())) AND contribution_type='voluntary_deposit'; IF day_total+p_amount_minor>500000000 THEN RAISE EXCEPTION 'daily_contribution_limit_exceeded'; END IF;
  result := public.contribute_personal_funds_to_band(p_band_id,p_bank_account_id,p_amount_minor,p_idempotency_key,p_note);
  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid,uuid,bigint,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid,uuid,bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) TO authenticated, service_role;
