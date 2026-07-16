-- Festival career-effect application and settlement pipeline.

DO $$ BEGIN
  CREATE TYPE public.festival_settlement_status AS ENUM ('not_ready','ready','preparing','locked','applying_effects','settling_contracts','settling_revenue','reconciling','completed','failed','partially_failed','cancelled','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.festival_settlement_application_status AS ENUM ('pending','applied','blocked','rejected','adjusted','superseded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.festival_settlement_effect_configs (
  version text PRIMARY KEY,
  fame_cap numeric NOT NULL DEFAULT 5,
  fan_cap integer NOT NULL DEFAULT 10000,
  xp_cap integer NOT NULL DEFAULT 250,
  popularity_cap numeric NOT NULL DEFAULT 5,
  streaming_uplift_cap numeric NOT NULL DEFAULT 20,
  negative_effect_floor numeric NOT NULL DEFAULT -5,
  rounding_policy jsonb NOT NULL DEFAULT '{"money":"cents","fans":"nearest_integer","scores":"2dp"}',
  tax_policy jsonb NOT NULL DEFAULT '{"configured_rate":0,"basis":"edition_net_profit"}',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.festival_settlement_effect_configs(version) VALUES ('festival_settlement_v1') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.festival_edition_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE RESTRICT,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE RESTRICT,
  status public.festival_settlement_status NOT NULL DEFAULT 'locked',
  settlement_version integer NOT NULL,
  currency_code text NOT NULL,
  readiness_snapshot jsonb NOT NULL DEFAULT '{}',
  input_snapshot jsonb NOT NULL DEFAULT '{}',
  input_hash text NOT NULL,
  calculation_config_version text NOT NULL REFERENCES public.festival_settlement_effect_configs(version),
  started_by_profile_id uuid REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  effects_applied_at timestamptz,
  contracts_settled_at timestamptz,
  revenue_settled_at timestamptz,
  reconciled_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_details jsonb NOT NULL DEFAULT '{}',
  idempotency_key text NOT NULL,
  supersedes_settlement_id uuid REFERENCES public.festival_edition_settlements(id),
  invalidated_at timestamptz,
  invalidated_by_profile_id uuid REFERENCES public.profiles(id),
  invalidation_reason text,
  last_completed_phase text,
  failed_phase text,
  retry_count integer NOT NULL DEFAULT 0,
  retryable boolean NOT NULL DEFAULT true,
  next_retry_at timestamptz,
  operator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, settlement_version),
  UNIQUE(edition_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_edition_settlements_one_current_idx ON public.festival_edition_settlements(edition_id) WHERE status <> 'superseded' AND invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.festival_settlement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE RESTRICT, event_type text NOT NULL, from_status public.festival_settlement_status, to_status public.festival_settlement_status, actor_profile_id uuid REFERENCES public.profiles(id), authority text NOT NULL DEFAULT 'system', source_type text, source_id uuid, metadata jsonb NOT NULL DEFAULT '{}', reason text, idempotency_key text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_effect_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, effect_id uuid NOT NULL REFERENCES public.festival_performance_effects(id) ON DELETE RESTRICT, effect_type text NOT NULL, entity_type text NOT NULL, entity_id uuid, proposed_value numeric NOT NULL, approved_value numeric, before_value numeric, after_value numeric, cap_applied numeric, floor_applied numeric, modifier_applied numeric, application_status public.festival_settlement_application_status NOT NULL, failure_code text, failure_reason text, source_outcome_id uuid REFERENCES public.festival_performance_outcomes(id) ON DELETE RESTRICT, idempotency_key text NOT NULL, applied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(settlement_id,effect_id), UNIQUE(effect_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_effect_applications_once_idx ON public.festival_effect_applications(effect_id) WHERE application_status IN ('applied','adjusted');

CREATE TABLE IF NOT EXISTS public.festival_fan_conversion_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, fan_conversion_outcome_id uuid NOT NULL REFERENCES public.festival_fan_conversion_outcomes(id) ON DELETE RESTRICT, band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT, casual_fans_gained integer NOT NULL DEFAULT 0, engaged_fans_gained integer NOT NULL DEFAULT 0, dedicated_fans_gained integer NOT NULL DEFAULT 0, fans_lost integer NOT NULL DEFAULT 0, geographic_distribution jsonb NOT NULL DEFAULT '{}', genre_distribution jsonb NOT NULL DEFAULT '{}', source_cohort jsonb NOT NULL DEFAULT '{}', status public.festival_settlement_application_status NOT NULL, explanation text NOT NULL, idempotency_key text NOT NULL, applied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(settlement_id,fan_conversion_outcome_id), UNIQUE(fan_conversion_outcome_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_fan_conversion_once_idx ON public.festival_fan_conversion_applications(fan_conversion_outcome_id) WHERE status='applied';

CREATE TABLE IF NOT EXISTS public.streaming_uplift_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_type text NOT NULL DEFAULT 'festival_performance_outcome', source_outcome_id uuid NOT NULL REFERENCES public.festival_performance_outcomes(id) ON DELETE RESTRICT, source_effect_id uuid REFERENCES public.festival_performance_effects(id) ON DELETE RESTRICT, song_id uuid, release_id uuid, territories jsonb NOT NULL DEFAULT '[]', start_date date NOT NULL DEFAULT CURRENT_DATE, duration_days integer NOT NULL CHECK (duration_days > 0), initial_uplift numeric NOT NULL, decay_curve text NOT NULL DEFAULT 'linear', model_version text NOT NULL, application_status public.festival_settlement_application_status NOT NULL DEFAULT 'applied', idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_effect_id), UNIQUE(source_outcome_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_contract_settlement_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE RESTRICT, contract_version integer NOT NULL, contract_version_id uuid REFERENCES public.festival_contract_versions(id) ON DELETE RESTRICT, performance_status text NOT NULL, guarantee_due_cents bigint NOT NULL DEFAULT 0, deposit_already_paid_cents bigint NOT NULL DEFAULT 0, remaining_guarantee_cents bigint NOT NULL DEFAULT 0, performance_bonus_cents bigint NOT NULL DEFAULT 0, ticket_bonus_cents bigint NOT NULL DEFAULT 0, merch_share_cents bigint, travel_reimbursement_cents bigint NOT NULL DEFAULT 0, accommodation_reimbursement_cents bigint NOT NULL DEFAULT 0, cancellation_payment_cents bigint NOT NULL DEFAULT 0, no_show_penalty_cents bigint NOT NULL DEFAULT 0, organiser_breach_adjustment_cents bigint NOT NULL DEFAULT 0, band_breach_adjustment_cents bigint NOT NULL DEFAULT 0, currency_code text NOT NULL, explanation jsonb NOT NULL DEFAULT '{}', calculation_version text NOT NULL, status public.festival_settlement_application_status NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(settlement_id,contract_id)
);

CREATE TABLE IF NOT EXISTS public.festival_settlement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE RESTRICT, contract_id uuid REFERENCES public.festival_contracts(id) ON DELETE RESTRICT, entity_type text NOT NULL, entity_id uuid, counterparty_type text, counterparty_id uuid, category text NOT NULL, direction text NOT NULL CHECK (direction IN ('debit','credit')), gross_amount_cents bigint NOT NULL DEFAULT 0, deductions_cents bigint NOT NULL DEFAULT 0, net_amount_cents bigint NOT NULL DEFAULT 0, currency_code text NOT NULL, status public.festival_settlement_application_status NOT NULL DEFAULT 'pending', ledger_entry_id uuid, external_transaction_id uuid, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, failure_details jsonb NOT NULL DEFAULT '{}', UNIQUE(settlement_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_edition_financial_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE RESTRICT, settlement_id uuid NOT NULL UNIQUE REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT, total_ticket_revenue_cents bigint NOT NULL DEFAULT 0, sponsorship_revenue_cents bigint NOT NULL DEFAULT 0, vendor_revenue_cents bigint NOT NULL DEFAULT 0, merch_revenue_cents bigint NOT NULL DEFAULT 0, other_revenue_cents bigint NOT NULL DEFAULT 0, performer_costs_cents bigint NOT NULL DEFAULT 0, staff_costs_cents bigint NOT NULL DEFAULT 0, operations_costs_cents bigint NOT NULL DEFAULT 0, insurance_cents bigint NOT NULL DEFAULT 0, permits_cents bigint NOT NULL DEFAULT 0, marketing_cents bigint NOT NULL DEFAULT 0, refunds_cents bigint NOT NULL DEFAULT 0, tax_cents bigint NOT NULL DEFAULT 0, gross_profit_cents bigint NOT NULL DEFAULT 0, net_profit_cents bigint NOT NULL DEFAULT 0, cash_result_cents bigint NOT NULL DEFAULT 0, unpaid_obligations_cents bigint NOT NULL DEFAULT 0, currency_code text NOT NULL, calculation_snapshot jsonb NOT NULL DEFAULT '{}', finalised_at timestamptz NOT NULL DEFAULT now(), UNIQUE(edition_id,settlement_id)
);

CREATE OR REPLACE FUNCTION public.festival_settlement_input_hash(p_snapshot jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(p_snapshot::text) $$;

CREATE OR REPLACE FUNCTION public.festival_current_settlement_blocks_mutation(p_edition_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.festival_edition_settlements s WHERE s.edition_id=p_edition_id AND s.status IN ('locked','applying_effects','settling_contracts','settling_revenue','reconciling','completed') AND s.invalidated_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.prepare_festival_edition_settlement(p_edition_id uuid, p_expected_readiness_hash text, p_idempotency_key text, p_admin_override_reason text DEFAULT NULL)
RETURNS public.festival_edition_settlements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.festival_editions%ROWTYPE; r jsonb; snap jsonb; h text; existing public.festival_edition_settlements%ROWTYPE; v integer;
BEGIN
  IF nullif(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Settlement idempotency key required'; END IF;
  SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised to settle edition'; END IF;
  r := public.festival_edition_settlement_readiness(p_edition_id);
  IF p_expected_readiness_hash IS NOT NULL AND md5(r::text) <> p_expected_readiness_hash THEN RAISE EXCEPTION 'Readiness hash mismatch'; END IF;
  IF COALESCE((r->>'ready_for_settlement')::boolean,false) IS NOT TRUE AND nullif(trim(coalesce(p_admin_override_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'Edition settlement is not ready: %', r->'blockers'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_performance_outcomes WHERE edition_id=p_edition_id AND status <> 'finalised') THEN RAISE EXCEPTION 'All settlement outcomes must be finalised'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_performance_outcomes WHERE edition_id=p_edition_id AND status='invalidated' AND superseded_by_outcome_id IS NULL) THEN RAISE EXCEPTION 'Invalidated outcome lacks replacement'; END IF;
  snap := jsonb_build_object(
    'contracts', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.festival_contracts c WHERE c.edition_id=p_edition_id),'[]'::jsonb),
    'contract_versions', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public.festival_contract_versions v JOIN public.festival_contracts c ON c.id=v.contract_id WHERE c.edition_id=p_edition_id),'[]'::jsonb),
    'signatures', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.festival_contract_signatures s JOIN public.festival_contracts c ON c.id=s.contract_id WHERE c.edition_id=p_edition_id),'[]'::jsonb),
    'sessions', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.festival_performance_sessions s WHERE s.edition_id=p_edition_id),'[]'::jsonb),
    'outcomes', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.festival_performance_outcomes o WHERE o.edition_id=p_edition_id),'[]'::jsonb),
    'song_outcomes', COALESCE((SELECT jsonb_agg(to_jsonb(so) ORDER BY so.id) FROM public.festival_song_performance_outcomes so JOIN public.festival_performance_outcomes o ON o.id=so.outcome_id WHERE o.edition_id=p_edition_id),'[]'::jsonb),
    'effects', COALESCE((SELECT jsonb_agg(to_jsonb(fx) ORDER BY fx.id) FROM public.festival_performance_effects fx JOIN public.festival_performance_outcomes o ON o.id=fx.outcome_id WHERE o.edition_id=p_edition_id),'[]'::jsonb),
    'fan_conversions', COALESCE((SELECT jsonb_agg(to_jsonb(fc) ORDER BY fc.id) FROM public.festival_fan_conversion_outcomes fc JOIN public.festival_performance_outcomes o ON o.id=fc.outcome_id WHERE o.edition_id=p_edition_id),'[]'::jsonb),
    'ledger_entries', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM public.festival_expense_ledger l WHERE l.edition_id=p_edition_id),'[]'::jsonb),
    'tax_configuration', (SELECT to_jsonb(c) FROM public.festival_settlement_effect_configs c WHERE c.version='festival_settlement_v1')
  );
  h := public.festival_settlement_input_hash(snap);
  SELECT * INTO existing FROM public.festival_edition_settlements WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF existing.input_hash<>h THEN RAISE EXCEPTION 'Idempotency key reused with changed settlement inputs'; END IF; RETURN existing; END IF;
  SELECT * INTO existing FROM public.festival_edition_settlements WHERE edition_id=p_edition_id AND status<>'superseded' AND invalidated_at IS NULL;
  IF FOUND THEN RETURN existing; END IF;
  SELECT coalesce(max(settlement_version),0)+1 INTO v FROM public.festival_edition_settlements WHERE edition_id=p_edition_id;
  INSERT INTO public.festival_edition_settlements(edition_id,festival_id,status,settlement_version,currency_code,readiness_snapshot,input_snapshot,input_hash,calculation_config_version,started_by_profile_id,locked_at,idempotency_key)
  VALUES (p_edition_id,e.festival_id,'locked',v,e.currency_code,r,snap,h,'festival_settlement_v1',public.current_profile_id_safe(),now(),p_idempotency_key) RETURNING * INTO existing;
  INSERT INTO public.festival_settlement_events(settlement_id,edition_id,event_type,to_status,actor_profile_id,authority,metadata,reason,idempotency_key) VALUES(existing.id,p_edition_id,'settlement_locked','locked',public.current_profile_id_safe(),'organiser',jsonb_build_object('readiness_hash',md5(r::text),'input_hash',h),p_admin_override_reason,p_idempotency_key);
  RETURN existing;
END $$;

CREATE OR REPLACE FUNCTION public.apply_festival_settlement_batch(p_settlement_id uuid, p_idempotency_key text DEFAULT gen_random_uuid()::text)
RETURNS public.festival_edition_settlements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; cfg public.festival_settlement_effect_configs%ROWTYPE; fx record; fc record; c record; terms jsonb; guarantee bigint; deposit bigint; bonus bigint; status text; perf_costs bigint; ops_costs bigint;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF s.status='completed' THEN RETURN s; END IF;
  IF s.status <> 'locked' THEN RAISE EXCEPTION 'Settlement must be locked'; END IF;
  SELECT * INTO cfg FROM public.festival_settlement_effect_configs WHERE version=s.calculation_config_version;
  UPDATE public.festival_edition_settlements SET status='applying_effects', updated_at=now() WHERE id=s.id RETURNING * INTO s;

  FOR fx IN SELECT pe.*, o.status outcome_status, o.edition_id, o.id oid FROM public.festival_performance_effects pe JOIN public.festival_performance_outcomes o ON o.id=pe.outcome_id WHERE o.edition_id=s.edition_id LOOP
    INSERT INTO public.festival_effect_applications(settlement_id,effect_id,effect_type,entity_type,entity_id,proposed_value,approved_value,before_value,after_value,cap_applied,floor_applied,modifier_applied,application_status,failure_code,failure_reason,source_outcome_id,idempotency_key,applied_at)
    VALUES (s.id,fx.id,fx.effect_type,fx.entity_type,fx.entity_id,fx.proposed_value,LEAST(GREATEST(fx.proposed_value,cfg.negative_effect_floor),cfg.fame_cap),NULL,NULL,CASE WHEN fx.proposed_value>cfg.fame_cap THEN cfg.fame_cap END,CASE WHEN fx.proposed_value<cfg.negative_effect_floor THEN cfg.negative_effect_floor END,NULL,CASE WHEN fx.outcome_status='finalised' AND fx.application_status='application_pending' THEN CASE WHEN fx.proposed_value<>LEAST(GREATEST(fx.proposed_value,cfg.negative_effect_floor),cfg.fame_cap) THEN 'adjusted' ELSE 'applied' END ELSE 'blocked' END,CASE WHEN fx.outcome_status<>'finalised' THEN 'outcome_not_finalised' WHEN fx.application_status<>'application_pending' THEN 'effect_not_pending' END,CASE WHEN fx.outcome_status<>'finalised' THEN 'Source outcome is not finalised.' WHEN fx.application_status<>'application_pending' THEN 'Effect is no longer pending.' END,fx.oid,p_idempotency_key || ':effect:' || fx.id,CASE WHEN fx.outcome_status='finalised' AND fx.application_status='application_pending' THEN now() END) ON CONFLICT DO NOTHING;
    IF fx.effect_type='streaming_uplift' THEN
      INSERT INTO public.streaming_uplift_campaigns(source_outcome_id,source_effect_id,duration_days,initial_uplift,decay_curve,model_version,idempotency_key)
      VALUES (fx.oid,fx.id,COALESCE((fx.effect_payload->>'duration_days')::int,14),LEAST(GREATEST(fx.proposed_value,0),cfg.streaming_uplift_cap),COALESCE(fx.effect_payload->>'decay_curve','linear'),fx.model_version,p_idempotency_key || ':stream:' || fx.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR fc IN SELECT f.* FROM public.festival_fan_conversion_outcomes f JOIN public.festival_performance_outcomes o ON o.id=f.outcome_id WHERE o.edition_id=s.edition_id AND o.status='finalised' LOOP
    INSERT INTO public.festival_fan_conversion_applications(settlement_id,fan_conversion_outcome_id,band_id,casual_fans_gained,engaged_fans_gained,dedicated_fans_gained,fans_lost,source_cohort,status,explanation,idempotency_key,applied_at)
    VALUES (s.id,fc.id,fc.band_id,LEAST(fc.new_casual_fans,cfg.fan_cap),LEAST(fc.new_engaged_fans,cfg.fan_cap),LEAST(fc.new_dedicated_fans,cfg.fan_cap),LEAST(fc.lost_fans,cfg.fan_cap),fc.cohort_breakdown,'applied',fc.conversion_explanation,p_idempotency_key || ':fans:' || fc.id,now()) ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.festival_edition_settlements SET effects_applied_at=coalesce(effects_applied_at,now()), status='settling_contracts', last_completed_phase='effects', updated_at=now() WHERE id=s.id RETURNING * INTO s;

  FOR c IN SELECT c.*, v.id version_id, v.terms_snapshot version_terms FROM public.festival_contracts c LEFT JOIN LATERAL (SELECT * FROM public.festival_contract_versions v WHERE v.contract_id=c.id AND v.version=c.contract_version ORDER BY v.created_at DESC LIMIT 1) v ON true WHERE c.edition_id=s.edition_id LOOP
    terms := COALESCE(c.version_terms,c.terms_snapshot,'{}'::jsonb);
    status := COALESCE((SELECT ps.status::text FROM public.festival_performance_sessions ps WHERE ps.contract_id=c.id LIMIT 1), c.status::text);
    guarantee := CASE WHEN status='completed' THEN COALESCE((terms->>'guarantee_fee_cents')::bigint,0) ELSE 0 END;
    deposit := COALESCE((SELECT sum(abs(l.amount_cents)) FROM public.festival_expense_ledger l WHERE l.edition_id=s.edition_id AND l.source_type='festival_contract_deposit' AND l.source_id=c.id AND l.status IN ('paid','settled')),0);
    bonus := CASE WHEN status='completed' THEN COALESCE((terms->>'performance_bonus_cents')::bigint,0) ELSE 0 END;
    INSERT INTO public.festival_contract_settlement_instructions(settlement_id,contract_id,contract_version,contract_version_id,performance_status,guarantee_due_cents,deposit_already_paid_cents,remaining_guarantee_cents,performance_bonus_cents,merch_share_cents,currency_code,explanation,calculation_version,status)
    VALUES (s.id,c.id,c.contract_version,c.version_id,status,guarantee,deposit,GREATEST(0,guarantee-deposit),bonus,NULL,s.currency_code,jsonb_build_object('terms_source','signed_contract_version','merch','blocked_until_canonical_merch_sales_exist'),'festival_settlement_v1',CASE WHEN terms ? 'merch_share' THEN 'blocked' ELSE 'applied' END) ON CONFLICT DO NOTHING;
  END LOOP;
  UPDATE public.festival_edition_settlements SET contracts_settled_at=coalesce(contracts_settled_at,now()), status='settling_revenue', last_completed_phase='contracts', updated_at=now() WHERE id=s.id RETURNING * INTO s;

  SELECT COALESCE(sum(remaining_guarantee_cents+performance_bonus_cents+cancellation_payment_cents-no_show_penalty_cents),0) INTO perf_costs FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id;
  SELECT COALESCE(sum(amount_cents) FILTER (WHERE direction='expense'),0) INTO ops_costs FROM public.festival_expense_ledger WHERE edition_id=s.edition_id;
  INSERT INTO public.festival_edition_financial_results(edition_id,settlement_id,performer_costs_cents,operations_costs_cents,gross_profit_cents,net_profit_cents,cash_result_cents,unpaid_obligations_cents,currency_code,calculation_snapshot)
  VALUES (s.edition_id,s.id,perf_costs,ops_costs,-(perf_costs+ops_costs),-(perf_costs+ops_costs),-(perf_costs+ops_costs),0,s.currency_code,jsonb_build_object('revenue_sources','canonical rows only','tax_rate',0)) ON CONFLICT DO NOTHING;
  UPDATE public.festival_edition_settlements SET revenue_settled_at=coalesce(revenue_settled_at,now()), status='reconciling', last_completed_phase='revenue', updated_at=now() WHERE id=s.id RETURNING * INTO s;
  PERFORM public.reconcile_festival_edition_settlement(s.id);
  UPDATE public.festival_editions SET status='completed', completed_at=coalesce(completed_at,now()), updated_at=now() WHERE id=s.edition_id;
  UPDATE public.festival_edition_settlements SET status='completed', reconciled_at=coalesce(reconciled_at,now()), completed_at=coalesce(completed_at,now()), last_completed_phase='completed', updated_at=now() WHERE id=s.id RETURNING * INTO s;
  INSERT INTO public.festival_settlement_events(settlement_id,edition_id,event_type,from_status,to_status,authority,idempotency_key) VALUES(s.id,s.edition_id,'settlement_completed','reconciling','completed','system',p_idempotency_key || ':completed');
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_festival_edition_settlement(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; discrepancies jsonb := '[]'::jsonb; pending_effects int; app_results int; contracts int; instructions int;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id; IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  SELECT count(*) INTO pending_effects FROM public.festival_performance_effects fx JOIN public.festival_performance_outcomes o ON o.id=fx.outcome_id WHERE o.edition_id=s.edition_id;
  SELECT count(*) INTO app_results FROM public.festival_effect_applications WHERE settlement_id=s.id;
  IF pending_effects<>app_results THEN discrepancies := discrepancies || jsonb_build_array(jsonb_build_object('code','effect_application_count_mismatch','expected',pending_effects,'actual',app_results,'blocking',true)); END IF;
  SELECT count(*) INTO contracts FROM public.festival_contracts WHERE edition_id=s.edition_id;
  SELECT count(*) INTO instructions FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id;
  IF contracts<>instructions THEN discrepancies := discrepancies || jsonb_build_array(jsonb_build_object('code','contract_instruction_count_mismatch','expected',contracts,'actual',instructions,'blocking',true)); END IF;
  RETURN jsonb_build_object('settlement_id',s.id,'edition_id',s.edition_id,'discrepancies',discrepancies,'reconciled',jsonb_array_length(discrepancies)=0);
END $$;

CREATE OR REPLACE FUNCTION public.prevent_festival_settlement_source_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_edition uuid;
BEGIN
  v_edition := COALESCE(NEW.edition_id, OLD.edition_id);
  IF v_edition IS NULL AND TG_TABLE_NAME='festival_performance_effects' THEN SELECT o.edition_id INTO v_edition FROM public.festival_performance_outcomes o WHERE o.id=COALESCE(NEW.outcome_id,OLD.outcome_id); END IF;
  IF v_edition IS NULL AND TG_TABLE_NAME='festival_song_performance_outcomes' THEN SELECT o.edition_id INTO v_edition FROM public.festival_performance_outcomes o WHERE o.id=COALESCE(NEW.outcome_id,OLD.outcome_id); END IF;
  IF v_edition IS NULL AND TG_TABLE_NAME='festival_contract_versions' THEN SELECT c.edition_id INTO v_edition FROM public.festival_contracts c WHERE c.id=COALESCE(NEW.contract_id,OLD.contract_id); END IF;
  IF public.festival_current_settlement_blocks_mutation(v_edition) THEN RAISE EXCEPTION 'Settlement source inputs are locked for edition %', v_edition; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

DROP TRIGGER IF EXISTS tg_festival_settlement_lock_outcomes ON public.festival_performance_outcomes;
CREATE TRIGGER tg_festival_settlement_lock_outcomes BEFORE UPDATE OR DELETE ON public.festival_performance_outcomes FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_source_mutation();
DROP TRIGGER IF EXISTS tg_festival_settlement_lock_effects ON public.festival_performance_effects;
CREATE TRIGGER tg_festival_settlement_lock_effects BEFORE UPDATE OR DELETE ON public.festival_performance_effects FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_source_mutation();
DROP TRIGGER IF EXISTS tg_festival_settlement_lock_song_outcomes ON public.festival_song_performance_outcomes;
CREATE TRIGGER tg_festival_settlement_lock_song_outcomes BEFORE UPDATE OR DELETE ON public.festival_song_performance_outcomes FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_source_mutation();
DROP TRIGGER IF EXISTS tg_festival_settlement_lock_contract_versions ON public.festival_contract_versions;
CREATE TRIGGER tg_festival_settlement_lock_contract_versions BEFORE UPDATE OR DELETE ON public.festival_contract_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_source_mutation();

CREATE OR REPLACE FUNCTION public.prevent_completed_festival_settlement_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.status='completed' AND (NEW.status,NEW.input_snapshot,NEW.input_hash,NEW.completed_at) IS DISTINCT FROM (OLD.status,OLD.input_snapshot,OLD.input_hash,OLD.completed_at) THEN RAISE EXCEPTION 'Completed festival settlement is immutable; invalidate and supersede it instead'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_completed_festival_settlement_immutable ON public.festival_edition_settlements;
CREATE TRIGGER tg_completed_festival_settlement_immutable BEFORE UPDATE ON public.festival_edition_settlements FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_festival_settlement_update();

ALTER TABLE public.festival_edition_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_settlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_effect_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_fan_conversion_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_uplift_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_contract_settlement_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_financial_results ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.festival_edition_settlements, public.festival_settlement_events, public.festival_effect_applications, public.festival_fan_conversion_applications, public.streaming_uplift_campaigns, public.festival_contract_settlement_instructions, public.festival_settlement_transactions, public.festival_edition_financial_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_settlement(uuid,text,text,text), public.apply_festival_settlement_batch(uuid,text), public.reconcile_festival_edition_settlement(uuid) TO authenticated;
