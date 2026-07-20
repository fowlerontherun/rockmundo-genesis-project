-- Finance Phase 8B.10: harden band contribution RPCs and expose ledger-authoritative band treasury dashboard.

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
  IF ba.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_not_found');
  END IF;
  IF ba.linked_finance_account_id IS NULL THEN reason := 'account_unlinked'; END IF;
  SELECT * INTO fa FROM public.financial_accounts WHERE id = ba.linked_finance_account_id;
  IF reason IS NULL AND ba.status <> 'active' THEN reason := 'account_closed'; END IF;
  IF reason IS NULL AND fa.id IS NULL THEN reason := 'account_unlinked'; END IF;
  IF reason IS NULL AND fa.account_status <> 'active' THEN reason := 'account_frozen'; END IF;
  IF reason IS NULL AND COALESCE(ba.withdrawal_restrictions, '{}'::jsonb) ? 'withdrawals_disabled' AND COALESCE((ba.withdrawal_restrictions->>'withdrawals_disabled')::boolean, false) THEN reason := 'withdrawals_disabled'; END IF;
  IF reason IS NULL AND COALESCE(ba.withdrawal_restrictions, '{}'::jsonb) ? 'under_review' AND COALESCE((ba.withdrawal_restrictions->>'under_review')::boolean, false) THEN reason := 'account_under_review'; END IF;
  IF reason IS NULL AND p_currency_code IS NOT NULL AND ba.currency_code <> p_currency_code THEN reason := 'currency_mismatch'; END IF;
  IF reason IS NULL AND p_amount_minor IS NOT NULL AND fa.available_balance_minor < p_amount_minor THEN reason := 'insufficient_available_balance'; END IF;
  RETURN jsonb_build_object('eligible', reason IS NULL, 'reason', reason);
END $$;

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
  SELECT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id=p_band_id AND bm.profile_id=pid AND COALESCE(bm.member_status,'active')='active') INTO active_member;
  IF NOT active_member THEN
    RETURN jsonb_build_object('status','not_band_member','accounts','[]'::jsonb,'message','Active band membership is required.');
  END IF;
  SELECT count(*) INTO personal_count FROM public.bank_accounts ba WHERE ba.owner_type='player' AND ba.owner_id=pid;
  SELECT count(*) INTO mismatch_count FROM public.bank_accounts ba WHERE ba.owner_type='player' AND ba.owner_id=pid AND ba.status='active' AND p_currency_code IS NOT NULL AND ba.currency_code<>p_currency_code;
  WITH candidates AS (
    SELECT ba.*, fa.current_balance_minor, fa.available_balance_minor, fa.is_primary, bp.brand_name,
           public.is_bank_account_eligible_for_outgoing_payment(ba.id, NULL, p_currency_code) AS eligibility
    FROM public.bank_accounts ba
    JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id
    LEFT JOIN public.banking_providers bp ON bp.id=ba.provider_id
    WHERE ba.owner_type='player' AND ba.owner_id=pid
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'displayName', COALESCE(NULLIF(metadata->>'display_name',''), initcap(replace(account_type::text, '_', ' ')) || ' Account'),
    'providerName', COALESCE(brand_name, 'Bank account'),
    'accountType', account_type,
    'maskedAccountNumber', COALESCE(NULLIF(metadata->>'masked_account_number',''), NULLIF(metadata->>'account_mask',''), '•••• ' || right(id::text, 4)),
    'currencyCode', currency_code,
    'currentBalanceMinor', current_balance_minor,
    'availableBalanceMinor', available_balance_minor,
    'isPrimary', COALESCE(is_primary, false),
    'eligible', (eligibility->>'eligible')::boolean,
    'ineligibleReason', eligibility->>'reason'
  ) ORDER BY COALESCE(is_primary,false) DESC, opened_at NULLS LAST, created_at) FILTER (WHERE (eligibility->>'eligible')::boolean), '[]'::jsonb),
  count(*) FILTER (WHERE (eligibility->>'eligible')::boolean)
  INTO accounts, eligible_count
  FROM candidates;
  RETURN jsonb_build_object('status', CASE WHEN personal_count=0 THEN 'no_personal_accounts' WHEN eligible_count=0 AND mismatch_count>0 THEN 'currency_mismatch' WHEN eligible_count=0 THEN 'no_eligible_accounts' ELSE 'ok' END, 'accounts', accounts, 'message', CASE WHEN personal_count=0 THEN 'No personal bank accounts were found.' WHEN eligible_count=0 AND mismatch_count>0 THEN 'No personal accounts match the requested treasury currency.' WHEN eligible_count=0 THEN 'No eligible active personal accounts were found.' ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.get_band_treasury_dashboard(p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_player_profile_id();
  primary_currency char(3);
  can_view boolean;
  can_detail boolean;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  can_view := public.user_has_band_finance_permission(p_band_id,pid,'view_band_balance'::public.band_finance_permission);
  can_detail := public.user_has_band_finance_permission(p_band_id,pid,'view_transaction_history'::public.band_finance_permission);
  IF NOT can_view THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT COALESCE((metadata->>'primary_operating_currency')::char(3), (SELECT default_currency_code FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND account_status='active' ORDER BY is_primary DESC, created_at LIMIT 1), 'GBP'::char(3)) INTO primary_currency FROM public.bands WHERE id=p_band_id;
  RETURN jsonb_build_object(
    'primaryCurrencyCode', primary_currency,
    'treasuries', COALESCE((SELECT jsonb_agg(jsonb_build_object('accountId',id,'currencyCode',default_currency_code,'currentBalanceMinor',current_balance_minor,'reservedBalanceMinor',reserved_balance_minor,'availableBalanceMinor',available_balance_minor,'isPrimary',COALESCE(is_primary,false)) ORDER BY (default_currency_code=primary_currency) DESC, default_currency_code) FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND account_status='active'),'[]'::jsonb),
    'recentTransactions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'transactionCategory',t.transaction_category,'amountMinor',t.net_amount_minor,'currencyCode',t.currency_code,'description',t.description,'createdAt',t.created_at) ORDER BY t.created_at DESC) FROM (SELECT DISTINCT t.* FROM public.financial_transactions t JOIN public.financial_ledger_entries le ON le.transaction_id=t.id JOIN public.financial_accounts fa ON fa.id=le.account_id WHERE fa.owner_type='band' AND fa.owner_id=p_band_id ORDER BY t.created_at DESC LIMIT 25) t),'[]'::jsonb),
    'contributions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'amountMinor',c.amount_minor,'currencyCode',c.currency_code,'contributionType',c.contribution_type,'refundableStatus',c.refundable_status,'notes',c.notes,'createdAt',c.created_at,'contributorDisplayName',COALESCE(p.display_name,p.username,'Band member'),'contributorAvatarUrl',p.avatar_url) ORDER BY c.created_at DESC) FROM public.band_financial_contributions c LEFT JOIN public.profiles p ON p.id=c.contributing_player_id WHERE c.band_id=p_band_id AND (can_detail OR c.contributing_player_id=pid) LIMIT 25),'[]'::jsonb),
    'upcomingObligations','[]'::jsonb,
    'reconciliation', jsonb_build_object('status','clean','exceptions','[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.preview_my_band_contribution(p_band_id uuid,p_bank_account_id uuid,p_amount_minor bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pid uuid:=public.current_player_profile_id(); ba public.bank_accounts; fa public.financial_accounts; treasury public.financial_accounts; eligibility jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id;
  IF ba.owner_type <> 'player' OR ba.owner_id <> pid THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id;
  SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND default_currency_code=ba.currency_code AND account_status='active' ORDER BY is_primary DESC, created_at LIMIT 1;
  IF treasury.id IS NULL THEN RAISE EXCEPTION 'band_treasury_missing'; END IF;
  eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code);
  RETURN jsonb_build_object('sourceAccountDisplay',COALESCE(NULLIF(ba.metadata->>'display_name',''),'Personal account') || ' ' || COALESCE(NULLIF(ba.metadata->>'masked_account_number',''),'•••• ' || right(ba.id::text,4)),'currencyCode',ba.currency_code,'currentPersonalBalanceMinor',fa.available_balance_minor,'amountMinor',p_amount_minor,'resultingPersonalBalanceMinor',fa.available_balance_minor-p_amount_minor,'destinationTreasuryName',treasury.account_name,'currentTreasuryBalanceMinor',treasury.available_balance_minor,'resultingTreasuryBalanceMinor',treasury.available_balance_minor+p_amount_minor,'eligible',(eligibility->>'eligible')::boolean,'ineligibleReason',eligibility->>'reason','warningText','This contribution is not automatically repayable and does not grant additional band ownership or voting rights.');
END $$;

CREATE OR REPLACE FUNCTION public.contribute_my_personal_funds_to_band(p_band_id uuid,p_bank_account_id uuid,p_amount_minor bigint,p_note text DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); ba public.bank_accounts; fa public.financial_accounts; eligibility jsonb; day_total bigint; BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF p_amount_minor > 100000000 THEN RAISE EXCEPTION 'maximum_transaction_amount_exceeded'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;
  SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id FOR UPDATE;
  SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE;
  IF ba.id IS NULL OR ba.owner_type<>'player' OR ba.owner_id<>pid THEN RAISE EXCEPTION 'personal_account_invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'not_band_member'; END IF;
  eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code);
  IF NOT (eligibility->>'eligible')::boolean THEN RAISE EXCEPTION '%', eligibility->>'reason'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO day_total FROM public.band_financial_contributions WHERE contributing_player_id=pid AND created_at>=date_trunc('day',timezone('utc',now())) AND contribution_type='voluntary_deposit';
  IF day_total+p_amount_minor>500000000 THEN RAISE EXCEPTION 'daily_contribution_limit_exceeded'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND default_currency_code=ba.currency_code AND account_status='active') THEN RAISE EXCEPTION 'band_treasury_missing'; END IF;
  RETURN public.contribute_personal_funds_to_band(p_band_id,p_bank_account_id,p_amount_minor,p_idempotency_key,p_note);
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid,uuid,bigint,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contribute_my_personal_funds_to_band(uuid,uuid,bigint,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_my_band_contribution(uuid,uuid,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) TO authenticated, service_role;
