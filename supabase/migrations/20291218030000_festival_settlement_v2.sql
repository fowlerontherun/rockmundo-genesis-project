-- festival-settlement-v2: forward-only accounting evidence and trusted scheduling.
ALTER TABLE public.festival_financial_settlements
  ADD COLUMN runtime_schema_version text NOT NULL DEFAULT 'festival-runtime-outcome-v2',
  ADD COLUMN settlement_formula_version text NOT NULL DEFAULT 'festival-settlement-v2',
  ADD COLUMN tax_rule_version text NOT NULL DEFAULT 'festival-tax-v1',
  ADD COLUMN payment_priority_version text NOT NULL DEFAULT 'festival-priority-v1',
  ADD COLUMN runtime_snapshot_digest text,
  ADD COLUMN contract_snapshot_digest text,
  ADD COLUMN calculation_digest text;

CREATE TABLE public.festival_settlement_liabilities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_id uuid NOT NULL REFERENCES public.festival_financial_settlements(id),settlement_line_id uuid NOT NULL UNIQUE REFERENCES public.festival_settlement_lines(id),priority integer NOT NULL CHECK(priority BETWEEN 1 AND 9),original_amount_minor bigint NOT NULL CHECK(original_amount_minor>=0),outstanding_amount_minor bigint NOT NULL CHECK(outstanding_amount_minor>=0),currency_code text NOT NULL CHECK(currency_code~'^[A-Z]{3}$'),status text NOT NULL CHECK(status IN('outstanding','processing','paid','waived','resolved')),next_retry_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_settlement_line_components(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),component_type text NOT NULL,contract_clause_id text,evidence jsonb NOT NULL,calculation text NOT NULL,amount_minor bigint NOT NULL,currency_code text NOT NULL CHECK(currency_code~'^[A-Z]{3}$'),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_tax_calculations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),jurisdiction text NOT NULL,tax_type text NOT NULL,rate numeric NOT NULL CHECK(rate>=0),taxable_base_minor bigint NOT NULL,tax_amount_minor bigint NOT NULL,currency_code text NOT NULL,rule_version text NOT NULL,event_date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_payment_priorities(priority integer PRIMARY KEY CHECK(priority BETWEEN 1 AND 9),code text NOT NULL UNIQUE,required boolean NOT NULL DEFAULT true);
INSERT INTO public.festival_payment_priorities VALUES (1,'ticket_refunds',true),(2,'statutory_taxes',true),(3,'staff_wages',true),(4,'artist_guarantees',true),(5,'essential_suppliers',true),(6,'other_suppliers',true),(7,'merchandise_royalties',true),(8,'sponsor_refunds',true),(9,'company_distribution',false);
CREATE TABLE public.festival_band_split_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),band_id uuid NOT NULL,agreement_snapshot jsonb NOT NULL,canonical_band_transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id),canonical_split_receipt_id uuid NOT NULL,transfer_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_royalty_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),payee_type text NOT NULL,payee_id uuid NOT NULL,gross_sales_minor bigint NOT NULL,refunds_minor bigint NOT NULL DEFAULT 0,chargebacks_minor bigint NOT NULL DEFAULT 0,tax_minor bigint NOT NULL DEFAULT 0,production_cost_minor bigint NOT NULL DEFAULT 0,commission_minor bigint NOT NULL DEFAULT 0,royalty_base_minor bigint NOT NULL,royalty_amount_minor bigint NOT NULL,currency_code text NOT NULL,canonical_transaction_id uuid REFERENCES public.financial_transactions(id),transfer_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_dispute_adjustment_lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dispute_id uuid NOT NULL REFERENCES public.festival_settlement_disputes(id),original_line_id uuid NOT NULL REFERENCES public.festival_settlement_lines(id),adjustment_line_id uuid NOT NULL UNIQUE REFERENCES public.festival_settlement_lines(id),resolver_profile_id uuid NOT NULL REFERENCES public.profiles(id),reason text NOT NULL,amount_minor bigint NOT NULL,currency_code text NOT NULL,idempotency_key uuid NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_staff_overtime_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),staff_checkin_id uuid NOT NULL REFERENCES public.festival_runtime_staff_checkins(id),approver_profile_id uuid NOT NULL REFERENCES public.profiles(id),approved_at timestamptz NOT NULL DEFAULT now(),requested_minutes integer NOT NULL CHECK(requested_minutes>=0),approved_minutes integer NOT NULL CHECK(approved_minutes BETWEEN 0 AND requested_minutes),reason text NOT NULL,idempotency_key uuid NOT NULL UNIQUE,UNIQUE(staff_checkin_id));

DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['festival_settlement_liabilities','festival_settlement_line_components','festival_tax_calculations','festival_payment_priorities','festival_band_split_receipts','festival_royalty_receipts','festival_dispute_adjustment_lines','festival_staff_overtime_approvals'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);END LOOP;END$$;

-- The Edge Function contract is x-worker-secret. pg_net lower-cases header names.
CREATE OR REPLACE FUNCTION public.invoke_festival_performance_worker() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE endpoint text; secret text;
BEGIN
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1' INTO secret USING 'festival_performance_worker_secret';
  endpoint:=current_setting('app.festival_worker_url',true);
  IF nullif(endpoint,'') IS NULL OR nullif(secret,'') IS NULL THEN RAISE EXCEPTION 'festival_worker_configuration_missing'; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, headers := jsonb_build_object(''content-type'',''application/json'',''x-worker-secret'',$2), body := ''{}''::jsonb)' USING endpoint,secret;
END $$;

CREATE OR REPLACE FUNCTION public.verify_festival_performance_worker_schedule() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE schedule_exists boolean:=false; schedule_active boolean:=false; secret_exists boolean:=false; url_exists boolean:=false; last_inv timestamptz; last_ok timestamptz; last_fail timestamptz; oldest timestamptz; exhausted bigint:=0; enabled boolean:=coalesce(current_setting('app.enable_festival_worker_schedule',true),'false')::boolean;
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN EXECUTE 'SELECT count(*)>0,coalesce(bool_or(active),false) FROM cron.job WHERE jobname=$1' INTO schedule_exists,schedule_active USING 'festival-performance-worker-every-minute'; END IF;
 BEGIN EXECUTE 'SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name=$1 AND nullif(decrypted_secret,'''') IS NOT NULL)' INTO secret_exists USING 'festival_performance_worker_secret'; EXCEPTION WHEN undefined_table OR insufficient_privilege THEN secret_exists:=false; END;
 url_exists:=nullif(current_setting('app.festival_worker_url',true),'') IS NOT NULL;
 SELECT max(started_at),max(completed_at) FILTER(WHERE status='succeeded'),max(completed_at) FILTER(WHERE status='failed') INTO last_inv,last_ok,last_fail FROM public.festival_simulation_worker_invocations;
 SELECT min(created_at) FILTER(WHERE status IN ('pending','failed')),count(*) FILTER(WHERE status='exhausted' OR (status='failed' AND attempts>=max_attempts)) INTO oldest,exhausted FROM public.festival_performance_simulation_jobs;
 RETURN jsonb_build_object('configured',enabled AND schedule_exists AND schedule_active AND secret_exists AND url_exists,'scheduleExists',schedule_exists,'scheduleActive',schedule_active,'secretExists',secret_exists,'urlExists',url_exists,'lastInvocationTime',last_inv,'lastSuccessfulInvocation',last_ok,'lastFailure',last_fail,'lastInvocationSucceeded',last_ok IS NOT NULL AND (last_fail IS NULL OR last_ok>last_fail),'oldestPendingJob',oldest,'exhaustedJobs',exhausted,'queueHealthy',exhausted=0 AND (oldest IS NULL OR oldest>now()-interval '5 minutes'),'valid',enabled AND schedule_exists AND schedule_active AND secret_exists AND url_exists AND last_ok IS NOT NULL AND (last_fail IS NULL OR last_ok>last_fail));
END $$;
COMMENT ON FUNCTION public.invoke_festival_performance_worker() IS 'Trusted scheduler target; reads URL/configuration from settings and sends the Vault secret only in x-worker-secret.';
