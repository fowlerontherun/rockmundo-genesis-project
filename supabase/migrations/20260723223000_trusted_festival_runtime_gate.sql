-- Trusted, rerunnable festival founding runtime-test context.
-- Forward-only: replaces caller-controlled app.allow_test_fixtures with a private token table.

CREATE SCHEMA IF NOT EXISTS festival_test;
REVOKE ALL ON SCHEMA festival_test FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA festival_test TO service_role;

CREATE TABLE IF NOT EXISTS festival_test.runs (
  run_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'runtime' CHECK (mode IN ('runtime','concurrency','rollback')),
  pause_after_lock boolean NOT NULL DEFAULT false,
  fail_after_extension boolean NOT NULL DEFAULT false,
  fail_after_debit boolean NOT NULL DEFAULT false,
  reached_pause_at timestamptz,
  second_started_at timestamptz,
  release_after_lock boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON festival_test.runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON festival_test.runs TO service_role;

CREATE OR REPLACE FUNCTION festival_test.token_hash(p_token text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION festival_test.create_run(
  p_run_id text,
  p_token text,
  p_mode text DEFAULT 'runtime',
  p_pause_after_lock boolean DEFAULT false,
  p_fail_after_extension boolean DEFAULT false,
  p_fail_after_debit boolean DEFAULT false,
  p_expires_in interval DEFAULT interval '30 minutes'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public AS $$
BEGIN
  IF current_user <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'festival_test_privileged_context_required' USING ERRCODE='42501';
  END IF;
  INSERT INTO festival_test.runs(run_id, token_hash, mode, pause_after_lock, fail_after_extension, fail_after_debit, expires_at)
  VALUES (p_run_id, festival_test.token_hash(p_token), p_mode, p_pause_after_lock, p_fail_after_extension, p_fail_after_debit, now() + p_expires_in)
  ON CONFLICT (run_id) DO UPDATE SET
    token_hash = excluded.token_hash,
    mode = excluded.mode,
    pause_after_lock = excluded.pause_after_lock,
    fail_after_extension = excluded.fail_after_extension,
    fail_after_debit = excluded.fail_after_debit,
    reached_pause_at = NULL,
    second_started_at = NULL,
    release_after_lock = false,
    expires_at = excluded.expires_at;
END $$;

CREATE OR REPLACE FUNCTION festival_test.release_run(p_run_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public AS $$
BEGIN
  IF current_user <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'festival_test_privileged_context_required' USING ERRCODE='42501';
  END IF;
  UPDATE festival_test.runs SET release_after_lock = true WHERE run_id = p_run_id;
END $$;

CREATE OR REPLACE FUNCTION festival_test.cleanup_run(p_run_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public,auth AS $$
DECLARE v_prefix text := p_run_id || '%';
BEGIN
  IF current_user <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'festival_test_privileged_context_required' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.company_transactions ct USING public.companies c WHERE ct.company_id=c.id AND c.description LIKE v_prefix;
  DELETE FROM public.festival_company_audit_log a USING public.festival_companies fc WHERE a.festival_company_id=fc.id AND fc.description LIKE v_prefix;
  DELETE FROM public.festival_company_founding_requests WHERE idempotency_key LIKE p_run_id || '-%';
  DELETE FROM public.company_shareholders s USING public.companies c WHERE s.company_id=c.id AND c.description LIKE v_prefix;
  DELETE FROM public.festival_companies WHERE description LIKE v_prefix;
  DELETE FROM public.companies WHERE description LIKE v_prefix;
  DELETE FROM public.financial_ledger_entries e USING public.financial_transactions t WHERE e.transaction_id=t.id AND t.idempotency_key LIKE 'festival-company-founding:' || p_run_id || '-%';
  DELETE FROM public.financial_transactions WHERE idempotency_key LIKE 'festival-company-founding:' || p_run_id || '-%';
  DELETE FROM public.financial_accounts WHERE metadata->>'festival_test_run_id' = p_run_id;
  DELETE FROM public.vip_subscriptions WHERE metadata->>'festival_test_run_id' = p_run_id;
  DELETE FROM public.profiles WHERE username LIKE 'festival_' || replace(p_run_id,'-','_') || '%';
  DELETE FROM auth.users WHERE email LIKE p_run_id || '%@example.test';
  DELETE FROM festival_test.runs WHERE run_id = p_run_id;
END $$;

CREATE OR REPLACE FUNCTION public._festival_test_context()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public AS $$
DECLARE v_token text := current_setting('app.festival_test_run_token', true); v_run festival_test.runs%ROWTYPE;
BEGIN
  IF v_token IS NULL OR btrim(v_token) = '' THEN RETURN '{}'::jsonb; END IF;
  SELECT * INTO v_run FROM festival_test.runs WHERE token_hash = festival_test.token_hash(v_token) AND expires_at > now();
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('trusted', true, 'runId', v_run.run_id, 'mode', v_run.mode, 'pauseAfterLock', v_run.pause_after_lock, 'failAfterExtension', v_run.fail_after_extension, 'failAfterDebit', v_run.fail_after_debit);
END $$;

CREATE OR REPLACE FUNCTION public._festival_test_fixtures_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((public._festival_test_context()->>'trusted')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public._festival_test_after_lock()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=festival_test,public AS $$
DECLARE v_ctx jsonb := public._festival_test_context(); v_run_id text := v_ctx->>'runId';
BEGIN
  IF COALESCE((v_ctx->>'pauseAfterLock')::boolean,false) IS NOT TRUE THEN RETURN; END IF;
  UPDATE festival_test.runs SET reached_pause_at = COALESCE(reached_pause_at, now()) WHERE run_id = v_run_id;
  WHILE EXISTS (SELECT 1 FROM festival_test.runs WHERE run_id=v_run_id AND release_after_lock IS NOT TRUE AND expires_at > now()) LOOP
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.found_festival_company(p_public_name text, p_company_name text, p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_profile_id uuid; v_cost numeric := 2000000; v_cost_minor bigint := 200000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_finance jsonb; v_result jsonb; v_tx uuid; v_balance numeric; v_available_minor bigint; v_test jsonb := public._festival_test_context();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF NOT public._festival_company_creation_enabled() THEN RAISE EXCEPTION 'festival_creation_disabled' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  v_public := btrim(coalesce(p_public_name,'')); v_company := btrim(coalesce(p_company_name,''));
  IF char_length(v_public) < 3 OR char_length(v_public) > 80 OR char_length(v_company) < 3 OR char_length(v_company) > 120 THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_slug := public._festival_slug(v_public); IF v_slug = '' THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_hash := encode(digest(v_public || '|' || v_company || '|' || coalesce(p_description,'') || '|2000000', 'sha256'), 'hex');
  v_profile_id := public._caller_profile_id(); IF v_profile_id IS NULL THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key, 0));
  PERFORM public._festival_test_after_lock();
  SELECT * INTO v_req FROM public.festival_company_founding_requests WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status = 'succeeded' THEN RETURN v_req.result || jsonb_build_object('idempotent', true); END IF;
    RAISE EXCEPTION 'festival_request_retryable' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash) VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;
  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF NOT public.can_profile_found_festival_company(v_profile.id) THEN RAISE EXCEPTION 'company_limit_reached' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(available_balance_minor,0) INTO v_available_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=v_profile.id AND is_primary FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_primary_financial_account_required' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_available_minor,0) < v_cost_minor THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  IF COALESCE((v_test->>'failAfterExtension')::boolean,false) THEN RAISE EXCEPTION 'festival_test_late_failure' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.company_shareholders(company_id,user_id,shares) VALUES (v_company_id,v_user,100);
  v_finance := public.finance_debit_player_personal_cash(v_profile.id, v_cost_minor, 'festival_company_founding_fee', 'Festival company founding fee', 'festival-company-founding:'||p_idempotency_key, jsonb_build_object('festivalCompanyId',v_fc_id,'companyId',v_company_id,'wholeUsdAmount',v_cost,'currencyUnit','minor'));
  IF COALESCE((v_test->>'failAfterDebit')::boolean,false) THEN RAISE EXCEPTION 'festival_test_post_debit_failure' USING ERRCODE='P0001'; END IF;
  v_tx := (v_finance->>'transactionId')::uuid; v_balance := (v_finance->>'projectedCash')::numeric;
  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'founding_cost_minor',v_cost_minor,'personal_financial_transaction_id',v_tx,'accounting','financial_accounts is authoritative; profiles.cash is an atomic compatibility projection')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('authoritative_personal_balance',v_balance));
  v_result := jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'authoritativePersonalBalance', v_balance, 'foundingCost', v_cost, 'foundingCostMinor', v_cost_minor, 'personalFinancialTransactionId', v_tx, 'idempotent', false);
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, result=v_result, completed_at=now(), updated_at=now() WHERE id=v_req.id;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  RAISE;
END $$;

REVOKE ALL ON FUNCTION public._festival_test_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_test_after_lock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
