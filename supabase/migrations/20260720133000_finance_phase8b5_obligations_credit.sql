-- Finance Phase 8B.5: universal financial obligations, debt recovery and credit history.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'financial_obligation_payment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'debt_collection';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'credit_adjustment';

DO $$ BEGIN CREATE TYPE public.financial_obligation_frequency AS ENUM ('daily','weekly','fortnightly','monthly','quarterly','annual','custom_interval'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_obligation_status AS ENUM ('active','grace_period','retrying','failed','collections','paused','cancelled','completed','written_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_obligation_event_type AS ENUM ('created','upcoming_notice','payment_succeeded','payment_failed','grace_started','retry_scheduled','debt_created','debt_escalated','credit_history_recorded','credit_score_changed','paused','resumed','cancelled','completed','written_off','admin_adjusted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.debt_collection_stage AS ENUM ('friendly_reminder','late_notice','final_notice','collections','legal_action','asset_recovery','settled','written_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.player_credit_event_type AS ENUM ('successful_payment','missed_payment','default','collection','mortgage_completion','debt_settlement','bankruptcy','score_adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financial_obligation_policies (
  obligation_type text PRIMARY KEY,
  default_grace_period_days integer NOT NULL DEFAULT 0 CHECK (default_grace_period_days >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  retry_interval_days integer NOT NULL DEFAULT 1 CHECK (retry_interval_days > 0),
  collection_stage_rules jsonb NOT NULL DEFAULT '[{"stage":"friendly_reminder","after_days":0},{"stage":"late_notice","after_days":7},{"stage":"final_notice","after_days":14},{"stage":"collections","after_days":21},{"stage":"legal_action","after_days":35},{"stage":"asset_recovery","after_days":60}]'::jsonb,
  notification_rules jsonb NOT NULL DEFAULT '{"upcoming_days":3,"notify_success":true,"notify_failure":true}'::jsonb,
  credit_reporting_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);

CREATE TABLE IF NOT EXISTS public.financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_type text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('player','band','company','npc','government')),
  owner_id uuid NOT NULL,
  linked_asset_type text, linked_asset_id uuid,
  payment_account_id uuid REFERENCES public.financial_accounts(id), recipient_account_id uuid REFERENCES public.financial_accounts(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency_code char(3) NOT NULL,
  frequency public.financial_obligation_frequency NOT NULL, custom_interval_days integer CHECK (custom_interval_days IS NULL OR custom_interval_days > 0),
  next_due_date date NOT NULL, grace_period_days integer NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0), retry_interval_days integer NOT NULL DEFAULT 1 CHECK (retry_interval_days > 0),
  status public.financial_obligation_status NOT NULL DEFAULT 'active', missed_payment_count integer NOT NULL DEFAULT 0 CHECK (missed_payment_count >= 0),
  outstanding_balance_minor bigint NOT NULL DEFAULT 0 CHECK (outstanding_balance_minor >= 0),
  linked_finance_transaction_id uuid REFERENCES public.financial_transactions(id), legacy_recurring_obligation_id uuid REFERENCES public.recurring_financial_obligations(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc',now()), completed_at timestamptz,
  UNIQUE(obligation_type, linked_asset_type, linked_asset_id)
);

CREATE TABLE IF NOT EXISTS public.financial_obligation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES public.financial_obligations(id) ON DELETE CASCADE,
  instalment_number integer NOT NULL CHECK (instalment_number > 0), due_date date NOT NULL, grace_expires_at date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), principal_minor bigint NOT NULL DEFAULT 0 CHECK (principal_minor >= 0), interest_minor bigint NOT NULL DEFAULT 0 CHECK (interest_minor >= 0), fees_minor bigint NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','due','paid','missed','failed','cancelled','completed')),
  source_schedule_type text, source_schedule_id uuid, transaction_id uuid REFERENCES public.financial_transactions(id), paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), UNIQUE(obligation_id, instalment_number)
);

CREATE TABLE IF NOT EXISTS public.financial_obligation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES public.financial_obligations(id) ON DELETE CASCADE, schedule_id uuid REFERENCES public.financial_obligation_schedule(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0), attempted_at timestamptz NOT NULL DEFAULT timezone('utc',now()), status text NOT NULL CHECK (status IN ('succeeded','failed','skipped')),
  failure_reason text, balance_at_attempt_minor bigint NOT NULL DEFAULT 0, remaining_shortfall_minor bigint NOT NULL DEFAULT 0 CHECK (remaining_shortfall_minor >= 0), transaction_id uuid REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.financial_obligation_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid REFERENCES public.financial_obligations(id) ON DELETE CASCADE, event_type public.financial_obligation_event_type NOT NULL, event_payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), created_by_profile_id uuid REFERENCES public.profiles(id));
CREATE TABLE IF NOT EXISTS public.financial_obligation_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid NOT NULL REFERENCES public.financial_obligations(id) ON DELETE CASCADE, previous_status public.financial_obligation_status, new_status public.financial_obligation_status NOT NULL, reason text, changed_at timestamptz NOT NULL DEFAULT timezone('utc',now()), changed_by_profile_id uuid REFERENCES public.profiles(id));
CREATE TABLE IF NOT EXISTS public.debt_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obligation_id uuid REFERENCES public.financial_obligations(id), owner_type text NOT NULL, owner_id uuid NOT NULL, original_amount_minor bigint NOT NULL CHECK(original_amount_minor>0), fees_minor bigint NOT NULL DEFAULT 0, interest_minor bigint NOT NULL DEFAULT 0, outstanding_balance_minor bigint NOT NULL CHECK(outstanding_balance_minor>=0), currency_code char(3) NOT NULL, collection_stage public.debt_collection_stage NOT NULL DEFAULT 'friendly_reminder', stage_entered_at timestamptz NOT NULL DEFAULT timezone('utc',now()), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','settled','written_off')), metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()), updated_at timestamptz NOT NULL DEFAULT timezone('utc',now()));
CREATE TABLE IF NOT EXISTS public.debt_collection_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), debt_id uuid NOT NULL REFERENCES public.debt_records(id) ON DELETE CASCADE, previous_stage public.debt_collection_stage, new_stage public.debt_collection_stage NOT NULL, fee_added_minor bigint NOT NULL DEFAULT 0, interest_added_minor bigint NOT NULL DEFAULT 0, notes text, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()));
CREATE TABLE IF NOT EXISTS public.player_credit_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, event_type public.player_credit_event_type NOT NULL, obligation_id uuid REFERENCES public.financial_obligations(id), debt_id uuid REFERENCES public.debt_records(id), event_date date NOT NULL DEFAULT CURRENT_DATE, amount_minor bigint NOT NULL DEFAULT 0, currency_code char(3), score_delta integer NOT NULL DEFAULT 0, private_metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT timezone('utc',now()));
CREATE TABLE IF NOT EXISTS public.player_credit_scores (profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, credit_score integer NOT NULL DEFAULT 600 CHECK(credit_score BETWEEN 300 AND 850), credit_band text NOT NULL DEFAULT 'Building', positive_factors jsonb NOT NULL DEFAULT '[]'::jsonb, negative_factors jsonb NOT NULL DEFAULT '[]'::jsonb, calculated_at timestamptz NOT NULL DEFAULT timezone('utc',now()), significant_change_notified_at timestamptz);

INSERT INTO public.financial_obligation_policies(obligation_type,default_grace_period_days,max_attempts,retry_interval_days) VALUES
 ('mortgage',7,3,1),('rent',7,3,1),('insurance',0,1,1),('utility',3,3,1),('staff_wages',0,2,1),('subscription',0,2,1),('loan',7,3,1)
ON CONFLICT (obligation_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_financial_obligations_due ON public.financial_obligations(status,next_due_date) WHERE status IN ('active','grace_period','retrying');
CREATE INDEX IF NOT EXISTS idx_financial_obligation_schedule_due ON public.financial_obligation_schedule(status,due_date);
CREATE INDEX IF NOT EXISTS idx_debt_records_owner ON public.debt_records(owner_type,owner_id,status);
CREATE INDEX IF NOT EXISTS idx_player_credit_history_profile ON public.player_credit_history(profile_id,event_date DESC);

CREATE OR REPLACE FUNCTION public.record_financial_obligation_event(p_obligation_id uuid,p_event_type public.financial_obligation_event_type,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE eid uuid; BEGIN INSERT INTO public.financial_obligation_events(obligation_id,event_type,event_payload,created_by_profile_id) VALUES(p_obligation_id,p_event_type,p_payload,public.current_player_profile_id()) RETURNING id INTO eid; RETURN eid; END $$;

CREATE OR REPLACE FUNCTION public.set_financial_obligation_status(p_obligation_id uuid,p_status public.financial_obligation_status,p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE old public.financial_obligation_status; BEGIN SELECT status INTO old FROM public.financial_obligations WHERE id=p_obligation_id FOR UPDATE; IF old IS DISTINCT FROM p_status THEN UPDATE public.financial_obligations SET status=p_status,updated_at=timezone('utc',now()),completed_at=CASE WHEN p_status IN ('completed','cancelled','written_off') THEN timezone('utc',now()) ELSE completed_at END WHERE id=p_obligation_id; INSERT INTO public.financial_obligation_status_history(obligation_id,previous_status,new_status,reason,changed_by_profile_id) VALUES(p_obligation_id,old,p_status,p_reason,public.current_player_profile_id()); PERFORM public.record_financial_obligation_event(p_obligation_id,CASE p_status WHEN 'completed' THEN 'completed'::public.financial_obligation_event_type WHEN 'cancelled' THEN 'cancelled'::public.financial_obligation_event_type WHEN 'paused' THEN 'paused'::public.financial_obligation_event_type WHEN 'written_off' THEN 'written_off'::public.financial_obligation_event_type ELSE 'admin_adjusted'::public.financial_obligation_event_type END,jsonb_build_object('reason',p_reason)); END IF; END $$;

CREATE OR REPLACE FUNCTION public.recalculate_player_credit_score(p_profile_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE successes int; misses int; defaults int; collections int; completions int; debts bigint; score int; old int;
BEGIN
 SELECT count(*) FILTER (WHERE event_type='successful_payment'), count(*) FILTER (WHERE event_type='missed_payment'), count(*) FILTER (WHERE event_type='default'), count(*) FILTER (WHERE event_type='collection'), count(*) FILTER (WHERE event_type='mortgage_completion') INTO successes,misses,defaults,collections,completions FROM public.player_credit_history WHERE profile_id=p_profile_id;
 SELECT COALESCE(sum(outstanding_balance_minor),0) INTO debts FROM public.debt_records WHERE owner_type='player' AND owner_id=p_profile_id AND status='open';
 score:=LEAST(850,GREATEST(300,600 + successes*2 + completions*40 - misses*20 - defaults*80 - collections*60 - LEAST(150,(debts/10000)::int)));
 SELECT credit_score INTO old FROM public.player_credit_scores WHERE profile_id=p_profile_id;
 INSERT INTO public.player_credit_scores(profile_id,credit_score,credit_band,positive_factors,negative_factors) VALUES(p_profile_id,score,CASE WHEN score>=760 THEN 'Excellent' WHEN score>=700 THEN 'Good' WHEN score>=620 THEN 'Fair' WHEN score>=520 THEN 'Poor' ELSE 'High Risk' END,jsonb_build_array('On-time payment history and completed mortgages improve this private score.'),CASE WHEN misses+defaults+collections>0 OR debts>0 THEN jsonb_build_array('Missed payments, defaults, collections and open debt reduce this private score.') ELSE '[]'::jsonb END) ON CONFLICT(profile_id) DO UPDATE SET credit_score=EXCLUDED.credit_score,credit_band=EXCLUDED.credit_band,positive_factors=EXCLUDED.positive_factors,negative_factors=EXCLUDED.negative_factors,calculated_at=timezone('utc',now());
 IF old IS NOT NULL AND abs(score-old)>=25 THEN INSERT INTO public.financial_obligation_events(obligation_id,event_type,event_payload) VALUES(NULL,'credit_score_changed',jsonb_build_object('profile_id',p_profile_id,'old_score',old,'new_score',score)); END IF;
 RETURN score;
END $$;

CREATE OR REPLACE FUNCTION public.create_financial_obligation_from_mortgage(p_mortgage_contract_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.mortgage_contracts; ba public.bank_accounts; pol public.financial_obligation_policies; accounts jsonb; recipient uuid; obl uuid; n int:=0; s record;
BEGIN
 SELECT * INTO c FROM public.mortgage_contracts WHERE id=p_mortgage_contract_id FOR UPDATE; IF c.id IS NULL THEN RAISE EXCEPTION 'mortgage not found'; END IF;
 SELECT * INTO ba FROM public.bank_accounts WHERE id=c.repayment_bank_account_id; SELECT * INTO pol FROM public.financial_obligation_policies WHERE obligation_type='mortgage'; accounts:=public.ensure_mortgage_provider_accounts(c.provider_id,c.currency_code); recipient:=(accounts->>'mortgage_repayment_cash')::uuid;
 INSERT INTO public.financial_obligations(obligation_type,owner_type,owner_id,linked_asset_type,linked_asset_id,payment_account_id,recipient_account_id,amount_minor,currency_code,frequency,next_due_date,grace_period_days,max_attempts,retry_interval_days,status,legacy_recurring_obligation_id,metadata)
 VALUES('mortgage',c.borrower_type::text,c.borrower_id,'mortgage_contract',c.id,ba.linked_finance_account_id,recipient,COALESCE((SELECT total_due_minor FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id AND status<>'paid' ORDER BY due_date LIMIT 1),0),c.currency_code,'monthly',c.next_payment_due_date,pol.default_grace_period_days,pol.max_attempts,pol.retry_interval_days,'active',c.recurring_obligation_id,jsonb_build_object('producer','mortgage_contract','phase','8B.5')) ON CONFLICT(obligation_type,linked_asset_type,linked_asset_id) DO UPDATE SET payment_account_id=EXCLUDED.payment_account_id,recipient_account_id=EXCLUDED.recipient_account_id,next_due_date=EXCLUDED.next_due_date RETURNING id INTO obl;
 FOR s IN SELECT * FROM public.mortgage_schedule_lines WHERE mortgage_contract_id=c.id ORDER BY instalment_number LOOP n:=n+1; INSERT INTO public.financial_obligation_schedule(obligation_id,instalment_number,due_date,grace_expires_at,amount_minor,principal_minor,interest_minor,fees_minor,status,source_schedule_type,source_schedule_id,transaction_id,paid_at) VALUES(obl,s.instalment_number,s.due_date,s.due_date + pol.default_grace_period_days,s.total_due_minor,s.principal_due_minor,s.interest_due_minor,s.fees_due_minor,CASE WHEN s.status='paid' THEN 'paid' ELSE 'scheduled' END,'mortgage_schedule_line',s.id,s.payment_transaction_id,CASE WHEN s.status='paid' THEN timezone('utc',now()) END) ON CONFLICT(obligation_id,instalment_number) DO UPDATE SET amount_minor=EXCLUDED.amount_minor,status=EXCLUDED.status,transaction_id=EXCLUDED.transaction_id; END LOOP;
 UPDATE public.mortgage_contracts SET recurring_obligation_id=NULL WHERE id=c.id; UPDATE public.recurring_financial_obligations SET status='cancelled', metadata=metadata||jsonb_build_object('replaced_by_financial_obligation_id',obl,'replaced_in_phase','8B.5') WHERE id=c.recurring_obligation_id;
 PERFORM public.record_financial_obligation_event(obl,'created',jsonb_build_object('source','mortgage_contract','schedule_lines',n)); RETURN obl;
END $$;

CREATE OR REPLACE FUNCTION public.process_financial_obligation_payment(p_schedule_id uuid,p_idempotency_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.financial_obligation_schedule; o public.financial_obligations; payer public.financial_accounts; tx uuid; attempts int; shortfall bigint; next_due date; debt uuid; res jsonb; BEGIN
 SELECT * INTO s FROM public.financial_obligation_schedule WHERE id=p_schedule_id FOR UPDATE; SELECT * INTO o FROM public.financial_obligations WHERE id=s.obligation_id FOR UPDATE; SELECT * INTO payer FROM public.financial_accounts WHERE id=o.payment_account_id FOR UPDATE; IF s.status='paid' THEN RETURN jsonb_build_object('status','already_paid'); END IF;
 SELECT count(*)+1 INTO attempts FROM public.financial_obligation_attempts WHERE schedule_id=s.id; shortfall:=GREATEST(0,s.amount_minor-COALESCE(payer.available_balance_minor,0));
 IF payer.id IS NULL OR payer.account_status<>'active' OR shortfall>0 THEN
  INSERT INTO public.financial_obligation_attempts(obligation_id,schedule_id,attempt_number,status,failure_reason,balance_at_attempt_minor,remaining_shortfall_minor,idempotency_key) VALUES(o.id,s.id,attempts,'failed',CASE WHEN payer.id IS NULL THEN 'missing_payment_account' ELSE 'insufficient_funds' END,COALESCE(payer.available_balance_minor,0),shortfall,p_idempotency_key) ON CONFLICT DO NOTHING;
  UPDATE public.financial_obligations SET status=CASE WHEN CURRENT_DATE<=s.grace_expires_at AND attempts<o.max_attempts THEN 'grace_period'::public.financial_obligation_status ELSE 'failed'::public.financial_obligation_status END, missed_payment_count=missed_payment_count+1, outstanding_balance_minor=outstanding_balance_minor+s.amount_minor, next_due_date=LEAST(next_due_date,CURRENT_DATE + o.retry_interval_days), updated_at=timezone('utc',now()) WHERE id=o.id;
  UPDATE public.financial_obligation_schedule SET status=CASE WHEN CURRENT_DATE<=s.grace_expires_at THEN 'missed' ELSE 'failed' END WHERE id=s.id; PERFORM public.record_financial_obligation_event(o.id,'payment_failed',jsonb_build_object('schedule_id',s.id,'attempt',attempts,'shortfall_minor',shortfall));
  IF o.owner_type='player' THEN INSERT INTO public.player_credit_history(profile_id,event_type,obligation_id,amount_minor,currency_code,score_delta,private_metadata) VALUES(o.owner_id,'missed_payment',o.id,s.amount_minor,o.currency_code,-20,jsonb_build_object('schedule_id',s.id)); PERFORM public.recalculate_player_credit_score(o.owner_id); END IF;
  IF attempts>=o.max_attempts OR CURRENT_DATE>s.grace_expires_at THEN INSERT INTO public.debt_records(obligation_id,owner_type,owner_id,original_amount_minor,outstanding_balance_minor,currency_code,metadata) VALUES(o.id,o.owner_type,o.owner_id,s.amount_minor,s.amount_minor,o.currency_code,jsonb_build_object('schedule_id',s.id)) RETURNING id INTO debt; UPDATE public.financial_obligations SET status='collections' WHERE id=o.id; PERFORM public.record_financial_obligation_event(o.id,'debt_created',jsonb_build_object('debt_id',debt)); IF o.owner_type='player' THEN INSERT INTO public.player_credit_history(profile_id,event_type,obligation_id,debt_id,amount_minor,currency_code,score_delta) VALUES(o.owner_id,'collection',o.id,debt,s.amount_minor,o.currency_code,-60); PERFORM public.recalculate_player_credit_score(o.owner_id); END IF; END IF;
  RETURN jsonb_build_object('status','failed','shortfallMinor',shortfall,'attempt',attempts);
 END IF;
 IF s.source_schedule_type='mortgage_schedule_line' THEN
  res := public.post_mortgage_schedule_payment(s.source_schedule_id,p_idempotency_key||'-mortgage-accounting');
  tx := (res->>'transactionId')::uuid;
 ELSE
  tx:=public.post_financial_journal('financial_obligation_payment',gen_random_uuid(),o.currency_code,p_idempotency_key,jsonb_build_array(jsonb_build_object('account_id',o.payment_account_id,'direction','debit','amount_minor',s.amount_minor),jsonb_build_object('account_id',o.recipient_account_id,'direction','credit','amount_minor',s.amount_minor)),'financial_obligation_schedule',s.id,jsonb_build_object('trusted_finance_workflow',true,'obligation_id',o.id));
 END IF;
 INSERT INTO public.financial_obligation_attempts(obligation_id,schedule_id,attempt_number,status,balance_at_attempt_minor,transaction_id,idempotency_key) VALUES(o.id,s.id,attempts,'succeeded',payer.available_balance_minor,tx,p_idempotency_key) ON CONFLICT DO NOTHING; UPDATE public.financial_obligation_schedule SET status='paid',transaction_id=tx,paid_at=timezone('utc',now()) WHERE id=s.id;
 SELECT min(due_date) INTO next_due FROM public.financial_obligation_schedule WHERE obligation_id=o.id AND status IN ('scheduled','due','missed','failed'); UPDATE public.financial_obligations SET status=CASE WHEN next_due IS NULL THEN 'completed' ELSE 'active' END, next_due_date=COALESCE(next_due,next_due_date), outstanding_balance_minor=GREATEST(0,outstanding_balance_minor-s.amount_minor), linked_finance_transaction_id=tx, updated_at=timezone('utc',now()), completed_at=CASE WHEN next_due IS NULL THEN timezone('utc',now()) ELSE completed_at END WHERE id=o.id;
 PERFORM public.record_financial_obligation_event(o.id,'payment_succeeded',jsonb_build_object('schedule_id',s.id,'transaction_id',tx)); IF o.owner_type='player' THEN INSERT INTO public.player_credit_history(profile_id,event_type,obligation_id,amount_minor,currency_code,score_delta) VALUES(o.owner_id,'successful_payment',o.id,s.amount_minor,o.currency_code,2); PERFORM public.recalculate_player_credit_score(o.owner_id); END IF;
 RETURN jsonb_build_object('status','posted','transactionId',tx,'nextDueDate',next_due);
END $$;

CREATE OR REPLACE FUNCTION public.process_due_financial_obligations(p_as_of_date date DEFAULT CURRENT_DATE,p_limit int DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r record; res jsonb; attempted int:=0; posted int:=0; failed int:=0; errored int:=0; BEGIN IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF; FOR r IN SELECT s.id FROM public.financial_obligation_schedule s JOIN public.financial_obligations o ON o.id=s.obligation_id WHERE o.status IN ('active','grace_period','retrying') AND s.status IN ('scheduled','due','missed') AND s.due_date<=p_as_of_date ORDER BY s.due_date LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP attempted:=attempted+1; BEGIN res:=public.process_financial_obligation_payment(r.id,'obligation-auto-'||r.id||'-'||p_as_of_date); IF res->>'status'='posted' THEN posted:=posted+1; ELSE failed:=failed+1; END IF; EXCEPTION WHEN OTHERS THEN errored:=errored+1; END; END LOOP; RETURN jsonb_build_object('attempted',attempted,'posted',posted,'failed',failed,'errored',errored); END $$;

CREATE OR REPLACE FUNCTION public.process_due_mortgage_repayments(p_as_of_date date DEFAULT CURRENT_DATE,p_limit int DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF; INSERT INTO public.financial_obligation_events(event_type,event_payload) VALUES('admin_adjusted',jsonb_build_object('legacy_mortgage_scheduler_replaced_by','process_due_financial_obligations','as_of_date',p_as_of_date)); RETURN public.process_due_financial_obligations(p_as_of_date,p_limit); END $$;

GRANT EXECUTE ON FUNCTION public.create_financial_obligation_from_mortgage(uuid), public.process_due_financial_obligations(date,int), public.process_due_mortgage_repayments(date,int), public.recalculate_player_credit_score(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_mortgage_financial_obligation_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.create_financial_obligation_from_mortgage(NEW.mortgage_contract_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_mortgage_financial_obligation_after_schedule ON public.mortgage_schedule_lines;
CREATE TRIGGER sync_mortgage_financial_obligation_after_schedule AFTER INSERT OR UPDATE OF total_due_minor,status,payment_transaction_id ON public.mortgage_schedule_lines FOR EACH ROW EXECUTE FUNCTION public.sync_mortgage_financial_obligation_trigger();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.mortgage_contracts WHERE status IN ('active','arrears') LOOP
    PERFORM public.create_financial_obligation_from_mortgage(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.replace_legacy_mortgage_recurring_obligation_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.create_financial_obligation_from_mortgage(NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS replace_legacy_mortgage_recurring_obligation ON public.mortgage_contracts;
CREATE TRIGGER replace_legacy_mortgage_recurring_obligation AFTER UPDATE OF recurring_obligation_id ON public.mortgage_contracts FOR EACH ROW WHEN (NEW.recurring_obligation_id IS NOT NULL) EXECUTE FUNCTION public.replace_legacy_mortgage_recurring_obligation_trigger();
