-- Canonical character banking and band funding.  All browser entry points below
-- derive the selected character and move money through balanced journal rows.

CREATE OR REPLACE FUNCTION public._move_financial_account_money(
  p_source uuid, p_destination uuid, p_amount bigint,
  p_category public.financial_transaction_category, p_description text,
  p_key text, p_profile uuid, p_related_type text DEFAULT NULL,
  p_related_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.financial_accounts; d public.financial_accounts; tx uuid; existing public.financial_transactions;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF p_key IS NULL OR length(trim(p_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;
  SELECT * INTO existing FROM public.financial_transactions WHERE idempotency_key=p_key;
  IF existing.id IS NOT NULL THEN
    IF existing.source_account_id<>p_source OR existing.destination_account_id<>p_destination OR existing.net_amount_minor<>p_amount THEN RAISE EXCEPTION 'idempotency_key_conflict'; END IF;
    RETURN existing.id;
  END IF;
  -- Deterministic locking avoids account-transfer deadlocks.
  PERFORM 1 FROM public.financial_accounts WHERE id IN (p_source,p_destination) ORDER BY id FOR UPDATE;
  SELECT * INTO s FROM public.financial_accounts WHERE id=p_source;
  SELECT * INTO d FROM public.financial_accounts WHERE id=p_destination;
  IF s.id IS NULL OR d.id IS NULL OR s.id=d.id THEN RAISE EXCEPTION 'account_invalid'; END IF;
  IF s.account_status<>'active' OR d.account_status<>'active' THEN RAISE EXCEPTION 'account_not_active'; END IF;
  IF COALESCE(s.currency_code,s.default_currency_code)<>COALESCE(d.currency_code,d.default_currency_code) THEN RAISE EXCEPTION 'currency_mismatch_no_conversion'; END IF;
  IF s.available_balance_minor<p_amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,metadata)
  VALUES(p_category,'completed',COALESCE(s.currency_code,s.default_currency_code),p_amount,p_amount,s.id,d.id,p_related_type,p_related_id,p_description,p_key,auth.uid(),p_profile,COALESCE(auth.uid()::text,'system'),now(),p_metadata) RETURNING id INTO tx;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-p_amount,updated_at=now() WHERE id=s.id;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+p_amount,updated_at=now() WHERE id=d.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor) VALUES
    (tx,s.id,'debit',p_amount,s.current_balance_minor,s.current_balance_minor-p_amount),
    (tx,d.id,'credit',p_amount,d.current_balance_minor,d.current_balance_minor+p_amount);
  RETURN tx;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_band_funding_sources(p_band_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); sources jsonb;
BEGIN
 IF pid IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'not_band_member'; END IF;
 IF NOT public.user_has_band_finance_permission(p_band_id,pid,'make_voluntary_contributions'::public.band_finance_permission) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 SELECT COALESCE(jsonb_agg(x ORDER BY x->>'sourceKind',x->>'displayName'),'[]') INTO sources FROM (
   SELECT jsonb_build_object('sourceKind','wallet','sourceAccountId',NULL,'displayName','Character wallet','accountType','wallet','currencyCode',COALESCE(currency_code,default_currency_code),'availableBalanceMinor',available_balance_minor,'eligible',account_status='active','ineligibleReason',CASE WHEN account_status<>'active' THEN 'Wallet is unavailable' END) x
   FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary
   UNION ALL
   SELECT jsonb_build_object('sourceKind','bank','sourceAccountId',ba.id,'displayName',COALESCE(NULLIF(ba.metadata->>'display_name',''),initcap(replace(ba.account_type::text,'_',' '))||' account'),'accountType',ba.account_type,'currencyCode',ba.currency_code,'availableBalanceMinor',fa.available_balance_minor,'eligible',COALESCE((e.v->>'eligible')::boolean,false),'ineligibleReason',e.v->>'reason')
   FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id CROSS JOIN LATERAL (SELECT public.is_bank_account_eligible_for_outgoing_payment(ba.id,NULL,ba.currency_code) v)e WHERE ba.owner_type='player' AND ba.owner_id=pid
 ) q;
 RETURN jsonb_build_object('status','ok','sources',sources);
END $$;

CREATE OR REPLACE FUNCTION public.preview_my_band_funding(p_band_id uuid,p_source_kind text,p_source_account_id uuid,p_amount_minor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); src public.financial_accounts; ba public.bank_accounts; treasury public.financial_accounts;
BEGIN
 IF p_amount_minor IS NULL OR p_amount_minor<=0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
 PERFORM public.get_my_band_funding_sources(p_band_id);
 IF p_source_kind='wallet' THEN SELECT * INTO src FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary; IF mod(p_amount_minor,100)<>0 THEN RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units'; END IF;
 ELSIF p_source_kind='bank' THEN SELECT * INTO ba FROM public.bank_accounts WHERE id=p_source_account_id AND owner_type='player' AND owner_id=pid; SELECT * INTO src FROM public.financial_accounts WHERE id=ba.linked_finance_account_id;
 ELSE RAISE EXCEPTION 'source_kind_invalid'; END IF;
 IF src.id IS NULL OR src.account_status<>'active' OR src.available_balance_minor<p_amount_minor THEN RAISE EXCEPTION 'source_unavailable_or_insufficient_funds'; END IF;
 IF p_source_kind='bank' AND NOT COALESCE((public.is_bank_account_eligible_for_outgoing_payment(ba.id,p_amount_minor,ba.currency_code)->>'eligible')::boolean,false) THEN RAISE EXCEPTION 'source_account_ineligible'; END IF;
 SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND metadata->>'account_role'='band_treasury' AND account_status='active' AND COALESCE(currency_code,default_currency_code)=COALESCE(src.currency_code,src.default_currency_code) ORDER BY created_at LIMIT 1;
 RETURN jsonb_build_object('sourceDisplay',CASE WHEN p_source_kind='wallet' THEN 'Character wallet' ELSE COALESCE(ba.metadata->>'display_name','Bank account') END,'currencyCode',COALESCE(src.currency_code,src.default_currency_code),'sourceBalanceMinor',src.available_balance_minor,'amountMinor',p_amount_minor,'resultingSourceBalanceMinor',src.available_balance_minor-p_amount_minor,'treasuryBalanceMinor',COALESCE(treasury.current_balance_minor,0),'resultingTreasuryBalanceMinor',COALESCE(treasury.current_balance_minor,0)+p_amount_minor,'treasuryWillBeCreated',treasury.id IS NULL);
END $$;

CREATE OR REPLACE FUNCTION public.fund_my_band(p_band_id uuid,p_source_kind text,p_source_account_id uuid,p_amount_minor bigint,p_note text,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); src public.financial_accounts; ba public.bank_accounts; treasury public.financial_accounts; tx uuid; contribution uuid; currency char(3); existing public.band_financial_contributions;
BEGIN
 PERFORM public.preview_my_band_funding(p_band_id,p_source_kind,p_source_account_id,p_amount_minor);
 SELECT * INTO existing FROM public.band_financial_contributions WHERE idempotency_key=p_idempotency_key;
 IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('contributionId',existing.id,'transactionId',existing.transaction_id,'sourceBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=existing.source_player_account_id),'treasuryBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=existing.destination_band_treasury_account_id)); END IF;
 IF p_source_kind='wallet' THEN SELECT * INTO src FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary FOR UPDATE;
 ELSE SELECT * INTO ba FROM public.bank_accounts WHERE id=p_source_account_id AND owner_id=pid FOR UPDATE; SELECT * INTO src FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE; END IF;
 currency:=COALESCE(src.currency_code,src.default_currency_code);
 SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND metadata->>'account_role'='band_treasury' AND account_status='active' AND COALESCE(currency_code,default_currency_code)=currency ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF treasury.id IS NULL THEN INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,account_status,default_currency_code,currency_code,is_primary,metadata) VALUES('band',p_band_id,'Band treasury ('||currency||')','active',currency,currency,false,jsonb_build_object('account_role','band_treasury','classification','capital')) RETURNING * INTO treasury; END IF;
 tx:=public._move_financial_account_money(src.id,treasury.id,p_amount_minor,'band_contribution','Member capital contribution',p_idempotency_key,pid,'band',p_band_id,jsonb_build_object('source_kind',p_source_kind,'classification','capital_contribution','commercial_revenue',false));
 INSERT INTO public.band_financial_contributions(band_id,contributing_player_id,source_player_account_id,destination_band_treasury_account_id,amount_minor,currency_code,contribution_type,transaction_id,idempotency_key,notes)
 VALUES(p_band_id,pid,src.id,treasury.id,p_amount_minor,currency,'voluntary_deposit',tx,p_idempotency_key,NULLIF(trim(p_note),'')) RETURNING id INTO contribution;
 IF p_source_kind='wallet' THEN UPDATE public.profiles SET cash=(SELECT current_balance_minor/100 FROM public.financial_accounts WHERE id=src.id) WHERE id=pid; END IF;
 -- Compatibility only: the legacy scalar projects the primary treasury currency.
 UPDATE public.bands SET band_balance=COALESCE((SELECT current_balance_minor/100 FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND metadata->>'account_role'='band_treasury' ORDER BY is_primary DESC,created_at LIMIT 1),0) WHERE id=p_band_id;
 RETURN jsonb_build_object('contributionId',contribution,'transactionId',tx,'sourceBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=src.id),'treasuryBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=treasury.id),'currencyCode',currency);
END $$;

-- Repair the unsafe cash reconciliation with explicit system-funded journals.
DO $$ DECLARE r record; ledger_balance bigint; desired bigint; tx uuid; BEGIN
 FOR r IN SELECT p.id,p.cash,fa.id account_id,fa.current_balance_minor FROM public.profiles p JOIN public.financial_accounts fa ON fa.owner_type='player' AND fa.owner_id=p.id AND fa.is_primary LOOP
   SELECT COALESCE(sum(CASE WHEN entry_direction='credit' THEN amount_minor ELSE -amount_minor END),0) INTO ledger_balance FROM public.financial_ledger_entries WHERE account_id=r.account_id;
   desired:=COALESCE(r.cash,0)::bigint*100;
   -- Preserve the player-visible balance; first make the stored account match its ledger, then journal the visible delta.
   UPDATE public.financial_accounts SET current_balance_minor=ledger_balance WHERE id=r.account_id AND current_balance_minor<>ledger_balance;
   IF desired>ledger_balance THEN PERFORM public.finance_credit_owner('player',r.id,desired-ledger_balance,'administrative_adjustment','Wallet reconciliation','canonical-wallet-reconcile-'||r.id,r.id,jsonb_build_object('reconciliation',true));
   ELSIF desired<ledger_balance THEN PERFORM public.finance_debit_owner('player',r.id,ledger_balance-desired,'administrative_adjustment','Wallet reconciliation','canonical-wallet-reconcile-'||r.id,r.id,jsonb_build_object('reconciliation',true)); END IF;
 END LOOP;
END $$;

CREATE OR REPLACE VIEW public.wallet_and_treasury_projection_integrity_issues AS
SELECT 'wallet_projection_mismatch' issue_type,p.id subject_id,p.cash::bigint*100 projection_minor,fa.current_balance_minor canonical_minor FROM public.profiles p JOIN public.financial_accounts fa ON fa.owner_type='player' AND fa.owner_id=p.id AND fa.is_primary WHERE p.cash::bigint*100<>fa.current_balance_minor
UNION ALL
SELECT 'band_projection_mismatch',b.id,b.band_balance::bigint*100,fa.current_balance_minor FROM public.bands b JOIN LATERAL(SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='band' AND owner_id=b.id AND metadata->>'account_role'='band_treasury' ORDER BY is_primary DESC,created_at LIMIT 1)fa ON true WHERE b.band_balance::bigint*100<>fa.current_balance_minor;

REVOKE EXECUTE ON FUNCTION public.create_bank_account(text,text,bigint,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_deposit_from_cash(uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_withdraw_to_cash(uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_transfer(uuid,uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deposit_to_band_treasury(uuid,uuid,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._move_financial_account_money(uuid,uuid,bigint,public.financial_transaction_category,text,text,uuid,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_my_bank_account(p_account_type public.bank_account_type,p_nickname text,p_initial_amount_minor bigint,p_term_months integer,p_currency_code char(3),p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); wallet public.financial_accounts; provider uuid; fa uuid; ba uuid; tx uuid; restrictions jsonb:='{}';
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;
  IF p_currency_code IS NULL OR p_currency_code !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'currency_invalid'; END IF;
  IF COALESCE(p_initial_amount_minor,0)<0 OR mod(COALESCE(p_initial_amount_minor,0),100)<>0 THEN RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units'; END IF;
  SELECT id INTO ba FROM public.bank_accounts WHERE metadata->>'opening_idempotency_key'=p_idempotency_key AND owner_id=pid;
  IF ba IS NOT NULL THEN RETURN (SELECT jsonb_build_object('accountId',bx.id,'balanceMinor',fx.current_balance_minor) FROM public.bank_accounts bx JOIN public.financial_accounts fx ON fx.id=bx.linked_finance_account_id WHERE bx.id=ba); END IF;
  SELECT * INTO wallet FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary AND COALESCE(currency_code,default_currency_code)=p_currency_code FOR UPDATE;
  IF wallet.id IS NULL THEN RAISE EXCEPTION 'wallet_currency_mismatch'; END IF;
  SELECT id INTO provider FROM public.banking_providers WHERE status='active' AND p_currency_code=ANY(supported_currencies) ORDER BY provider_code LIMIT 1;
  IF provider IS NULL THEN RAISE EXCEPTION 'banking_provider_unavailable'; END IF;
  IF p_account_type='fixed_deposit' THEN
    IF COALESCE(p_term_months,0)<=0 THEN RAISE EXCEPTION 'fixed_deposit_term_required'; END IF;
    restrictions:=jsonb_build_object('locked_until',(CURRENT_DATE+make_interval(months=>p_term_months))::text);
  END IF;
  INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,account_status,current_balance_minor,default_currency_code,currency_code,is_primary,metadata)
  VALUES('player',pid,COALESCE(NULLIF(trim(p_nickname),''),initcap(replace(p_account_type::text,'_',' '))||' account'),'active',0,p_currency_code,p_currency_code,false,jsonb_build_object('account_role','bank_deposit','display_name',NULLIF(trim(p_nickname),''))) RETURNING id INTO fa;
  INSERT INTO public.bank_accounts(provider_id,owner_type,owner_id,linked_finance_account_id,account_type,currency_code,status,opened_at,withdrawal_restrictions,metadata)
  VALUES(provider,'player',pid,fa,p_account_type,p_currency_code,'active',now(),restrictions,jsonb_build_object('display_name',NULLIF(trim(p_nickname),''),'opening_idempotency_key',p_idempotency_key)) RETURNING id INTO ba;
  IF p_initial_amount_minor>0 THEN tx:=public._move_financial_account_money(wallet.id,fa,p_initial_amount_minor,'administrative_adjustment','Wallet opening deposit',p_idempotency_key||':deposit',pid,'bank_account',ba,jsonb_build_object('classification','transfer')); END IF;
  UPDATE public.profiles SET cash=(wallet.current_balance_minor-COALESCE(p_initial_amount_minor,0))/100 WHERE id=pid;
  RETURN jsonb_build_object('accountId',ba,'transactionId',tx,'walletBalanceMinor',wallet.current_balance_minor-COALESCE(p_initial_amount_minor,0),'balanceMinor',COALESCE(p_initial_amount_minor,0));
END $$;

CREATE OR REPLACE FUNCTION public.deposit_my_wallet_to_bank(p_bank_account_id uuid,p_amount_minor bigint,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); ba public.bank_accounts; wallet public.financial_accounts; bank public.financial_accounts; tx uuid;
BEGIN
 IF mod(COALESCE(p_amount_minor,0),100)<>0 THEN RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units'; END IF;
 SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id AND owner_type='player' AND owner_id=pid FOR UPDATE;
 IF ba.id IS NULL OR ba.status<>'active' OR ba.deposit_restrictions<>'{}'::jsonb THEN RAISE EXCEPTION 'bank_account_cannot_receive_deposit'; END IF;
 SELECT * INTO bank FROM public.financial_accounts WHERE id=ba.linked_finance_account_id;
 SELECT * INTO wallet FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary AND COALESCE(currency_code,default_currency_code)=ba.currency_code;
 tx:=public._move_financial_account_money(wallet.id,bank.id,p_amount_minor,'administrative_adjustment','Wallet to bank',p_idempotency_key,pid,'bank_account',ba.id,jsonb_build_object('classification','transfer'));
 SELECT * INTO wallet FROM public.financial_accounts WHERE id=wallet.id; UPDATE public.profiles SET cash=wallet.current_balance_minor/100 WHERE id=pid;
 RETURN jsonb_build_object('transactionId',tx,'walletBalanceMinor',wallet.current_balance_minor,'bankBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=bank.id));
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_my_bank_to_wallet(p_bank_account_id uuid,p_amount_minor bigint,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); ba public.bank_accounts; wallet public.financial_accounts; bank public.financial_accounts; eligibility jsonb; tx uuid;
BEGIN
 IF mod(COALESCE(p_amount_minor,0),100)<>0 THEN RAISE EXCEPTION 'wallet_amount_must_be_whole_major_units'; END IF;
 SELECT * INTO ba FROM public.bank_accounts WHERE id=p_bank_account_id AND owner_type='player' AND owner_id=pid FOR UPDATE;
 eligibility:=public.is_bank_account_eligible_for_outgoing_payment(p_bank_account_id,p_amount_minor,ba.currency_code); IF ba.id IS NULL OR NOT COALESCE((eligibility->>'eligible')::boolean,false) THEN RAISE EXCEPTION 'bank_account_cannot_withdraw'; END IF;
 SELECT * INTO bank FROM public.financial_accounts WHERE id=ba.linked_finance_account_id; SELECT * INTO wallet FROM public.financial_accounts WHERE owner_type='player' AND owner_id=pid AND is_primary AND COALESCE(currency_code,default_currency_code)=ba.currency_code;
 tx:=public._move_financial_account_money(bank.id,wallet.id,p_amount_minor,'administrative_adjustment','Bank to wallet',p_idempotency_key,pid,'bank_account',ba.id,jsonb_build_object('classification','transfer'));
 SELECT * INTO wallet FROM public.financial_accounts WHERE id=wallet.id; UPDATE public.profiles SET cash=wallet.current_balance_minor/100 WHERE id=pid;
 RETURN jsonb_build_object('transactionId',tx,'walletBalanceMinor',wallet.current_balance_minor,'bankBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=bank.id));
END $$;

CREATE OR REPLACE FUNCTION public.transfer_between_my_bank_accounts(p_source_bank_account_id uuid,p_destination_bank_account_id uuid,p_amount_minor bigint,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_active_player_profile_id(); s public.bank_accounts; d public.bank_accounts; tx uuid;
BEGIN
 SELECT * INTO s FROM public.bank_accounts WHERE id=p_source_bank_account_id AND owner_type='player' AND owner_id=pid FOR UPDATE;
 SELECT * INTO d FROM public.bank_accounts WHERE id=p_destination_bank_account_id AND owner_type='player' AND owner_id=pid FOR UPDATE;
 IF s.id IS NULL OR d.id IS NULL OR s.status<>'active' OR d.status<>'active' OR s.currency_code<>d.currency_code THEN RAISE EXCEPTION 'bank_transfer_accounts_invalid_or_currency_mismatch'; END IF;
 IF NOT COALESCE((public.is_bank_account_eligible_for_outgoing_payment(s.id,p_amount_minor,s.currency_code)->>'eligible')::boolean,false) THEN RAISE EXCEPTION 'source_account_cannot_transfer'; END IF;
 tx:=public._move_financial_account_money(s.linked_finance_account_id,d.linked_finance_account_id,p_amount_minor,'administrative_adjustment','Bank account transfer',p_idempotency_key,pid,'bank_account',d.id,jsonb_build_object('classification','transfer'));
 RETURN jsonb_build_object('transactionId',tx,'sourceBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=s.linked_finance_account_id),'destinationBalanceMinor',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=d.linked_finance_account_id));
END $$;

GRANT EXECUTE ON FUNCTION public.open_my_bank_account(public.bank_account_type,text,bigint,integer,char(3),text),public.deposit_my_wallet_to_bank(uuid,bigint,text),public.withdraw_my_bank_to_wallet(uuid,bigint,text),public.transfer_between_my_bank_accounts(uuid,uuid,bigint,text),public.get_my_band_funding_sources(uuid),public.preview_my_band_funding(uuid,text,uuid,bigint),public.fund_my_band(uuid,text,uuid,bigint,text,text) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
