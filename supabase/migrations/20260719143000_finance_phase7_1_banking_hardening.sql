-- Finance Phase 7.1: secure banking settlement and loan servicing hardening.

CREATE OR REPLACE FUNCTION public.is_service_role() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(auth.jwt()->>'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_financial_owner(
  p_owner_type public.financial_owner_type,
  p_owner_id uuid,
  p_permission_key text DEFAULT 'view_borrowing',
  p_actor_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.is_service_role() OR public.has_role(p_actor_user_id, 'admin') THEN
    RETURN true;
  END IF;

  IF p_owner_type = 'player' THEN
    RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_owner_id AND p.user_id = p_actor_user_id);
  ELSIF p_owner_type = 'band' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.band_members bm
      JOIN public.profiles p ON p.id = bm.profile_id
      WHERE bm.band_id = p_owner_id AND p.user_id = p_actor_user_id
    );
  ELSIF p_owner_type = 'company' THEN
    RETURN EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_owner_id AND c.owner_id = p_actor_user_id);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_financial_owner_permission(
  p_owner_type public.financial_owner_type,
  p_owner_id uuid,
  p_permission_key text DEFAULT 'view_borrowing',
  p_actor_user_id uuid DEFAULT auth.uid()
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_access_financial_owner(p_owner_type, p_owner_id, p_permission_key, p_actor_user_id) THEN
    RAISE EXCEPTION 'not authorised for financial owner %:% permission %', p_owner_type, p_owner_id, p_permission_key
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_loan_contract(p_loan_contract_id uuid, p_permission_key text DEFAULT 'view_borrowing')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_contracts c
    WHERE c.id = p_loan_contract_id
      AND public.can_access_financial_owner(c.borrower_type, c.borrower_id, p_permission_key, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_loan_application(p_application_id uuid, p_permission_key text DEFAULT 'view_borrowing')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loan_applications a
    WHERE a.id = p_application_id
      AND public.can_access_financial_owner(a.applicant_type, a.applicant_id, p_permission_key, auth.uid())
  );
$$;

-- Exact account ledger primitive. It is intentionally lower-level than owner transfers:
-- callers must pass the accounts chosen by the contract/product workflow.
CREATE OR REPLACE FUNCTION public.finance_transfer_accounts(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount_minor bigint,
  p_currency_code char(3),
  p_transaction_category public.financial_transaction_category,
  p_description text,
  p_idempotency_key text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  src public.financial_accounts;
  dst public.financial_accounts;
  tx uuid;
  first_id uuid;
  second_id uuid;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN RAISE EXCEPTION 'source and destination accounts are required'; END IF;
  IF p_source_account_id = p_destination_account_id THEN RAISE EXCEPTION 'self transfers are not allowed'; END IF;
  IF p_currency_code !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'invalid currency'; END IF;

  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF tx IS NOT NULL THEN RETURN tx; END IF;

  first_id := LEAST(p_source_account_id, p_destination_account_id);
  second_id := GREATEST(p_source_account_id, p_destination_account_id);
  PERFORM 1 FROM public.financial_accounts WHERE id IN (first_id, second_id) ORDER BY id FOR UPDATE;

  SELECT * INTO src FROM public.financial_accounts WHERE id = p_source_account_id;
  SELECT * INTO dst FROM public.financial_accounts WHERE id = p_destination_account_id;
  IF src.id IS NULL OR dst.id IS NULL THEN RAISE EXCEPTION 'finance account not found'; END IF;
  IF src.account_status <> 'active' OR dst.account_status <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF src.default_currency_code <> p_currency_code OR dst.default_currency_code <> p_currency_code THEN RAISE EXCEPTION 'account currency mismatch'; END IF;
  IF src.owner_type <> 'system' AND src.available_balance_minor < p_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,metadata)
  VALUES (p_transaction_category,'completed',p_currency_code,p_amount_minor,p_amount_minor,src.id,dst.id,p_related_entity_type,p_related_entity_id,p_description,p_idempotency_key,auth.uid(),p_actor_profile_id,COALESCE(auth.uid()::text,'system'),timezone('utc',now()),p_metadata)
  RETURNING id INTO tx;

  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor - p_amount_minor, updated_at = timezone('utc',now()) WHERE id = src.id;
  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor + p_amount_minor, updated_at = timezone('utc',now()) WHERE id = dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor) VALUES
    (tx, src.id, 'debit', p_amount_minor, src.current_balance_minor, src.current_balance_minor - p_amount_minor),
    (tx, dst.id, 'credit', p_amount_minor, dst.current_balance_minor, dst.current_balance_minor + p_amount_minor);
  RETURN tx;
END;
$$;

CREATE TABLE IF NOT EXISTS public.banking_provider_financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.banking_providers(id),
  currency_code char(3) NOT NULL,
  account_role text NOT NULL CHECK (account_role IN ('lending_funding','loan_receivable','interest_income','fee_income','loss_write_off','interest_expense')),
  finance_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(provider_id, currency_code, account_role)
);
ALTER TABLE public.banking_provider_financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS banking_provider_financial_accounts_admin_select ON public.banking_provider_financial_accounts;
CREATE POLICY banking_provider_financial_accounts_admin_select ON public.banking_provider_financial_accounts FOR SELECT USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_or_create_provider_finance_account(p_provider_id uuid, p_currency_code char(3), p_account_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing uuid; acct public.financial_accounts; provider public.banking_providers;
BEGIN
  SELECT finance_account_id INTO existing FROM public.banking_provider_financial_accounts WHERE provider_id=p_provider_id AND currency_code=p_currency_code AND account_role=p_account_role;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  SELECT * INTO provider FROM public.banking_providers WHERE id=p_provider_id;
  IF provider.id IS NULL THEN RAISE EXCEPTION 'banking provider not found'; END IF;
  INSERT INTO public.financial_accounts(owner_type, owner_id, account_name, default_currency_code, is_primary, metadata)
  VALUES ('system', NULL, provider.provider_code || ' ' || p_currency_code || ' ' || p_account_role, p_currency_code, false, jsonb_build_object('provider_id', p_provider_id, 'provider_account_role', p_account_role))
  RETURNING * INTO acct;
  INSERT INTO public.banking_provider_financial_accounts(provider_id,currency_code,account_role,finance_account_id) VALUES(p_provider_id,p_currency_code,p_account_role,acct.id)
  ON CONFLICT(provider_id,currency_code,account_role) DO UPDATE SET provider_id=EXCLUDED.provider_id RETURNING finance_account_id INTO existing;
  RETURN existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_bank_account(p_owner_type public.financial_owner_type,p_owner_id uuid,p_provider_id uuid,p_account_type public.bank_account_type,p_currency char(3),p_idempotency_key text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fa public.financial_accounts; ba uuid; provider public.banking_providers;
BEGIN
  PERFORM public.assert_financial_owner_permission(p_owner_type,p_owner_id,'open_bank_account',auth.uid());
  SELECT * INTO provider FROM public.banking_providers WHERE id=p_provider_id AND status IN ('active','restricted');
  IF provider.id IS NULL OR NOT (p_currency = ANY(provider.supported_currencies)) THEN RAISE EXCEPTION 'provider does not support account'; END IF;
  SELECT id INTO ba FROM public.bank_accounts WHERE metadata->>'idempotency_key'=p_idempotency_key AND p_idempotency_key IS NOT NULL;
  IF ba IS NOT NULL THEN RETURN ba; END IF;
  INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,default_currency_code,is_primary,metadata)
  VALUES (p_owner_type,p_owner_id,initcap(p_account_type::text)||' bank account',p_currency,false,jsonb_build_object('account_purpose','bank_'||p_account_type::text)) RETURNING * INTO fa;
  INSERT INTO public.bank_accounts(provider_id,owner_type,owner_id,linked_finance_account_id,account_type,currency_code,status,opened_at,interest_configuration,metadata)
  VALUES(p_provider_id,p_owner_type,p_owner_id,fa.id,p_account_type,p_currency,'active',timezone('utc',now()),jsonb_build_object('annual_rate_bps',provider.base_deposit_rate_basis_points,'payment_frequency','monthly'),jsonb_build_object('idempotency_key',p_idempotency_key)) RETURNING id INTO ba;
  INSERT INTO public.banking_audit_events(actor_profile_id,action,entity_type,entity_id,provider_id,reason,new_value) VALUES(public.current_profile_id(),'bank_account_opened','bank_account',ba,p_provider_id,'authorised account opening',jsonb_build_object('owner_type',p_owner_type,'owner_id',p_owner_id,'currency',p_currency));
  RETURN ba;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_loan_application(p_application_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE app public.loan_applications; prod public.loan_products; prov public.banking_providers; prof public.banking_customer_profiles; max_amt bigint; rate int; sched record; payment bigint:=0; total_interest bigint:=0; approved boolean; reasons text[]:='{}'; rejections text[]:='{}'; res uuid; exposure bigint; operational_reject boolean:=false;
BEGIN
  SELECT * INTO app FROM public.loan_applications WHERE id=p_application_id FOR UPDATE;
  IF app.id IS NULL THEN RAISE EXCEPTION 'loan application not found'; END IF;
  PERFORM public.assert_financial_owner_permission(app.applicant_type,app.applicant_id,'apply_for_loan',auth.uid());
  SELECT * INTO prod FROM public.loan_products WHERE id=app.product_id; SELECT * INTO prov FROM public.banking_providers WHERE id=app.provider_id;
  INSERT INTO public.banking_customer_profiles(owner_type,owner_id) VALUES(app.applicant_type,app.applicant_id) ON CONFLICT DO NOTHING;
  SELECT * INTO prof FROM public.banking_customer_profiles WHERE owner_type=app.applicant_type AND owner_id=app.applicant_id;
  SELECT COALESCE(sum(outstanding_principal_minor),0) INTO exposure FROM public.loan_contracts WHERE provider_id=prov.id AND status IN ('active','grace_period','delinquent','defaulted');
  max_amt := LEAST(prod.maximum_amount_minor, GREATEST(0,(COALESCE((app.income_snapshot->>'average_income_minor')::bigint, prod.income_requirement_minor) * prod.affordability_threshold_basis_points / 10000) * GREATEST(prod.minimum_term_months,LEAST(app.requested_term_months,prod.maximum_term_months))));
  approved := prov.status='active' AND NOT prov.lending_frozen AND app.currency_code=ANY(prov.supported_currencies) AND app.currency_code=ANY(prod.supported_currencies) AND app.applicant_type=ANY(prod.eligible_owner_types) AND app.purpose=ANY(prod.allowed_purposes) AND app.requested_amount_minor BETWEEN prod.minimum_amount_minor AND prod.maximum_amount_minor AND prof.credit_score >= GREATEST(prov.minimum_credit_score,prod.minimum_credit_score) AND exposure + app.requested_amount_minor <= prov.maximum_exposure_minor AND app.requested_amount_minor <= max_amt;
  IF approved THEN
    reasons := ARRAY['Credit score meets product minimum','Requested purpose and currency are supported','Affordability and provider exposure limits pass'];
    rate := prod.base_interest_rate_basis_points + prov.base_lending_margin_basis_points + GREATEST(0,(700-prof.credit_score)/10)*25;
    FOR sched IN SELECT * FROM public.calculate_equal_instalment_schedule(app.requested_amount_minor,rate,app.requested_term_months,(CURRENT_DATE + interval '1 month')::date) LOOP payment := GREATEST(payment,sched.total_due_minor); total_interest := total_interest + sched.scheduled_interest_minor; END LOOP;
  ELSE
    operational_reject := prov.status<>'active' OR prov.lending_frozen OR NOT (app.currency_code=ANY(prov.supported_currencies) AND app.currency_code=ANY(prod.supported_currencies)) OR NOT (app.applicant_type=ANY(prod.eligible_owner_types)) OR NOT (app.purpose=ANY(prod.allowed_purposes)) OR exposure + app.requested_amount_minor > prov.maximum_exposure_minor;
    rejections := ARRAY_REMOVE(ARRAY[CASE WHEN prov.status<>'active' OR prov.lending_frozen THEN 'Provider is not currently lending' END, CASE WHEN NOT (app.currency_code=ANY(prov.supported_currencies) AND app.currency_code=ANY(prod.supported_currencies)) THEN 'Currency is not supported' END, CASE WHEN NOT (app.applicant_type=ANY(prod.eligible_owner_types)) THEN 'Borrower type is not eligible' END, CASE WHEN NOT (app.purpose=ANY(prod.allowed_purposes)) THEN 'Loan purpose is not eligible for this product' END, CASE WHEN prof.credit_score < GREATEST(prov.minimum_credit_score,prod.minimum_credit_score) THEN 'Credit score is below the minimum' END, CASE WHEN app.requested_amount_minor > max_amt THEN 'Affordability limit is below requested amount' END, CASE WHEN exposure + app.requested_amount_minor > prov.maximum_exposure_minor THEN 'Provider exposure limit would be exceeded' END], NULL);
  END IF;
  INSERT INTO public.underwriting_results(application_id,approved,maximum_approved_amount_minor,offered_interest_rate_basis_points,offered_term_months,scheduled_payment_minor,total_interest_minor,total_repayment_minor,fees_minor,affordability_ratio_basis_points,risk_band,approval_reasons,rejection_reasons,metadata) VALUES(app.id,approved,max_amt,rate,CASE WHEN approved THEN app.requested_term_months END,CASE WHEN approved THEN payment END,CASE WHEN approved THEN total_interest ELSE 0 END,CASE WHEN approved THEN app.requested_amount_minor+total_interest ELSE 0 END,CASE WHEN approved THEN round(app.requested_amount_minor*prod.origination_fee_basis_points::numeric/10000)::bigint+prod.origination_fee_flat_minor ELSE 0 END,prod.affordability_threshold_basis_points,CASE WHEN prof.credit_score>=760 THEN 'low' WHEN prof.credit_score>=560 THEN 'medium' ELSE 'high' END,reasons,rejections,jsonb_build_object('snapshot_source','server','operational_rejection',operational_reject)) ON CONFLICT(application_id) DO UPDATE SET approved=EXCLUDED.approved, maximum_approved_amount_minor=EXCLUDED.maximum_approved_amount_minor, offered_interest_rate_basis_points=EXCLUDED.offered_interest_rate_basis_points, scheduled_payment_minor=EXCLUDED.scheduled_payment_minor, total_interest_minor=EXCLUDED.total_interest_minor, total_repayment_minor=EXCLUDED.total_repayment_minor, rejection_reasons=EXCLUDED.rejection_reasons, metadata=EXCLUDED.metadata RETURNING id INTO res;
  IF approved THEN
    INSERT INTO public.loan_offers(application_id,principal_minor,currency_code,interest_rate_basis_points,term_months,payment_frequency,scheduled_payment_minor,origination_fee_minor,total_interest_minor,total_repayment_minor,first_payment_date,grace_period_days,early_repayment_terms,late_payment_terms,offer_expires_at,metadata) SELECT app.id,app.requested_amount_minor,app.currency_code,rate,app.requested_term_months,prod.payment_frequency,payment,round(app.requested_amount_minor*prod.origination_fee_basis_points::numeric/10000)::bigint+prod.origination_fee_flat_minor,total_interest,app.requested_amount_minor+total_interest+round(app.requested_amount_minor*prod.origination_fee_basis_points::numeric/10000)::bigint+prod.origination_fee_flat_minor,(CURRENT_DATE + interval '1 month')::date,prod.grace_period_days,jsonb_build_object('partial_rule','shorten_term','fee_bps',prod.early_repayment_fee_basis_points),prod.late_payment_rule,timezone('utc',now())+interval '7 days',jsonb_build_object('schedule_model','equal_principal') ON CONFLICT(application_id) DO NOTHING;
    UPDATE public.loan_applications SET status='offer_issued', reviewed_at=timezone('utc',now()), decision_reason='Approved by transparent affordability rules', offered_terms=(SELECT to_jsonb(o) FROM public.loan_offers o WHERE o.application_id=app.id) WHERE id=app.id;
  ELSE
    UPDATE public.loan_applications SET status='rejected', reviewed_at=timezone('utc',now()), decision_reason=array_to_string(rejections,'; ') WHERE id=app.id;
  END IF;
  INSERT INTO public.banking_audit_events(actor_profile_id,action,entity_type,entity_id,provider_id,reason,new_value) VALUES(public.current_profile_id(),'loan_application_decision','loan_application',app.id,app.provider_id,'authorised underwriting completed',(SELECT to_jsonb(u) FROM public.underwriting_results u WHERE u.id=res));
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.accept_loan_offer(p_offer_id uuid,p_disbursement_bank_account_id uuid,p_repayment_bank_account_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE offer public.loan_offers; app public.loan_applications; disb public.bank_accounts; repay public.bank_accounts; contract_id uuid; tx uuid; sched record; obligation uuid; provider_funding uuid; provider_receivable uuid;
BEGIN
  SELECT id INTO contract_id FROM public.loan_contracts WHERE metadata->>'acceptance_idempotency_key'=p_idempotency_key; IF contract_id IS NOT NULL THEN RETURN contract_id; END IF;
  SELECT * INTO offer FROM public.loan_offers WHERE id=p_offer_id FOR UPDATE;
  IF offer.id IS NULL OR offer.status<>'issued' OR offer.offer_expires_at <= timezone('utc',now()) THEN RAISE EXCEPTION 'loan offer is not acceptable'; END IF;
  SELECT * INTO app FROM public.loan_applications WHERE id=offer.application_id FOR UPDATE;
  PERFORM public.assert_financial_owner_permission(app.applicant_type,app.applicant_id,'accept_loan',auth.uid());
  SELECT * INTO disb FROM public.bank_accounts WHERE id=p_disbursement_bank_account_id FOR UPDATE;
  SELECT * INTO repay FROM public.bank_accounts WHERE id=p_repayment_bank_account_id FOR UPDATE;
  IF disb.owner_type<>app.applicant_type OR disb.owner_id<>app.applicant_id OR repay.owner_type<>app.applicant_type OR repay.owner_id<>app.applicant_id THEN RAISE EXCEPTION 'bank account does not belong to borrower'; END IF;
  IF disb.currency_code<>offer.currency_code OR repay.currency_code<>offer.currency_code THEN RAISE EXCEPTION 'loan accounts must match loan currency unless explicit conversion is quoted'; END IF;
  IF disb.status NOT IN ('active','restricted') OR repay.status<>'active' THEN RAISE EXCEPTION 'bank account is not eligible'; END IF;
  provider_funding := public.get_or_create_provider_finance_account(app.provider_id, offer.currency_code, 'lending_funding');
  provider_receivable := public.get_or_create_provider_finance_account(app.provider_id, offer.currency_code, 'loan_receivable');
  tx := public.finance_transfer_accounts(provider_funding, disb.linked_finance_account_id, offer.principal_minor, offer.currency_code, 'loan_disbursement', 'Loan principal disbursement into selected bank account', 'loan-disbursement-'||p_idempotency_key, 'loan_offer', offer.id, public.current_profile_id(), jsonb_build_object('taxable',false,'liability',true,'provider_id',app.provider_id,'bank_account_id',disb.id,'provider_receivable_account_id',provider_receivable));
  INSERT INTO public.loan_contracts(borrower_type,borrower_id,provider_id,product_id,offer_id,repayment_bank_account_id,disbursement_bank_account_id,principal_minor,currency_code,outstanding_principal_minor,interest_rate_basis_points,rate_type,term_months,maturity_date,payment_frequency,scheduled_payment_minor,next_payment_date,total_payments,purpose,linked_entity_type,linked_entity_id,credit_score_at_origination,affordability_snapshot,status,disbursement_transaction_id,metadata) VALUES(app.applicant_type,app.applicant_id,app.provider_id,app.product_id,offer.id,repay.id,disb.id,offer.principal_minor,offer.currency_code,offer.principal_minor,offer.interest_rate_basis_points,offer.rate_type,offer.term_months,offer.first_payment_date + ((offer.term_months-1)||' months')::interval,offer.payment_frequency,offer.scheduled_payment_minor,offer.first_payment_date,offer.term_months,app.purpose,app.related_entity_type,app.related_entity_id,app.credit_score_snapshot,app.affordability_result,'active',tx,jsonb_build_object('acceptance_idempotency_key',p_idempotency_key,'principal_is_income',false,'schedule_model','equal_principal','provider_receivable_account_id',provider_receivable)) RETURNING id INTO contract_id;
  FOR sched IN SELECT * FROM public.calculate_equal_instalment_schedule(offer.principal_minor,offer.interest_rate_basis_points,offer.term_months,offer.first_payment_date) LOOP INSERT INTO public.loan_schedule_lines(loan_contract_id,instalment_number,due_date,opening_principal_minor,scheduled_principal_minor,scheduled_interest_minor,total_due_minor) VALUES(contract_id,sched.instalment_number,sched.due_date,sched.opening_principal_minor,sched.scheduled_principal_minor,sched.scheduled_interest_minor,sched.total_due_minor); END LOOP;
  INSERT INTO public.recurring_financial_obligations(owner_type,owner_id,owner_account_id,expense_category,description,amount_minor,currency_code,frequency,next_due_date,related_entity_type,related_entity_id,auto_pay_enabled,grace_period_days,priority,metadata) VALUES(app.applicant_type,app.applicant_id,repay.linked_finance_account_id,'loan_principal_repayment','Loan repayment trigger; schedule line is authoritative',0,offer.currency_code,offer.payment_frequency,offer.first_payment_date,'loan_contract',contract_id,true,offer.grace_period_days,10,jsonb_build_object('dynamic_amount_from','loan_schedule_lines','allocation_order',ARRAY['late_fee','accrued_interest','scheduled_interest','principal'])) RETURNING id INTO obligation;
  UPDATE public.loan_contracts SET recurring_obligation_id=obligation WHERE id=contract_id;
  UPDATE public.loan_offers SET status='accepted', accepted_at=timezone('utc',now()) WHERE id=offer.id; UPDATE public.loan_applications SET status='offer_accepted' WHERE id=app.id;
  UPDATE public.banking_customer_profiles SET total_borrowing_minor=total_borrowing_minor+offer.principal_minor, available_credit_minor=GREATEST(0,available_credit_minor-offer.principal_minor), updated_at=timezone('utc',now()) WHERE owner_type=app.applicant_type AND owner_id=app.applicant_id;
  INSERT INTO public.banking_audit_events(actor_profile_id,action,entity_type,entity_id,provider_id,reason,new_value) VALUES(public.current_profile_id(),'loan_acceptance','loan_contract',contract_id,app.provider_id,'authorised borrower accepted offer with exact bank-account settlement',jsonb_build_object('disbursement_transaction_id',tx,'disbursement_bank_account_id',disb.id,'repayment_bank_account_id',repay.id));
  RETURN contract_id;
END $$;

CREATE TABLE IF NOT EXISTS public.loan_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), loan_contract_id uuid NOT NULL REFERENCES public.loan_contracts(id), schedule_line_id uuid REFERENCES public.loan_schedule_lines(id), attempted_at timestamptz NOT NULL DEFAULT timezone('utc',now()), attempt_number integer NOT NULL DEFAULT 1, result text NOT NULL CHECK (result IN ('succeeded','failed')), failure_category text, failure_code text, user_message text, internal_error_reference text, retriable boolean NOT NULL DEFAULT true, next_retry_date date, transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, metadata jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.loan_payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_payment_attempts_owner_select ON public.loan_payment_attempts;
CREATE POLICY loan_payment_attempts_owner_select ON public.loan_payment_attempts FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));

CREATE OR REPLACE FUNCTION public.process_due_loan_repayments(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line record; loan public.loan_contracts; repay public.bank_accounts; tx uuid; paid int:=0; fee_due bigint; principal_due bigint; interest_due bigint; total_due bigint; provider_receivable uuid; provider_interest uuid; err text;
BEGIN
  IF NOT public.is_service_role() THEN RAISE EXCEPTION 'service role required for scheduled loan repayments' USING ERRCODE='42501'; END IF;
  FOR line IN SELECT l.* FROM public.loan_schedule_lines l JOIN public.loan_contracts c ON c.id=l.loan_contract_id WHERE c.status IN ('active','grace_period','delinquent') AND l.due_date<=p_as_of AND l.status IN ('scheduled','due','grace_period','late','seriously_late','final_warning','partial') ORDER BY l.due_date FOR UPDATE SKIP LOCKED LOOP
    SELECT * INTO loan FROM public.loan_contracts WHERE id=line.loan_contract_id FOR UPDATE; SELECT * INTO repay FROM public.bank_accounts WHERE id=loan.repayment_bank_account_id FOR UPDATE;
    principal_due := GREATEST(0,line.scheduled_principal_minor - line.principal_paid_minor); interest_due := GREATEST(0,line.scheduled_interest_minor - line.interest_paid_minor); fee_due := GREATEST(0,line.scheduled_fee_minor - line.fee_paid_minor); total_due := principal_due+interest_due+fee_due;
    IF total_due <= 0 THEN CONTINUE; END IF;
    BEGIN
      IF repay.id IS NULL THEN RAISE EXCEPTION 'missing repayment bank account'; END IF; IF repay.status <> 'active' THEN RAISE EXCEPTION 'repayment account is not active'; END IF; IF repay.currency_code <> loan.currency_code THEN RAISE EXCEPTION 'repayment account currency mismatch'; END IF;
      provider_receivable := public.get_or_create_provider_finance_account(loan.provider_id, loan.currency_code, 'loan_receivable'); provider_interest := public.get_or_create_provider_finance_account(loan.provider_id, loan.currency_code, 'interest_income');
      tx := public.finance_transfer_accounts(repay.linked_finance_account_id, provider_receivable, total_due, loan.currency_code, 'loan_principal_repayment', 'Loan repayment from selected bank account', 'loan-repayment-'||line.id||'-'||p_as_of, 'loan_contract', loan.id, NULL, jsonb_build_object('allocation_order','late_fee,accrued_interest,scheduled_interest,principal','principal_minor',principal_due,'interest_minor',interest_due,'fee_minor',fee_due,'interest_income_account_id',provider_interest));
      INSERT INTO public.loan_payments(loan_contract_id,schedule_line_id,amount_minor,principal_minor,interest_minor,fee_minor,currency_code,payment_type,transaction_id,idempotency_key,metadata) VALUES(loan.id,line.id,total_due,principal_due,interest_due,fee_due,loan.currency_code,'scheduled',tx,'loan-payment-'||line.id||'-'||p_as_of,jsonb_build_object('repayment_bank_account_id',repay.id,'source_finance_account_id',repay.linked_finance_account_id,'provider_receivable_account_id',provider_receivable,'provider_interest_income_account_id',provider_interest)) ON CONFLICT DO NOTHING;
      INSERT INTO public.loan_payment_attempts(loan_contract_id,schedule_line_id,result,transaction_id,idempotency_key) VALUES(loan.id,line.id,'succeeded',tx,'loan-attempt-'||line.id||'-'||p_as_of) ON CONFLICT DO NOTHING;
      UPDATE public.loan_schedule_lines SET amount_paid_minor=total_due, principal_paid_minor=scheduled_principal_minor, interest_paid_minor=scheduled_interest_minor, fee_paid_minor=scheduled_fee_minor, status='paid', payment_transaction_id=tx WHERE id=line.id;
      UPDATE public.loan_contracts SET outstanding_principal_minor=GREATEST(0,outstanding_principal_minor-principal_due), amount_repaid_minor=amount_repaid_minor+total_due, interest_paid_minor=interest_paid_minor+interest_due, fees_paid_minor=fees_paid_minor+fee_due, payments_made=payments_made+1, next_payment_date=(SELECT min(due_date) FROM public.loan_schedule_lines WHERE loan_contract_id=loan.id AND status<>'paid') WHERE id=loan.id;
      PERFORM public.record_credit_score_event(loan.borrower_type,loan.borrower_id,LEAST(4, GREATEST(1, 8 - (SELECT count(*)::int FROM public.credit_score_events e WHERE e.owner_type=loan.borrower_type AND e.owner_id=loan.borrower_id AND e.reason_code='loan_repayment_on_time' AND e.created_at > timezone('utc',now()) - interval '90 days'))),'loan_repayment_on_time','A scheduled loan repayment was completed on time','loan_contract',loan.id);
      paid := paid + 1;
    EXCEPTION WHEN others THEN
      err := SQLERRM;
      INSERT INTO public.loan_payment_attempts(loan_contract_id,schedule_line_id,result,failure_category,failure_code,user_message,internal_error_reference,next_retry_date,idempotency_key,metadata) VALUES(loan.id,line.id,'failed',CASE WHEN err ILIKE '%insufficient funds%' THEN 'borrower_funds' WHEN err ILIKE '%currency%' THEN 'currency_mismatch' WHEN err ILIKE '%active%' THEN 'account_status' ELSE 'system' END,SQLSTATE,CASE WHEN err ILIKE '%insufficient funds%' THEN 'The repayment account does not have enough available funds.' ELSE 'The repayment could not be processed safely.' END,md5(err || clock_timestamp()::text),(p_as_of + interval '1 day')::date,'loan-attempt-'||line.id||'-'||p_as_of,jsonb_build_object('error',err)) ON CONFLICT DO NOTHING;
      UPDATE public.recurring_financial_obligations SET failure_count=failure_count+1,last_attempted_at=timezone('utc',now()),status=CASE WHEN err ILIKE '%insufficient funds%' THEN 'failed' ELSE status END WHERE related_entity_type='loan_contract' AND related_entity_id=loan.id;
    END;
  END LOOP;
  UPDATE public.loan_contracts SET status='paid_off', outstanding_principal_minor=0, completed_at=timezone('utc',now()) WHERE status IN ('active','grace_period','delinquent') AND outstanding_principal_minor=0 AND NOT EXISTS (SELECT 1 FROM public.loan_schedule_lines l WHERE l.loan_contract_id=loan_contracts.id AND l.status<>'paid');
  RETURN paid;
END $$;

CREATE OR REPLACE FUNCTION public.progress_loan_delinquency(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; changed int:=0; new_stage public.loan_schedule_line_status; impact int; late_fee bigint;
BEGIN
  IF NOT public.is_service_role() THEN RAISE EXCEPTION 'service role required for scheduled delinquency progression' USING ERRCODE='42501'; END IF;
  FOR r IN SELECT l.*,c.borrower_type,c.borrower_id,c.id contract_id,c.product_id,c.status contract_status,p.late_payment_rule,p.grace_period_days FROM public.loan_schedule_lines l JOIN public.loan_contracts c ON c.id=l.loan_contract_id JOIN public.loan_products p ON p.id=c.product_id WHERE c.status IN ('active','grace_period','delinquent') AND l.status NOT IN ('paid','cancelled') AND l.due_date < p_as_of FOR UPDATE SKIP LOCKED LOOP
    IF p_as_of - r.due_date <= r.grace_period_days THEN new_stage:='grace_period'; impact:=0; ELSIF p_as_of-r.due_date < 30 THEN new_stage:='late'; impact:=-25; ELSIF p_as_of-r.due_date < 60 THEN new_stage:='seriously_late'; impact:=-50; ELSIF p_as_of-r.due_date < 90 THEN new_stage:='final_warning'; impact:=-75; ELSE new_stage:='defaulted'; impact:=-120; END IF;
    late_fee := CASE WHEN new_stage IN ('late','seriously_late','final_warning') AND NOT r.late_fee_applied THEN LEAST(COALESCE((r.late_payment_rule->>'flat_fee_minor')::bigint,0),COALESCE((r.late_payment_rule->>'cap_minor')::bigint,2500)) ELSE 0 END;
    UPDATE public.loan_schedule_lines SET status=new_stage, days_overdue=p_as_of-due_date, scheduled_fee_minor=scheduled_fee_minor+late_fee, total_due_minor=total_due_minor+late_fee, late_fee_applied=late_fee_applied OR late_fee>0 WHERE id=r.id AND status IS DISTINCT FROM new_stage;
    IF FOUND THEN
      INSERT INTO public.loan_delinquency_records(loan_contract_id,schedule_line_id,stage,days_overdue,credit_impact_points,late_fee_minor,notification_key) VALUES(r.contract_id,r.id,new_stage,p_as_of-r.due_date,impact,late_fee,'loan-delinquency-'||r.id||'-'||new_stage) ON CONFLICT DO NOTHING;
      IF impact <> 0 AND NOT EXISTS (SELECT 1 FROM public.credit_score_events e WHERE e.related_entity_type='loan_contract' AND e.related_entity_id=r.contract_id AND e.reason_code='loan_'||new_stage::text) THEN PERFORM public.record_credit_score_event(r.borrower_type,r.borrower_id,impact,'loan_'||new_stage::text,'Loan repayment status changed to '||new_stage::text,'loan_contract',r.contract_id); END IF;
      changed:=changed+1;
    END IF;
    IF new_stage='defaulted' AND r.contract_status<>'defaulted' THEN
      UPDATE public.loan_contracts SET status='defaulted', defaulted_at=timezone('utc',now()) WHERE id=r.contract_id;
      INSERT INTO public.loan_default_records(loan_contract_id,defaulted_amount_minor,principal_minor,interest_minor,fees_minor,recovery_options) VALUES(r.contract_id,r.total_due_minor-r.amount_paid_minor,r.opening_principal_minor-r.principal_paid_minor,r.scheduled_interest_minor-r.interest_paid_minor,r.scheduled_fee_minor-r.fee_paid_minor,jsonb_build_object('pay_arrears',true,'restructure',true,'refinance_if_eligible',true,'owner_or_member_contribution',true)) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN changed;
END $$;

CREATE OR REPLACE FUNCTION public.record_credit_score_event(p_owner_type public.financial_owner_type,p_owner_id uuid,p_delta integer,p_reason text,p_summary text,p_related_type text DEFAULT NULL,p_related_id uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prof public.banking_customer_profiles; ns integer; nb public.credit_band; adjusted_delta integer;
BEGIN
  IF p_delta < 0 AND NOT (public.is_service_role() OR public.has_role(auth.uid(),'admin') OR p_reason IN ('loan_repayment_on_time','loan_paid_off')) THEN RAISE EXCEPTION 'admin or service role required for negative credit adjustments' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_score_events WHERE owner_type=p_owner_type AND owner_id=p_owner_id AND reason_code=p_reason AND related_entity_type IS NOT DISTINCT FROM p_related_type AND related_entity_id IS NOT DISTINCT FROM p_related_id AND created_at > timezone('utc',now()) - interval '1 day') THEN SELECT credit_score INTO ns FROM public.banking_customer_profiles WHERE owner_type=p_owner_type AND owner_id=p_owner_id; RETURN COALESCE(ns,600); END IF;
  SELECT * INTO prof FROM public.banking_customer_profiles WHERE owner_type=p_owner_type AND owner_id=p_owner_id FOR UPDATE; IF prof.id IS NULL THEN INSERT INTO public.banking_customer_profiles(owner_type,owner_id) VALUES(p_owner_type,p_owner_id) RETURNING * INTO prof; END IF;
  adjusted_delta := CASE WHEN p_delta > 0 THEN LEAST(p_delta, GREATEST(1, 12 - COALESCE((SELECT sum(GREATEST(0,new_score-previous_score))::int FROM public.credit_score_events e WHERE e.owner_type=p_owner_type AND e.owner_id=p_owner_id AND e.created_at > timezone('utc',now()) - interval '30 days'),0))) ELSE p_delta END;
  ns := LEAST(1000,GREATEST(0,prof.credit_score+adjusted_delta)); nb := public.credit_band_for_score(ns);
  UPDATE public.banking_customer_profiles SET credit_score=ns, credit_band=nb, last_evaluated_at=timezone('utc',now()), updated_at=timezone('utc',now()) WHERE id=prof.id;
  INSERT INTO public.credit_score_events(owner_type,owner_id,previous_score,new_score,previous_band,new_band,reason_code,public_summary,related_entity_type,related_entity_id,metadata) VALUES(p_owner_type,p_owner_id,prof.credit_score,ns,prof.credit_band,nb,p_reason,p_summary,p_related_type,p_related_id,jsonb_build_object('requested_delta',p_delta,'applied_delta',adjusted_delta)); RETURN ns;
END $$;

-- Replace permissive child RLS with parent-authorisation checks.
ALTER TABLE public.underwriting_results ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_offers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_delinquency_records ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_default_records ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_restructurings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.loan_refinance_records ENABLE ROW LEVEL SECURITY; ALTER TABLE public.deposit_interest_accruals ENABLE ROW LEVEL SECURITY; ALTER TABLE public.credit_score_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.debt_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.provider_exposure_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_schedule_owner_select ON public.loan_schedule_lines;
CREATE POLICY loan_schedule_owner_select ON public.loan_schedule_lines FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS underwriting_results_owner_select ON public.underwriting_results; CREATE POLICY underwriting_results_owner_select ON public.underwriting_results FOR SELECT USING (public.can_access_loan_application(application_id,'view_borrowing'));
DROP POLICY IF EXISTS loan_offers_owner_select ON public.loan_offers; CREATE POLICY loan_offers_owner_select ON public.loan_offers FOR SELECT USING (public.can_access_loan_application(application_id,'review_loan_offer'));
DROP POLICY IF EXISTS loan_payments_owner_select ON public.loan_payments; CREATE POLICY loan_payments_owner_select ON public.loan_payments FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS loan_delinquency_records_owner_select ON public.loan_delinquency_records; CREATE POLICY loan_delinquency_records_owner_select ON public.loan_delinquency_records FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS loan_default_records_owner_select ON public.loan_default_records; CREATE POLICY loan_default_records_owner_select ON public.loan_default_records FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS loan_restructurings_owner_select ON public.loan_restructurings; CREATE POLICY loan_restructurings_owner_select ON public.loan_restructurings FOR SELECT USING (public.can_access_loan_contract(loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS loan_refinance_records_owner_select ON public.loan_refinance_records; CREATE POLICY loan_refinance_records_owner_select ON public.loan_refinance_records FOR SELECT USING (public.can_access_loan_contract(old_loan_contract_id,'view_borrowing') OR public.can_access_loan_contract(new_loan_contract_id,'view_borrowing'));
DROP POLICY IF EXISTS deposit_interest_accruals_owner_select ON public.deposit_interest_accruals; CREATE POLICY deposit_interest_accruals_owner_select ON public.deposit_interest_accruals FOR SELECT USING (EXISTS (SELECT 1 FROM public.bank_accounts ba WHERE ba.id=bank_account_id AND public.can_access_financial_owner(ba.owner_type,ba.owner_id,'view_borrowing',auth.uid())));
DROP POLICY IF EXISTS credit_score_events_owner_select ON public.credit_score_events; CREATE POLICY credit_score_events_owner_select ON public.credit_score_events FOR SELECT USING (public.can_access_financial_owner(owner_type,owner_id,'view_credit_report',auth.uid())) ;
DROP POLICY IF EXISTS debt_snapshots_owner_select ON public.debt_snapshots; CREATE POLICY debt_snapshots_owner_select ON public.debt_snapshots FOR SELECT USING (public.can_access_financial_owner(owner_type,owner_id,'view_borrowing',auth.uid())) ;
DROP POLICY IF EXISTS provider_exposure_snapshots_admin_select ON public.provider_exposure_snapshots; CREATE POLICY provider_exposure_snapshots_admin_select ON public.provider_exposure_snapshots FOR SELECT USING (public.has_role(auth.uid(),'admin'));
