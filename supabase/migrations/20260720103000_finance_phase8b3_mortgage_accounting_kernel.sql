-- Finance Phase 8B.3: executable residential mortgage accounting kernel.

-- The journal primitive is intentionally permission-gated by EXECUTE grants.  Security-definer
-- product workflows (mortgages, scheduled processors) must be able to call it on behalf of
-- authenticated players after doing their own domain checks, so the body must not inspect
-- auth.role() directly.
CREATE OR REPLACE FUNCTION public.post_financial_journal(
  p_event_type public.financial_transaction_category,
  p_event_id uuid,
  p_currency_code char(3),
  p_idempotency_key text,
  p_entries jsonb,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tx uuid; debit_total bigint; credit_total bigint; gross bigint; r record; acct public.financial_accounts; before_bal bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key)=0 THEN RAISE EXCEPTION 'idempotency key required'; END IF;
  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key=p_idempotency_key;
  IF tx IS NOT NULL THEN RETURN tx; END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) < 2 THEN RAISE EXCEPTION 'journal requires at least two entries'; END IF;
  SELECT COALESCE(sum(CASE WHEN value->>'direction'='debit' THEN (value->>'amount_minor')::bigint ELSE 0 END),0), COALESCE(sum(CASE WHEN value->>'direction'='credit' THEN (value->>'amount_minor')::bigint ELSE 0 END),0) INTO debit_total, credit_total FROM jsonb_array_elements(p_entries);
  IF debit_total <= 0 OR debit_total <> credit_total THEN RAISE EXCEPTION 'journal debits and credits must balance'; END IF;
  gross := debit_total;
  PERFORM 1 FROM public.financial_accounts fa JOIN (SELECT DISTINCT (value->>'account_id')::uuid id FROM jsonb_array_elements(p_entries)) e ON e.id=fa.id ORDER BY fa.id FOR UPDATE;
  FOR r IN SELECT value->>'account_id' account_id, value->>'direction' direction, (value->>'amount_minor')::bigint amount_minor, value->>'component' component, value->>'description' description FROM jsonb_array_elements(p_entries) LOOP
    IF r.amount_minor <= 0 THEN RAISE EXCEPTION 'journal amounts must be positive'; END IF;
    IF r.direction NOT IN ('debit','credit') THEN RAISE EXCEPTION 'journal direction must be debit or credit'; END IF;
    SELECT * INTO acct FROM public.financial_accounts WHERE id=r.account_id::uuid;
    IF acct.id IS NULL THEN RAISE EXCEPTION 'journal account not found'; END IF;
    IF acct.account_status <> 'active' THEN RAISE EXCEPTION 'journal account is not active'; END IF;
    IF acct.currency_code <> p_currency_code THEN RAISE EXCEPTION 'journal account currency mismatch'; END IF;
    IF acct.owner_type <> 'system' AND r.direction='debit' AND acct.available_balance_minor < r.amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  END LOOP;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,metadata)
  VALUES(p_event_type,'completed',p_currency_code,gross,gross,(SELECT (value->>'account_id')::uuid FROM jsonb_array_elements(p_entries) WHERE value->>'direction'='debit' LIMIT 1),(SELECT (value->>'account_id')::uuid FROM jsonb_array_elements(p_entries) WHERE value->>'direction'='credit' LIMIT 1),p_related_entity_type,p_related_entity_id,p_event_type::text,p_idempotency_key,auth.uid(),COALESCE(auth.uid()::text,'system'),timezone('utc',now()),p_currency_code,p_currency_code,gross,gross,p_metadata||jsonb_build_object('journal_event_id',p_event_id,'journal_entries',p_entries)) RETURNING id INTO tx;
  FOR r IN SELECT value->>'account_id' account_id, value->>'direction' direction, (value->>'amount_minor')::bigint amount_minor, value->>'component' component, value->>'description' description FROM jsonb_array_elements(p_entries) LOOP
    SELECT current_balance_minor INTO before_bal FROM public.financial_accounts WHERE id=r.account_id::uuid FOR UPDATE;
    UPDATE public.financial_accounts SET current_balance_minor = CASE WHEN r.direction='debit' THEN current_balance_minor-r.amount_minor ELSE current_balance_minor+r.amount_minor END, updated_at=timezone('utc',now()) WHERE id=r.account_id::uuid;
    INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES(tx,r.account_id::uuid,r.direction::public.financial_entry_direction,r.amount_minor,before_bal,CASE WHEN r.direction='debit' THEN before_bal-r.amount_minor ELSE before_bal+r.amount_minor END,p_currency_code);
  END LOOP;
  RETURN tx;
END $$;

ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS clearing_account_id uuid REFERENCES public.financial_accounts(id);
ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS release_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.property_deposits ADD COLUMN IF NOT EXISTS release_reason text;
ALTER TABLE public.property_purchase_transactions ADD COLUMN IF NOT EXISTS deposit_settlement_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.property_purchase_transactions ADD COLUMN IF NOT EXISTS provider_origination_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.property_purchase_transactions ADD COLUMN IF NOT EXISTS seller_principal_settlement_transaction_id uuid REFERENCES public.financial_transactions(id);

CREATE UNIQUE INDEX IF NOT EXISTS property_deposits_one_reserved_reservation_phase8b3 ON public.property_deposits(reservation_id) WHERE status='reserved';

CREATE OR REPLACE FUNCTION public.ensure_development_mortgage_provider(p_currency_code char(3) DEFAULT 'GBP') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bp uuid; fund uuid; treasury uuid; bal bigint;
BEGIN
  SELECT id INTO bp FROM public.banking_providers WHERE provider_code='aurora_international';
  IF bp IS NULL THEN
    INSERT INTO public.banking_providers(provider_code,name,brand_name,home_country,supported_countries,supported_currencies,provider_type,status,reputation_score,stability_rating,risk_appetite,service_quality_rating,base_deposit_rate_basis_points,base_lending_margin_basis_points,maximum_exposure_minor,metadata)
    VALUES('aurora_international','Aurora International','Aurora International','United Kingdom',ARRAY['GB'],ARRAY[p_currency_code],'international_bank','active',80,80,60,80,100,550,100000000000,jsonb_build_object('development_fixture',true,'phase','8B.3')) RETURNING id INTO bp;
  ELSE
    UPDATE public.banking_providers SET status='active', supported_currencies=CASE WHEN p_currency_code=ANY(supported_currencies) THEN supported_currencies ELSE array_append(supported_currencies,p_currency_code) END WHERE id=bp;
  END IF;
  PERFORM public.ensure_mortgage_provider_accounts(bp,p_currency_code);
  UPDATE public.financial_accounts fa SET currency_code=bpfa.currency_code, default_currency_code=bpfa.currency_code FROM public.banking_provider_financial_accounts bpfa WHERE bpfa.provider_id=bp AND bpfa.finance_account_id=fa.id;
  IF NOT EXISTS (SELECT 1 FROM public.mortgage_products WHERE product_code='aurora_residential_fixed_gbp') THEN
    INSERT INTO public.mortgage_products(provider_id,product_code,product_name,status,currency_code,annual_rate_bps,stress_rate_bps,min_deposit_bps,max_ltv_bps,min_term_months,max_term_months,fees)
    VALUES(bp,'aurora_residential_fixed_gbp','Aurora Residential Fixed GBP','active',p_currency_code,550,700,1000,9000,12,360,'[]'::jsonb);
  ELSE
    UPDATE public.mortgage_products SET provider_id=bp,status='active',currency_code=p_currency_code WHERE product_code='aurora_residential_fixed_gbp';
  END IF;
  fund := public.get_or_create_provider_finance_account(bp,p_currency_code,'mortgage_funding_cash');
  SELECT id INTO treasury FROM public.financial_accounts WHERE owner_type='system' AND owner_id IS NULL AND currency_code=p_currency_code AND metadata->>'account_role'='world_banking_treasury' LIMIT 1;
  IF treasury IS NULL THEN
    INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,currency_code,default_currency_code,current_balance_minor,is_primary,metadata) VALUES('system',NULL,'World Banking Treasury',p_currency_code,p_currency_code,0,false,jsonb_build_object('account_role','world_banking_treasury','development_fixture',true)) RETURNING id INTO treasury;
  END IF;
  SELECT current_balance_minor INTO bal FROM public.financial_accounts WHERE id=fund;
  IF bal < 1000000000 THEN
    PERFORM public.post_financial_journal('administrative_adjustment',gen_random_uuid(),p_currency_code,'phase8b3-dev-mortgage-capital-'||bp,jsonb_build_array(jsonb_build_object('account_id',treasury,'direction','debit','amount_minor',1000000000-bal,'component','development_treasury_source'),jsonb_build_object('account_id',fund,'direction','credit','amount_minor',1000000000-bal,'component','mortgage_funding_cash')),'banking_provider',bp,jsonb_build_object('phase','8B.3','development_fixture',true,'economic_model','world treasury funds provider mortgage cash'));
  END IF;
  RETURN bp;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_property_seller_financial_account(p_seller_type public.property_owner_type,p_seller_id uuid,p_currency_code char(3)) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acct uuid;
BEGIN
 IF p_seller_type='world' THEN
  SELECT id INTO acct FROM public.financial_accounts WHERE owner_type='system' AND owner_id IS NULL AND currency_code=p_currency_code AND account_status='active' AND metadata->>'account_role'='world_property_treasury' ORDER BY created_at LIMIT 1;
  IF acct IS NULL THEN INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,currency_code,default_currency_code,current_balance_minor,is_primary,account_status,metadata) VALUES('system',NULL,'World Property Treasury',p_currency_code,p_currency_code,0,false,'active',jsonb_build_object('account_role','world_property_treasury','phase','8B.3')) RETURNING id INTO acct; END IF;
 ELSIF p_seller_type='player' THEN
  SELECT ba.linked_finance_account_id INTO acct FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id WHERE ba.owner_type='player' AND ba.owner_id=p_seller_id AND ba.currency_code=p_currency_code AND ba.status='active' AND fa.account_status='active' AND fa.currency_code=p_currency_code AND NOT (fa.metadata ? 'provider_account_role') ORDER BY ba.created_at LIMIT 1;
 ELSE
  RAISE EXCEPTION 'seller type is not enabled for mortgage settlement';
 END IF;
 IF acct IS NULL THEN RAISE EXCEPTION 'seller financial account unavailable'; END IF;
 RETURN acct;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_mortgage_deposit(p_offer_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; res public.property_reservations; dep_ba public.bank_accounts; src public.financial_accounts; clearing uuid; tx uuid; dep_id uuid;
BEGIN
 IF p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
 SELECT id INTO dep_id FROM public.property_deposits WHERE idempotency_key=p_idempotency_key; IF dep_id IS NOT NULL THEN RETURN dep_id; END IF;
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id FOR UPDATE;
 IF offer.id IS NULL OR app.applicant_type<>'player' OR app.applicant_id<>pid THEN RAISE EXCEPTION 'offer not found'; END IF;
 SELECT * INTO res FROM public.property_reservations WHERE property_id=offer.property_id AND applicant_type='player' AND applicant_id=pid AND status='active' FOR UPDATE;
 IF offer.status<>'accepted' OR offer.expires_at<=timezone('utc',now()) OR res.id IS NULL OR res.expires_at<=timezone('utc',now()) THEN RAISE EXCEPTION 'accepted unexpired offer and reservation required'; END IF;
 SELECT * INTO dep_ba FROM public.bank_accounts WHERE id=offer.deposit_bank_account_id FOR UPDATE; SELECT * INTO src FROM public.financial_accounts WHERE id=dep_ba.linked_finance_account_id FOR UPDATE;
 IF dep_ba.owner_type<>'player' OR dep_ba.owner_id<>pid OR dep_ba.status<>'active' OR dep_ba.currency_code<>offer.currency_code OR src.account_status<>'active' OR src.currency_code<>offer.currency_code THEN RAISE EXCEPTION 'deposit account is not eligible'; END IF;
 IF src.available_balance_minor<offer.deposit_minor THEN RAISE EXCEPTION 'insufficient deposit funds'; END IF;
 clearing := public.get_or_create_provider_finance_account(offer.provider_id,offer.currency_code,'mortgage_settlement_clearing');
 tx := public.post_financial_journal('mortgage_deposit_reservation',gen_random_uuid(),offer.currency_code,p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',src.id,'direction','debit','amount_minor',offer.deposit_minor,'component','player_deposit'),jsonb_build_object('account_id',clearing,'direction','credit','amount_minor',offer.deposit_minor,'component','mortgage_settlement_clearing')),'mortgage_offer',offer.id,jsonb_build_object('reservation_id',res.id));
 INSERT INTO public.property_deposits(property_id,owner_type,owner_id,amount_minor,currency_code,status,source_account_id,clearing_account_id,reservation_id,financial_transaction_id,idempotency_key) VALUES(offer.property_id,'player',pid,offer.deposit_minor,offer.currency_code,'reserved',src.id,clearing,res.id,tx,p_idempotency_key) RETURNING id INTO dep_id;
 RETURN dep_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_mortgage_deposit(p_property_deposit_id uuid,p_reason text,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE dep public.property_deposits; tx uuid;
BEGIN
 SELECT * INTO dep FROM public.property_deposits WHERE id=p_property_deposit_id FOR UPDATE;
 IF dep.id IS NULL THEN RAISE EXCEPTION 'deposit not found'; END IF;
 IF dep.status='released' AND dep.release_transaction_id IS NOT NULL THEN RETURN dep.release_transaction_id; END IF;
 IF dep.status<>'reserved' THEN RAISE EXCEPTION 'deposit is not reserved'; END IF;
 tx := public.post_financial_journal('mortgage_deposit_release',gen_random_uuid(),dep.currency_code,p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',dep.clearing_account_id,'direction','debit','amount_minor',dep.amount_minor,'component','mortgage_settlement_clearing'),jsonb_build_object('account_id',dep.source_account_id,'direction','credit','amount_minor',dep.amount_minor,'component','player_refund')),'property_deposit',dep.id,jsonb_build_object('reason',p_reason));
 UPDATE public.property_deposits SET status='released',released_at=timezone('utc',now()),release_reason=p_reason,release_transaction_id=tx WHERE id=dep.id;
 RETURN tx;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mortgaged_property_purchase(p_offer_id uuid,p_deposit_bank_account_id uuid,p_repayment_bank_account_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); offer public.mortgage_offers; app public.mortgage_applications; prop public.properties; res public.property_reservations; dep public.property_deposits; dep_ba public.bank_accounts; repay_ba public.bank_accounts; repay_fa uuid; accounts jsonb; funding uuid; receivable uuid; seller uuid; contract_id uuid; deposit_tx uuid; orig_tx uuid; principal_tx uuid; i int; bal bigint; int_due bigint; prin_due bigint; monthly bigint; next_due date; obl uuid;
BEGIN
 IF p_idempotency_key IS NULL OR length(p_idempotency_key)<8 THEN RAISE EXCEPTION 'idempotency key is required'; END IF;
 SELECT id INTO contract_id FROM public.mortgage_contracts WHERE idempotency_key=p_idempotency_key; IF contract_id IS NOT NULL THEN RETURN contract_id; END IF;
 PERFORM public.set_mortgage_completion_accounts(p_offer_id,p_deposit_bank_account_id,p_repayment_bank_account_id);
 SELECT * INTO offer FROM public.mortgage_offers WHERE id=p_offer_id FOR UPDATE; SELECT * INTO app FROM public.mortgage_applications WHERE id=offer.application_id FOR UPDATE; SELECT * INTO prop FROM public.properties WHERE id=offer.property_id FOR UPDATE; SELECT * INTO res FROM public.property_reservations WHERE property_id=offer.property_id AND applicant_type='player' AND applicant_id=pid AND status='active' FOR UPDATE;
 IF offer.status<>'accepted' OR offer.expires_at<=timezone('utc',now()) OR app.applicant_id<>pid OR res.id IS NULL OR res.expires_at<=timezone('utc',now()) THEN RAISE EXCEPTION 'offer or reservation is not completable'; END IF;
 SELECT * INTO dep_ba FROM public.bank_accounts WHERE id=p_deposit_bank_account_id FOR UPDATE; SELECT * INTO repay_ba FROM public.bank_accounts WHERE id=p_repayment_bank_account_id FOR UPDATE; repay_fa:=repay_ba.linked_finance_account_id;
 IF dep_ba.owner_id<>pid OR repay_ba.owner_id<>pid OR dep_ba.status<>'active' OR repay_ba.status<>'active' OR dep_ba.currency_code<>offer.currency_code OR repay_ba.currency_code<>offer.currency_code THEN RAISE EXCEPTION 'completion accounts are not eligible'; END IF;
 SELECT * INTO dep FROM public.property_deposits WHERE reservation_id=res.id AND status='reserved' FOR UPDATE;
 IF dep.id IS NULL THEN RAISE EXCEPTION 'reserved deposit required'; END IF;
 IF dep.amount_minor<>offer.deposit_minor OR dep.currency_code<>offer.currency_code OR dep.source_account_id<>dep_ba.linked_finance_account_id THEN RAISE EXCEPTION 'reserved deposit does not match offer'; END IF;
 accounts:=public.ensure_mortgage_provider_accounts(offer.provider_id,offer.currency_code); funding:=(accounts->>'mortgage_funding_cash')::uuid; receivable:=(accounts->>'mortgage_receivable')::uuid; seller:=public.resolve_property_seller_financial_account(prop.owner_type,prop.owner_id,offer.currency_code);
 IF seller=receivable THEN RAISE EXCEPTION 'seller account cannot be receivable account'; END IF;
 IF (SELECT current_balance_minor FROM public.financial_accounts WHERE id=funding FOR UPDATE) < offer.principal_minor THEN RAISE EXCEPTION 'mortgage provider has insufficient liquidity'; END IF;
 INSERT INTO public.mortgage_contracts(offer_id,property_id,provider_id,borrower_type,borrower_id,deposit_bank_account_id,repayment_bank_account_id,original_principal_minor,outstanding_principal_minor,currency_code,annual_rate_bps,term_months,remaining_term_months,next_payment_due_date,status,activated_at,idempotency_key) VALUES(offer.id,prop.id,offer.provider_id,'player',pid,dep_ba.id,repay_ba.id,offer.principal_minor,offer.principal_minor,offer.currency_code,offer.annual_rate_bps,offer.term_months,offer.term_months,offer.first_payment_date,'active',timezone('utc',now()),p_idempotency_key) RETURNING id INTO contract_id;
 monthly:=offer.monthly_payment_minor; bal:=offer.principal_minor;
 FOR i IN 1..offer.term_months LOOP
  int_due:=FLOOR(bal::numeric*offer.annual_rate_bps/10000/12)::bigint; prin_due:=CASE WHEN i=offer.term_months THEN bal ELSE LEAST(bal,GREATEST(1,monthly-int_due)) END;
  INSERT INTO public.mortgage_schedule_lines(mortgage_contract_id,schedule_version,instalment_number,due_date,opening_principal_minor,principal_due_minor,interest_due_minor,total_due_minor,currency_code,status) VALUES(contract_id,1,i,(offer.first_payment_date+((i-1)||' months')::interval)::date,bal,prin_due,int_due,prin_due+int_due,offer.currency_code,'scheduled'); bal:=bal-prin_due;
 END LOOP;
 deposit_tx:=public.post_financial_journal('property_purchase_settlement',gen_random_uuid(),offer.currency_code,'phase8b3-deposit-settle-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',dep.clearing_account_id,'direction','debit','amount_minor',offer.deposit_minor,'component','deposit_clearing'),jsonb_build_object('account_id',seller,'direction','credit','amount_minor',offer.deposit_minor,'component','seller_deposit_receipt')),'mortgage_contract',contract_id,jsonb_build_object('deposit_id',dep.id));
 orig_tx:=public.post_financial_journal('mortgage_origination',gen_random_uuid(),offer.currency_code,'phase8b3-origination-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',funding,'direction','debit','amount_minor',offer.principal_minor,'component','provider_funding_cash'),jsonb_build_object('account_id',receivable,'direction','credit','amount_minor',offer.principal_minor,'component','mortgage_receivable')),'mortgage_contract',contract_id,jsonb_build_object('provider_id',offer.provider_id));
 principal_tx:=public.post_financial_journal('property_purchase_settlement',gen_random_uuid(),offer.currency_code,'phase8b3-principal-settle-'||p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',funding,'direction','debit','amount_minor',offer.principal_minor,'component','provider_principal_cash'),jsonb_build_object('account_id',seller,'direction','credit','amount_minor',offer.principal_minor,'component','seller_principal_receipt')),'mortgage_contract',contract_id,jsonb_build_object('provider_id',offer.provider_id));
 INSERT INTO public.property_purchase_transactions(property_id,buyer_type,buyer_id,seller_type,seller_id,purchase_price_minor,deposit_minor,mortgage_principal_minor,currency_code,financial_transaction_id,status,idempotency_key,completed_at,settlement_transaction_ids,seller_financial_account_id,deposit_settlement_transaction_id,provider_origination_transaction_id,seller_principal_settlement_transaction_id) VALUES(prop.id,'player',pid,prop.owner_type,prop.owner_id,offer.purchase_price_minor,offer.deposit_minor,offer.principal_minor,offer.currency_code,principal_tx,'completed',p_idempotency_key,timezone('utc',now()),ARRAY[deposit_tx,orig_tx,principal_tx],seller,deposit_tx,orig_tx,principal_tx);
 UPDATE public.properties SET owner_type='player',owner_id=pid,listing_status='sold',persistent_status='occupied',updated_at=timezone('utc',now()) WHERE id=prop.id;
 UPDATE public.property_listings SET status='sold',closed_at=timezone('utc',now()) WHERE property_id=prop.id AND status IN ('reserved','for_sale'); UPDATE public.property_reservations SET status='completed',completed_at=timezone('utc',now()) WHERE id=res.id; UPDATE public.property_deposits SET status='applied',released_at=timezone('utc',now()) WHERE id=dep.id;
 INSERT INTO public.property_ownership_history(property_id,owner_type,owner_id,purchase_price_minor,currency_code) VALUES(prop.id,'player',pid,offer.purchase_price_minor,offer.currency_code);
 INSERT INTO public.property_security_interests(property_id,mortgage_contract_id,provider_id,original_secured_amount_minor,outstanding_secured_amount_minor,currency_code) VALUES(prop.id,contract_id,offer.provider_id,offer.principal_minor,offer.principal_minor,offer.currency_code);
 INSERT INTO public.recurring_financial_obligations(owner_type,owner_id,owner_account_id,expense_category,description,amount_minor,currency_code,frequency,next_due_date,related_entity_type,related_entity_id,auto_pay_enabled,grace_period_days,cancellable_by_owner) VALUES('player',pid,repay_fa,'system_fee','Mortgage repayment',offer.monthly_payment_minor,offer.currency_code,'monthly',offer.first_payment_date,'mortgage_contract',contract_id,true,7,false) RETURNING id INTO obl;
 UPDATE public.mortgage_contracts SET recurring_obligation_id=obl WHERE id=contract_id;
 INSERT INTO public.mortgage_equity_snapshots(mortgage_contract_id,property_id,property_value_minor,outstanding_principal_minor,equity_minor,ltv_bps,currency_code) VALUES(contract_id,prop.id,prop.current_valuation_minor,offer.principal_minor,prop.current_valuation_minor-offer.principal_minor,FLOOR(offer.principal_minor::numeric*10000/prop.current_valuation_minor)::int,offer.currency_code);
 UPDATE public.mortgage_offers SET status='completed' WHERE id=offer.id; UPDATE public.mortgage_applications SET status='active',updated_at=timezone('utc',now()) WHERE id=app.id;
 RETURN contract_id;
END $$;

CREATE OR REPLACE FUNCTION public.post_mortgage_schedule_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line public.mortgage_schedule_lines; c public.mortgage_contracts; ba public.bank_accounts; fa public.financial_accounts; accounts jsonb; cash uuid; receivable uuid; interest_income uuid; fee_income uuid; tx uuid; pay_id uuid; attempt_id uuid; next_due date; unpaid_principal bigint; unpaid_count int;
BEGIN
 SELECT id INTO pay_id FROM public.mortgage_payments WHERE idempotency_key=p_idempotency_key; IF pay_id IS NOT NULL THEN RETURN jsonb_build_object('status','already_posted','paymentId',pay_id); END IF;
 SELECT * INTO line FROM public.mortgage_schedule_lines WHERE id=p_schedule_line_id FOR UPDATE; SELECT * INTO c FROM public.mortgage_contracts WHERE id=line.mortgage_contract_id FOR UPDATE; SELECT * INTO ba FROM public.bank_accounts WHERE id=c.repayment_bank_account_id FOR UPDATE; SELECT * INTO fa FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE;
 IF line.id IS NULL OR c.status NOT IN ('active','arrears') OR line.schedule_version<>(SELECT max(schedule_version) FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id) THEN RAISE EXCEPTION 'schedule line is not payable'; END IF;
 IF line.status='paid' THEN RETURN jsonb_build_object('status','already_paid','scheduleLineId',line.id); END IF;
 IF fa.available_balance_minor < line.total_due_minor THEN
  INSERT INTO public.mortgage_payment_attempts(mortgage_contract_id,schedule_line_id,amount_minor,currency_code,status,failure_reason,failure_type,error_classification,retry_eligible,idempotency_key) VALUES(c.id,line.id,line.total_due_minor,c.currency_code,'failed','insufficient_funds','insufficient_funds','business',true,p_idempotency_key) ON CONFLICT DO NOTHING RETURNING id INTO attempt_id;
  UPDATE public.mortgage_schedule_lines SET status=CASE WHEN due_date<CURRENT_DATE THEN 'missed'::public.mortgage_schedule_status ELSE 'due'::public.mortgage_schedule_status END WHERE id=line.id;
  RETURN jsonb_build_object('status','failed','reason','insufficient_funds','attemptId',attempt_id);
 END IF;
 accounts:=public.ensure_mortgage_provider_accounts(c.provider_id,c.currency_code); cash:=(accounts->>'mortgage_settlement_clearing')::uuid; receivable:=(accounts->>'mortgage_receivable')::uuid; interest_income:=(accounts->>'mortgage_interest_income')::uuid; fee_income:=(accounts->>'mortgage_fee_income')::uuid;
 tx:=public.post_financial_journal('mortgage_principal_repayment',gen_random_uuid(),c.currency_code,p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',fa.id,'direction','debit','amount_minor',line.total_due_minor,'component','borrower_cash'),jsonb_build_object('account_id',cash,'direction','credit','amount_minor',line.total_due_minor,'component','provider_payment_cash'),jsonb_build_object('account_id',receivable,'direction','debit','amount_minor',line.principal_due_minor,'component','principal_receivable_reduction'),jsonb_build_object('account_id',interest_income,'direction','credit','amount_minor',line.interest_due_minor,'component','interest_income'),jsonb_build_object('account_id',fee_income,'direction','credit','amount_minor',GREATEST(line.fees_due_minor,1),'component','fee_income'),jsonb_build_object('account_id',cash,'direction','debit','amount_minor',GREATEST(line.fees_due_minor,1),'component','fee_balance_adjustment')),'mortgage_schedule_line',line.id,jsonb_build_object('contract_id',c.id));
 INSERT INTO public.mortgage_payments(mortgage_contract_id,schedule_line_id,financial_transaction_id,journal_event_id,principal_transaction_id,interest_transaction_id,fee_transaction_id,amount_minor,principal_minor,interest_minor,fees_minor,currency_code,status,idempotency_key) VALUES(c.id,line.id,tx,tx,tx,tx,tx,line.total_due_minor,line.principal_due_minor,line.interest_due_minor,line.fees_due_minor,c.currency_code,'posted',p_idempotency_key) RETURNING id INTO pay_id;
 INSERT INTO public.mortgage_payment_attempts(mortgage_contract_id,schedule_line_id,amount_minor,currency_code,status,payment_id,idempotency_key) VALUES(c.id,line.id,line.total_due_minor,c.currency_code,'succeeded',pay_id,'attempt-'||p_idempotency_key) ON CONFLICT DO NOTHING;
 UPDATE public.mortgage_schedule_lines SET paid_principal_minor=principal_due_minor,paid_interest_minor=interest_due_minor,paid_fees_minor=fees_due_minor,status='paid',payment_transaction_id=tx WHERE id=line.id;
 SELECT COALESCE(sum(principal_due_minor-paid_principal_minor),0), count(*) FILTER (WHERE status<>'paid'), min(due_date) FILTER (WHERE status<>'paid') INTO unpaid_principal, unpaid_count, next_due FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id AND schedule_version=line.schedule_version;
 UPDATE public.mortgage_contracts SET outstanding_principal_minor=unpaid_principal,remaining_term_months=unpaid_count,next_payment_due_date=next_due,status=CASE WHEN unpaid_count=0 THEN 'redeemed'::public.mortgage_status ELSE 'active'::public.mortgage_status END,redeemed_at=CASE WHEN unpaid_count=0 THEN timezone('utc',now()) ELSE redeemed_at END WHERE id=c.id;
 UPDATE public.property_security_interests SET outstanding_secured_amount_minor=unpaid_principal,status=CASE WHEN unpaid_principal=0 THEN 'released'::public.security_interest_status ELSE status END,release_date=CASE WHEN unpaid_principal=0 THEN CURRENT_DATE ELSE release_date END WHERE mortgage_contract_id=c.id AND status IN ('registered','pending_release');
 UPDATE public.recurring_financial_obligations SET next_due_date=next_due,status=CASE WHEN unpaid_count=0 THEN 'cancelled' ELSE status END WHERE id=c.recurring_obligation_id;
 RETURN jsonb_build_object('status','posted','paymentId',pay_id,'transactionId',tx,'nextPaymentDueDate',next_due);
END $$;

CREATE OR REPLACE FUNCTION public.retry_mortgage_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.mortgage_contracts; l public.mortgage_schedule_lines;
BEGIN
 SELECT * INTO l FROM public.mortgage_schedule_lines WHERE id=p_schedule_line_id; SELECT * INTO c FROM public.mortgage_contracts WHERE id=l.mortgage_contract_id;
 IF c.borrower_type<>'player' OR c.borrower_id<>public.current_player_profile_id() THEN RAISE EXCEPTION 'schedule line not found'; END IF;
 IF l.status NOT IN ('due','missed','scheduled') OR l.due_date>CURRENT_DATE THEN RAISE EXCEPTION 'schedule line is not eligible for retry'; END IF;
 RETURN public.post_mortgage_schedule_payment(p_schedule_line_id,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.process_due_mortgage_repayments(p_as_of_date date DEFAULT CURRENT_DATE,p_limit int DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; result jsonb; attempted int:=0; posted int:=0; insufficient int:=0; skipped int:=0; errored int:=0;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT l.id FROM public.mortgage_schedule_lines l JOIN public.mortgage_contracts c ON c.id=l.mortgage_contract_id WHERE c.status IN ('active','arrears') AND l.status IN ('scheduled','due','missed') AND l.due_date<=p_as_of_date AND l.schedule_version=(SELECT max(schedule_version) FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id) ORDER BY l.due_date LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  attempted:=attempted+1;
  BEGIN result:=public.post_mortgage_schedule_payment(r.id,'mortgage-auto-'||r.id||'-'||p_as_of_date); IF result->>'status'='posted' THEN posted:=posted+1; ELSIF result->>'reason'='insufficient_funds' THEN insufficient:=insufficient+1; ELSE skipped:=skipped+1; END IF; EXCEPTION WHEN OTHERS THEN errored:=errored+1; END;
 END LOOP;
 RETURN jsonb_build_object('attempted',attempted,'posted',posted,'failedInsufficientFunds',insufficient,'skipped',skipped,'errored',errored);
END $$;

CREATE OR REPLACE FUNCTION public.get_mortgage_offer_by_id(p_offer_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('offer',to_jsonb(o),'application',to_jsonb(a),'property',to_jsonb(p),'provider',to_jsonb(bp),'reservation',(SELECT to_jsonb(r) FROM public.property_reservations r WHERE r.property_id=o.property_id AND r.applicant_type='player' AND r.applicant_id=public.current_player_profile_id() AND r.status='active' ORDER BY r.created_at DESC LIMIT 1)) FROM public.mortgage_offers o JOIN public.mortgage_applications a ON a.id=o.application_id JOIN public.properties p ON p.id=o.property_id JOIN public.banking_providers bp ON bp.id=o.provider_id WHERE o.id=p_offer_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.list_eligible_mortgage_completion_accounts(p_offer_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',ba.id,'financeAccountId',ba.linked_finance_account_id,'providerName',bp.brand_name,'accountType',ba.account_type,'currencyCode',ba.currency_code,'availableBalanceMinor',fa.available_balance_minor,'maskedIdentifier',right(ba.id::text,8),'restrictions',jsonb_build_object('withdrawal',ba.withdrawal_restrictions,'deposit',ba.deposit_restrictions)) ORDER BY ba.created_at),'[]'::jsonb)
 FROM public.mortgage_offers o JOIN public.mortgage_applications a ON a.id=o.application_id JOIN public.bank_accounts ba ON ba.owner_type='player' AND ba.owner_id=a.applicant_id AND ba.currency_code=o.currency_code AND ba.status='active' JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id AND fa.account_status='active' JOIN public.banking_providers bp ON bp.id=ba.provider_id WHERE o.id=p_offer_id AND a.applicant_type='player' AND a.applicant_id=public.current_player_profile_id();
$$;

GRANT EXECUTE ON FUNCTION public.ensure_development_mortgage_provider(char), public.resolve_property_seller_financial_account(public.property_owner_type,uuid,char), public.release_mortgage_deposit(uuid,text,text), public.process_due_mortgage_repayments(date,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_mortgage_deposit(uuid,text), public.complete_mortgaged_property_purchase(uuid,uuid,uuid,text), public.retry_mortgage_payment(uuid,text), public.get_mortgage_offer_by_id(uuid), public.list_eligible_mortgage_completion_accounts(uuid) TO authenticated;

SELECT public.ensure_development_mortgage_provider('GBP');
