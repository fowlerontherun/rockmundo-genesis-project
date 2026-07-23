-- Corrective runtime/finance gate fixes for festival-company founding.

CREATE OR REPLACE FUNCTION public.finance_debit_player_personal_cash(
  p_profile_id uuid,
  p_amount_minor bigint,
  p_category public.financial_transaction_category,
  p_description text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  src public.financial_accounts;
  dst public.financial_accounts;
  tx uuid;
  src_before bigint;
  dst_before bigint;
  v_related_entity_id uuid := NULLIF(p_metadata->>'festivalCompanyId','')::uuid;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF tx IS NOT NULL THEN
    SELECT * INTO src FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p_profile_id AND is_primary;
    UPDATE public.profiles SET cash = (src.current_balance_minor / 100.0), updated_at = now() WHERE id=p_profile_id;
    RETURN jsonb_build_object('transactionId', tx, 'availableBalanceMinor', src.available_balance_minor, 'currentBalanceMinor', src.current_balance_minor, 'projectedCash', (src.current_balance_minor / 100.0));
  END IF;

  SELECT * INTO src FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p_profile_id AND is_primary FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'finance account not found'; END IF;
  dst := public.get_or_create_primary_financial_account('system', NULL, 'System operating account', src.default_currency_code);
  SELECT * INTO dst FROM public.financial_accounts WHERE id = dst.id FOR UPDATE;
  IF src.account_status <> 'active' OR dst.account_status <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF src.available_balance_minor < p_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  src_before := src.current_balance_minor; dst_before := dst.current_balance_minor;

  INSERT INTO public.financial_transactions(
    transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,source_account_id,destination_account_id,
    related_entity_type,related_entity_id,description,idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,
    source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,metadata
  ) VALUES (
    p_category,'completed',src.default_currency_code,p_amount_minor,p_amount_minor,src.id,dst.id,
    CASE WHEN v_related_entity_id IS NULL THEN NULL ELSE 'festival_company' END,v_related_entity_id,p_description,p_idempotency_key,auth.uid(),p_profile_id,COALESCE(auth.uid()::text,'system'),timezone('utc',now()),
    src.default_currency_code,dst.default_currency_code,p_amount_minor,p_amount_minor,p_metadata || jsonb_build_object('profilesCashRole','compatibility_projection')
  ) RETURNING id INTO tx;

  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor - p_amount_minor, updated_at = timezone('utc', now()) WHERE id = src.id;
  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor + p_amount_minor, updated_at = timezone('utc', now()) WHERE id = dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES
    (tx, src.id, 'debit', p_amount_minor, src_before, src_before - p_amount_minor, src.default_currency_code),
    (tx, dst.id, 'credit', p_amount_minor, dst_before, dst_before + p_amount_minor, dst.default_currency_code);

  SELECT * INTO src FROM public.financial_accounts WHERE id=src.id;
  UPDATE public.profiles SET cash = (src.current_balance_minor / 100.0), updated_at = now() WHERE id=p_profile_id;
  RETURN jsonb_build_object('transactionId', tx, 'availableBalanceMinor', src.available_balance_minor, 'currentBalanceMinor', src.current_balance_minor, 'projectedCash', (src.current_balance_minor / 100.0));
END $$;

REVOKE ALL ON FUNCTION public.finance_debit_player_personal_cash(uuid,bigint,public.financial_transaction_category,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION festival_test.cleanup_run(p_run_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public,auth AS $$
DECLARE v_prefix text := p_run_id || '%';
BEGIN
  IF current_user <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'festival_test_privileged_context_required' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.financial_ledger_entries e USING public.financial_transactions t WHERE e.transaction_id=t.id AND t.idempotency_key LIKE 'festival-company-founding:' || p_run_id || '-%';
  DELETE FROM public.company_transactions ct USING public.companies c WHERE ct.company_id=c.id AND c.description LIKE v_prefix;
  DELETE FROM public.festival_company_audit_log a USING public.festival_companies fc WHERE a.festival_company_id=fc.id AND fc.description LIKE v_prefix;
  DELETE FROM public.festival_company_founding_requests WHERE idempotency_key LIKE p_run_id || '-%';
  DELETE FROM public.company_shareholders s USING public.companies c WHERE s.company_id=c.id AND c.description LIKE v_prefix;
  DELETE FROM public.festival_companies WHERE description LIKE v_prefix;
  DELETE FROM public.financial_transactions WHERE idempotency_key LIKE 'festival-company-founding:' || p_run_id || '-%';
  DELETE FROM public.companies WHERE description LIKE v_prefix;
  DELETE FROM public.financial_accounts WHERE metadata->>'festival_test_run_id' = p_run_id;
  DELETE FROM public.vip_subscriptions WHERE metadata->>'festival_test_run_id' = p_run_id;
  DELETE FROM public.profiles WHERE username LIKE 'festival_' || replace(p_run_id,'-','_') || '%';
  DELETE FROM auth.users WHERE email LIKE p_run_id || '%@example.test';
  DELETE FROM festival_test.runs WHERE run_id = p_run_id;
END $$;
