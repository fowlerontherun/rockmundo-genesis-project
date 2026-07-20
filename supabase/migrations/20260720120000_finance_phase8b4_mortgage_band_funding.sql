-- Finance Phase 8B.4: repair mortgage posting and add ledger-backed band funding primitives.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_redemption';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_principal_repayment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_deposit_release';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'property_purchase_settlement';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_origination';

ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS allow_negative_balance boolean NOT NULL DEFAULT false;
ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_balances_nonnegative;
ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_balances_nonnegative CHECK (
  (current_balance_minor >= 0 OR allow_negative_balance = true)
  AND reserved_balance_minor >= 0
  AND (reserved_balance_minor <= current_balance_minor OR allow_negative_balance = true)
);

ALTER TABLE public.banking_provider_financial_accounts DROP CONSTRAINT IF EXISTS banking_provider_financial_accounts_account_role_check;
ALTER TABLE public.banking_provider_financial_accounts ADD CONSTRAINT banking_provider_financial_accounts_account_role_check CHECK (account_role IN ('lending_funding','loan_receivable','interest_income','fee_income','loss_write_off','interest_expense','settlement_clearing','provider_equity','mortgage_funding_cash','mortgage_receivable','mortgage_interest_income','mortgage_fee_income','mortgage_settlement_clearing','mortgage_repayment_cash','mortgage_origination_clearing','mortgage_credit_loss_expense'));

CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_one_band_treasury_per_currency
  ON public.financial_accounts(owner_type, owner_id, currency_code)
  WHERE owner_type='band' AND account_status='active' AND metadata->>'account_role'='band_treasury';

CREATE TABLE IF NOT EXISTS public.band_financial_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  contributing_player_id uuid NOT NULL REFERENCES public.profiles(id),
  source_player_account_id uuid REFERENCES public.financial_accounts(id),
  destination_band_treasury_account_id uuid REFERENCES public.financial_accounts(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code char(3) NOT NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id),
  contribution_type text NOT NULL CHECK (contribution_type IN ('voluntary_deposit','expense_shortfall','full_expense_payment','refund','admin_adjustment')),
  related_expense_type text,
  related_expense_id uuid,
  refundable_status text NOT NULL DEFAULT 'not_refundable',
  notes text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.band_financial_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS band_financial_contributions_member_select ON public.band_financial_contributions;
CREATE POLICY band_financial_contributions_member_select ON public.band_financial_contributions FOR SELECT USING (
  contributing_player_id = public.current_player_profile_id()
  OR public.user_has_band_finance_permission(band_id, public.current_player_profile_id(), 'view_transaction_history')
);

CREATE TABLE IF NOT EXISTS public.band_expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  expense_type text NOT NULL, expense_id uuid, destination_account_id uuid REFERENCES public.financial_accounts(id),
  total_amount_minor bigint NOT NULL CHECK(total_amount_minor>0), currency_code char(3) NOT NULL,
  status text NOT NULL DEFAULT 'completed', initiating_player_id uuid REFERENCES public.profiles(id), idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);
CREATE TABLE IF NOT EXISTS public.band_expense_payment_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES public.band_expense_payments(id) ON DELETE CASCADE,
  component_type text NOT NULL CHECK(component_type IN ('band_treasury','personal_player')),
  source_account_id uuid NOT NULL REFERENCES public.financial_accounts(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
  transaction_id uuid REFERENCES public.financial_transactions(id), contributor_player_id uuid REFERENCES public.profiles(id), contribution_id uuid REFERENCES public.band_financial_contributions(id), created_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);

CREATE TABLE IF NOT EXISTS public.band_finance_reconciliation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exception_type text NOT NULL, band_id uuid REFERENCES public.bands(id), related_entity_type text, related_entity_id uuid, amount_minor bigint, details jsonb NOT NULL DEFAULT '{}'::jsonb, detected_at timestamptz NOT NULL DEFAULT timezone('utc',now()), resolved_at timestamptz
);

CREATE OR REPLACE FUNCTION public.get_or_create_band_treasury_account(p_band_id uuid, p_currency_code char(3) DEFAULT 'GBP') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acct uuid;
BEGIN
  IF p_band_id IS NULL THEN RAISE EXCEPTION 'band id required'; END IF;
  SELECT id INTO acct FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND currency_code=p_currency_code AND account_status='active' AND metadata->>'account_role'='band_treasury' ORDER BY is_primary DESC, created_at LIMIT 1;
  IF acct IS NULL THEN
    INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,currency_code,default_currency_code,current_balance_minor,is_primary,account_status,metadata)
    VALUES('band',p_band_id,'Band treasury',p_currency_code,p_currency_code,0,false,'active',jsonb_build_object('account_role','band_treasury','phase','8B.4')) RETURNING id INTO acct;
  END IF;
  RETURN acct;
END $$;

CREATE OR REPLACE FUNCTION public.post_financial_journal(
  p_event_type public.financial_transaction_category, p_event_id uuid, p_currency_code char(3), p_idempotency_key text, p_entries jsonb,
  p_related_entity_type text DEFAULT NULL, p_related_entity_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tx uuid; debit_total bigint; credit_total bigint; gross bigint; r record; acct public.financial_accounts; before_bal bigint;
BEGIN
  IF auth.role() IN ('anon','authenticated') AND COALESCE((p_metadata->>'trusted_finance_workflow')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'service role or trusted finance workflow required' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key)=0 THEN RAISE EXCEPTION 'idempotency key required'; END IF;
  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key=p_idempotency_key; IF tx IS NOT NULL THEN RETURN tx; END IF;
  IF jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries)<2 THEN RAISE EXCEPTION 'journal requires at least two entries'; END IF;
  SELECT COALESCE(sum(CASE WHEN value->>'direction'='debit' THEN (value->>'amount_minor')::bigint ELSE 0 END),0), COALESCE(sum(CASE WHEN value->>'direction'='credit' THEN (value->>'amount_minor')::bigint ELSE 0 END),0) INTO debit_total, credit_total FROM jsonb_array_elements(p_entries);
  IF debit_total<=0 OR debit_total<>credit_total THEN RAISE EXCEPTION 'journal debits and credits must balance'; END IF; gross:=debit_total;
  PERFORM 1 FROM public.financial_accounts fa JOIN (SELECT DISTINCT (value->>'account_id')::uuid id FROM jsonb_array_elements(p_entries)) e ON e.id=fa.id ORDER BY fa.id FOR UPDATE;
  FOR r IN SELECT value->>'account_id' account_id, value->>'direction' direction, (value->>'amount_minor')::bigint amount_minor FROM jsonb_array_elements(p_entries) LOOP
    IF r.amount_minor<=0 THEN RAISE EXCEPTION 'journal amounts must be positive'; END IF; IF r.direction NOT IN ('debit','credit') THEN RAISE EXCEPTION 'journal direction must be debit or credit'; END IF;
    SELECT * INTO acct FROM public.financial_accounts WHERE id=r.account_id::uuid;
    IF acct.id IS NULL THEN RAISE EXCEPTION 'journal account not found'; END IF; IF acct.account_status<>'active' THEN RAISE EXCEPTION 'journal account is not active'; END IF; IF acct.currency_code<>p_currency_code THEN RAISE EXCEPTION 'journal account currency mismatch'; END IF;
    IF r.direction='debit' AND acct.available_balance_minor<r.amount_minor AND NOT acct.allow_negative_balance THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  END LOOP;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,metadata)
  VALUES(p_event_type,'completed',p_currency_code,gross,gross,(SELECT (value->>'account_id')::uuid FROM jsonb_array_elements(p_entries) WHERE value->>'direction'='debit' LIMIT 1),(SELECT (value->>'account_id')::uuid FROM jsonb_array_elements(p_entries) WHERE value->>'direction'='credit' LIMIT 1),p_related_entity_type,p_related_entity_id,p_event_type::text,p_idempotency_key,auth.uid(),COALESCE(auth.uid()::text,'system'),timezone('utc',now()),p_currency_code,p_currency_code,gross,gross,p_metadata||jsonb_build_object('journal_event_id',p_event_id,'journal_entries',p_entries)) RETURNING id INTO tx;
  FOR r IN SELECT value->>'account_id' account_id, value->>'direction' direction, (value->>'amount_minor')::bigint amount_minor FROM jsonb_array_elements(p_entries) LOOP
    SELECT current_balance_minor INTO before_bal FROM public.financial_accounts WHERE id=r.account_id::uuid FOR UPDATE;
    UPDATE public.financial_accounts SET current_balance_minor=CASE WHEN r.direction='debit' THEN current_balance_minor-r.amount_minor ELSE current_balance_minor+r.amount_minor END, updated_at=timezone('utc',now()) WHERE id=r.account_id::uuid;
    INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES(tx,r.account_id::uuid,r.direction::public.financial_entry_direction,r.amount_minor,before_bal,CASE WHEN r.direction='debit' THEN before_bal-r.amount_minor ELSE before_bal+r.amount_minor END,p_currency_code);
  END LOOP;
  RETURN tx;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_financial_journal(public.financial_transaction_category,uuid,char(3),text,jsonb,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_financial_journal(public.financial_transaction_category,uuid,char(3),text,jsonb,text,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_development_mortgage_provider(p_currency_code char(3) DEFAULT 'GBP') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bp uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
  SELECT id INTO bp FROM public.banking_providers WHERE provider_code='aurora_international';
  IF bp IS NULL THEN RAISE EXCEPTION 'development mortgage provider fixture must be loaded from local seed/admin setup, not production migrations'; END IF;
  RETURN bp;
END $$;

UPDATE public.mortgage_products SET min_term_months=60 WHERE min_term_months < 60;

CREATE OR REPLACE FUNCTION public.complete_mortgaged_property_purchase(p_offer_id uuid,p_deposit_bank_account_id uuid,p_repayment_bank_account_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; prop public.properties; res public.property_reservations; dep public.property_deposits; dep_ba public.bank_accounts; repay_ba public.bank_accounts; repay_fa uuid; accounts jsonb; funding uuid; receivable uuid; equity uuid; seller uuid; contract_id uuid; deposit_tx uuid; orig_tx uuid; principal_tx uuid; i int; bal bigint; int_due bigint; prin_due bigint; monthly bigint; obl uuid;
BEGIN
 IF p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
 SELECT id INTO contract_id FROM public.mortgage_contracts WHERE idempotency_key=p_idempotency_key; IF contract_id IS NOT NULL THEN RETURN contract_id; END IF;
 PERFORM public.set_mortgage_completion_accounts(p_offer_id,p_deposit_bank_account_id,p_repayment_bank_account_id);
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id FOR UPDATE; SELECT * INTO prop FROM public.properties WHERE id=offer.property_id FOR UPDATE; SELECT * INTO res FROM public.property_reservations WHERE property_id=offer.property_id AND applicant_type='player' AND applicant_id=pid AND status='active' FOR UPDATE;
 IF offer.status<>'accepted' OR offer.expires_at<=timezone('utc',now()) OR app.applicant_id<>pid OR res.id IS NULL OR res.expires_at<=timezone('utc',now()) THEN RAISE EXCEPTION 'offer or reservation is not completable'; END IF;
 SELECT * INTO dep_ba FROM public.bank_accounts WHERE id=p_deposit_bank_account_id FOR UPDATE; SELECT * INTO repay_ba FROM public.bank_accounts WHERE id=p_repayment_bank_account_id FOR UPDATE; repay_fa:=repay_ba.linked_finance_account_id;
 IF dep_ba.owner_id<>pid OR repay_ba.owner_id<>pid OR dep_ba.status<>'active' OR repay_ba.status<>'active' OR dep_ba.currency_code<>offer.currency_code OR repay_ba.currency_code<>offer.currency_code THEN RAISE EXCEPTION 'completion accounts are not eligible'; END IF;
 SELECT * INTO dep FROM public.property_deposits WHERE reservation_id=res.id AND status='reserved' FOR UPDATE; IF dep.id IS NULL THEN RAISE EXCEPTION 'reserved deposit required'; END IF;
 accounts:=public.ensure_mortgage_provider_accounts(offer.provider_id,offer.currency_code); funding:=(accounts->>'mortgage_funding_cash')::uuid; receivable:=(accounts->>'mortgage_receivable')::uuid; equity:=public.get_or_create_provider_finance_account(offer.provider_id,offer.currency_code,'provider_equity'); seller:=public.resolve_property_seller_financial_account(prop.owner_type,prop.owner_id,offer.currency_code);
 IF (SELECT current_balance_minor FROM public.financial_accounts WHERE id=funding FOR UPDATE)<offer.principal_minor THEN RAISE EXCEPTION 'mortgage provider has insufficient liquidity'; END IF;
 INSERT INTO public.mortgage_contracts(offer_id,property_id,provider_id,borrower_type,borrower_id,deposit_bank_account_id,repayment_bank_account_id,original_principal_minor,outstanding_principal_minor,currency_code,annual_rate_bps,term_months,remaining_term_months,next_payment_due_date,status,activated_at,idempotency_key) VALUES(offer.id,prop.id,offer.provider_id,'player',pid,dep_ba.id,repay_ba.id,offer.principal_minor,offer.principal_minor,offer.currency_code,offer.annual_rate_bps,offer.term_months,offer.term_months,offer.first_payment_date,'active',timezone('utc',now()),p_idempotency_key) RETURNING id INTO contract_id;
 monthly:=offer.monthly_payment_minor; bal:=offer.principal_minor; FOR i IN 1..offer.term_months LOOP int_due:=FLOOR(bal::numeric*offer.annual_rate_bps/10000/12)::bigint; prin_due:=CASE WHEN i=offer.term_months THEN bal ELSE LEAST(bal,GREATEST(1,monthly-int_due)) END; INSERT INTO public.mortgage_schedule_lines(mortgage_contract_id,schedule_version,instalment_number,due_date,opening_principal_minor,principal_due_minor,interest_due_minor,total_due_minor,currency_code,status) VALUES(contract_id,1,i,(offer.first_payment_date+((i-1)||' months')::interval)::date,bal,prin_due,int_due,prin_due+int_due,offer.currency_code,'scheduled'); bal:=bal-prin_due; END LOOP;
 deposit_tx:=public.post_financial_journal('property_purchase_settlement',gen_random_uuid(),offer.currency_code,'phase8b4-deposit-settle-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',dep.clearing_account_id,'direction','debit','amount_minor',offer.deposit_minor),jsonb_build_object('account_id',seller,'direction','credit','amount_minor',offer.deposit_minor)),'mortgage_contract',contract_id,jsonb_build_object('trusted_finance_workflow',true,'deposit_id',dep.id));
 principal_tx:=public.post_financial_journal('property_purchase_settlement',gen_random_uuid(),offer.currency_code,'phase8b4-principal-settle-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',funding,'direction','debit','amount_minor',offer.principal_minor),jsonb_build_object('account_id',seller,'direction','credit','amount_minor',offer.principal_minor)),'mortgage_contract',contract_id,jsonb_build_object('trusted_finance_workflow',true,'provider_id',offer.provider_id,'funding_debited_once',true));
 orig_tx:=public.post_financial_journal('mortgage_origination',gen_random_uuid(),offer.currency_code,'phase8b4-origination-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',equity,'direction','debit','amount_minor',offer.principal_minor),jsonb_build_object('account_id',receivable,'direction','credit','amount_minor',offer.principal_minor)),'mortgage_contract',contract_id,jsonb_build_object('trusted_finance_workflow',true,'economic_model','equity offsets receivable; funding cash is only debited in settlement'));
 INSERT INTO public.property_purchase_transactions(property_id,buyer_type,buyer_id,seller_type,seller_id,purchase_price_minor,deposit_minor,mortgage_principal_minor,currency_code,financial_transaction_id,status,idempotency_key,completed_at,settlement_transaction_ids,seller_financial_account_id,deposit_settlement_transaction_id,provider_origination_transaction_id,seller_principal_settlement_transaction_id) VALUES(prop.id,'player',pid,prop.owner_type,prop.owner_id,offer.purchase_price_minor,offer.deposit_minor,offer.principal_minor,offer.currency_code,principal_tx,'completed',p_idempotency_key,timezone('utc',now()),ARRAY[deposit_tx,orig_tx,principal_tx],seller,deposit_tx,orig_tx,principal_tx);
 UPDATE public.property_ownership_history SET ended_at=timezone('utc',now()) WHERE property_id=prop.id AND ended_at IS NULL;
 UPDATE public.properties SET owner_type='player',owner_id=pid,listing_status='sold',persistent_status='occupied',updated_at=timezone('utc',now()) WHERE id=prop.id;
 UPDATE public.property_listings SET status='sold',closed_at=timezone('utc',now()) WHERE property_id=prop.id AND status IN ('reserved','for_sale'); UPDATE public.property_reservations SET status='completed',completed_at=timezone('utc',now()) WHERE id=res.id; UPDATE public.property_deposits SET status='applied',released_at=timezone('utc',now()) WHERE id=dep.id;
 INSERT INTO public.property_ownership_history(property_id,owner_type,owner_id,purchase_price_minor,currency_code) VALUES(prop.id,'player',pid,offer.purchase_price_minor,offer.currency_code);
 INSERT INTO public.property_occupancies(property_id,occupant_type,occupant_id,use_type,status,started_at) SELECT prop.id,'player',pid,'residential','active',timezone('utc',now()) WHERE NOT EXISTS (SELECT 1 FROM public.property_occupancies po WHERE po.property_id=prop.id AND po.occupant_type='player' AND po.occupant_id=pid AND po.status='active');
 INSERT INTO public.property_security_interests(property_id,mortgage_contract_id,provider_id,original_secured_amount_minor,outstanding_secured_amount_minor,currency_code) VALUES(prop.id,contract_id,offer.provider_id,offer.principal_minor,offer.principal_minor,offer.currency_code);
 INSERT INTO public.recurring_financial_obligations(owner_type,owner_id,owner_account_id,expense_category,description,amount_minor,currency_code,frequency,next_due_date,related_entity_type,related_entity_id,auto_pay_enabled,grace_period_days,cancellable_by_owner) VALUES('player',pid,repay_fa,'mortgage_principal_repayment','Mortgage repayment',offer.monthly_payment_minor,offer.currency_code,'monthly',offer.first_payment_date,'mortgage_contract',contract_id,true,7,false) RETURNING id INTO obl;
 UPDATE public.mortgage_contracts SET recurring_obligation_id=obl WHERE id=contract_id; UPDATE public.mortgage_offers SET status='completed' WHERE id=offer.id; UPDATE public.mortgage_applications SET status='active',updated_at=timezone('utc',now()) WHERE id=app.id; RETURN contract_id;
END $$;

CREATE OR REPLACE FUNCTION public.post_mortgage_schedule_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line public.mortgage_schedule_lines; c public.mortgage_contracts; ba public.bank_accounts; fa public.financial_accounts; accounts jsonb; cash uuid; receivable uuid; interest_income uuid; fee_income uuid; equity uuid; tx uuid; red_tx uuid; pay_id uuid; attempt_id uuid; next_due date; unpaid_principal bigint; unpaid_interest bigint; unpaid_fees bigint; unpaid_count int; entries jsonb;
BEGIN
 SELECT id INTO pay_id FROM public.mortgage_payments WHERE idempotency_key=p_idempotency_key; IF pay_id IS NOT NULL THEN RETURN jsonb_build_object('status','already_posted','paymentId',pay_id); END IF;
 SELECT * INTO line FROM public.mortgage_schedule_lines WHERE id=p_schedule_line_id FOR UPDATE; SELECT * INTO c FROM public.mortgage_contracts WHERE id=line.mortgage_contract_id FOR UPDATE; SELECT * INTO ba FROM public.bank_accounts WHERE id=c.repayment_bank_account_id FOR UPDATE; SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE;
 IF line.id IS NULL OR c.status NOT IN ('active','arrears') THEN RAISE EXCEPTION 'schedule line is not payable'; END IF; IF line.status='paid' THEN RETURN jsonb_build_object('status','already_paid','scheduleLineId',line.id); END IF;
 IF fa.available_balance_minor<line.total_due_minor THEN INSERT INTO public.mortgage_payment_attempts(mortgage_contract_id,schedule_line_id,amount_minor,currency_code,status,failure_reason,failure_type,error_classification,retry_eligible,idempotency_key) VALUES(c.id,line.id,line.total_due_minor,c.currency_code,'failed','insufficient_funds','insufficient_funds','business',true,p_idempotency_key) ON CONFLICT DO NOTHING RETURNING id INTO attempt_id; RETURN jsonb_build_object('status','failed','reason','insufficient_funds','attemptId',attempt_id); END IF;
 accounts:=public.ensure_mortgage_provider_accounts(c.provider_id,c.currency_code); cash:=public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'mortgage_repayment_cash'); receivable:=(accounts->>'mortgage_receivable')::uuid; interest_income:=(accounts->>'mortgage_interest_income')::uuid; fee_income:=(accounts->>'mortgage_fee_income')::uuid; equity:=public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'provider_equity');
 entries:=jsonb_build_array(jsonb_build_object('account_id',fa.id,'direction','debit','amount_minor',line.total_due_minor),jsonb_build_object('account_id',cash,'direction','credit','amount_minor',line.total_due_minor));
 IF line.principal_due_minor>0 THEN entries:=entries||jsonb_build_array(jsonb_build_object('account_id',receivable,'direction','debit','amount_minor',line.principal_due_minor),jsonb_build_object('account_id',equity,'direction','credit','amount_minor',line.principal_due_minor)); END IF;
 IF line.interest_due_minor>0 THEN entries:=entries||jsonb_build_array(jsonb_build_object('account_id',cash,'direction','debit','amount_minor',line.interest_due_minor),jsonb_build_object('account_id',interest_income,'direction','credit','amount_minor',line.interest_due_minor)); END IF;
 IF line.fees_due_minor>0 THEN entries:=entries||jsonb_build_array(jsonb_build_object('account_id',cash,'direction','debit','amount_minor',line.fees_due_minor),jsonb_build_object('account_id',fee_income,'direction','credit','amount_minor',line.fees_due_minor)); END IF;
 tx:=public.post_financial_journal('mortgage_principal_repayment',gen_random_uuid(),c.currency_code,p_idempotency_key,entries,'mortgage_schedule_line',line.id,jsonb_build_object('trusted_finance_workflow',true,'contract_id',c.id,'zero_fee_line_posted',line.fees_due_minor>0));
 INSERT INTO public.mortgage_payments(mortgage_contract_id,schedule_line_id,financial_transaction_id,journal_event_id,principal_transaction_id,interest_transaction_id,fee_transaction_id,amount_minor,principal_minor,interest_minor,fees_minor,currency_code,status,idempotency_key) VALUES(c.id,line.id,tx,tx,tx,CASE WHEN line.interest_due_minor>0 THEN tx END,CASE WHEN line.fees_due_minor>0 THEN tx END,line.total_due_minor,line.principal_due_minor,line.interest_due_minor,line.fees_due_minor,c.currency_code,'posted',p_idempotency_key) RETURNING id INTO pay_id;
 UPDATE public.mortgage_schedule_lines SET paid_principal_minor=principal_due_minor,paid_interest_minor=interest_due_minor,paid_fees_minor=fees_due_minor,status='paid',payment_transaction_id=tx WHERE id=line.id;
 SELECT COALESCE(sum(principal_due_minor-paid_principal_minor),0), COALESCE(sum(interest_due_minor-paid_interest_minor),0), COALESCE(sum(fees_due_minor-paid_fees_minor),0), count(*) FILTER (WHERE status<>'paid'), min(due_date) FILTER (WHERE status<>'paid') INTO unpaid_principal,unpaid_interest,unpaid_fees,unpaid_count,next_due FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id;
 UPDATE public.mortgage_contracts SET outstanding_principal_minor=unpaid_principal,remaining_term_months=unpaid_count,next_payment_due_date=next_due,status=CASE WHEN unpaid_count=0 AND unpaid_principal=0 AND unpaid_interest=0 AND unpaid_fees=0 THEN 'redeemed'::public.mortgage_status ELSE 'active'::public.mortgage_status END,redeemed_at=CASE WHEN unpaid_count=0 AND unpaid_principal=0 AND unpaid_interest=0 AND unpaid_fees=0 THEN timezone('utc',now()) ELSE redeemed_at END WHERE id=c.id;
 IF unpaid_count=0 AND unpaid_principal=0 AND unpaid_interest=0 AND unpaid_fees=0 THEN
  red_tx:=public.post_financial_journal('mortgage_redemption',gen_random_uuid(),c.currency_code,'mortgage-redemption-'||c.id,jsonb_build_array(jsonb_build_object('account_id',cash,'direction','debit','amount_minor',1),jsonb_build_object('account_id',cash,'direction','credit','amount_minor',1)),'mortgage_contract',c.id,jsonb_build_object('trusted_finance_workflow',true,'audit_only',true,'payment_transaction_id',tx));
  UPDATE public.property_security_interests SET outstanding_secured_amount_minor=0,status='released',release_date=CURRENT_DATE,release_transaction_id=red_tx WHERE mortgage_contract_id=c.id AND status IN ('registered','pending_release');
  UPDATE public.recurring_financial_obligations SET next_due_date=NULL,status='completed' WHERE id=c.recurring_obligation_id;
  UPDATE public.properties SET metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('finance_status','unencumbered','mortgage_released_at',timezone('utc',now())) WHERE id=c.property_id;
 END IF;
 RETURN jsonb_build_object('status','posted','paymentId',pay_id,'transactionId',tx,'nextPaymentDueDate',next_due);
END $$;

CREATE OR REPLACE FUNCTION public.contribute_personal_funds_to_band(p_band_id uuid,p_player_bank_account_id uuid,p_amount_minor bigint,p_idempotency_key text,p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); src public.financial_accounts; ba public.bank_accounts; treasury uuid; tx uuid; cid uuid; day_total bigint;
BEGIN
 IF pid IS NULL THEN RAISE EXCEPTION 'profile required'; END IF; IF p_amount_minor<=0 THEN RAISE EXCEPTION 'amount must be positive'; END IF; IF p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
 SELECT id INTO cid FROM public.band_financial_contributions WHERE idempotency_key=p_idempotency_key; IF cid IS NOT NULL THEN RETURN (SELECT jsonb_build_object('contributionId',id,'transactionId',transaction_id) FROM public.band_financial_contributions WHERE id=cid); END IF;
 IF NOT EXISTS (SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=pid AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'active band membership required'; END IF;
 SELECT * INTO ba FROM public.bank_accounts WHERE id=p_player_bank_account_id FOR UPDATE; IF ba.owner_type<>'player' OR ba.owner_id<>pid OR ba.status<>'active' THEN RAISE EXCEPTION 'player bank account is not eligible'; END IF;
 SELECT * INTO src FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE; IF src.account_status<>'active' OR src.available_balance_minor<p_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
 IF p_amount_minor<100 OR p_amount_minor>100000000 THEN RAISE EXCEPTION 'contribution amount outside limits'; END IF;
 SELECT COALESCE(sum(amount_minor),0) INTO day_total FROM public.band_financial_contributions WHERE contributing_player_id=pid AND created_at>=date_trunc('day',timezone('utc',now())) AND contribution_type='voluntary_deposit'; IF day_total+p_amount_minor>500000000 THEN RAISE EXCEPTION 'daily contribution limit exceeded'; END IF;
 treasury:=public.get_or_create_band_treasury_account(p_band_id,ba.currency_code);
 tx:=public.post_financial_journal('band_contribution',gen_random_uuid(),ba.currency_code,p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',src.id,'direction','debit','amount_minor',p_amount_minor),jsonb_build_object('account_id',treasury,'direction','credit','amount_minor',p_amount_minor)),'band',p_band_id,jsonb_build_object('trusted_finance_workflow',true,'contribution_type','voluntary_deposit','commercial_revenue',false));
 INSERT INTO public.band_financial_contributions(band_id,contributing_player_id,source_player_account_id,destination_band_treasury_account_id,amount_minor,currency_code,transaction_id,contribution_type,notes,idempotency_key) VALUES(p_band_id,pid,src.id,treasury,p_amount_minor,ba.currency_code,tx,'voluntary_deposit',p_note,p_idempotency_key) RETURNING id INTO cid;
 RETURN jsonb_build_object('contributionId',cid,'transactionId',tx,'newPlayerAvailableBalance',(SELECT available_balance_minor FROM public.financial_accounts WHERE id=src.id),'newBandTreasuryBalance',(SELECT current_balance_minor FROM public.financial_accounts WHERE id=treasury));
END $$;

GRANT EXECUTE ON FUNCTION public.get_or_create_band_treasury_account(uuid,char) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contribute_personal_funds_to_band(uuid,uuid,bigint,text,text) TO authenticated;

-- No development fixtures are created by this production migration. Local environments may call an explicit seed/admin setup.
