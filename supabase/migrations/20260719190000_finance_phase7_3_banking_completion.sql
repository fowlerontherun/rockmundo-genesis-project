-- Finance Phase 7.3: finish authoritative lending, provider accounting and complete banking journeys.

ALTER TABLE public.loan_contracts ADD COLUMN IF NOT EXISTS origination_fee_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.loan_contracts ADD COLUMN IF NOT EXISTS net_proceeds_minor bigint;
ALTER TABLE public.loan_contracts ADD COLUMN IF NOT EXISTS origination_event_id uuid;
ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS principal_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS interest_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS fee_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.deposit_interest_accruals ADD COLUMN IF NOT EXISTS payment_transaction_id uuid REFERENCES public.financial_transactions(id);

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
DECLARE src public.financial_accounts; dst public.financial_accounts; tx uuid; first_id uuid; second_id uuid;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF tx IS NOT NULL THEN RETURN tx; END IF;
  first_id := LEAST(p_source_account_id, p_destination_account_id); second_id := GREATEST(p_source_account_id, p_destination_account_id);
  PERFORM 1 FROM public.financial_accounts WHERE id IN (first_id, second_id) ORDER BY id FOR UPDATE;
  SELECT * INTO src FROM public.financial_accounts WHERE id = p_source_account_id;
  SELECT * INTO dst FROM public.financial_accounts WHERE id = p_destination_account_id;
  IF src.id IS NULL OR dst.id IS NULL THEN RAISE EXCEPTION 'finance account not found'; END IF;
  IF src.account_status <> 'active' OR dst.account_status <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF src.currency_code <> p_currency_code OR dst.currency_code <> p_currency_code THEN RAISE EXCEPTION 'exact account currency mismatch'; END IF;
  IF src.owner_type <> 'system' AND src.available_balance_minor < p_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  INSERT INTO public.financial_transactions(transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,metadata)
  VALUES (p_transaction_category,'completed',p_currency_code,p_amount_minor,p_amount_minor,src.id,dst.id,p_related_entity_type,p_related_entity_id,p_description,p_idempotency_key,auth.uid(),p_actor_profile_id,COALESCE(auth.uid()::text,'system'),timezone('utc',now()),p_currency_code,p_currency_code,p_amount_minor,p_amount_minor,p_metadata) RETURNING id INTO tx;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor-p_amount_minor, updated_at=timezone('utc',now()) WHERE id=src.id;
  UPDATE public.financial_accounts SET current_balance_minor=current_balance_minor+p_amount_minor, updated_at=timezone('utc',now()) WHERE id=dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES
    (tx,src.id,'debit',p_amount_minor,src.current_balance_minor,src.current_balance_minor-p_amount_minor,p_currency_code),
    (tx,dst.id,'credit',p_amount_minor,dst.current_balance_minor,dst.current_balance_minor+p_amount_minor,p_currency_code);
  RETURN tx;
END $$;

CREATE OR REPLACE FUNCTION public.banking_assert_owner_access(p_owner_type public.financial_owner_type,p_owner_id uuid,p_permission_key text DEFAULT 'view_banking',p_amount_minor bigint DEFAULT 0) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_access_financial_owner(p_owner_type,p_owner_id,p_permission_key) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.post_provider_loan_origination(p_contract_id uuid,p_event_id uuid,p_idempotency_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.loan_contracts; fund uuid; recv uuid; fee_income uuid; disb public.bank_accounts; repay public.bank_accounts; disb_tx uuid; recv_tx uuid; fee_tx uuid; fee bigint;
BEGIN
  SELECT * INTO c FROM public.loan_contracts WHERE id=p_contract_id FOR UPDATE;
  SELECT * INTO disb FROM public.bank_accounts WHERE id=c.disbursement_bank_account_id;
  SELECT * INTO repay FROM public.bank_accounts WHERE id=c.repayment_bank_account_id;
  fund := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'lending_funding');
  recv := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'loan_receivable');
  fee_income := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'fee_income');
  fee := COALESCE((SELECT origination_fee_minor FROM public.loan_offers WHERE id=c.offer_id),0);
  IF fee > 0 THEN fee_tx := public.finance_transfer_accounts(repay.linked_finance_account_id,fee_income,fee,c.currency_code,'loan_fee','Loan origination fee','loan-origination-fee-'||p_idempotency_key,'loan_contract',c.id,NULL,jsonb_build_object('origination_event_id',p_event_id)); END IF;
  disb_tx := public.finance_transfer_accounts(fund,disb.linked_finance_account_id,c.principal_minor,c.currency_code,'loan_disbursement','Loan principal disbursement','loan-origination-disbursement-'||p_idempotency_key,'loan_contract',c.id,NULL,jsonb_build_object('origination_event_id',p_event_id,'taxable',false));
  recv_tx := public.finance_transfer_accounts(fund,recv,c.principal_minor,c.currency_code,'loan_disbursement','Provider receivable recognition','loan-origination-receivable-'||p_idempotency_key,'loan_contract',c.id,NULL,jsonb_build_object('origination_event_id',p_event_id,'provider_accounting_leg','receivable'));
  UPDATE public.loan_contracts SET disbursement_transaction_id=disb_tx, origination_fee_transaction_id=fee_tx, net_proceeds_minor=principal_minor, origination_event_id=p_event_id, metadata=metadata||jsonb_build_object('provider_receivable_transaction_id',recv_tx) WHERE id=c.id;
  RETURN jsonb_build_object('disbursement_transaction_id',disb_tx,'receivable_transaction_id',recv_tx,'fee_transaction_id',fee_tx);
END $$;

CREATE OR REPLACE FUNCTION public.post_provider_loan_repayment(p_contract_id uuid,p_schedule_line_id uuid,p_principal_minor bigint,p_interest_minor bigint,p_fee_minor bigint,p_payment_type text,p_idempotency_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.loan_contracts; repay public.bank_accounts; settle uuid; recv uuid; int_inc uuid; fee_inc uuid; ptx uuid; itx uuid; ftx uuid;
BEGIN
  SELECT * INTO c FROM public.loan_contracts WHERE id=p_contract_id FOR UPDATE;
  SELECT * INTO repay FROM public.bank_accounts WHERE id=c.repayment_bank_account_id;
  settle := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'settlement_clearing'); recv := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'loan_receivable'); int_inc := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'interest_income'); fee_inc := public.get_or_create_provider_finance_account(c.provider_id,c.currency_code,'fee_income');
  IF p_principal_minor>0 THEN ptx := public.finance_transfer_accounts(repay.linked_finance_account_id,settle,p_principal_minor,c.currency_code,'loan_principal_repayment','Loan principal repayment',p_idempotency_key||'-principal','loan_contract',c.id,NULL,'{}'); PERFORM public.finance_transfer_accounts(recv,settle,p_principal_minor,c.currency_code,'loan_principal_repayment','Provider receivable reduction',p_idempotency_key||'-receivable','loan_contract',c.id,NULL,'{}'); END IF;
  IF p_interest_minor>0 THEN itx := public.finance_transfer_accounts(repay.linked_finance_account_id,int_inc,p_interest_minor,c.currency_code,'loan_interest_repayment','Loan interest repayment',p_idempotency_key||'-interest','loan_contract',c.id,NULL,'{}'); END IF;
  IF p_fee_minor>0 THEN ftx := public.finance_transfer_accounts(repay.linked_finance_account_id,fee_inc,p_fee_minor,c.currency_code,'loan_fee','Loan fee repayment',p_idempotency_key||'-fee','loan_contract',c.id,NULL,'{}'); END IF;
  INSERT INTO public.loan_payments(loan_contract_id,schedule_line_id,amount_minor,principal_minor,interest_minor,fee_minor,currency_code,payment_type,transaction_id,principal_transaction_id,interest_transaction_id,fee_transaction_id,idempotency_key)
  VALUES(c.id,p_schedule_line_id,p_principal_minor+p_interest_minor+p_fee_minor,p_principal_minor,p_interest_minor,p_fee_minor,c.currency_code,p_payment_type,COALESCE(ptx,itx,ftx),ptx,itx,ftx,p_idempotency_key) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('principal_transaction_id',ptx,'interest_transaction_id',itx,'fee_transaction_id',ftx);
END $$;

CREATE OR REPLACE FUNCTION public.get_banking_dashboard() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid; result jsonb;
BEGIN
  SELECT id INTO pid FROM public.profiles WHERE user_id=auth.uid() LIMIT 1;
  IF pid IS NULL THEN RETURN jsonb_build_object('accounts','[]'::jsonb,'loans','[]'::jsonb,'creditProfile',jsonb_build_object('band','Building','positiveFactors',jsonb_build_array('Create a profile to start banking.'),'negativeFactors','[]'::jsonb),'recentActivity','[]'::jsonb); END IF;
  SELECT jsonb_build_object('accounts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ba.id,'accountType',ba.account_type,'currencyCode',ba.currency_code,'balanceMinor',fa.current_balance_minor,'providerName',bp.brand_name,'restrictionSummary',CASE WHEN ba.status='restricted' THEN 'Restricted' ELSE 'Unrestricted' END,'annualRateBps',COALESCE((ba.interest_configuration->>'annual_rate_bps')::int,0))) FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id JOIN public.banking_providers bp ON bp.id=ba.provider_id WHERE ba.owner_type='player' AND ba.owner_id=pid),'[]'::jsonb),'loans',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'providerName',bp.brand_name,'status',c.status,'principalMinor',c.principal_minor,'outstandingPrincipalMinor',c.outstanding_principal_minor,'currencyCode',c.currency_code,'interestRateBps',c.interest_rate_basis_points,'nextPaymentMinor',COALESCE(c.scheduled_payment_minor,0),'nextPaymentDate',c.next_payment_date,'overdueMinor',COALESCE((SELECT sum(total_due_minor-amount_paid_minor) FROM public.loan_schedule_lines l WHERE l.loan_contract_id=c.id AND l.due_date<CURRENT_DATE AND l.status<>'paid'),0))) FROM public.loan_contracts c JOIN public.banking_providers bp ON bp.id=c.provider_id WHERE c.borrower_type='player' AND c.borrower_id=pid AND c.status NOT IN ('cancelled','paid_off')),'[]'::jsonb),'creditProfile',COALESCE((SELECT jsonb_build_object('band',credit_band,'score',credit_score,'positiveFactors',jsonb_build_array('On-time payments improve your band.'),'negativeFactors','[]'::jsonb) FROM public.banking_customer_profiles WHERE owner_type='player' AND owner_id=pid),jsonb_build_object('band','Building','positiveFactors',jsonb_build_array('Open a current account to start building a banking history.'),'negativeFactors','[]'::jsonb)),'recentActivity','[]'::jsonb) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.create_loan_application(p_borrower_type public.financial_owner_type,p_borrower_id uuid,p_product_id uuid,p_requested_amount_minor bigint,p_requested_term_months integer,p_purpose public.loan_purpose,p_related_entity_type text DEFAULT NULL,p_related_entity_id uuid DEFAULT NULL,p_expected_use text DEFAULT NULL,p_idempotency_key text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing uuid; prod public.loan_products; app_id uuid; avg_income bigint:=0; cash bigint:=0; debt_service bigint:=0; score int:=600;
BEGIN
  PERFORM public.banking_assert_owner_access(p_borrower_type,p_borrower_id,'apply_for_loan',p_requested_amount_minor);
  SELECT id INTO existing FROM public.loan_applications WHERE idempotency_key=p_idempotency_key AND p_idempotency_key IS NOT NULL; IF existing IS NOT NULL THEN RETURN existing; END IF;
  SELECT * INTO prod FROM public.loan_products WHERE id=p_product_id AND status='active'; IF prod.id IS NULL THEN RAISE EXCEPTION 'loan product unavailable'; END IF;
  SELECT COALESCE(sum(t.net_amount_minor),0) INTO avg_income FROM public.financial_transactions t JOIN public.financial_accounts fa ON fa.id=t.destination_account_id WHERE fa.owner_type=p_borrower_type AND fa.owner_id=p_borrower_id AND t.transaction_category NOT IN ('transfer_in','loan_disbursement');
  SELECT COALESCE(sum(current_balance_minor),0) INTO cash FROM public.financial_accounts WHERE owner_type=p_borrower_type AND owner_id=p_borrower_id AND account_status='active';
  SELECT COALESCE(sum(scheduled_payment_minor),0) INTO debt_service FROM public.loan_contracts WHERE borrower_type=p_borrower_type AND borrower_id=p_borrower_id AND status IN ('active','grace_period','delinquent');
  SELECT COALESCE(credit_score,600) INTO score FROM public.banking_customer_profiles WHERE owner_type=p_borrower_type AND owner_id=p_borrower_id;
  INSERT INTO public.loan_applications(applicant_type,applicant_id,provider_id,product_id,requested_amount_minor,currency_code,requested_term_months,purpose,related_entity_type,related_entity_id,declared_expected_use,income_snapshot,expense_snapshot,debt_snapshot,credit_score_snapshot,affordability_result,status,created_by_profile_id,idempotency_key,metadata)
  VALUES(p_borrower_type,p_borrower_id,prod.provider_id,prod.id,p_requested_amount_minor,prod.supported_currencies[1],p_requested_term_months,p_purpose,p_related_entity_type,p_related_entity_id,p_expected_use,jsonb_build_object('source','server_generated','version','phase7_3_v1','average_income_minor',GREATEST(avg_income,prod.income_requirement_minor),'excluded','member contributions/internal transfers/loan proceeds'),jsonb_build_object('source','server_generated','version','phase7_3_v1'),jsonb_build_object('source','server_generated','existing_debt_service_minor',debt_service,'available_unrestricted_cash_minor',cash),score,jsonb_build_object('source','server_generated','snapshot_calculated_at',timezone('utc',now())),'submitted',(SELECT id FROM public.profiles WHERE user_id=auth.uid() LIMIT 1),COALESCE(p_idempotency_key,gen_random_uuid()::text),jsonb_build_object('snapshot_source','server_generated','snapshot_version','phase7_3_v1')) RETURNING id INTO app_id;
  PERFORM public.evaluate_loan_application(app_id);
  RETURN app_id;
END $$;

REVOKE INSERT ON public.loan_applications FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_banking_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan_application(public.financial_owner_type,uuid,uuid,bigint,integer,public.loan_purpose,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_loan_offer(uuid,uuid,uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_transfer_accounts(uuid,uuid,bigint,char(3),public.financial_transaction_category,text,text,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_transfer_accounts(uuid,uuid,bigint,char(3),public.financial_transaction_category,text,text,text,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE VIEW public.loan_integrity_issues AS
SELECT 'financial_account_currency_default_mismatch' issue_type,id::text subject_id FROM public.financial_accounts WHERE account_status='active' AND currency_code<>default_currency_code
UNION ALL SELECT 'loan_principal_without_disbursement_transaction',id::text FROM public.loan_contracts WHERE status<>'cancelled' AND disbursement_transaction_id IS NULL
UNION ALL SELECT 'provider_receivable_mismatch',provider_id::text FROM public.banking_provider_reconciliation WHERE receivable_difference_minor<>0;

CREATE OR REPLACE VIEW public.banking_provider_reconciliation AS
WITH contract_totals AS (
  SELECT provider_id,currency_code,COALESCE(sum(outstanding_principal_minor),0) contract_outstanding_principal_minor,COALESCE(sum(principal_minor),0) originated_principal_minor,COALESCE(sum(interest_paid_minor),0) paid_interest_minor,COALESCE(sum(fees_paid_minor),0) paid_fee_minor FROM public.loan_contracts GROUP BY provider_id,currency_code
), ledger_totals AS (
  SELECT b.provider_id,b.currency_code,COALESCE(sum(CASE WHEN b.account_role='loan_receivable' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) receivable_ledger_minor,COALESCE(sum(CASE WHEN b.account_role='interest_income' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) interest_income_ledger_minor,COALESCE(sum(CASE WHEN b.account_role='fee_income' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) fee_income_ledger_minor FROM public.banking_provider_financial_accounts b LEFT JOIN public.financial_ledger_entries e ON e.account_id=b.finance_account_id AND e.currency_code=b.currency_code GROUP BY b.provider_id,b.currency_code
)
SELECT COALESCE(c.provider_id,l.provider_id) provider_id,COALESCE(c.currency_code,l.currency_code) currency_code,COALESCE(c.contract_outstanding_principal_minor,0) contract_outstanding_principal_minor,COALESCE(c.originated_principal_minor,0) originated_principal_minor,COALESCE(c.paid_interest_minor,0) paid_interest_minor,COALESCE(c.paid_fee_minor,0) paid_fee_minor,COALESCE(l.receivable_ledger_minor,0) receivable_ledger_minor,COALESCE(l.interest_income_ledger_minor,0) interest_income_ledger_minor,COALESCE(l.fee_income_ledger_minor,0) fee_income_ledger_minor,COALESCE(l.receivable_ledger_minor,0)-COALESCE(c.contract_outstanding_principal_minor,0) receivable_difference_minor,COALESCE(l.interest_income_ledger_minor,0)-COALESCE(c.paid_interest_minor,0) interest_income_difference_minor,COALESCE(l.fee_income_ledger_minor,0)-COALESCE(c.paid_fee_minor,0) fee_income_difference_minor,CASE WHEN COALESCE(l.receivable_ledger_minor,0)=COALESCE(c.contract_outstanding_principal_minor,0) AND COALESCE(l.interest_income_ledger_minor,0)=COALESCE(c.paid_interest_minor,0) AND COALESCE(l.fee_income_ledger_minor,0)=COALESCE(c.paid_fee_minor,0) THEN 'Reconciled' WHEN abs(COALESCE(l.receivable_ledger_minor,0)-COALESCE(c.contract_outstanding_principal_minor,0)) <= 100 THEN 'Warning' ELSE 'Critical' END status FROM contract_totals c FULL JOIN ledger_totals l ON l.provider_id=c.provider_id AND l.currency_code=c.currency_code;
