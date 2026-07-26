-- Complete the native-v2 settlement boundary.  In particular, a legal company is
-- not a festival identity: one company may operate several festival companies.
ALTER TABLE public.festival_companies DROP CONSTRAINT IF EXISTS festival_companies_company_id_key;
CREATE INDEX IF NOT EXISTS festival_companies_company_id_idx ON public.festival_companies(company_id);

ALTER TABLE public.festival_launches
  ADD COLUMN festival_id uuid REFERENCES public.festivals(id),
  ADD COLUMN festival_edition_id uuid REFERENCES public.festival_editions(id);
CREATE UNIQUE INDEX festival_launch_canonical_edition_idx
  ON public.festival_launches(festival_edition_id) WHERE festival_edition_id IS NOT NULL;

-- A single, private identity resolver is the gate for every settlement source.
-- SELECT INTO STRICT deliberately rejects both missing and ambiguous chains.
CREATE OR REPLACE FUNCTION public._festival_settlement_identity(p_runtime_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE i record; n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id;
 IF n<>1 THEN RAISE EXCEPTION 'festival_identity_runtime_%',CASE WHEN n=0 THEN 'missing' ELSE 'ambiguous' END; END IF;
 SELECT count(*) INTO n FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
 JOIN public.festival_editions e ON e.id=l.festival_edition_id AND e.festival_id=l.festival_id
 JOIN public.festivals f ON f.id=e.festival_id
 JOIN public.festival_companies fc ON fc.id=l.festival_company_id
 JOIN public.companies co ON co.id=fc.company_id
 JOIN public.cities ci ON ci.id=pe.city_id
 WHERE r.id=p_runtime_session_id;
 IF n<>1 THEN RAISE EXCEPTION 'festival_identity_chain_%',CASE WHEN n=0 THEN 'missing' ELSE 'ambiguous' END; END IF;
 SELECT r.id runtime_session_id,l.id launch_id,pe.id public_edition_id,f.id festival_id,
        fc.id festival_company_id,co.id company_id,ci.id city_id,ci.country country_id
 INTO STRICT i FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
 JOIN public.festival_editions e ON e.id=l.festival_edition_id AND e.festival_id=l.festival_id
 JOIN public.festivals f ON f.id=e.festival_id JOIN public.festival_companies fc ON fc.id=l.festival_company_id
 JOIN public.companies co ON co.id=fc.company_id JOIN public.cities ci ON ci.id=pe.city_id
 WHERE r.id=p_runtime_session_id;
 RETURN jsonb_build_object('runtimeSessionId',i.runtime_session_id,'launchId',i.launch_id,
   'publicEditionId',i.public_edition_id,'festivalId',i.festival_id,
   'festivalCompanyId',i.festival_company_id,'companyId',i.company_id,
   'cityId',i.city_id,'countryId',i.country_id);
END $$;

CREATE OR REPLACE FUNCTION public._assert_festival_settlement_source_chain(
 p_runtime_session_id uuid,p_source_type text,p_source_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE i jsonb:=public._festival_settlement_identity(p_runtime_session_id); ok boolean:=false;
BEGIN
 CASE p_source_type
 WHEN 'festival_artist_booking' THEN SELECT EXISTS(
   SELECT 1 FROM public.festival_runtime_performances rp
   JOIN public.festival_artist_bookings b ON b.id=rp.artist_booking_id
   JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
   JOIN public.festival_launches l ON l.festival_company_id=ap.festival_company_id
   JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
   WHERE rp.runtime_session_id=(i->>'runtimeSessionId')::uuid AND b.id=p_source_id
     AND l.id=(i->>'launchId')::uuid AND pe.id=(i->>'publicEditionId')::uuid) INTO ok;
 WHEN 'festival_runtime_staff_checkin' THEN SELECT EXISTS(
   SELECT 1 FROM public.festival_runtime_staff_checkins c JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id
   JOIN public.festival_staff_assignments a ON a.id=sh.staff_assignment_id
   JOIN public.festival_operations_plans op ON op.id=a.festival_operations_plan_id AND op.id=sh.festival_operations_plan_id
   JOIN public.festival_launches l ON l.festival_company_id=op.festival_company_id
   JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
   WHERE c.id=p_source_id AND c.runtime_session_id=(i->>'runtimeSessionId')::uuid
     AND l.id=(i->>'launchId')::uuid AND pe.id=(i->>'publicEditionId')::uuid) INTO ok;
 WHEN 'festival_supplier_contract' THEN SELECT EXISTS(
   SELECT 1 FROM public.festival_runtime_supplier_checkins ck JOIN public.festival_supplier_contracts c ON c.id=ck.supplier_contract_id
   JOIN public.festival_operations_plans op ON op.id=c.festival_operations_plan_id
   JOIN public.festival_launches l ON l.festival_company_id=op.festival_company_id
   WHERE ck.runtime_session_id=(i->>'runtimeSessionId')::uuid AND c.id=p_source_id AND l.id=(i->>'launchId')::uuid) INTO ok;
 WHEN 'festival_financial_receivable' THEN SELECT EXISTS(
   SELECT 1 FROM public.festival_financial_receivables fr JOIN public.festival_sponsor_contracts c ON c.id=fr.sponsor_contract_id
   JOIN public.festival_sponsorship_plans sp ON sp.id=c.festival_sponsorship_plan_id
   JOIN public.festival_launches l ON l.festival_company_id=sp.festival_company_id
   WHERE fr.id=p_source_id AND l.id=(i->>'launchId')::uuid) INTO ok;
 WHEN 'festival_runtime_vendor_sales' THEN SELECT EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales
   WHERE id=p_source_id AND runtime_session_id=(i->>'runtimeSessionId')::uuid) INTO ok;
 WHEN 'festival_ticket_sale' THEN SELECT EXISTS(SELECT 1 FROM public.festival_ticket_sales
   WHERE id=p_source_id AND festival_launch_id=(i->>'launchId')::uuid) INTO ok;
 WHEN 'festival_ticket_refund_obligation' THEN SELECT EXISTS(SELECT 1 FROM public.festival_ticket_refund_obligations ro
   JOIN public.festival_ticket_sales ts ON ts.id=ro.festival_ticket_sale_id
   WHERE ro.id=p_source_id AND ts.festival_launch_id=(i->>'launchId')::uuid) INTO ok;
 ELSE RAISE EXCEPTION 'festival_settlement_source_type_invalid'; END CASE;
 IF NOT ok THEN RAISE EXCEPTION 'festival_settlement_source_chain_mismatch'; END IF;
END $$;

-- Contract projection is now anchored at the launch, never at the legal company.
CREATE OR REPLACE FUNCTION public._build_festival_contract_package(p_runtime_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE i jsonb:=public._festival_settlement_identity(p_runtime_session_id); fc uuid; launch uuid; package jsonb;
BEGIN
 fc:=(i->>'festivalCompanyId')::uuid; launch:=(i->>'launchId')::uuid;
 package:=i||jsonb_build_object('schemaVersion','festival-settlement-contract-package-v2',
 'artistBookingContracts',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM public.festival_artist_bookings b
   JOIN public.festival_artist_programmes p ON p.id=b.festival_artist_programme_id
   WHERE p.festival_company_id=fc AND EXISTS(SELECT 1 FROM public.festival_runtime_performances rp WHERE rp.runtime_session_id=p_runtime_session_id AND rp.artist_booking_id=b.id)),'[]'),
 'staffContracts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.festival_staff_assignments a
   JOIN public.festival_operations_plans op ON op.id=a.festival_operations_plan_id WHERE op.festival_company_id=fc
   AND EXISTS(SELECT 1 FROM public.festival_staff_shifts sh JOIN public.festival_runtime_staff_checkins ck ON ck.staff_shift_id=sh.id WHERE sh.staff_assignment_id=a.id AND ck.runtime_session_id=p_runtime_session_id)),'[]'),
 'supplierContracts',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.festival_supplier_contracts c
   JOIN public.festival_operations_plans op ON op.id=c.festival_operations_plan_id WHERE op.festival_company_id=fc
   AND EXISTS(SELECT 1 FROM public.festival_runtime_supplier_checkins ck WHERE ck.supplier_contract_id=c.id AND ck.runtime_session_id=p_runtime_session_id)),'[]'),
 'sponsorContracts',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.festival_sponsor_contracts c
   JOIN public.festival_sponsorship_plans sp ON sp.id=c.festival_sponsorship_plan_id WHERE sp.festival_company_id=fc
   AND EXISTS(SELECT 1 FROM public.festival_financial_receivables fr WHERE fr.sponsor_contract_id=c.id)),'[]'),
 'merchandiseContracts',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM public.festival_artist_bookings b
   JOIN public.festival_artist_programmes p ON p.id=b.festival_artist_programme_id WHERE p.festival_company_id=fc
   AND coalesce((b.contract_terms->>'merchRevenueShareBasisPoints')::int,0)>0
   AND EXISTS(SELECT 1 FROM public.festival_runtime_performances rp WHERE rp.artist_booking_id=b.id AND rp.runtime_session_id=p_runtime_session_id)),'[]'),
 'ticketRefundPolicies',coalesce((SELECT jsonb_agg(to_jsonb(tp) ORDER BY tp.id) FROM public.festival_ticket_plans tp
   JOIN public.festival_public_ticket_products pp ON pp.festival_launch_id=launch
   JOIN public.festival_ticket_products p ON p.id=pp.source_ticket_product_id AND p.festival_ticket_plan_id=tp.id),'[]'),
 'bandSplitAgreements',coalesce((SELECT jsonb_agg(to_jsonb(bp) ORDER BY bp.band_id) FROM public.band_finance_policies bp
   WHERE EXISTS(SELECT 1 FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
     JOIN public.festival_runtime_performances rp ON rp.artist_booking_id=b.id WHERE b.band_id=bp.band_id AND ap.festival_company_id=fc AND rp.runtime_session_id=p_runtime_session_id)),'[]'),
 'taxRules',jsonb_build_array(jsonb_build_object('cityId',i->>'cityId','countryId',i->>'countryId',
   'eventDate',(SELECT starts_at::date FROM public.festival_public_editions WHERE id=(i->>'publicEditionId')::uuid))));
 RETURN package||jsonb_build_object('contentDigest',public.festival_json_content_digest(package,ARRAY[]::text[]));
END $$;

-- Requests and decisions are separate append-only facts.
ALTER TABLE public.festival_staff_overtime_approvals DROP CONSTRAINT IF EXISTS festival_staff_overtime_approvals_decision_check;
ALTER TABLE public.festival_staff_overtime_approvals ADD CONSTRAINT festival_staff_overtime_state_check
 CHECK(decision IN('requested','approved','rejected','superseded')) NOT VALID;
CREATE OR REPLACE FUNCTION public.request_festival_overtime(p_staff_checkin_id uuid,p_requested_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE; d public.festival_staff_overtime_approvals%ROWTYPE; actor uuid:=public._caller_profile_id();
BEGIN
 SELECT * INTO d FROM public.festival_staff_overtime_approvals WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN IF d.staff_checkin_id<>p_staff_checkin_id OR d.requested_minutes<>p_requested_minutes THEN RAISE EXCEPTION 'festival_overtime_idempotency_conflict'; END IF; RETURN to_jsonb(d); END IF;
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id;
 IF c.profile_id IS DISTINCT FROM actor OR p_requested_minutes<=0 OR char_length(btrim(p_reason))<10 THEN RAISE EXCEPTION 'festival_overtime_request_invalid'; END IF;
 INSERT INTO public.festival_staff_overtime_approvals(staff_checkin_id,approver_profile_id,requested_minutes,approved_minutes,reason,idempotency_key,decision,effective)
 VALUES(c.id,actor,p_requested_minutes,0,btrim(p_reason),p_idempotency_key,'requested',false) RETURNING * INTO d; RETURN to_jsonb(d);
END $$;

CREATE OR REPLACE FUNCTION public.decide_festival_overtime(p_staff_checkin_id uuid,p_approved_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE; sh public.festival_staff_shifts%ROWTYPE; req public.festival_staff_overtime_approvals%ROWTYPE;
 old public.festival_staff_overtime_approvals%ROWTYPE; d public.festival_staff_overtime_approvals%ROWTYPE; actual int; contracted int; actor uuid:=public._caller_profile_id();
BEGIN
 SELECT * INTO d FROM public.festival_staff_overtime_approvals WHERE idempotency_key=p_idempotency_key; IF FOUND THEN RETURN to_jsonb(d); END IF;
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id FOR UPDATE;
 IF NOT public._festival_runtime_owner(c.runtime_session_id,actor) OR char_length(btrim(p_reason))<10 THEN RAISE EXCEPTION 'festival_overtime_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_financial_settlements WHERE runtime_session_id=c.runtime_session_id AND status<>'draft') THEN RAISE EXCEPTION 'festival_overtime_requires_dispute_adjustment'; END IF;
 SELECT * INTO sh FROM public.festival_staff_shifts WHERE id=c.staff_shift_id;
 SELECT * INTO req FROM public.festival_staff_overtime_approvals WHERE staff_checkin_id=c.id AND decision='requested' ORDER BY decision_at DESC,id DESC LIMIT 1;
 IF req.id IS NULL THEN RAISE EXCEPTION 'festival_overtime_request_missing'; END IF;
 contracted:=greatest(0,extract(epoch FROM (sh.ends_at-sh.starts_at))/60-sh.break_minutes);
 actual:=greatest(0,extract(epoch FROM (c.checked_out_at-c.checked_in_at))/60);
 IF c.checked_in_at IS NULL OR c.checked_out_at IS NULL THEN RAISE EXCEPTION 'festival_overtime_evidence_incomplete'; END IF;
 IF p_approved_minutes<0 OR p_approved_minutes>req.requested_minutes OR req.requested_minutes>greatest(actual-contracted,0) THEN RAISE EXCEPTION 'festival_overtime_minutes_invalid'; END IF;
 SELECT * INTO old FROM public.festival_staff_overtime_approvals WHERE staff_checkin_id=c.id AND effective FOR UPDATE;
 IF old.id IS NOT NULL THEN UPDATE public.festival_staff_overtime_approvals SET effective=false,decision='superseded' WHERE id=old.id; END IF;
 INSERT INTO public.festival_staff_overtime_approvals(staff_checkin_id,approver_profile_id,requested_minutes,approved_minutes,reason,idempotency_key,decision,effective,supersedes_decision_id)
 VALUES(c.id,actor,req.requested_minutes,p_approved_minutes,btrim(p_reason),p_idempotency_key,CASE WHEN p_approved_minutes=0 THEN 'rejected' ELSE 'approved' END,true,old.id)
 RETURNING * INTO d; RETURN to_jsonb(d);
END $$;

-- Manual completion decisions unblock missing checkout without rewriting runtime evidence.
CREATE OR REPLACE FUNCTION public.create_festival_shift_evidence_decision(p_staff_checkin_id uuid,p_effective_worked_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE; d public.festival_staff_shift_evidence_decisions%ROWTYPE; actor uuid:=public._caller_profile_id();
BEGIN
 SELECT * INTO d FROM public.festival_staff_shift_evidence_decisions WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN IF d.staff_checkin_id<>p_staff_checkin_id OR d.effective_worked_minutes<>p_effective_worked_minutes THEN RAISE EXCEPTION 'festival_shift_evidence_idempotency_conflict'; END IF; RETURN to_jsonb(d); END IF;
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id FOR UPDATE;
 IF NOT public._festival_runtime_owner(c.runtime_session_id,actor) OR p_effective_worked_minutes<0 OR char_length(btrim(p_reason))<10 THEN RAISE EXCEPTION 'festival_shift_evidence_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_financial_settlements WHERE runtime_session_id=c.runtime_session_id AND status<>'draft') THEN RAISE EXCEPTION 'festival_shift_evidence_requires_dispute_adjustment'; END IF;
 INSERT INTO public.festival_staff_shift_evidence_decisions(staff_checkin_id,decision_type,effective_worked_minutes,approver_profile_id,reason,idempotency_key)
 VALUES(c.id,'manual_completion',p_effective_worked_minutes,actor,btrim(p_reason),p_idempotency_key) RETURNING * INTO d; RETURN to_jsonb(d);
END $$;
CREATE OR REPLACE FUNCTION public.supersede_festival_shift_evidence_decision(p_decision_id uuid,p_effective_worked_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.festival_staff_shift_evidence_decisions%ROWTYPE; d public.festival_staff_shift_evidence_decisions%ROWTYPE; actor uuid:=public._caller_profile_id(); r uuid;
BEGIN
 SELECT * INTO old FROM public.festival_staff_shift_evidence_decisions WHERE id=p_decision_id FOR UPDATE;
 SELECT runtime_session_id INTO r FROM public.festival_runtime_staff_checkins WHERE id=old.staff_checkin_id;
 IF old.id IS NULL OR NOT public._festival_runtime_owner(r,actor) OR char_length(btrim(p_reason))<10 THEN RAISE EXCEPTION 'festival_shift_evidence_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_financial_settlements WHERE runtime_session_id=r AND status<>'draft') THEN RAISE EXCEPTION 'festival_shift_evidence_requires_dispute_adjustment'; END IF;
 INSERT INTO public.festival_staff_shift_evidence_decisions(staff_checkin_id,decision_type,effective_worked_minutes,approver_profile_id,reason,supersedes_decision_id,idempotency_key)
 VALUES(old.staff_checkin_id,'manual_completion',p_effective_worked_minutes,actor,btrim(p_reason),old.id,p_idempotency_key)
 ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=excluded.idempotency_key RETURNING * INTO d; RETURN to_jsonb(d);
END $$;
CREATE OR REPLACE FUNCTION public.get_festival_shift_evidence_history(p_staff_checkin_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r uuid; actor uuid:=public._caller_profile_id();
BEGIN SELECT runtime_session_id INTO r FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id;
 IF NOT public._festival_runtime_owner(r,actor) THEN RAISE EXCEPTION 'festival_shift_evidence_forbidden'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(d)||jsonb_build_object('effective',NOT EXISTS(SELECT 1 FROM public.festival_staff_shift_evidence_decisions n WHERE n.supersedes_decision_id=d.id)) ORDER BY decision_at,id)
 FROM public.festival_staff_shift_evidence_decisions d WHERE d.staff_checkin_id=p_staff_checkin_id),'[]'); END $$;

-- Componentisation is executable accounting, not descriptive schema. Components
-- are rebuilt from frozen line evidence and sum exactly to each payable line.
CREATE OR REPLACE FUNCTION public._populate_festival_payable_components(p_settlement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l record; worked int; contracted int; approved int; base bigint; overtime bigint; kinds text[]; k text;
BEGIN
 DELETE FROM public.festival_settlement_line_components c USING public.festival_settlement_lines l
 WHERE c.settlement_line_id=l.id AND l.settlement_id=p_settlement_id;
 FOR l IN SELECT sl.*,c.checked_in_at,c.checked_out_at,sh.starts_at,sh.ends_at,sh.break_minutes
   FROM public.festival_settlement_lines sl JOIN public.festival_runtime_staff_checkins c ON sl.source_type='festival_runtime_staff_checkin' AND c.id=sl.source_id
   JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id WHERE sl.settlement_id=p_settlement_id LOOP
   contracted:=greatest(1,extract(epoch FROM(l.ends_at-l.starts_at))/60-l.break_minutes);
   worked:=greatest(0,extract(epoch FROM(l.checked_out_at-l.checked_in_at))/60);
   SELECT coalesce(max(approved_minutes) FILTER(WHERE effective AND decision='approved'),0) INTO approved FROM public.festival_staff_overtime_approvals WHERE staff_checkin_id=l.source_id;
   base:=least(l.net_amount_minor,(l.gross_amount_minor*least(worked,contracted))/contracted);
   overtime:=least(l.net_amount_minor-base,(l.gross_amount_minor*approved)/contracted);
   INSERT INTO public.festival_settlement_line_components(settlement_line_id,component_type,evidence,calculation,amount_minor,currency_code) VALUES
    (l.id,'contracted_regular_pay',jsonb_build_object('contractedMinutes',contracted),'agreed pay × regular minutes / contracted minutes',base,l.currency_code),
    (l.id,'approved_overtime',jsonb_build_object('approvedMinutes',approved),'hourly contract rate × approved overtime minutes',overtime,l.currency_code),
    (l.id,'guaranteed_minimum','{}','accepted guaranteed minimum',0,l.currency_code),
    (l.id,'lateness_deduction','{}','accepted lateness deduction',0,l.currency_code),
    (l.id,'early_departure_deduction','{}','accepted early departure deduction',0,l.currency_code),
    (l.id,'absence','{}','accepted absence clause',0,l.currency_code),
    (l.id,'role_bonus','{}','accepted role bonus',0,l.currency_code),
    (l.id,'emergency_call_out','{}','accepted call-out clause',0,l.currency_code),
    (l.id,'manual_adjustment','{}','immutable adjustment only',l.net_amount_minor-base-overtime,l.currency_code);
 END LOOP;
 FOR l IN SELECT * FROM public.festival_settlement_lines WHERE settlement_id=p_settlement_id AND line_type IN('artist_fee','supplier_invoice','sponsor_receivable') LOOP
   kinds:=CASE l.line_type WHEN 'artist_fee' THEN ARRAY['appearance_guarantee','completion_bonus','performance_threshold','attendance_threshold','sell_out_bonus','headliner_bonus','revenue_share','travel_reimbursement','accommodation_reimbursement','cancellation_payment','no_show_deduction','delay_deduction']
    WHEN 'supplier_invoice' THEN ARRAY['deposit','remaining_fee','completion','early_delivery','quality','emergency_service','delay','partial_delivery','sla_breach','damage','cancellation','force_majeure']
    ELSE ARRAY['fixed_fee','milestone','attendance_target','exposure_target','exclusivity','category_conflict','under_delivery','cancellation','sponsor_refund','bonus'] END;
   FOREACH k IN ARRAY kinds LOOP INSERT INTO public.festival_settlement_line_components(settlement_line_id,component_type,evidence,calculation,amount_minor,currency_code)
    VALUES(l.id,k,l.calculation_metadata,'independent accepted contract clause',CASE WHEN k=kinds[1] THEN l.net_amount_minor ELSE 0 END,l.currency_code); END LOOP;
 END LOOP;
END $$;

-- Canonical lifecycle and immutable prepared evidence.
ALTER TABLE public.festival_financial_settlements DROP CONSTRAINT IF EXISTS festival_financial_settlements_status_check;
UPDATE public.festival_financial_settlements SET status=CASE status WHEN 'settlement_review' THEN 'calculated' WHEN 'settling' THEN 'processing' WHEN 'settlement_failed' THEN 'failed' WHEN 'ready_for_settlement' THEN 'draft' WHEN 'not_ready' THEN 'draft' ELSE status END;
ALTER TABLE public.festival_financial_settlements ADD CONSTRAINT festival_settlement_status_v2 CHECK(status IN('draft','calculated','processing','partially_settled','settled','failed','disputed'));
ALTER TABLE public.festival_financial_settlements ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.festival_settlement_lines DROP CONSTRAINT IF EXISTS festival_settlement_lines_status_check;
ALTER TABLE public.festival_settlement_lines ADD CONSTRAINT festival_settlement_line_status_v2
 CHECK(status IN('pending','processing','paid','failed','outstanding','waived','resolved','not_applicable','disputed'));
CREATE OR REPLACE FUNCTION public._festival_settlement_status_normalise() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.status:=CASE NEW.status WHEN 'settling' THEN 'processing' WHEN 'settlement_failed' THEN 'failed'
 WHEN 'settlement_review' THEN 'calculated' WHEN 'ready_for_settlement' THEN 'draft' WHEN 'not_ready' THEN 'draft' ELSE NEW.status END; RETURN NEW; END $$;
CREATE TRIGGER festival_settlement_status_normalise BEFORE INSERT OR UPDATE OF status ON public.festival_financial_settlements
 FOR EACH ROW EXECUTE FUNCTION public._festival_settlement_status_normalise();
CREATE OR REPLACE FUNCTION public._festival_prepared_evidence_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE st text; sid uuid;
BEGIN
 IF TG_TABLE_NAME='festival_settlement_lines' THEN sid:=coalesce(OLD.settlement_id,NEW.settlement_id);
 ELSIF TG_TABLE_NAME='festival_settlement_line_components' THEN SELECT settlement_id INTO sid FROM public.festival_settlement_lines WHERE id=OLD.settlement_line_id;
 ELSE SELECT l.settlement_id INTO sid FROM public.festival_settlement_lines l WHERE l.id=OLD.settlement_line_id; END IF;
 SELECT status INTO st FROM public.festival_financial_settlements WHERE id=sid;
 IF st IN('calculated','processing','partially_settled','settled','failed','disputed') THEN RAISE EXCEPTION 'festival_settlement_prepared_evidence_immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER festival_line_prepared_immutable BEFORE UPDATE OF payer_type,payer_id,recipient_type,recipient_id,gross_amount_minor,net_amount_minor,currency_code,priority,source_type,source_id,formula_version OR DELETE ON public.festival_settlement_lines FOR EACH ROW EXECUTE FUNCTION public._festival_prepared_evidence_immutable();
CREATE TRIGGER festival_component_prepared_immutable BEFORE UPDATE OR DELETE ON public.festival_settlement_line_components FOR EACH ROW EXECUTE FUNCTION public._festival_prepared_evidence_immutable();
CREATE TRIGGER festival_tax_prepared_immutable BEFORE UPDATE OR DELETE ON public.festival_tax_calculations FOR EACH ROW EXECUTE FUNCTION public._festival_prepared_evidence_immutable();

CREATE TABLE public.festival_settlement_processing_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),settlement_id uuid NOT NULL REFERENCES public.festival_financial_settlements(id),
 action text NOT NULL CHECK(action IN('process','retry')),idempotency_key uuid NOT NULL,request_digest text NOT NULL,
 settlement_version integer NOT NULL,calculation_digest text NOT NULL,response jsonb,completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(settlement_id,action,idempotency_key));
ALTER TABLE public.festival_settlement_processing_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_settlement_processing_requests FROM PUBLIC,anon,authenticated;

-- Completion is defined by every required line. Receivables are reported, not
-- mistaken for liabilities, and retry locks only the lowest unresolved tier.
CREATE OR REPLACE FUNCTION public._festival_settlement_completion(p_settlement_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('allPayablesResolved',NOT EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=p_settlement_id AND l.line_category='liability' AND l.status NOT IN('paid','waived','resolved','not_applicable')),
 'receivablesSummary',jsonb_build_object('collected',coalesce(sum(net_amount_minor) FILTER(WHERE line_category='receivable' AND status='paid'),0),'outstanding',coalesce(sum(net_amount_minor) FILTER(WHERE line_category='receivable' AND status IN('pending','processing','outstanding','failed')),0),'writtenOff',coalesce(sum(net_amount_minor) FILTER(WHERE line_category='receivable' AND status='waived'),0),'disputed',coalesce(sum(net_amount_minor) FILTER(WHERE line_category='receivable' AND status='disputed'),0)))
 FROM public.festival_settlement_lines WHERE settlement_id=p_settlement_id $$;

GRANT EXECUTE ON FUNCTION public.create_festival_shift_evidence_decision(uuid,integer,text,uuid),public.supersede_festival_shift_evidence_decision(uuid,integer,text,uuid),public.get_festival_shift_evidence_history(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._festival_settlement_identity(uuid),public._populate_festival_payable_components(uuid),public._festival_settlement_completion(uuid) FROM PUBLIC,anon,authenticated;
