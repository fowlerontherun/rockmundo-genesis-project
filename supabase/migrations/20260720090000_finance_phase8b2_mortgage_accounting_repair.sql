-- Finance Phase 8B.2: fail-safe mortgage accounting repair gates.
-- This forward-only migration repairs unsafe PR #1240 behaviours by adding
-- mortgage-specific categories, journalling the development provider capital
-- fixture through the authoritative post_financial_journal primitive, and
-- replacing unsafe mortgage posting functions with explicit fail-closed gates
-- until the full executable vertical-slice workflow can be proven.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_deposit_reservation';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_deposit_release';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_origination';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'property_purchase_settlement';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_principal_repayment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_interest_payment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_fee_payment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'mortgage_redemption';

ALTER TABLE public.mortgage_contracts ADD COLUMN IF NOT EXISTS recurring_obligation_id uuid REFERENCES public.recurring_financial_obligations(id);
ALTER TABLE public.mortgage_payments ADD COLUMN IF NOT EXISTS journal_event_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.mortgage_payments ADD COLUMN IF NOT EXISTS principal_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.mortgage_payments ADD COLUMN IF NOT EXISTS interest_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.mortgage_payments ADD COLUMN IF NOT EXISTS fee_transaction_id uuid REFERENCES public.financial_transactions(id);
ALTER TABLE public.mortgage_payment_attempts ADD COLUMN IF NOT EXISTS failure_type text;
ALTER TABLE public.mortgage_payment_attempts ADD COLUMN IF NOT EXISTS error_classification text;
ALTER TABLE public.mortgage_payment_attempts ADD COLUMN IF NOT EXISTS retry_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE public.mortgage_payment_attempts ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.mortgage_payments(id);
ALTER TABLE public.property_purchase_transactions ADD COLUMN IF NOT EXISTS settlement_transaction_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.property_purchase_transactions ADD COLUMN IF NOT EXISTS seller_financial_account_id uuid REFERENCES public.financial_accounts(id);

CREATE UNIQUE INDEX IF NOT EXISTS mortgage_arrears_unique_active_state ON public.mortgage_arrears_records(mortgage_contract_id,schedule_line_id,stage) WHERE stage IN ('grace_period','late','seriously_late','final_warning');
CREATE INDEX IF NOT EXISTS mortgage_schedule_active_due_idx ON public.mortgage_schedule_lines(mortgage_contract_id,schedule_version,due_date,status) WHERE status IN ('scheduled','due','missed','part_paid');
CREATE INDEX IF NOT EXISTS property_deposits_financial_transaction_idx ON public.property_deposits(financial_transaction_id);

CREATE OR REPLACE FUNCTION public.resolve_property_seller_financial_account(p_seller_type public.property_owner_type,p_seller_id uuid,p_currency_code char(3)) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acct uuid;
BEGIN
 IF p_seller_type='world' THEN
  SELECT id INTO acct FROM public.financial_accounts WHERE owner_type='system' AND owner_id IS NULL AND currency_code=p_currency_code AND account_status='active' AND metadata->>'account_role'='world_property_treasury' ORDER BY created_at LIMIT 1;
  IF acct IS NULL THEN
   INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,currency_code,default_currency_code,current_balance_minor,account_status,metadata)
   VALUES('system',NULL,'World Property Treasury',p_currency_code,p_currency_code,0,'active',jsonb_build_object('account_role','world_property_treasury','phase','8B.2')) RETURNING id INTO acct;
  END IF;
 ELSIF p_seller_type='player' THEN
  SELECT ba.linked_finance_account_id INTO acct FROM public.bank_accounts ba JOIN public.financial_accounts fa ON fa.id=ba.linked_finance_account_id WHERE ba.owner_type='player' AND ba.owner_id=p_seller_id AND ba.currency_code=p_currency_code AND ba.status='active' AND fa.account_status='active' ORDER BY ba.created_at LIMIT 1;
 ELSE
  RAISE EXCEPTION 'seller type is not enabled for mortgage settlement';
 END IF;
 IF acct IS NULL THEN RAISE EXCEPTION 'seller financial account unavailable'; END IF;
 RETURN acct;
END $$;
REVOKE ALL ON FUNCTION public.resolve_property_seller_financial_account(public.property_owner_type,uuid,char) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_property_seller_financial_account(public.property_owner_type,uuid,char) TO service_role;

CREATE OR REPLACE FUNCTION public.release_mortgage_deposit(p_property_deposit_id uuid,p_reason text,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'mortgage_deposit_release_requires_phase8b2_workflow_test:%', p_reason;
END $$;
REVOKE ALL ON FUNCTION public.release_mortgage_deposit(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_mortgage_deposit(uuid,text,text) TO service_role;

DO $$
DECLARE bp uuid; fund uuid; equity uuid; unjournaled bigint; tx uuid;
BEGIN
 SELECT id INTO bp FROM public.banking_providers WHERE provider_code='aurora_international' AND status='active';
 IF bp IS NOT NULL THEN
  fund := public.get_or_create_provider_finance_account(bp,'GBP','mortgage_funding_cash');
  equity := public.get_or_create_provider_finance_account(bp,'GBP','provider_equity');
  SELECT GREATEST(0, fa.current_balance_minor - COALESCE((SELECT sum(CASE WHEN le.entry_direction='credit' THEN le.amount_minor ELSE -le.amount_minor END) FROM public.financial_ledger_entries le WHERE le.account_id=fa.id),0)) INTO unjournaled FROM public.financial_accounts fa WHERE fa.id=fund FOR UPDATE;
  IF unjournaled > 0 THEN
   tx := public.post_financial_journal('administrative_adjustment',gen_random_uuid(),'GBP','phase8b2-reverse-unjournaled-mortgage-funding-'||bp,jsonb_build_array(jsonb_build_object('account_id',fund,'direction','debit','amount_minor',unjournaled,'component','reverse_unsafe_fixture','description','Reverse unjournaled Phase 8B.1 direct funding balance'),jsonb_build_object('account_id',equity,'direction','credit','amount_minor',unjournaled,'component','fixture_equity_offset','description','Offset unsafe fixture reversal')),'banking_provider',bp,jsonb_build_object('phase','8B.2','audit','reverse direct current_balance update'));
   tx := public.post_financial_journal('administrative_adjustment',gen_random_uuid(),'GBP','phase8b2-balanced-dev-mortgage-capital-'||bp,jsonb_build_array(jsonb_build_object('account_id',equity,'direction','debit','amount_minor',unjournaled,'component','development_provider_capital','description','Development provider capitalisation source'),jsonb_build_object('account_id',fund,'direction','credit','amount_minor',unjournaled,'component','mortgage_funding_cash','description','Balanced development mortgage funding cash')),'banking_provider',bp,jsonb_build_object('phase','8B.2','fixture','development mortgage provider capitalisation'));
  END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mortgaged_property_purchase(p_offer_id uuid,p_deposit_bank_account_id uuid,p_repayment_bank_account_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'mortgage_completion_disabled_pending_phase8b2_executable_accounting_tests';
END $$;

CREATE OR REPLACE FUNCTION public.reserve_mortgage_deposit(p_offer_id uuid,p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'mortgage_deposit_reservation_disabled_pending_balanced_phase8b2_posting';
END $$;
REVOKE ALL ON FUNCTION public.reserve_mortgage_deposit(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mortgage_deposit(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.post_mortgage_schedule_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'mortgage_payment_processing_disabled_pending_balanced_phase8b2_posting';
END $$;
REVOKE ALL ON FUNCTION public.post_mortgage_schedule_payment(uuid,text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.process_due_mortgage_repayments(date,int);
CREATE FUNCTION public.process_due_mortgage_repayments(p_as_of_date date DEFAULT CURRENT_DATE,p_limit int DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('attempted',0,'posted',0,'failed_insufficient_funds',0,'skipped',0,'errored',0,'status','disabled_pending_phase8b2_accounting_tests');
END $$;
REVOKE ALL ON FUNCTION public.process_due_mortgage_repayments(date,int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.retry_mortgage_payment(p_schedule_line_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'mortgage_retry_disabled_pending_balanced_phase8b2_posting';
END $$;

CREATE OR REPLACE FUNCTION public.progress_mortgage_arrears(p_as_of date DEFAULT CURRENT_DATE) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; stage text; n int:=0;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT l.*,c.borrower_id FROM public.mortgage_schedule_lines l JOIN public.mortgage_contracts c ON c.id=l.mortgage_contract_id WHERE c.status IN ('active','arrears') AND l.status IN ('scheduled','due','missed','part_paid') AND l.due_date<p_as_of AND l.schedule_version=(SELECT max(l2.schedule_version) FROM public.mortgage_schedule_lines l2 WHERE l2.mortgage_contract_id=l.mortgage_contract_id) LOOP
  stage:=CASE WHEN p_as_of-r.due_date<=7 THEN 'grace_period' WHEN p_as_of-r.due_date<30 THEN 'late' WHEN p_as_of-r.due_date<60 THEN 'seriously_late' ELSE 'final_warning' END;
  INSERT INTO public.mortgage_arrears_records(mortgage_contract_id,schedule_line_id,days_overdue,unpaid_principal_minor,unpaid_interest_minor,fees_minor,missed_payment_count,stage)
  VALUES(r.mortgage_contract_id,r.id,p_as_of-r.due_date,r.principal_due_minor-r.paid_principal_minor,r.interest_due_minor-r.paid_interest_minor,r.fees_due_minor-r.paid_fees_minor,1,stage)
  ON CONFLICT DO NOTHING;
  UPDATE public.mortgage_schedule_lines SET status='missed' WHERE id=r.id AND status IN ('scheduled','due','part_paid');
  UPDATE public.mortgage_contracts SET status='arrears' WHERE id=r.mortgage_contract_id AND status='active';
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.progress_mortgage_arrears(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.mortgage_reconciliation_exceptions AS
SELECT 'contract_without_security' issue, c.id::text entity_id FROM public.mortgage_contracts c WHERE c.status='active' AND NOT EXISTS(SELECT 1 FROM public.property_security_interests s WHERE s.mortgage_contract_id=c.id AND s.status='registered')
UNION ALL SELECT 'security_without_active_contract',s.id::text FROM public.property_security_interests s LEFT JOIN public.mortgage_contracts c ON c.id=s.mortgage_contract_id AND c.status IN ('active','arrears') WHERE s.status='registered' AND c.id IS NULL
UNION ALL SELECT 'security_balance_mismatch',s.id::text FROM public.property_security_interests s JOIN public.mortgage_contracts c ON c.id=s.mortgage_contract_id WHERE s.status='registered' AND s.outstanding_secured_amount_minor<>c.outstanding_principal_minor
UNION ALL SELECT 'schedule_principal_total_mismatch',c.id::text FROM public.mortgage_contracts c WHERE c.original_principal_minor<>(SELECT COALESCE(sum(principal_due_minor),0) FROM public.mortgage_schedule_lines l WHERE l.mortgage_contract_id=c.id)
UNION ALL SELECT 'payment_component_mismatch',id::text FROM public.mortgage_payments WHERE amount_minor<>principal_minor+interest_minor+fees_minor
UNION ALL SELECT 'completed_purchase_without_seller_account',id::text FROM public.property_purchase_transactions WHERE status='completed' AND seller_financial_account_id IS NULL
UNION ALL SELECT 'completed_purchase_without_settlement_transactions',id::text FROM public.property_purchase_transactions WHERE status='completed' AND cardinality(settlement_transaction_ids)=0
UNION ALL SELECT 'redeemed_contract_active_obligation',c.id::text FROM public.mortgage_contracts c JOIN public.recurring_financial_obligations r ON r.id=c.recurring_obligation_id WHERE c.status='redeemed' AND r.status='active'
UNION ALL SELECT 'redeemed_contract_unreleased_security',c.id::text FROM public.mortgage_contracts c JOIN public.property_security_interests s ON s.mortgage_contract_id=c.id WHERE c.status='redeemed' AND s.status<>'released'
UNION ALL SELECT 'duplicate_arrears_state',mortgage_contract_id::text FROM public.mortgage_arrears_records GROUP BY mortgage_contract_id,schedule_line_id,stage HAVING count(*)>1;

GRANT EXECUTE ON FUNCTION public.complete_mortgaged_property_purchase(uuid,uuid,uuid,text), public.retry_mortgage_payment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_mortgage_repayments(date,int), public.progress_mortgage_arrears(date) TO service_role;
