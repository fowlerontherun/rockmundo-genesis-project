-- Festival lifecycle recovery and operational resilience (forward-only).
-- This layer coordinates the existing runtime/settlement workers; it does not
-- invent financial results or gameplay outcomes.

CREATE TABLE public.festival_lifecycle_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 runtime_session_id uuid NOT NULL REFERENCES public.festival_runtime_sessions(id),
 settlement_id uuid REFERENCES public.festival_financial_settlements(id),
 operation text NOT NULL CHECK (operation IN ('runtime_completion','settlement_preparation','payment_execution','finalisation','effect_execution','snapshot_rebuild','reconciliation')),
 idempotency_key uuid NOT NULL,
 request_digest text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
 lease_owner uuid, lease_expires_at timestamptz, attempt_count integer NOT NULL DEFAULT 0,
 result jsonb, last_error jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(runtime_session_id,operation,idempotency_key),
 CHECK ((status='processing')=(lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX festival_one_active_settlement_operation
 ON public.festival_lifecycle_operations(runtime_session_id)
 WHERE operation='settlement_preparation' AND status='processing';

CREATE TABLE public.festival_lifecycle_transitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_session_id uuid NOT NULL REFERENCES public.festival_runtime_sessions(id),
 settlement_id uuid REFERENCES public.festival_financial_settlements(id), from_state text NOT NULL, to_state text NOT NULL,
 operation_id uuid REFERENCES public.festival_lifecycle_operations(id), actor_profile_id uuid REFERENCES public.profiles(id),
 reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.festival_repair_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_session_id uuid NOT NULL REFERENCES public.festival_runtime_sessions(id),
 settlement_id uuid REFERENCES public.festival_financial_settlements(id), actor_profile_id uuid REFERENCES public.profiles(id),
 repair_type text NOT NULL, idempotency_key uuid NOT NULL, before_snapshot jsonb NOT NULL, after_snapshot jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(runtime_session_id,repair_type,idempotency_key)
);
CREATE TABLE public.festival_payment_terminal_resolutions (
 settlement_line_id uuid PRIMARY KEY REFERENCES public.festival_settlement_lines(id),
 terminal_state text NOT NULL CHECK(terminal_state IN('paid','waived','written_off','cancelled')),
 evidence_id uuid, resolved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_lifecycle_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_lifecycle_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_repair_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_payment_terminal_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_lifecycle_operations,public.festival_lifecycle_transitions,public.festival_repair_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_payment_terminal_resolutions FROM PUBLIC,anon,authenticated;

ALTER TABLE public.festival_settlement_lines DROP CONSTRAINT IF EXISTS festival_settlement_line_status_v3;
ALTER TABLE public.festival_settlement_lines ADD CONSTRAINT festival_settlement_line_status_recovery
 CHECK(status IN('pending','processing','paid','failed','outstanding','waived','resolved','not_applicable','written_off','cancelled','disputed')) NOT VALID;

CREATE FUNCTION public._festival_payment_terminal_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE existing text;
BEGIN
 IF NEW.status IN('paid','waived','written_off','cancelled') THEN
  SELECT terminal_state INTO existing FROM public.festival_payment_terminal_resolutions WHERE settlement_line_id=NEW.id;
  IF existing IS NOT NULL AND existing<>NEW.status THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_payment_multiple_terminal_states'; END IF;
  INSERT INTO public.festival_payment_terminal_resolutions(settlement_line_id,terminal_state)
  VALUES(NEW.id,NEW.status) ON CONFLICT DO NOTHING;
 ELSIF OLD.status IN('paid','waived','written_off','cancelled') AND NEW.status<>OLD.status THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_payment_terminal_state_immutable';
 END IF; RETURN NEW;
END $$;
INSERT INTO public.festival_payment_terminal_resolutions(settlement_line_id,terminal_state)
 SELECT id,status FROM public.festival_settlement_lines WHERE status IN('paid','waived','written_off','cancelled') ON CONFLICT DO NOTHING;
CREATE TRIGGER festival_payment_terminal_state AFTER INSERT OR UPDATE OF status ON public.festival_settlement_lines FOR EACH ROW EXECUTE FUNCTION public._festival_payment_terminal_guard();

CREATE FUNCTION public._festival_lifecycle_transition_allowed(p_from text,p_to text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT p_from=p_to OR (p_from,p_to) IN (
 ('planning','scheduled'),('scheduled','preparing'),('preparing','running'),('running','runtime_complete'),
 ('runtime_complete','settlement_preparing'),('settlement_preparing','calculated'),('calculated','settled'),
 ('settled','finalising'),('finalising','finalised'),('finalising','finalisation_failed'),('finalisation_failed','finalising')) $$;

CREATE FUNCTION public.transition_festival_lifecycle(p_runtime uuid,p_from text,p_to text,p_operation uuid DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s uuid; current_state text;
BEGIN
 IF NOT public._festival_lifecycle_transition_allowed(p_from,p_to) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_lifecycle_transition_invalid'; END IF;
 SELECT id,status INTO s,current_state FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime FOR UPDATE;
 -- Translate existing physical states to the canonical lifecycle without rewriting them.
 current_state:=CASE WHEN current_state IS NULL THEN (SELECT CASE status WHEN 'runtime_complete' THEN 'runtime_complete' WHEN 'live' THEN 'running' ELSE 'preparing' END FROM public.festival_runtime_sessions WHERE id=p_runtime)
  WHEN current_state='draft' THEN 'settlement_preparing' WHEN current_state IN('calculated','settled','finalising','finalised','finalisation_failed') THEN current_state ELSE p_from END;
 IF current_state IS DISTINCT FROM p_from THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='festival_lifecycle_state_stale',DETAIL=current_state; END IF;
 INSERT INTO public.festival_lifecycle_transitions(runtime_session_id,settlement_id,from_state,to_state,operation_id,actor_profile_id,reason)
 VALUES(p_runtime,s,p_from,p_to,p_operation,public._caller_profile_id(),p_reason);
 RETURN jsonb_build_object('runtimeSessionId',p_runtime,'from',p_from,'to',p_to);
END $$;

CREATE FUNCTION public.festival_runtime_integrity(p_runtime uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object(
 'pass', r.status='runtime_complete' AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_performances p WHERE p.runtime_session_id=r.id AND p.status NOT IN('completed','cancelled','abandoned','failed'))
 AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins x WHERE x.runtime_session_id=r.id AND x.status IN('expected','checked_in','late'))
 AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_supplier_checkins x WHERE x.runtime_session_id=r.id AND x.status IN('expected','arrived','late'))
 AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_sponsor_activations x WHERE x.runtime_session_id=r.id AND x.status IN('planned','ready','active')),
 'runtimeComplete',r.status='runtime_complete',
 'openPerformances',(SELECT count(*) FROM public.festival_runtime_performances p WHERE p.runtime_session_id=r.id AND p.status NOT IN('completed','cancelled','abandoned','failed')),
 'activeStaffShifts',(SELECT count(*) FROM public.festival_runtime_staff_checkins x WHERE x.runtime_session_id=r.id AND x.status IN('expected','checked_in','late')),
 'incompleteSuppliers',(SELECT count(*) FROM public.festival_runtime_supplier_checkins x WHERE x.runtime_session_id=r.id AND x.status IN('expected','arrived','late')),
 'unfinishedSponsors',(SELECT count(*) FROM public.festival_runtime_sponsor_activations x WHERE x.runtime_session_id=r.id AND x.status IN('planned','ready','active')))
 FROM public.festival_runtime_sessions r WHERE r.id=p_runtime $$;

CREATE FUNCTION public._festival_snapshot_integrity(p_settlement uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; runtime_digest text; contract_digest text; review_digest text; final_digest text; issues jsonb:='[]';
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement;
 SELECT content_digest INTO runtime_digest FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=s.runtime_session_id;
 SELECT content_digest INTO contract_digest FROM public.festival_settlement_contract_snapshots WHERE runtime_session_id=s.runtime_session_id;
 SELECT content_digest INTO review_digest FROM public.festival_settlement_snapshots WHERE id=s.review_snapshot_id;
 SELECT content_digest INTO final_digest FROM public.festival_settlement_snapshots WHERE id=s.final_snapshot_id;
 IF runtime_digest IS DISTINCT FROM s.runtime_outcome_digest THEN issues:=issues||'[{"code":"runtime_digest_mismatch"}]'; END IF;
 IF contract_digest IS NULL THEN issues:=issues||'[{"code":"contract_digest_missing"}]'; END IF;
 IF s.calculation_digest IS NULL THEN issues:=issues||'[{"code":"calculation_digest_missing"}]'; END IF;
 IF s.review_snapshot_id IS NOT NULL AND review_digest IS DISTINCT FROM (SELECT public.festival_json_content_digest(snapshot,ARRAY[]::text[]) FROM public.festival_settlement_snapshots WHERE id=s.review_snapshot_id) THEN issues:=issues||'[{"code":"review_digest_mismatch"}]'; END IF;
 IF s.final_snapshot_id IS NOT NULL AND final_digest IS DISTINCT FROM (SELECT public.festival_json_content_digest(snapshot,ARRAY[]::text[]) FROM public.festival_settlement_snapshots WHERE id=s.final_snapshot_id) THEN issues:=issues||'[{"code":"final_digest_mismatch"}]'; END IF;
 RETURN jsonb_build_object('pass',jsonb_array_length(issues)=0,'runtimeDigest',runtime_digest,'contractDigest',contract_digest,'calculationDigest',s.calculation_digest,'reviewDigest',review_digest,'finalDigest',final_digest,'issues',issues);
END $$;

CREATE FUNCTION public._festival_progression_integrity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE integrity jsonb;
BEGIN
 IF NEW.status IN('calculated','settled','finalising','finalised') AND OLD.status IS DISTINCT FROM NEW.status THEN
  integrity:=public._festival_snapshot_integrity(NEW.id);
  IF NOT coalesce((integrity->>'pass')::boolean,false) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_snapshot_verification_failed',DETAIL=(integrity->'issues')::text;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_snapshot_progression_gate BEFORE UPDATE OF status ON public.festival_financial_settlements FOR EACH ROW EXECUTE FUNCTION public._festival_progression_integrity_guard();

CREATE FUNCTION public.festival_consistency_audit(p_runtime uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s uuid; rt jsonb; snap jsonb; issues jsonb:='[]';
BEGIN
 SELECT id INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime; rt:=public.festival_runtime_integrity(p_runtime);
 IF NOT coalesce((rt->>'pass')::boolean,false) THEN issues:=issues||jsonb_build_array(jsonb_build_object('area','runtime','detail',rt)); END IF;
 IF s IS NOT NULL THEN
  snap:=public._festival_snapshot_integrity(s); IF NOT (snap->>'pass')::boolean THEN issues:=issues||jsonb_build_array(jsonb_build_object('area','snapshot','detail',snap)); END IF;
  IF EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=s AND status IN('processing','failed','outstanding')) THEN issues:=issues||'[{"area":"payment","code":"non_terminal_liability"}]'; END IF;
  IF EXISTS(SELECT 1 FROM public.festival_settlement_receipts r LEFT JOIN public.festival_settlement_lines l ON l.id=r.settlement_line_id WHERE r.settlement_id=s AND l.id IS NULL) THEN issues:=issues||'[{"area":"financial","code":"orphan_receipt"}]'; END IF;
  IF EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=s AND status<>'completed') THEN issues:=issues||'[{"area":"effect","code":"incomplete_effect"}]'; END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN jsonb_array_length(issues)=0 THEN 'PASS' ELSE 'FAIL' END,'runtimeIntegrity',rt,'financialIntegrity',jsonb_array_length(issues)=0,'paymentIntegrity',NOT EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=s AND status IN('processing','failed')),'snapshotIntegrity',snap,'effectIntegrity',NOT EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=s AND status<>'completed'),'worldUpdateIntegrity',NOT EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=s AND effect_type IN('world_pulse','rockmundo_fm','twaater') AND status<>'completed'),'failures',issues);
END $$;

CREATE FUNCTION public.admin_festival_diagnostics(p_runtime uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; audit jsonb;
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime; audit:=public.festival_consistency_audit(p_runtime);
 RETURN jsonb_build_object('lifecycleState',coalesce(s.status,(SELECT status FROM public.festival_runtime_sessions WHERE id=p_runtime)),'settlementHealth',audit->'financialIntegrity',
 'receiptHealth',NOT EXISTS(SELECT 1 FROM public.festival_settlement_receipts WHERE settlement_id=s.id AND status<>'completed'),
 'outstandingLiabilities',(SELECT coalesce(sum(net_amount_minor),0) FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_category='liability' AND status NOT IN('paid','waived','written_off')),
 'failedEffects',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'type',effect_type,'error',last_error)),'[]') FROM public.festival_settlement_effect_receipts WHERE settlement_id=s.id AND status='failed'),
 'retryableItems',(SELECT count(*) FROM public.festival_lifecycle_operations WHERE runtime_session_id=p_runtime AND status IN('pending','failed') OR (runtime_session_id=p_runtime AND status='processing' AND lease_expires_at<now())),
 'blockingIssues',audit->'failures');
END $$;

CREATE FUNCTION public.admin_repair_festival(p_runtime uuid,p_repair text,p_idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; before jsonb; result jsonb; r record;
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime FOR UPDATE;
 SELECT result INTO result FROM public.festival_repair_audit WHERE runtime_session_id=p_runtime AND repair_type=p_repair AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN result; END IF;
 before:=public.festival_consistency_audit(p_runtime);
 CASE p_repair
  WHEN 'reconciliation' THEN result:=public._festival_settlement_reconciliation_v7(s.id,true);
  WHEN 'resume_payments' THEN UPDATE public.festival_settlement_lines SET status='pending' WHERE settlement_id=s.id AND status='failed'; result:=jsonb_build_object('resumed',true);
  WHEN 'resume_effects' THEN UPDATE public.festival_settlement_effect_receipts SET status='pending',last_error=NULL WHERE settlement_id=s.id AND status='failed'; result:=jsonb_build_object('resumed',true);
  WHEN 'resume_finalisation' THEN UPDATE public.festival_settlement_finalisation_requests SET status='failed',lease_owner=NULL,lease_expires_at=NULL WHERE settlement_id=s.id AND status='processing' AND lease_expires_at<now(); result:=jsonb_build_object('resumed',true,'version',s.version);
  WHEN 'rebuild_snapshots' THEN UPDATE public.festival_settlement_snapshots SET content_digest=public.festival_json_content_digest(snapshot,ARRAY[]::text[]) WHERE settlement_id=s.id; result:=jsonb_build_object('rebuilt',true);
  WHEN 'recalculate_digests' THEN UPDATE public.festival_financial_settlements SET calculation_digest=public._festival_calculation_digest(id) WHERE id=s.id; result:=jsonb_build_object('recalculated',true);
  WHEN 'repair_orphans' THEN
   UPDATE public.festival_settlement_receipts r SET status='conflicted'
    WHERE r.settlement_id=s.id AND NOT EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.id=r.settlement_line_id AND l.settlement_id=s.id);
   DELETE FROM public.festival_settlement_effect_destinations d USING public.festival_settlement_effect_receipts e
    WHERE d.receipt_id=e.id AND e.settlement_id=s.id AND (d.evidence_digest IS DISTINCT FROM e.evidence_digest OR d.destination_kind IS DISTINCT FROM e.effect_type);
   result:=jsonb_build_object('repaired',true);
  ELSE RAISE EXCEPTION 'festival_repair_unknown';
 END CASE;
 INSERT INTO public.festival_repair_audit(runtime_session_id,settlement_id,actor_profile_id,repair_type,idempotency_key,before_snapshot,after_snapshot,result)
 VALUES(p_runtime,s.id,public._caller_profile_id(),p_repair,p_idempotency_key,before,public.festival_consistency_audit(p_runtime),result);
 RETURN result;
END $$;

-- Effect order is a data invariant: workers may resume anywhere, but may not
-- complete a dependent effect before every prerequisite is durable.
CREATE FUNCTION public._festival_effect_dependency_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS(
  SELECT 1 FROM (VALUES
   ('award_eligibility',ARRAY['artist_reputation','band_reputation','festival_reputation']),
   ('player_news',ARRAY['festival_history']),('band_news',ARRAY['festival_history']),('company_news',ARRAY['company_history']),
   ('rockmundo_fm',ARRAY['world_pulse']),('twaater',ARRAY['world_pulse'])) d(effect,deps), unnest(d.deps) dep
  WHERE d.effect=NEW.effect_type AND NOT EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts p WHERE p.settlement_id=NEW.settlement_id AND p.effect_type=dep AND p.status='completed'))
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_effect_dependency_incomplete'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER festival_effect_dependency_order BEFORE UPDATE OF status ON public.festival_settlement_effect_receipts FOR EACH ROW EXECUTE FUNCTION public._festival_effect_dependency_guard();

REVOKE ALL ON FUNCTION public._festival_payment_terminal_guard(),public._festival_lifecycle_transition_allowed(text,text),public.transition_festival_lifecycle(uuid,text,text,uuid,text),public.festival_runtime_integrity(uuid),public._festival_snapshot_integrity(uuid),public._festival_progression_integrity_guard(),public.festival_consistency_audit(uuid),public.admin_festival_diagnostics(uuid),public.admin_repair_festival(uuid,text,uuid),public._festival_effect_dependency_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.festival_consistency_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_diagnostics(uuid),public.admin_repair_festival(uuid,text,uuid) TO authenticated;
