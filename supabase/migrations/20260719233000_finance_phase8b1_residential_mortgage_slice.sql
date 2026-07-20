-- Finance Phase 8B.1: residential mortgage vertical slice corrections.

ALTER TABLE public.banking_provider_financial_accounts DROP CONSTRAINT IF EXISTS banking_provider_financial_accounts_account_role_check;
ALTER TABLE public.banking_provider_financial_accounts ADD CONSTRAINT banking_provider_financial_accounts_account_role_check CHECK (account_role IN ('lending_funding','loan_receivable','interest_income','fee_income','loss_write_off','interest_expense','mortgage_funding_cash','mortgage_receivable','mortgage_interest_income','mortgage_fee_income','mortgage_settlement_clearing','mortgage_credit_loss_expense'));

UPDATE public.mortgage_products mp SET provider_id=(SELECT id FROM public.banking_providers WHERE provider_code='aurora_international') WHERE mp.provider_id IS NULL;
ALTER TABLE public.mortgage_products ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.mortgage_offers ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.mortgage_contracts ALTER COLUMN provider_id SET NOT NULL;
ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.property_reservations(id);
ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS financial_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE public.mortgage_offers ADD COLUMN IF NOT EXISTS deposit_bank_account_id uuid REFERENCES public.bank_accounts(id);
ALTER TABLE public.mortgage_offers ADD COLUMN IF NOT EXISTS repayment_bank_account_id uuid REFERENCES public.bank_accounts(id);
ALTER TABLE public.mortgage_affordability_snapshots ADD COLUMN IF NOT EXISTS source_window_days integer NOT NULL DEFAULT 90;
ALTER TABLE public.mortgage_affordability_snapshots ADD COLUMN IF NOT EXISTS raw_qualifying_income_minor bigint NOT NULL DEFAULT 0;
ALTER TABLE public.mortgage_affordability_snapshots ADD COLUMN IF NOT EXISTS normalised_monthly_income_minor bigint NOT NULL DEFAULT 0;
ALTER TABLE public.mortgage_affordability_snapshots ADD COLUMN IF NOT EXISTS income_volatility_bps integer NOT NULL DEFAULT 0;
ALTER TABLE public.mortgage_affordability_snapshots ADD COLUMN IF NOT EXISTS qualifying_income_event_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS mortgage_affordability_one_version ON public.mortgage_affordability_snapshots(application_id, calculation_version);
CREATE UNIQUE INDEX IF NOT EXISTS mortgage_underwriting_one_snapshot ON public.mortgage_underwriting_results(application_id, snapshot_id);
CREATE UNIQUE INDEX IF NOT EXISTS mortgage_offers_one_active ON public.mortgage_offers(application_id) WHERE status IN ('issued','accepted');
CREATE UNIQUE INDEX IF NOT EXISTS mortgage_contracts_one_offer ON public.mortgage_contracts(offer_id);
CREATE UNIQUE INDEX IF NOT EXISTS property_deposits_one_reserved_reservation ON public.property_deposits(reservation_id) WHERE status='reserved';
CREATE INDEX IF NOT EXISTS mortgage_schedule_due_idx ON public.mortgage_schedule_lines(due_date,status);
CREATE INDEX IF NOT EXISTS mortgage_contracts_borrower_idx ON public.mortgage_contracts(borrower_type,borrower_id,status);

CREATE OR REPLACE FUNCTION public.ensure_mortgage_provider_accounts(p_provider_id uuid, p_currency_code char(3)) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; result jsonb:='{}'; provider public.banking_providers; acct uuid;
BEGIN
  SELECT * INTO provider FROM public.banking_providers WHERE id=p_provider_id AND status='active';
  IF provider.id IS NULL OR NOT (p_currency_code=ANY(provider.supported_currencies)) THEN RAISE EXCEPTION 'active mortgage provider does not support currency'; END IF;
  FOREACH role IN ARRAY ARRAY['mortgage_funding_cash','mortgage_receivable','mortgage_interest_income','mortgage_fee_income','mortgage_settlement_clearing','mortgage_credit_loss_expense'] LOOP
    acct := public.get_or_create_provider_finance_account(p_provider_id,p_currency_code,role);
    result := result || jsonb_build_object(role, acct);
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ensure_mortgage_provider_accounts(uuid,char) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.mortgage_monthly_payment(p_principal bigint,p_annual_rate_bps int,p_term_months int) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r numeric; pay numeric;
BEGIN
 IF p_principal<=0 OR p_term_months<=0 THEN RETURN 0; END IF;
 r := (p_annual_rate_bps::numeric/10000)/12;
 IF r=0 THEN RETURN CEIL(p_principal::numeric/p_term_months)::bigint; END IF;
 pay := p_principal*r/(1-power(1+r,-p_term_months));
 RETURN CEIL(pay)::bigint;
END $$;

CREATE OR REPLACE FUNCTION public.list_eligible_mortgage_products(p_property_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(mp) || jsonb_build_object('providerName',bp.brand_name)),'[]'::jsonb)
 FROM public.mortgage_products mp JOIN public.properties p ON p.id=p_property_id JOIN public.banking_providers bp ON bp.id=mp.provider_id
 WHERE mp.status='active' AND bp.status='active' AND mp.currency_code=p.currency_code AND p.category=ANY(mp.eligible_property_categories) AND 'player'=ANY(mp.eligible_owner_types) AND mp.rate_model='fixed' AND mp.repayment_strategy='repayment' AND mp.currency_code=ANY(bp.supported_currencies)
$$;

CREATE OR REPLACE FUNCTION public.create_mortgage_application(p_property_id uuid,p_product_id uuid,p_term_months int,p_requested_deposit_minor bigint,p_currency_code char(3),p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); prop public.properties; prod public.mortgage_products; prov public.banking_providers; app_id uuid; required_deposit bigint; principal bigint; pay bigint; raw_income bigint; monthly_income bigint; income_events int; cash bigint; debt bigint; essential bigint:=0; score int; snap uuid; result_status text; reasons jsonb:='[]'; existing uuid;
BEGIN
 IF p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
 SELECT id INTO existing FROM public.mortgage_applications WHERE idempotency_key=p_idempotency_key; IF existing IS NOT NULL THEN RETURN existing; END IF;
 SELECT * INTO prop FROM public.properties WHERE id=p_property_id FOR UPDATE; SELECT * INTO prod FROM public.mortgage_products WHERE id=p_product_id; SELECT * INTO prov FROM public.banking_providers WHERE id=prod.provider_id;
 IF prop.id IS NULL OR prod.id IS NULL THEN RAISE EXCEPTION 'property or product not found'; END IF;
 PERFORM public.ensure_mortgage_provider_accounts(prod.provider_id,p_currency_code);
 required_deposit:=CEIL(prop.current_valuation_minor::numeric*prod.min_deposit_bps/10000)::bigint; principal:=prop.current_valuation_minor-p_requested_deposit_minor; pay:=public.mortgage_monthly_payment(principal,GREATEST(prod.annual_rate_bps,prod.stress_rate_bps),p_term_months);
 SELECT COALESCE(sum(t.net_amount_minor),0), count(*) INTO raw_income,income_events FROM public.financial_transactions t JOIN public.financial_accounts fa ON fa.id=t.destination_account_id WHERE fa.owner_type='player' AND fa.owner_id=pid AND t.status='completed' AND t.created_at>=timezone('utc',now())-interval '90 days' AND t.transaction_category IN ('wage_payment','gig_payment','festival_payment','merchandise_revenue','streaming_royalty','song_release_royalty');
 monthly_income:=FLOOR(raw_income::numeric*30/90)::bigint;
 SELECT COALESCE(sum(fa.available_balance_minor),0) INTO cash FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id WHERE ba.owner_type='player' AND ba.owner_id=pid AND ba.status='active' AND ba.currency_code=p_currency_code AND fa.account_status='active' AND fa.default_currency_code=p_currency_code;
 SELECT COALESCE(sum(l.total_due_minor-l.amount_paid_minor),0) INTO debt FROM public.loan_schedule_lines l JOIN public.loan_contracts c ON c.id=l.loan_contract_id WHERE c.borrower_type='player' AND c.borrower_id=pid AND c.status IN ('active','grace_period','delinquent','defaulted') AND l.status<>'paid' AND l.due_date <= CURRENT_DATE + interval '1 month';
 SELECT COALESCE(credit_score,500) INTO score FROM public.banking_customer_profiles WHERE owner_type='player' AND owner_id=pid;
 IF prop.listing_status<>'for_sale' OR prop.persistent_status<>'available' THEN reasons := reasons || '"property_not_available"'::jsonb; END IF;
 IF prod.status<>'active' OR prov.status<>'active' OR NOT (p_currency_code=ANY(prov.supported_currencies)) THEN reasons := reasons || '"provider_or_product_inactive"'::jsonb; END IF;
 IF p_currency_code<>prop.currency_code OR p_currency_code<>prod.currency_code THEN reasons := reasons || '"currency_mismatch"'::jsonb; END IF;
 IF p_term_months NOT BETWEEN prod.min_term_months AND prod.max_term_months THEN reasons := reasons || '"invalid_term"'::jsonb; END IF;
 IF p_requested_deposit_minor<required_deposit OR cash<p_requested_deposit_minor THEN reasons := reasons || '"insufficient_deposit"'::jsonb; END IF;
 IF score<500 THEN reasons := reasons || '"credit_score_below_minimum"'::jsonb; END IF;
 IF monthly_income<=0 THEN reasons := reasons || '"no_qualifying_income"'::jsonb; END IF;
 IF monthly_income-debt-essential-pay<=0 THEN reasons := reasons || '"insufficient_disposable_income"'::jsonb; END IF;
 IF monthly_income>0 AND FLOOR((debt+essential+pay)::numeric*10000/monthly_income)::int>4500 THEN reasons := reasons || '"stressed_payment_failed"'::jsonb; END IF;
 result_status := CASE WHEN jsonb_array_length(reasons)=0 THEN 'approved' ELSE 'rejected' END;
 INSERT INTO public.mortgage_applications(applicant_type,applicant_id,property_id,product_id,requested_term_months,requested_deposit_minor,currency_code,status,idempotency_key) VALUES('player',pid,p_property_id,p_product_id,p_term_months,p_requested_deposit_minor,p_currency_code,CASE WHEN result_status='approved' THEN 'offered'::public.mortgage_status ELSE 'declined'::public.mortgage_status END,p_idempotency_key) RETURNING id INTO app_id;
 INSERT INTO public.mortgage_affordability_snapshots(application_id,source_period_start,source_period_end,calculation_version,verified_income_minor,raw_qualifying_income_minor,source_window_days,normalised_monthly_income_minor,income_volatility_bps,qualifying_income_event_count,essential_expenditure_minor,existing_debt_service_minor,unrestricted_cash_minor,credit_score,currency_code,source_references) VALUES(app_id,CURRENT_DATE-90,CURRENT_DATE,'phase8b1-monthly-v1',monthly_income,raw_income,90,monthly_income,0,income_events,essential,debt,cash,score,p_currency_code,jsonb_build_object('included_income_categories',jsonb_build_array('wage_payment','gig_payment','festival_payment','merchandise_revenue','streaming_royalty','song_release_royalty'),'normalisation','raw_90_day_income_x_30_div_90')) RETURNING id INTO snap;
 INSERT INTO public.mortgage_underwriting_results(application_id,snapshot_id,status,verified_deposit_minor,required_deposit_minor,principal_minor,ltv_bps,stressed_payment_minor,debt_service_ratio_bps,disposable_income_minor,maximum_affordable_principal_minor,rejection_reasons) VALUES(app_id,snap,result_status,LEAST(cash,p_requested_deposit_minor),required_deposit,principal,FLOOR(principal::numeric*10000/NULLIF(prop.current_valuation_minor,0))::int,pay,CASE WHEN monthly_income>0 THEN FLOOR((debt+essential+pay)::numeric*10000/monthly_income)::int ELSE 10000 END,monthly_income-debt-essential-pay,FLOOR(prop.current_valuation_minor::numeric*prod.max_ltv_bps/10000)::bigint,reasons);
 IF result_status='approved' THEN INSERT INTO public.mortgage_offers(application_id,product_id,property_id,provider_id,purchase_price_minor,deposit_minor,principal_minor,currency_code,annual_rate_bps,term_months,first_payment_date,monthly_payment_minor,total_repayment_estimate_minor,fees,expires_at,status) VALUES(app_id,p_product_id,p_property_id,prod.provider_id,prop.current_valuation_minor,p_requested_deposit_minor,principal,p_currency_code,prod.annual_rate_bps,p_term_months,CURRENT_DATE+interval '1 month',public.mortgage_monthly_payment(principal,prod.annual_rate_bps,p_term_months),public.mortgage_monthly_payment(principal,prod.annual_rate_bps,p_term_months)*p_term_months,prod.fees,timezone('utc',now())+interval '14 days','issued'); END IF;
 RETURN app_id;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_property_for_mortgage_offer(p_offer_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; prop public.properties; res public.property_reservations;
BEGIN
 SELECT * INTO res FROM public.property_reservations WHERE idempotency_key=p_idempotency_key; IF res.id IS NOT NULL THEN RETURN to_jsonb(res); END IF;
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id FOR UPDATE; SELECT * INTO prop FROM public.properties WHERE id=offer.property_id FOR UPDATE;
 IF offer.id IS NULL OR app.applicant_id<>pid OR app.applicant_type<>'player' THEN RAISE EXCEPTION 'offer not found'; END IF;
 IF offer.status<>'issued' OR offer.expires_at<=timezone('utc',now()) THEN RAISE EXCEPTION 'offer is not reservable'; END IF;
 IF prop.listing_status<>'for_sale' OR prop.persistent_status<>'available' THEN RAISE EXCEPTION 'property is not available'; END IF;
 INSERT INTO public.property_reservations(property_id,applicant_type,applicant_id,expires_at,status,idempotency_key) VALUES(prop.id,'player',pid,LEAST(offer.expires_at,timezone('utc',now())+interval '48 hours'),'active',p_idempotency_key) RETURNING * INTO res;
 UPDATE public.properties SET listing_status='reserved',persistent_status='reserved',updated_at=timezone('utc',now()) WHERE id=prop.id;
 UPDATE public.property_listings SET status='reserved' WHERE property_id=prop.id AND status='for_sale';
 UPDATE public.mortgage_offers SET status='accepted',accepted_at=timezone('utc',now()) WHERE id=offer.id;
 UPDATE public.mortgage_applications SET status='pending_completion',updated_at=timezone('utc',now()) WHERE id=app.id;
 INSERT INTO public.mortgage_audit_events(application_id,action,actor_type,actor_id,details) VALUES(app.id,'property_reserved','player',pid,to_jsonb(res));
 RETURN to_jsonb(res);
END $$;

CREATE OR REPLACE FUNCTION public.expire_stale_property_reservations(p_as_of timestamptz DEFAULT timezone('utc',now())) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n int:=0;
BEGIN
 FOR r IN SELECT * FROM public.property_reservations WHERE status='active' AND expires_at<=p_as_of FOR UPDATE LOOP
  UPDATE public.property_reservations SET status='expired',cancelled_at=timezone('utc',now()) WHERE id=r.id;
  UPDATE public.properties SET listing_status='for_sale',persistent_status='available' WHERE id=r.property_id AND owner_type='world';
  UPDATE public.property_listings SET status='for_sale' WHERE property_id=r.property_id AND status='reserved';
  UPDATE public.mortgage_offers o SET status='expired' FROM public.mortgage_applications a WHERE a.id=o.application_id AND a.property_id=r.property_id AND o.status='accepted';
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_stale_property_reservations(timestamptz) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.set_mortgage_completion_accounts(p_offer_id uuid,p_deposit_bank_account_id uuid,p_repayment_bank_account_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; dep public.bank_accounts; repay public.bank_accounts; fa public.financial_accounts;
BEGIN
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id; SELECT * INTO dep FROM public.bank_accounts WHERE id=p_deposit_bank_account_id; SELECT * INTO repay FROM public.bank_accounts WHERE id=p_repayment_bank_account_id; SELECT * INTO fa FROM public.financial_accounts WHERE id=dep.linked_finance_account_id;
 IF offer.id IS NULL OR app.applicant_type<>'player' OR app.applicant_id<>pid THEN RAISE EXCEPTION 'offer not found'; END IF;
 IF dep.owner_type<>'player' OR dep.owner_id<>pid OR repay.owner_type<>'player' OR repay.owner_id<>pid THEN RAISE EXCEPTION 'account does not belong to applicant'; END IF;
 IF dep.status<>'active' OR repay.status<>'active' OR dep.currency_code<>offer.currency_code OR repay.currency_code<>offer.currency_code THEN RAISE EXCEPTION 'account is not eligible'; END IF;
 IF fa.available_balance_minor<offer.deposit_minor THEN RAISE EXCEPTION 'insufficient deposit funds'; END IF;
 UPDATE public.mortgage_offers SET deposit_bank_account_id=dep.id, repayment_bank_account_id=repay.id WHERE id=offer.id;
 RETURN jsonb_build_object('offerId',offer.id,'depositBankAccountId',dep.id,'repaymentBankAccountId',repay.id,'depositValidated',true);
END $$;

CREATE OR REPLACE FUNCTION public.reserve_mortgage_deposit(p_offer_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE offer public.mortgage_offers; app public.mortgage_applications; dep_ba public.bank_accounts; src public.financial_accounts; clearing uuid; tx uuid; dep_id uuid; res_id uuid;
BEGIN
 SELECT id INTO dep_id FROM public.property_deposits WHERE idempotency_key=p_idempotency_key; IF dep_id IS NOT NULL THEN RETURN dep_id; END IF;
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id; SELECT id INTO res_id FROM public.property_reservations WHERE property_id=offer.property_id AND applicant_type=app.applicant_type AND applicant_id=app.applicant_id AND status='active' FOR UPDATE;
 SELECT * INTO dep_ba FROM public.bank_accounts WHERE id=offer.deposit_bank_account_id FOR UPDATE; SELECT * INTO src FROM public.financial_accounts WHERE id=dep_ba.linked_finance_account_id FOR UPDATE;
 clearing := public.get_or_create_provider_finance_account(offer.provider_id,offer.currency_code,'mortgage_settlement_clearing');
 IF res_id IS NULL THEN RAISE EXCEPTION 'active reservation required'; END IF; IF src.available_balance_minor<offer.deposit_minor THEN RAISE EXCEPTION 'insufficient deposit funds'; END IF;
 tx := public.finance_transfer('player',app.applicant_id,'system',NULL,offer.deposit_minor,'system_fee','Mortgage deposit reservation',p_idempotency_key,'mortgage_offer',offer.id,app.applicant_id,jsonb_build_object('destination_account_id',clearing));
 INSERT INTO public.property_deposits(property_id,owner_type,owner_id,amount_minor,currency_code,status,source_account_id,reservation_id,financial_transaction_id,idempotency_key) VALUES(offer.property_id,'player',app.applicant_id,offer.deposit_minor,offer.currency_code,'reserved',src.id,res_id,tx,p_idempotency_key) RETURNING id INTO dep_id;
 RETURN dep_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mortgaged_property_purchase(p_offer_id uuid,p_deposit_bank_account_id uuid,p_repayment_bank_account_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; prop public.properties; res public.property_reservations; contract_id uuid; dep_id uuid; provider_accounts jsonb; funding uuid; receivable uuid; seller_tx uuid; provider_tx uuid; i int; bal bigint; int_due bigint; prin_due bigint; monthly bigint; dep_ba public.bank_accounts; repay_ba public.bank_accounts;
BEGIN
 SELECT id INTO contract_id FROM public.mortgage_contracts WHERE idempotency_key=p_idempotency_key; IF contract_id IS NOT NULL THEN RETURN contract_id; END IF;
 PERFORM public.set_mortgage_completion_accounts(p_offer_id,p_deposit_bank_account_id,p_repayment_bank_account_id);
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id FOR UPDATE; SELECT * INTO prop FROM public.properties WHERE id=offer.property_id FOR UPDATE; SELECT * INTO res FROM public.property_reservations WHERE property_id=prop.id AND applicant_type='player' AND applicant_id=pid AND status='active' FOR UPDATE; SELECT * INTO dep_ba FROM public.bank_accounts WHERE id=p_deposit_bank_account_id; SELECT * INTO repay_ba FROM public.bank_accounts WHERE id=p_repayment_bank_account_id;
 IF offer.status<>'accepted' OR offer.expires_at<=timezone('utc',now()) OR res.id IS NULL OR res.expires_at<=timezone('utc',now()) THEN RAISE EXCEPTION 'offer or reservation is not completable'; END IF;
 dep_id := public.reserve_mortgage_deposit(p_offer_id,'mortgage-deposit-'||p_idempotency_key);
 provider_accounts := public.ensure_mortgage_provider_accounts(offer.provider_id,offer.currency_code); funding := (provider_accounts->>'mortgage_funding_cash')::uuid; receivable := (provider_accounts->>'mortgage_receivable')::uuid;
 IF (SELECT current_balance_minor FROM public.financial_accounts WHERE id=funding FOR UPDATE) < offer.principal_minor THEN RAISE EXCEPTION 'mortgage provider has insufficient liquidity'; END IF;
 INSERT INTO public.mortgage_contracts(offer_id,property_id,provider_id,borrower_type,borrower_id,deposit_bank_account_id,repayment_bank_account_id,original_principal_minor,outstanding_principal_minor,currency_code,annual_rate_bps,term_months,remaining_term_months,next_payment_due_date,status,activated_at,idempotency_key) VALUES(offer.id,prop.id,offer.provider_id,'player',pid,dep_ba.id,repay_ba.id,offer.principal_minor,offer.principal_minor,offer.currency_code,offer.annual_rate_bps,offer.term_months,offer.term_months,offer.first_payment_date,'active',timezone('utc',now()),p_idempotency_key) RETURNING id INTO contract_id;
 monthly:=offer.monthly_payment_minor; bal:=offer.principal_minor;
 FOR i IN 1..offer.term_months LOOP int_due:=FLOOR(bal::numeric*offer.annual_rate_bps/10000/12)::bigint; prin_due:=CASE WHEN i=offer.term_months THEN bal ELSE LEAST(bal,GREATEST(1,monthly-int_due)) END; INSERT INTO public.mortgage_schedule_lines(mortgage_contract_id,schedule_version,instalment_number,due_date,opening_principal_minor,principal_due_minor,interest_due_minor,total_due_minor,currency_code,status) VALUES(contract_id,1,i,(offer.first_payment_date + ((i-1)||' months')::interval)::date,bal,prin_due,int_due,prin_due+int_due,offer.currency_code,'scheduled'); bal:=bal-prin_due; END LOOP;
 UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-offer.principal_minor WHERE id=funding; UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+offer.principal_minor WHERE id=receivable;
 INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_profile_id,created_by_actor,completed_at,metadata) VALUES('system_fee','completed',offer.currency_code,offer.principal_minor,offer.principal_minor,funding,receivable,'mortgage_contract',contract_id,'Mortgage origination funding','mortgage-provider-funding-'||p_idempotency_key,pid,'system',timezone('utc',now()),jsonb_build_object('provider_id',offer.provider_id)) RETURNING id INTO provider_tx;
 INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor) SELECT provider_tx,funding,'debit',offer.principal_minor,current_balance_minor+offer.principal_minor,current_balance_minor FROM public.financial_accounts WHERE id=funding UNION ALL SELECT provider_tx,receivable,'credit',offer.principal_minor,current_balance_minor-offer.principal_minor,current_balance_minor FROM public.financial_accounts WHERE id=receivable;
 INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_profile_id,created_by_actor,completed_at,metadata) VALUES('system_fee','completed',offer.currency_code,offer.purchase_price_minor,offer.purchase_price_minor,receivable,'property_purchase_transaction',prop.id,'Property seller settlement marker','mortgage-seller-settlement-'||p_idempotency_key,pid,'system',timezone('utc',now()),jsonb_build_object('seller_type',prop.owner_type,'seller_id',prop.owner_id,'deposit_minor',offer.deposit_minor,'mortgage_principal_minor',offer.principal_minor)) RETURNING id INTO seller_tx;
 INSERT INTO public.property_purchase_transactions(property_id,buyer_type,buyer_id,seller_type,seller_id,purchase_price_minor,deposit_minor,mortgage_principal_minor,currency_code,financial_transaction_id,status,idempotency_key,completed_at) VALUES(prop.id,'player',pid,prop.owner_type,prop.owner_id,offer.purchase_price_minor,offer.deposit_minor,offer.principal_minor,offer.currency_code,seller_tx,'completed',p_idempotency_key,timezone('utc',now()));
 UPDATE public.properties SET owner_type='player',owner_id=pid,listing_status='sold',persistent_status='occupied',updated_at=timezone('utc',now()) WHERE id=prop.id;
 UPDATE public.property_listings SET status='sold',closed_at=timezone('utc',now()) WHERE property_id=prop.id AND status IN ('reserved','for_sale'); UPDATE public.property_reservations SET status='completed',completed_at=timezone('utc',now()) WHERE id=res.id; UPDATE public.property_deposits SET status='applied',released_at=timezone('utc',now()) WHERE id=dep_id;
 INSERT INTO public.property_ownership_history(property_id,owner_type,owner_id,purchase_price_minor,currency_code) VALUES(prop.id,'player',pid,offer.purchase_price_minor,offer.currency_code);
 INSERT INTO public.property_security_interests(property_id,mortgage_contract_id,provider_id,original_secured_amount_minor,outstanding_secured_amount_minor,currency_code) VALUES(prop.id,contract_id,offer.provider_id,offer.principal_minor,offer.principal_minor,offer.currency_code);
 INSERT INTO public.recurring_financial_obligations(owner_type,owner_id,owner_account_id,expense_category,description,amount_minor,currency_code,frequency,next_due_date,related_entity_type,related_entity_id,auto_pay_enabled,grace_period_days,cancellable_by_owner) VALUES('player',pid,(SELECT linked_finance_account_id FROM public.bank_accounts WHERE id=repay_ba.id),'system_fee','Mortgage repayment',offer.monthly_payment_minor,offer.currency_code,'monthly',offer.first_payment_date,'mortgage_contract',contract_id,true,7,false) ON CONFLICT DO NOTHING;
 INSERT INTO public.mortgage_equity_snapshots(mortgage_contract_id,property_id,property_value_minor,outstanding_principal_minor,equity_minor,ltv_bps,currency_code) VALUES(contract_id,prop.id,prop.current_valuation_minor,offer.principal_minor,prop.current_valuation_minor-offer.principal_minor,FLOOR(offer.principal_minor::numeric*10000/prop.current_valuation_minor)::int,offer.currency_code);
 UPDATE public.mortgage_offers SET status='completed' WHERE id=offer.id; UPDATE public.mortgage_applications SET status='active',updated_at=timezone('utc',now()) WHERE id=app.id;
 INSERT INTO public.mortgage_audit_events(mortgage_contract_id,application_id,action,actor_type,actor_id,details) VALUES(contract_id,app.id,'mortgage_completed','player',pid,jsonb_build_object('purchasePriceMinor',offer.purchase_price_minor));
 RETURN contract_id;
END $$;

CREATE OR REPLACE FUNCTION public.post_mortgage_schedule_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line public.mortgage_schedule_lines; c public.mortgage_contracts; ba public.bank_accounts; fa public.financial_accounts; accounts jsonb; receivable uuid; interest_income uuid; tx uuid; pay_id uuid; attempt_id uuid; next_due date;
BEGIN
 SELECT id INTO pay_id FROM public.mortgage_payments WHERE idempotency_key=p_idempotency_key; IF pay_id IS NOT NULL THEN RETURN jsonb_build_object('status','already_posted','paymentId',pay_id); END IF;
 SELECT * INTO line FROM public.mortgage_schedule_lines WHERE id=p_schedule_line_id FOR UPDATE; SELECT * INTO c FROM public.mortgage_contracts WHERE id=line.mortgage_contract_id FOR UPDATE; SELECT * INTO ba FROM public.bank_accounts WHERE id=c.repayment_bank_account_id FOR UPDATE; SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE;
 IF line.id IS NULL OR c.status NOT IN ('active','arrears') THEN RAISE EXCEPTION 'schedule line is not payable'; END IF;
 IF line.status='paid' THEN RETURN jsonb_build_object('status','already_paid','scheduleLineId',line.id); END IF;
 IF fa.available_balance_minor < line.total_due_minor THEN
  INSERT INTO public.mortgage_payment_attempts(mortgage_contract_id,schedule_line_id,amount_minor,currency_code,status,failure_reason,idempotency_key) VALUES(c.id,line.id,line.total_due_minor,c.currency_code,'failed','insufficient_funds',p_idempotency_key) ON CONFLICT DO NOTHING RETURNING id INTO attempt_id;
  UPDATE public.mortgage_schedule_lines SET status=CASE WHEN due_date<CURRENT_DATE THEN 'missed'::public.mortgage_schedule_status ELSE 'due'::public.mortgage_schedule_status END WHERE id=line.id;
  RETURN jsonb_build_object('status','failed','reason','insufficient_funds','attemptId',attempt_id);
 END IF;
 accounts:=public.ensure_mortgage_provider_accounts(c.provider_id,c.currency_code); receivable:=(accounts->>'mortgage_receivable')::uuid; interest_income:=(accounts->>'mortgage_interest_income')::uuid;
 UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-line.total_due_minor WHERE id=fa.id;
 UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-line.principal_due_minor WHERE id=receivable;
 UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+line.interest_due_minor+line.fees_due_minor WHERE id=interest_income;
 INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_profile_id,created_by_actor,completed_at,metadata) VALUES('system_fee','completed',c.currency_code,line.total_due_minor,line.total_due_minor,fa.id,interest_income,'mortgage_schedule_line',line.id,'Mortgage repayment',p_idempotency_key,c.borrower_id,'system',timezone('utc',now()),jsonb_build_object('principal_minor',line.principal_due_minor,'interest_minor',line.interest_due_minor,'receivable_account_id',receivable)) RETURNING id INTO tx;
 INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor) SELECT tx,fa.id,'debit',line.total_due_minor,current_balance_minor+line.total_due_minor,current_balance_minor FROM public.financial_accounts WHERE id=fa.id UNION ALL SELECT tx,receivable,'debit',line.principal_due_minor,current_balance_minor+line.principal_due_minor,current_balance_minor FROM public.financial_accounts WHERE id=receivable UNION ALL SELECT tx,interest_income,'credit',line.interest_due_minor+line.fees_due_minor,current_balance_minor-(line.interest_due_minor+line.fees_due_minor),current_balance_minor FROM public.financial_accounts WHERE id=interest_income;
 INSERT INTO public.mortgage_payments(mortgage_contract_id,schedule_line_id,financial_transaction_id,amount_minor,principal_minor,interest_minor,fees_minor,currency_code,status,idempotency_key) VALUES(c.id,line.id,tx,line.total_due_minor,line.principal_due_minor,line.interest_due_minor,line.fees_due_minor,c.currency_code,'posted',p_idempotency_key) RETURNING id INTO pay_id;
 INSERT INTO public.mortgage_payment_attempts(mortgage_contract_id,schedule_line_id,amount_minor,currency_code,status,idempotency_key) VALUES(c.id,line.id,line.total_due_minor,c.currency_code,'succeeded','attempt-'||p_idempotency_key) ON CONFLICT DO NOTHING;
 UPDATE public.mortgage_schedule_lines SET paid_principal_minor=principal_due_minor,paid_interest_minor=interest_due_minor,paid_fees_minor=fees_due_minor,status='paid',payment_transaction_id=tx WHERE id=line.id;
 SELECT min(due_date) INTO next_due FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id AND status<>'paid';
 UPDATE public.mortgage_contracts SET outstanding_principal_minor=GREATEST(0,outstanding_principal_minor-line.principal_due_minor),remaining_term_months=GREATEST(0,remaining_term_months-1),next_payment_due_date=next_due,status=CASE WHEN next_due IS NULL THEN 'redeemed'::public.mortgage_status ELSE 'active'::public.mortgage_status END WHERE id=c.id;
 UPDATE public.property_security_interests SET outstanding_secured_amount_minor=GREATEST(0,outstanding_secured_amount_minor-line.principal_due_minor),status=CASE WHEN GREATEST(0,outstanding_secured_amount_minor-line.principal_due_minor)=0 THEN 'pending_release'::public.security_interest_status ELSE status END WHERE mortgage_contract_id=c.id AND status='registered';
 INSERT INTO public.mortgage_equity_snapshots(mortgage_contract_id,property_id,property_value_minor,outstanding_principal_minor,equity_minor,ltv_bps,currency_code) SELECT c.id,c.property_id,p.current_valuation_minor,GREATEST(0,c.outstanding_principal_minor-line.principal_due_minor),p.current_valuation_minor-GREATEST(0,c.outstanding_principal_minor-line.principal_due_minor),CASE WHEN p.current_valuation_minor>0 THEN FLOOR(GREATEST(0,c.outstanding_principal_minor-line.principal_due_minor)::numeric*10000/p.current_valuation_minor)::int ELSE 0 END,c.currency_code FROM public.properties p WHERE p.id=c.property_id;
 RETURN jsonb_build_object('status','posted','paymentId',pay_id,'transactionId',tx,'nextPaymentDueDate',next_due);
END $$;
REVOKE ALL ON FUNCTION public.post_mortgage_schedule_payment(uuid,text) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.process_due_mortgage_repayments(p_as_of_date date DEFAULT CURRENT_DATE,p_limit int DEFAULT 50) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n int:=0;
BEGIN
 FOR r IN SELECT l.id FROM public.mortgage_schedule_lines l JOIN public.mortgage_contracts c ON c.id=l.mortgage_contract_id WHERE c.status IN ('active','arrears') AND l.status IN ('scheduled','due','missed') AND l.due_date<=p_as_of_date ORDER BY l.due_date LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.post_mortgage_schedule_payment(r.id,'mortgage-auto-'||r.id||'-'||p_as_of_date); n:=n+1;
 END LOOP; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_due_mortgage_repayments(date,int) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.retry_mortgage_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.mortgage_contracts; l public.mortgage_schedule_lines;
BEGIN
 SELECT * INTO l FROM public.mortgage_schedule_lines WHERE id=p_schedule_line_id; SELECT * INTO c FROM public.mortgage_contracts WHERE id=l.mortgage_contract_id;
 IF c.borrower_type<>'player' OR c.borrower_id<>public.current_player_profile_id() THEN RAISE EXCEPTION 'schedule line not found'; END IF;
 IF l.status NOT IN ('due','missed','scheduled') OR l.due_date>CURRENT_DATE THEN RAISE EXCEPTION 'schedule line is not eligible for retry'; END IF;
 RETURN public.post_mortgage_schedule_payment(p_schedule_line_id,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.progress_mortgage_arrears(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; stage text; n int:=0;
BEGIN
 FOR r IN SELECT l.*,c.borrower_id FROM public.mortgage_schedule_lines l JOIN public.mortgage_contracts c ON c.id=l.mortgage_contract_id WHERE l.status<>'paid' AND l.due_date<p_as_of LOOP
  stage:=CASE WHEN p_as_of-r.due_date<=7 THEN 'grace_period' WHEN p_as_of-r.due_date<30 THEN 'late' WHEN p_as_of-r.due_date<60 THEN 'seriously_late' ELSE 'final_warning' END;
  INSERT INTO public.mortgage_arrears_records(mortgage_contract_id,schedule_line_id,days_overdue,unpaid_principal_minor,unpaid_interest_minor,fees_minor,missed_payment_count,stage) VALUES(r.mortgage_contract_id,r.id,p_as_of-r.due_date,r.principal_due_minor-r.paid_principal_minor,r.interest_due_minor-r.paid_interest_minor,r.fees_due_minor-r.paid_fees_minor,1,stage);
  UPDATE public.mortgage_schedule_lines SET status='missed' WHERE id=r.id; UPDATE public.mortgage_contracts SET status='arrears' WHERE id=r.mortgage_contract_id AND status='active'; n:=n+1;
 END LOOP; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.progress_mortgage_arrears(date) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.make_mortgage_overpayment(p_mortgage_contract_id uuid,p_amount_minor bigint,p_reduction_preference text,p_idempotency_key text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('status','feature_disabled','feature','mortgage_overpayment','message','Overpayments remain disabled until the ledger-backed variation flow is implemented') $$;
CREATE OR REPLACE FUNCTION public.settle_mortgage(p_settlement_quote_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('status','feature_disabled','feature','mortgage_settlement','message','Mortgage settlement remains disabled until the ledger-backed redemption flow is implemented') $$;

CREATE OR REPLACE FUNCTION public.list_my_mortgages() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'propertyId',c.property_id,'providerId',c.provider_id,'originalPrincipalMinor',c.original_principal_minor,'outstandingPrincipalMinor',c.outstanding_principal_minor,'currencyCode',c.currency_code,'annualRateBps',c.annual_rate_bps,'termMonths',c.term_months,'remainingTermMonths',c.remaining_term_months,'nextPaymentDueDate',c.next_payment_due_date,'status',c.status) ORDER BY c.created_at DESC),'[]'::jsonb) FROM public.mortgage_contracts c WHERE c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id()
$$;
CREATE OR REPLACE FUNCTION public.get_mortgage_dashboard(p_mortgage_contract_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('contract',to_jsonb(c),'property',to_jsonb(p),'provider',to_jsonb(bp),'nextScheduleLine',(SELECT to_jsonb(l) FROM public.mortgage_schedule_lines l WHERE l.mortgage_contract_id=c.id AND l.status<>'paid' ORDER BY l.due_date LIMIT 1),'principalPaidMinor',COALESCE((SELECT sum(principal_minor) FROM public.mortgage_payments mp WHERE mp.mortgage_contract_id=c.id AND mp.status='posted'),0),'interestPaidMinor',COALESCE((SELECT sum(interest_minor) FROM public.mortgage_payments mp WHERE mp.mortgage_contract_id=c.id AND mp.status='posted'),0),'arrears',(SELECT to_jsonb(a) FROM public.mortgage_arrears_records a WHERE a.mortgage_contract_id=c.id ORDER BY a.created_at DESC LIMIT 1),'security',(SELECT to_jsonb(s) FROM public.property_security_interests s WHERE s.mortgage_contract_id=c.id ORDER BY s.registration_date DESC LIMIT 1),'equity',(SELECT to_jsonb(e) FROM public.mortgage_equity_snapshots e WHERE e.mortgage_contract_id=c.id ORDER BY e.snapshot_date DESC LIMIT 1)) FROM public.mortgage_contracts c JOIN public.properties p ON p.id=c.property_id JOIN public.banking_providers bp ON bp.id=c.provider_id WHERE c.id=p_mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id()
$$;
CREATE OR REPLACE FUNCTION public.get_mortgage_schedule(p_mortgage_contract_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.instalment_number),'[]'::jsonb) FROM public.mortgage_schedule_lines l JOIN public.mortgage_contracts c ON c.id=l.mortgage_contract_id WHERE c.id=p_mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id() $$;
CREATE OR REPLACE FUNCTION public.get_mortgage_payment_history(p_mortgage_contract_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC),'[]'::jsonb) FROM public.mortgage_payments p JOIN public.mortgage_contracts c ON c.id=p.mortgage_contract_id WHERE c.id=p_mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id() $$;
CREATE OR REPLACE FUNCTION public.get_mortgage_payment_attempts(p_mortgage_contract_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.attempted_at DESC),'[]'::jsonb) FROM public.mortgage_payment_attempts a JOIN public.mortgage_contracts c ON c.id=a.mortgage_contract_id WHERE c.id=p_mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id() $$;
CREATE OR REPLACE FUNCTION public.get_property_detail(p_property_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('property',to_jsonb(p),'listing',(SELECT to_jsonb(l) FROM public.property_listings l WHERE l.property_id=p.id ORDER BY l.listed_at DESC LIMIT 1),'products',public.list_eligible_mortgage_products(p.id),'runningCosts',COALESCE((SELECT jsonb_agg(to_jsonb(rc)) FROM public.property_running_costs rc WHERE rc.property_id=p.id),'[]'::jsonb)) FROM public.properties p WHERE p.id=p_property_id $$;
CREATE OR REPLACE FUNCTION public.get_property_reservation(p_property_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT to_jsonb(r) FROM public.property_reservations r WHERE r.property_id=p_property_id AND r.applicant_type='player' AND r.applicant_id=public.current_player_profile_id() AND r.status='active' ORDER BY r.created_at DESC LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.get_mortgage_underwriting_result(p_application_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT to_jsonb(r) FROM public.mortgage_underwriting_results r JOIN public.mortgage_applications a ON a.id=r.application_id WHERE a.id=p_application_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id() ORDER BY r.created_at DESC LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.get_mortgage_offer(p_application_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT to_jsonb(o) FROM public.mortgage_offers o JOIN public.mortgage_applications a ON a.id=o.application_id WHERE o.application_id=p_application_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id() AND o.status IN ('issued','accepted','completed') ORDER BY o.created_at DESC LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.evaluate_mortgage_application(p_application_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.get_mortgage_underwriting_result(p_application_id) $$;

CREATE OR REPLACE VIEW public.mortgage_reconciliation_exceptions AS
SELECT 'contract_without_security' issue, c.id::text entity_id FROM public.mortgage_contracts c WHERE c.status='active' AND NOT EXISTS(SELECT 1 FROM public.property_security_interests s WHERE s.mortgage_contract_id=c.id AND s.status='registered')
UNION ALL SELECT 'security_without_active_contract',s.id::text FROM public.property_security_interests s LEFT JOIN public.mortgage_contracts c ON c.id=s.mortgage_contract_id AND c.status IN ('active','arrears') WHERE s.status='registered' AND c.id IS NULL
UNION ALL SELECT 'security_balance_mismatch',s.id::text FROM public.property_security_interests s JOIN public.mortgage_contracts c ON c.id=s.mortgage_contract_id WHERE s.status='registered' AND s.outstanding_secured_amount_minor<>c.outstanding_principal_minor
UNION ALL SELECT 'schedule_principal_total_mismatch',c.id::text FROM public.mortgage_contracts c WHERE c.original_principal_minor<>(SELECT COALESCE(sum(principal_due_minor),0) FROM public.mortgage_schedule_lines l WHERE l.mortgage_contract_id=c.id)
UNION ALL SELECT 'payment_component_mismatch',id::text FROM public.mortgage_payments WHERE amount_minor<>principal_minor+interest_minor+fees_minor
UNION ALL SELECT 'duplicate_active_offers',application_id::text FROM public.mortgage_offers WHERE status IN ('issued','accepted') GROUP BY application_id HAVING count(*)>1
UNION ALL SELECT 'duplicate_active_reservations',property_id::text FROM public.property_reservations WHERE status='active' GROUP BY property_id HAVING count(*)>1
UNION ALL SELECT 'contract_next_payment_mismatch',c.id::text FROM public.mortgage_contracts c WHERE c.status IN ('active','arrears') AND c.next_payment_due_date IS DISTINCT FROM (SELECT min(due_date) FROM public.mortgage_schedule_lines l WHERE l.mortgage_contract_id=c.id AND l.status<>'paid');

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['property_ownership_history','property_occupancies','property_valuations','property_permissions','property_running_costs','property_purchase_transactions','property_leases','property_deposits'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP;
END $$;
DROP POLICY IF EXISTS property_ownership_history_owner_select ON public.property_ownership_history;
CREATE POLICY property_ownership_history_owner_select ON public.property_ownership_history FOR SELECT USING (owner_type='player' AND owner_id=public.current_player_profile_id());
DROP POLICY IF EXISTS property_deposits_owner_select ON public.property_deposits;
CREATE POLICY property_deposits_owner_select ON public.property_deposits FOR SELECT USING (owner_type='player' AND owner_id=public.current_player_profile_id());
DROP POLICY IF EXISTS property_purchase_owner_select ON public.property_purchase_transactions;
CREATE POLICY property_purchase_owner_select ON public.property_purchase_transactions FOR SELECT USING (buyer_type='player' AND buyer_id=public.current_player_profile_id());
DROP POLICY IF EXISTS mortgage_affordability_own_select ON public.mortgage_affordability_snapshots;
CREATE POLICY mortgage_affordability_own_select ON public.mortgage_affordability_snapshots FOR SELECT USING (EXISTS(SELECT 1 FROM public.mortgage_applications a WHERE a.id=application_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id()));
DROP POLICY IF EXISTS mortgage_underwriting_own_select ON public.mortgage_underwriting_results;
CREATE POLICY mortgage_underwriting_own_select ON public.mortgage_underwriting_results FOR SELECT USING (EXISTS(SELECT 1 FROM public.mortgage_applications a WHERE a.id=application_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id()));
DROP POLICY IF EXISTS mortgage_equity_own_select ON public.mortgage_equity_snapshots;
CREATE POLICY mortgage_equity_own_select ON public.mortgage_equity_snapshots FOR SELECT USING (EXISTS(SELECT 1 FROM public.mortgage_contracts c WHERE c.id=mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id()));
DROP POLICY IF EXISTS mortgage_arrears_own_select ON public.mortgage_arrears_records;
CREATE POLICY mortgage_arrears_own_select ON public.mortgage_arrears_records FOR SELECT USING (EXISTS(SELECT 1 FROM public.mortgage_contracts c WHERE c.id=mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id()));
DROP POLICY IF EXISTS mortgage_audit_own_select ON public.mortgage_audit_events;
CREATE POLICY mortgage_audit_own_select ON public.mortgage_audit_events FOR SELECT USING ((application_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.mortgage_applications a WHERE a.id=application_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id())) OR (mortgage_contract_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.mortgage_contracts c WHERE c.id=mortgage_contract_id AND c.borrower_type='player' AND c.borrower_id=public.current_player_profile_id())));

UPDATE public.mortgage_products mp SET provider_id=(SELECT id FROM public.banking_providers WHERE provider_code='aurora_international') WHERE mp.product_code='phase8b_fixed_residential' AND mp.provider_id IS NULL;
INSERT INTO public.mortgage_products(provider_id,product_code,product_name,currency_code,rate_model,repayment_strategy,annual_rate_bps,stress_rate_bps,min_deposit_bps,max_ltv_bps,min_term_months,max_term_months,early_repayment_charge_bps,fees,status)
SELECT id,'phase8b1_aurora_fixed_residential','Aurora Fixed Residential Mortgage','GBP','fixed','repayment',475,700,1000,9000,60,360,0,'[]'::jsonb,'active' FROM public.banking_providers WHERE provider_code='aurora_international' ON CONFLICT(product_code) DO UPDATE SET provider_id=EXCLUDED.provider_id,status='active';
SELECT public.ensure_mortgage_provider_accounts(id,'GBP') FROM public.banking_providers WHERE provider_code='aurora_international';
UPDATE public.financial_accounts SET current_balance_minor=GREATEST(current_balance_minor,1000000000) WHERE id=(SELECT finance_account_id FROM public.banking_provider_financial_accounts bpfa JOIN public.banking_providers bp ON bp.id=bpfa.provider_id WHERE bp.provider_code='aurora_international' AND bpfa.currency_code='GBP' AND bpfa.account_role='mortgage_funding_cash');

GRANT EXECUTE ON FUNCTION public.reserve_property_for_mortgage_offer(uuid,text), public.set_mortgage_completion_accounts(uuid,uuid,uuid), public.complete_mortgaged_property_purchase(uuid,uuid,uuid,text), public.retry_mortgage_payment(uuid,text), public.make_mortgage_overpayment(uuid,bigint,text,text), public.settle_mortgage(uuid,text), public.list_my_mortgages(), public.get_mortgage_dashboard(uuid), public.get_mortgage_schedule(uuid), public.get_mortgage_payment_history(uuid), public.get_mortgage_payment_attempts(uuid), public.get_property_detail(uuid), public.get_property_reservation(uuid), public.get_mortgage_underwriting_result(uuid), public.get_mortgage_offer(uuid) TO authenticated;
