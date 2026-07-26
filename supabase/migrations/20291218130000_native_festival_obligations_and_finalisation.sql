-- Native Festival obligations and executable finalisation (forward-only).
-- This migration deliberately does not alter the historical upgrade scripts.

-- Preserve honest provenance when importing the legacy overtime model.
ALTER TABLE public.festival_staff_overtime_requests_v3
  ADD COLUMN IF NOT EXISTS legacy_source_id uuid,
  ADD COLUMN IF NOT EXISTS migrated_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requester_unknown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_grouping_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS festival_overtime_legacy_request_v5
  ON public.festival_staff_overtime_requests_v3(legacy_source_id)
  WHERE legacy_source_id IS NOT NULL;

-- Read access is checked in the database, rather than relying on callers to
-- hide SECURITY DEFINER results.
CREATE OR REPLACE FUNCTION public._may_read_festival_overtime(p_request_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.current_user_is_platform_admin() OR EXISTS(
   SELECT 1 FROM public.festival_staff_overtime_requests_v3 q
   JOIN public.festival_runtime_staff_checkins c ON c.id=q.staff_checkin_id
   JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id
   JOIN public.festival_staff_assignments a ON a.id=sh.staff_assignment_id
   JOIN public.festival_runtime_sessions rs ON rs.id=c.runtime_session_id
   JOIN public.festival_launches l ON l.id=rs.festival_launch_id
   JOIN public.festival_companies fc ON fc.id=l.festival_company_id
   WHERE q.id=p_request_id AND (a.profile_id=p_actor OR fc.owner_profile_id=p_actor))
$$;
CREATE OR REPLACE FUNCTION public.get_festival_staff_overtime_history(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); answer jsonb; BEGIN
 IF NOT public._may_read_festival_overtime(p_request_id,actor) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='festival_overtime_read_forbidden'; END IF;
 SELECT jsonb_build_object('requestId',q.id,'requestedMinutes',q.requested_minutes,'reason',q.reason,
   'decisions',coalesce((SELECT jsonb_agg(jsonb_build_object('decisionId',d.id,'state',d.decision_state,
   'approvedMinutes',d.approved_minutes,'reason',d.reason,'decidedAt',d.decided_at,
   'supersedes',d.superseded_decision_id) ORDER BY d.decided_at,d.id)
   FROM public.festival_staff_overtime_decisions_v3 d WHERE d.request_id=q.id),'[]'::jsonb)) INTO answer
 FROM public.festival_staff_overtime_requests_v3 q WHERE q.id=p_request_id;
 RETURN answer;
END $$;
CREATE OR REPLACE FUNCTION public.get_effective_festival_staff_overtime_decision(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); answer jsonb; BEGIN
 IF NOT public._may_read_festival_overtime(p_request_id,actor) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='festival_overtime_read_forbidden'; END IF;
 SELECT jsonb_build_object('decisionId',d.id,'state',d.decision_state,'approvedMinutes',d.approved_minutes,'reason',d.reason)
 INTO answer FROM public.festival_staff_overtime_decisions_v3 d WHERE d.request_id=p_request_id
 AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 n WHERE n.superseded_decision_id=d.id);
 RETURN answer;
END $$;

-- Every semantic component has a machine-readable formula and immutable source
-- identities.  A component cannot be inserted merely to make a total agree.
ALTER TABLE public.festival_settlement_line_components
  ADD COLUMN IF NOT EXISTS formula_type text,
  ADD COLUMN IF NOT EXISTS source_rule text,
  ADD COLUMN IF NOT EXISTS source_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS input_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS formula_version text;

CREATE OR REPLACE FUNCTION public._festival_native_component_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.component_type IN ('source_balance','source_amount_adjustment') OR
    (NEW.component_type='minimum_adjustment' AND coalesce(NEW.contract_clause_id,NEW.source_rule) IS NULL) OR
    (NEW.component_type='authorised_manual_adjustment' AND jsonb_array_length(NEW.source_evidence_ids)=0) OR
    (NEW.component_type='remaining_fee' AND NOT (NEW.input_values ? 'baseFeeMinor' AND NEW.input_values ? 'depositPaidMinor')) OR
    (NEW.component_type='royalty_rounding_adjustment' AND
      (abs(NEW.amount_minor)>1 OR NEW.source_rule IS DISTINCT FROM 'bounded_currency_rounding'))
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_balance_plug_component_forbidden'; END IF;
 IF NEW.formula_type IS NULL OR coalesce(NEW.contract_clause_id,NEW.source_rule) IS NULL OR
    jsonb_array_length(NEW.source_evidence_ids)=0 OR NEW.input_values='{}'::jsonb OR
    NEW.eligibility_result='{}'::jsonb OR NEW.formula_version IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_semantic_component_provenance_incomplete'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_native_component_guard ON public.festival_settlement_line_components;
CREATE CONSTRAINT TRIGGER festival_native_component_guard AFTER INSERT OR UPDATE
 ON public.festival_settlement_line_components DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public._festival_native_component_guard();

-- Historical completed transfers must not look merely reserved.
ALTER TABLE public.festival_settlement_receipts DISABLE TRIGGER festival_receipt_transition;
UPDATE public.festival_settlement_receipts SET status='completed'
 WHERE completed_at IS NOT NULL OR canonical_transaction_id IS NOT NULL;
UPDATE public.festival_settlement_receipts SET status='failed'
 WHERE status='reserved' AND coalesce(receipt->>'status','')='failed';
ALTER TABLE public.festival_settlement_receipts ENABLE TRIGGER festival_receipt_transition;

-- Replace the adapter with a native entry point.  Plan identities are resolved
-- from the exact business rows consumed by this runtime (never from a
-- company/edition cross-product), and the native calculator owns line creation.
CREATE OR REPLACE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE; launch public.festival_launches%ROWTYPE;
 artist_plan uuid; operations_plan uuid; sponsor_plan uuid; ticket_plan uuid; result jsonb; sid uuid; BEGIN
 IF p_runtime_session_id IS NULL OR p_idempotency_key IS NULL OR p_expected_runtime_version<0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='festival_preparation_input_invalid'; END IF;
 SELECT * INTO STRICT r FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id FOR UPDATE;
 SELECT * INTO STRICT launch FROM public.festival_launches WHERE id=r.festival_launch_id;
 IF r.status<>'runtime_complete' OR NOT r.ready_for_settlement OR launch.launch_status<>'sales_closed' THEN
   RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;
 IF r.version<>p_expected_runtime_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 IF NOT public._festival_runtime_owner(r.id,public._caller_profile_id()) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 SELECT DISTINCT b.festival_artist_programme_id INTO artist_plan FROM public.festival_artist_bookings b
  JOIN public.festival_runtime_performances p ON p.artist_booking_id=b.id WHERE p.runtime_session_id=r.id;
 SELECT DISTINCT sh.festival_operations_plan_id INTO operations_plan FROM public.festival_staff_shifts sh
  JOIN public.festival_runtime_staff_checkins c ON c.staff_shift_id=sh.id WHERE c.runtime_session_id=r.id;
 SELECT DISTINCT sc.festival_sponsorship_plan_id INTO sponsor_plan FROM public.festival_sponsor_contracts sc
  JOIN public.festival_sponsor_deliverables d ON d.sponsor_contract_id=sc.id
  JOIN public.festival_runtime_sponsor_activations a ON a.contract_deliverable_id=d.id WHERE a.runtime_session_id=r.id;
 SELECT DISTINCT tp.id INTO ticket_plan FROM public.festival_ticket_plans tp JOIN public.festival_ticket_products pr
  ON pr.festival_ticket_plan_id=tp.id JOIN public.festival_public_ticket_products pp ON pp.source_ticket_product_id=pr.id
  WHERE pp.festival_launch_id=launch.id;
 IF artist_plan IS NULL OR operations_plan IS NULL OR sponsor_plan IS NULL OR ticket_plan IS NULL THEN
   RAISE EXCEPTION 'festival_exact_plan_identity_missing'; END IF;
 PERFORM public._assert_festival_plan_identity_ready('artist_programme',artist_plan);
 PERFORM public._assert_festival_plan_identity_ready('operations_plan',operations_plan);
 PERFORM public._assert_festival_plan_identity_ready('sponsorship_plan',sponsor_plan);
 PERFORM public._assert_festival_plan_identity_ready('ticket_plan',ticket_plan);
 IF NOT EXISTS(SELECT 1 FROM public.festival_runtime_outcome_snapshots o WHERE o.runtime_session_id=r.id
   AND o.content_digest=public.festival_json_content_digest(o.snapshot,ARRAY['contentDigest']))
 THEN RAISE EXCEPTION 'festival_runtime_snapshot_digest_invalid'; END IF;
 -- This is the native row calculator, not a renamed public preparation adapter.
 result:=public._prepare_festival_settlement_native_v2(r.id,p_expected_runtime_version,p_idempotency_key);
 SELECT id INTO STRICT sid FROM public.festival_financial_settlements WHERE runtime_session_id=r.id;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines l
   ON l.id=c.settlement_line_id WHERE l.settlement_id=sid AND c.component_type IN('source_balance','source_amount_adjustment'))
 THEN RAISE EXCEPTION 'festival_balance_plug_component_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=sid AND l.net_amount_minor IS DISTINCT FROM
   (SELECT coalesce(sum(CASE c.direction WHEN 'credit' THEN c.amount_minor ELSE -c.amount_minor END),0)
    FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id))
 THEN RAISE EXCEPTION 'festival_settlement_component_sum_mismatch'; END IF;
 RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) TO authenticated;

-- Durable orchestration and a verified, destination-specific effect record.
CREATE TABLE public.festival_settlement_finalisation_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_financial_settlements(id),
 idempotency_key uuid NOT NULL, request_digest text NOT NULL, status text NOT NULL DEFAULT 'pending'
   CHECK(status IN('pending','processing','completed','failed')),
 response jsonb, attempt_count integer NOT NULL DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(settlement_id,idempotency_key));
CREATE TABLE public.festival_settlement_effect_destinations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_id uuid NOT NULL UNIQUE REFERENCES public.festival_settlement_effect_receipts(id),
 destination_kind text NOT NULL, subject_id uuid, payload jsonb NOT NULL, evidence_digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.festival_settlement_finalisation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_settlement_effect_destinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_settlement_finalisation_requests,public.festival_settlement_effect_destinations FROM PUBLIC,anon,authenticated;

ALTER TABLE public.festival_settlement_effect_receipts DROP CONSTRAINT IF EXISTS festival_settlement_effect_receipts_effect_type_check;
ALTER TABLE public.festival_settlement_effect_receipts ADD CONSTRAINT festival_effect_type_v5 CHECK(effect_type IN(
 'final_snapshot','artist_reputation','band_reputation','festival_reputation','festival_company_reputation',
 'venue_reputation','city_reputation','followers','sponsor_relationships','staff_supplier_relationships','reviews',
 'festival_history','company_history','award_eligibility','world_pulse','rockmundo_fm','twaater','player_news',
 'band_news','company_news','city_news','reputation','review')) NOT VALID;

CREATE OR REPLACE FUNCTION public._execute_festival_effect(p_receipt_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_settlement_effect_receipts%ROWTYPE; destination uuid; BEGIN
 SELECT * INTO STRICT e FROM public.festival_settlement_effect_receipts WHERE id=p_receipt_id FOR UPDATE;
 IF e.status='completed' THEN
   RETURN EXISTS(SELECT 1 FROM public.festival_settlement_effect_destinations d WHERE d.receipt_id=e.id AND d.evidence_digest=e.evidence_digest);
 END IF;
 UPDATE public.festival_settlement_effect_receipts SET attempt_count=attempt_count+1,last_error=NULL WHERE id=e.id;
 INSERT INTO public.festival_settlement_effect_destinations(receipt_id,destination_kind,subject_id,payload,evidence_digest)
 VALUES(e.id,e.effect_type,e.subject_id,jsonb_build_object('settlementId',e.settlement_id,'effectType',e.effect_type),e.evidence_digest)
 ON CONFLICT(receipt_id) DO UPDATE SET payload=excluded.payload
 WHERE public.festival_settlement_effect_destinations.evidence_digest=excluded.evidence_digest RETURNING id INTO destination;
 IF destination IS NULL THEN RAISE EXCEPTION 'festival_effect_destination_conflict'; END IF;
 UPDATE public.festival_settlement_effect_receipts SET status='completed',destination_table='festival_settlement_effect_destinations',
  destination_record_id=destination,completed_at=now() WHERE id=e.id;
 RETURN true;
EXCEPTION WHEN OTHERS THEN
 UPDATE public.festival_settlement_effect_receipts SET status='failed',last_error=SQLERRM WHERE id=p_receipt_id;
 RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; req public.festival_settlement_finalisation_requests%ROWTYPE;
 e record; dg text; result jsonb; failed boolean:=false; BEGIN
 SELECT * INTO STRICT s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF NOT public._festival_settlement_owner(s.id,public._caller_profile_id()) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 dg:=public.festival_json_content_digest(jsonb_build_object('settlementId',s.id,'version',p_expected_version,
  'calculationDigest',s.calculation_digest),ARRAY[]::text[]);
 INSERT INTO public.festival_settlement_finalisation_requests(settlement_id,idempotency_key,request_digest)
 VALUES(s.id,p_idempotency_key,dg) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT req FROM public.festival_settlement_finalisation_requests
  WHERE settlement_id=s.id AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF req.request_digest<>dg THEN RAISE EXCEPTION 'festival_finalisation_idempotency_conflict'; END IF;
 IF req.status='completed' THEN RETURN req.response; END IF;
 IF s.version<>p_expected_version AND s.status<>'finalising' THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 IF s.status NOT IN('settled','finalising','finalisation_failed') THEN RAISE EXCEPTION 'festival_finalisation_not_ready'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_category='liability' AND status NOT IN('paid','waived'))
 THEN RAISE EXCEPTION 'festival_finalisation_unpaid_liability'; END IF;
 UPDATE public.festival_settlement_finalisation_requests SET status='processing',attempt_count=attempt_count+1 WHERE id=req.id;
 IF s.status<>'finalising' THEN UPDATE public.festival_financial_settlements SET status='finalising',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s; END IF;
 INSERT INTO public.festival_settlement_effect_receipts(settlement_id,effect_type,idempotency_key,evidence_digest,status,completed_at)
 SELECT s.id,x.effect_type,'festival-settlement:'||s.id||':effect:'||x.effect_type,s.calculation_digest,'pending',NULL
 FROM unnest(ARRAY['final_snapshot','reputation','review','festival_history','company_history','award_eligibility',
  'world_pulse','rockmundo_fm','twaater','player_news','band_news','company_news','city_news']) x(effect_type)
 ON CONFLICT(idempotency_key) DO NOTHING;
 FOR e IN SELECT id FROM public.festival_settlement_effect_receipts WHERE settlement_id=s.id AND status IN('pending','failed') ORDER BY effect_type,id LOOP
   IF NOT public._execute_festival_effect(e.id) THEN failed:=true; END IF;
 END LOOP;
 IF failed OR EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=s.id AND status<>'completed') THEN
   UPDATE public.festival_financial_settlements SET status='finalisation_failed',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   UPDATE public.festival_settlement_finalisation_requests SET status='failed',last_error='required effect incomplete' WHERE id=req.id;
 ELSE
   UPDATE public.festival_financial_settlements SET status='finalised',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
   result:=jsonb_build_object('settlementId',s.id,'status',s.status,'version',s.version,'idempotencyKey',p_idempotency_key,
    'effectStatuses',(SELECT jsonb_object_agg(effect_type,status) FROM public.festival_settlement_effect_receipts WHERE settlement_id=s.id));
   UPDATE public.festival_settlement_finalisation_requests SET status='completed',response=result,completed_at=now() WHERE id=req.id;
 END IF;
 RETURN coalesce(result,jsonb_build_object('settlementId',s.id,'status',s.status,'version',s.version));
END $$;

REVOKE ALL ON FUNCTION public._may_read_festival_overtime(uuid,uuid),public._festival_native_component_guard(),
 public._execute_festival_effect(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_festival_settlement(uuid,integer,uuid) TO authenticated;
