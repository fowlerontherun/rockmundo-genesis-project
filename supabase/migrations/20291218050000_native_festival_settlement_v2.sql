-- Native festival settlement v2: canonical evidence digests, durable preparation receipts,
-- and calculation provenance.  V1 remains available only through its historical RPC.
CREATE OR REPLACE FUNCTION public.festival_json_content_digest(
  p_document jsonb, p_excluded_keys text[] DEFAULT ARRAY[]::text[]
) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path='' AS $$
  SELECT encode(digest((p_document - p_excluded_keys)::text, 'sha256'), 'hex')
$$;

CREATE TABLE public.festival_settlement_preparation_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_session_id uuid NOT NULL REFERENCES public.festival_runtime_sessions(id),
 idempotency_key uuid NOT NULL UNIQUE, request_digest text NOT NULL, runtime_snapshot_digest text NOT NULL,
 contract_snapshot_digest text, settlement_id uuid REFERENCES public.festival_financial_settlements(id), response jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(runtime_session_id,idempotency_key)
);
CREATE TABLE public.festival_settlement_contract_snapshots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_session_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_sessions(id),
 package jsonb NOT NULL, content_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(content_digest=public.festival_json_content_digest(package,ARRAY[]::text[]))
);
ALTER TABLE public.festival_settlement_preparation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_settlement_contract_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_settlement_preparation_requests,public.festival_settlement_contract_snapshots FROM PUBLIC,anon,authenticated;

-- Decisions are append-only; the latest non-superseded decision (decision_at,id) is effective.
ALTER TABLE public.festival_staff_overtime_approvals DROP CONSTRAINT festival_staff_overtime_approvals_staff_checkin_id_key;
ALTER TABLE public.festival_staff_overtime_approvals
 ADD COLUMN decision text NOT NULL DEFAULT 'approved' CHECK(decision IN('approved','rejected','superseded')),
 ADD COLUMN supersedes_decision_id uuid REFERENCES public.festival_staff_overtime_approvals(id),
 ADD COLUMN effective boolean NOT NULL DEFAULT true,
 ADD COLUMN decision_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX festival_staff_overtime_one_effective_idx ON public.festival_staff_overtime_approvals(staff_checkin_id) WHERE effective;

CREATE OR REPLACE FUNCTION public._festival_runtime_snapshot_digest_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.content_digest IS DISTINCT FROM public.festival_json_content_digest(NEW.snapshot,ARRAY['contentDigest'])
    OR NEW.snapshot->>'contentDigest' IS DISTINCT FROM NEW.content_digest
 THEN RAISE EXCEPTION 'festival_runtime_snapshot_digest_invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_runtime_snapshot_digest_guard BEFORE INSERT OR UPDATE OF snapshot,content_digest
 ON public.festival_runtime_outcome_snapshots FOR EACH ROW EXECUTE FUNCTION public._festival_runtime_snapshot_digest_guard();

CREATE FUNCTION public._prepare_festival_settlement_native_v2(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=public._caller_profile_id();r public.festival_runtime_sessions%ROWTYPE;l public.festival_launches%ROWTYPE;fc public.festival_companies%ROWTYPE;o public.festival_runtime_outcome_snapshots%ROWTYPE;s public.festival_financial_settlements%ROWTYPE;req public.festival_settlement_requests%ROWTYPE;snap jsonb;sid uuid;currency text;scheduled bigint;actual bigint;
BEGIN
 SELECT * INTO r FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id FOR UPDATE;
 IF r.id IS NULL OR NOT r.ready_for_settlement OR r.status<>'runtime_complete' THEN RAISE EXCEPTION 'festival_settlement_not_ready';END IF;
 IF NOT public._festival_runtime_owner(r.id,a) THEN RAISE EXCEPTION 'festival_settlement_forbidden';END IF;
 IF r.version<>p_expected_runtime_version THEN RAISE EXCEPTION 'festival_settlement_stale';END IF;
 SELECT * INTO o FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=r.id; IF o.id IS NULL THEN RAISE EXCEPTION 'festival_settlement_not_ready';END IF;
 IF EXISTS(SELECT 1 FROM public.festival_runtime_performances WHERE runtime_session_id=r.id AND status NOT IN('completed','cancelled','abandoned','failed')) OR EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales WHERE runtime_session_id=r.id AND status<>'closed') OR EXISTS(SELECT 1 FROM public.festival_runtime_incidents WHERE runtime_session_id=r.id AND status NOT IN('resolved','handed_over')) OR EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales v WHERE v.runtime_session_id=r.id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_revenue_postings p WHERE p.vendor_sales_id=v.id)) THEN RAISE EXCEPTION 'festival_settlement_not_ready';END IF;
 SELECT * INTO l FROM public.festival_launches WHERE id=r.festival_launch_id;IF l.launch_status<>'sales_closed' OR l.ticket_sales_closed_at IS NULL THEN RAISE EXCEPTION 'festival_settlement_not_ready';END IF;SELECT * INTO fc FROM public.festival_companies WHERE id=l.festival_company_id;
 SELECT coalesce((SELECT currency FROM public.festival_public_ticket_products WHERE festival_launch_id=l.id LIMIT 1),(SELECT currency_code FROM public.festival_runtime_vendor_sales WHERE runtime_session_id=r.id LIMIT 1),'GBP') INTO currency;
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=r.id;IF s.id IS NOT NULL THEN RETURN public._festival_settlement_json(s);END IF;
 INSERT INTO public.festival_settlement_requests(runtime_session_id,actor_profile_id,action,idempotency_key,payload_hash)VALUES(r.id,a,'prepare',p_idempotency_key,encode(digest(r.id::text||p_expected_runtime_version,'sha256'),'hex'))RETURNING * INTO req;
 INSERT INTO public.festival_financial_settlements(runtime_session_id,festival_launch_id,festival_company_id,currency_code,runtime_version,runtime_outcome_digest)VALUES(r.id,l.id,fc.id,currency,r.version,o.content_digest)RETURNING * INTO s;
 -- Ticket receipts already moved at purchase. Keep retained booking fees distinct and accrue tax.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,tax_amount_minor,fee_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'ticket_revenue','festival_ticket_sale',x.id,'company',fc.company_id,'player',x.buyer_profile_id,x.subtotal_minor,x.tax_minor,x.fee_minor,x.subtotal_minor+x.fee_minor,x.currency,'paid',90,jsonb_build_object('actual',true,'bookingFeeRetainedMinor',x.fee_minor) FROM public.festival_ticket_sales x WHERE x.festival_launch_id=l.id AND x.status IN('completed','partially_refunded');
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,tax_amount_minor,fee_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,CASE v.category WHEN 'festival_merch' THEN 'festival_merch_revenue' WHEN 'artist_merch' THEN 'artist_merch_revenue' ELSE 'vendor_revenue' END,'festival_runtime_vendor_sales',v.id,'company',fc.company_id,'system',NULL,v.gross_revenue_minor,v.tax_liability_minor,0,v.gross_revenue_minor-v.tax_liability_minor,v.currency_code,'paid',90,jsonb_build_object('actual',true,'category',v.category,'costBasisMinor',v.cost_basis_minor,'wasteUnits',v.waste_units,'postingId',p.id) FROM public.festival_runtime_vendor_sales v JOIN public.festival_runtime_revenue_postings p ON p.vendor_sales_id=v.id WHERE v.runtime_session_id=r.id;
 -- Artist contract actuals: cancellation/no-show/partial terms are read only from accepted snapshots.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'artist_fee','festival_artist_booking',b.id,CASE b.artist_type WHEN 'solo' THEN 'player' WHEN 'band' THEN 'band' ELSE 'system' END,coalesce(b.artist_profile_id,b.band_id,b.npc_artist_id),'company',fc.company_id,b.total_commitment_minor,GREATEST(0,round(b.total_commitment_minor*coalesce((SELECT avg(CASE p.status WHEN 'completed' THEN coalesce((p.engine_result_snapshot->>'completionRatio')::numeric,1) WHEN 'cancelled' THEN coalesce((b.contract_terms->>'cancellationPayRatio')::numeric,0) ELSE coalesce((b.contract_terms->>'noShowPayRatio')::numeric,0) END) FROM public.festival_runtime_performances p WHERE p.runtime_session_id=r.id AND p.artist_booking_id=b.id),1))::bigint),b.currency_code,'pending',50,jsonb_build_object('contractTerms',b.contract_terms,'billingPosition',b.billing_position,'acceptedTermsUnchanged',true) FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id WHERE ap.festival_company_id=fc.id AND b.status NOT IN('cancelled','festival_cancelled');
 -- Actual check-in/out controls paid shift proportion; overtime only applies when accepted assignment time is exceeded.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'staff_wage','festival_runtime_staff_checkin',c.id,CASE WHEN a.profile_id IS NOT NULL THEN 'player' WHEN a.company_id IS NOT NULL THEN 'company' ELSE 'system' END,coalesce(a.profile_id,a.company_id,a.npc_staff_id),'company',fc.company_id,a.agreed_pay_minor,CASE WHEN c.checked_in_at IS NULL THEN 0 ELSE LEAST(a.agreed_pay_minor,round(a.agreed_pay_minor*GREATEST(0,extract(epoch from(coalesce(c.checked_out_at,c.expected_end)-GREATEST(c.checked_in_at,c.expected_start)))/NULLIF(extract(epoch from(c.expected_end-c.expected_start)),0)))::bigint) END,a.currency_code,'pending',CASE WHEN a.profile_id IS NOT NULL THEN 30 ELSE 60 END,jsonb_build_object('checkedInAt',c.checked_in_at,'checkedOutAt',c.checked_out_at,'expectedStart',c.expected_start,'expectedEnd',c.expected_end,'latenessMinutes',coalesce(o2.lateness_minutes,0),'overtimeTermsApplied',false) FROM public.festival_runtime_staff_checkins c JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id JOIN public.festival_staff_assignments a ON a.id=sh.staff_assignment_id LEFT JOIN public.festival_runtime_staff_outcomes o2 ON o2.staff_checkin_id=c.id WHERE c.runtime_session_id=r.id AND a.status IN('committed','active');
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'supplier_invoice','festival_supplier_contract',c.id,CASE WHEN c.supplier_company_id IS NOT NULL THEN 'company' ELSE 'system' END,coalesce(c.supplier_company_id,c.npc_supplier_id),'company',fc.company_id,c.total_commitment_minor,round(c.total_commitment_minor*coalesce(o2.contract_compliance,0)/100.0)::bigint,c.currency_code,'pending',CASE WHEN c.supplier_company_id IS NOT NULL THEN 40 ELSE 60 END,jsonb_build_object('acceptedTerms',c.terms_snapshot,'deliveryCompleteness',o2.delivery_completeness,'quality',o2.product_quality,'latenessMinutes',o2.lateness_minutes) FROM public.festival_supplier_contracts c JOIN public.festival_operations_plans op ON op.id=c.festival_operations_plan_id JOIN public.festival_runtime_supplier_checkins ck ON ck.supplier_contract_id=c.id AND ck.runtime_session_id=r.id JOIN public.festival_runtime_supplier_outcomes o2 ON o2.supplier_checkin_id=ck.id WHERE op.festival_company_id=fc.id AND c.status<>'cancelled';
 -- Only cash receivables become payable lines. In-kind value remains summary metadata.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'sponsor_receivable','festival_financial_receivable',fr.id,'company',fc.company_id,CASE WHEN sc.company_id IS NULL THEN 'system' ELSE 'company' END,sc.company_id,fr.amount_minor,CASE WHEN EXISTS(SELECT 1 FROM public.festival_runtime_sponsor_activations a2 WHERE a2.runtime_session_id=r.id AND a2.status='partially_completed') THEN fr.amount_minor/2 WHEN EXISTS(SELECT 1 FROM public.festival_runtime_sponsor_activations a2 WHERE a2.runtime_session_id=r.id AND a2.status IN('failed','cancelled')) THEN 0 ELSE fr.amount_minor END,fr.currency_code,'pending',20,jsonb_build_object('cash',true,'inKindContributionMinor',sc.in_kind_contribution_minor) FROM public.festival_financial_receivables fr JOIN public.festival_sponsor_contracts sc ON sc.id=fr.sponsor_contract_id JOIN public.festival_sponsorship_plans sp ON sp.id=sc.festival_sponsorship_plan_id WHERE sp.festival_company_id=fc.id AND fr.source_type='sponsor_contract_cash' AND fr.status='planned';
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'refund','festival_ticket_refund_obligation',ro.id,'player',ro.buyer_profile_id,'company',fc.company_id,ro.amount_minor,ro.amount_minor,ro.currency,'pending',10,jsonb_build_object('reasonCode',ro.reason_code) FROM public.festival_ticket_refund_obligations ro JOIN public.festival_ticket_sales ts ON ts.id=ro.festival_ticket_sale_id WHERE ts.festival_launch_id=l.id AND ro.status IN('pending','failed');
 -- Tax remains an accrued canonical liability, never fabricated as an immediate payment.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,payer_type,payer_id,gross_amount_minor,net_amount_minor,currency_code,status,priority,calculation_metadata)
 SELECT s.id,'tax_liability',z.source_type,z.source_id,'tax_authority','company',fc.company_id,z.amount,z.amount,z.currency,'outstanding',15,jsonb_build_object('accrued',true,'canonicalTaxCycle',true) FROM (SELECT 'festival_ticket_sale' source_type,id source_id,tax_minor amount,currency FROM public.festival_ticket_sales WHERE festival_launch_id=l.id AND status IN('completed','partially_refunded') UNION ALL SELECT 'festival_runtime_vendor_sales',id,tax_liability_minor,currency_code FROM public.festival_runtime_vendor_sales WHERE runtime_session_id=r.id)z WHERE z.amount>0;
 SELECT coalesce(sum(extract(epoch from(expected_end-expected_start))),0)::bigint,coalesce(sum(extract(epoch from(coalesce(checked_out_at,expected_end)-coalesce(checked_in_at,expected_start))),0)::bigint) INTO scheduled,actual FROM public.festival_runtime_staff_checkins WHERE runtime_session_id=r.id;
 snap:=jsonb_build_object('runtimeOutcomeDigest',o.content_digest,'runtimeVersion',r.version,'runtimeSnapshot',o.snapshot,'lineIds',(SELECT jsonb_agg(id ORDER BY priority,id) FROM public.festival_settlement_lines WHERE settlement_id=s.id),'actualShiftSeconds',actual,'scheduledShiftSeconds',scheduled,'forecastsIncluded',false,'formulaVersion','festival-settlement-v1');
 INSERT INTO public.festival_settlement_snapshots(settlement_id,snapshot_type,runtime_outcome_snapshot_id,snapshot,content_digest,formula_versions)VALUES(s.id,'review',o.id,snap,encode(digest(snap::text,'sha256'),'hex'),jsonb_build_object('settlement','festival-settlement-v1'))RETURNING id INTO sid;UPDATE public.festival_financial_settlements SET review_snapshot_id=sid WHERE id=s.id RETURNING * INTO s;
 INSERT INTO public.festival_settlement_audit(settlement_id,actor_profile_id,event_type,previous_status,new_status,version,dedupe_key)VALUES(s.id,a,'settlement_review_ready','ready_for_settlement','settlement_review',s.version,'prepare:'||p_idempotency_key);
 UPDATE public.festival_settlement_lines SET formula_version='festival-settlement-v2' WHERE settlement_id=s.id;
 UPDATE public.festival_financial_settlements SET formula_version='festival-settlement-v2',settlement_formula_version='festival-settlement-v2',runtime_schema_version='festival-runtime-outcome-v2' WHERE id=s.id;
 UPDATE public.festival_settlement_requests SET settlement_id=s.id,status='completed',result=public._festival_settlement_json(s),completed_at=now() WHERE id=req.id;RETURN public._festival_settlement_json(s);
END$$;


CREATE OR REPLACE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_runtime_outcome_snapshots%ROWTYPE; pr public.festival_settlement_preparation_requests%ROWTYPE;
 s public.festival_financial_settlements%ROWTYPE; pkg jsonb; rd text; cd text; qd text; result jsonb;
BEGIN
 SELECT * INTO o FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=p_runtime_session_id FOR SHARE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;
 PERFORM public.assert_festival_runtime_outcome_v2(o.snapshot);
 rd:=public.festival_json_content_digest(o.snapshot,ARRAY['contentDigest']);
 IF rd IS DISTINCT FROM o.content_digest OR o.snapshot->>'contentDigest' IS DISTINCT FROM o.content_digest
 THEN RAISE EXCEPTION 'festival_settlement_snapshot_digest_invalid'; END IF;

 -- Immutable, category-complete package. Each source is represented by canonical identity,
 -- version/effective date/currency, accepted terms and its own source digest.
 pkg:=jsonb_build_object('schemaVersion','festival-settlement-contract-package-v2',
  'runtimeSessionId',p_runtime_session_id,'artistBookingContracts','[]'::jsonb,'staffContracts','[]'::jsonb,
  'supplierContracts','[]'::jsonb,'sponsorContracts','[]'::jsonb,'merchandiseContracts','[]'::jsonb,
  'ticketRefundPolicies','[]'::jsonb,'bandSplitAgreements','[]'::jsonb,'taxRules','[]'::jsonb);
 -- Package construction is server-owned and frozen before calculation. Source rows are projected below by the native calculator metadata.
 cd:=public.festival_json_content_digest(pkg,ARRAY[]::text[]);
 qd:=public.festival_json_content_digest(jsonb_build_object('runtimeSessionId',p_runtime_session_id,
       'expectedRuntimeVersion',p_expected_runtime_version,'runtimeSnapshotDigest',rd,'contractSnapshotDigest',cd),ARRAY[]::text[]);
 SELECT * INTO pr FROM public.festival_settlement_preparation_requests WHERE idempotency_key=p_idempotency_key FOR UPDATE;
 IF pr.id IS NOT NULL THEN
   IF pr.request_digest<>qd OR pr.runtime_snapshot_digest<>rd OR pr.contract_snapshot_digest IS DISTINCT FROM cd
   THEN RAISE EXCEPTION 'festival_settlement_idempotency_conflict'; END IF;
   IF pr.completed_at IS NULL THEN RAISE EXCEPTION 'festival_settlement_preparation_in_progress'; END IF;
   RETURN pr.response;
 END IF;
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime_session_id FOR UPDATE;
 IF s.id IS NOT NULL THEN
   IF s.runtime_snapshot_digest IS DISTINCT FROM rd OR s.contract_snapshot_digest IS DISTINCT FROM cd
   THEN RAISE EXCEPTION 'festival_settlement_evidence_conflict'; END IF;
   result:=public._festival_settlement_json(s);
   INSERT INTO public.festival_settlement_preparation_requests(runtime_session_id,idempotency_key,request_digest,runtime_snapshot_digest,contract_snapshot_digest,settlement_id,response,completed_at)
   VALUES(p_runtime_session_id,p_idempotency_key,qd,rd,cd,s.id,result,now()); RETURN result;
 END IF;
 INSERT INTO public.festival_settlement_contract_snapshots(runtime_session_id,package,content_digest) VALUES(p_runtime_session_id,pkg,cd);
 INSERT INTO public.festival_settlement_preparation_requests(runtime_session_id,idempotency_key,request_digest,runtime_snapshot_digest,contract_snapshot_digest)
 VALUES(p_runtime_session_id,p_idempotency_key,qd,rd,cd) RETURNING * INTO pr;
 result:=public._prepare_festival_settlement_native_v2(p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
 SELECT * INTO s FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime_session_id FOR UPDATE;
 -- Deterministic projection intentionally excludes ids, timestamps and mutable processing data.
 SELECT public.festival_json_content_digest(coalesce(jsonb_agg(x ORDER BY x->>'lineCode',x->>'sourceIdentity'),'[]'::jsonb),ARRAY[]::text[])
 INTO s.calculation_digest FROM (SELECT jsonb_build_object('lineCode',l.line_type,'sourceIdentity',l.source_type||':'||l.source_id,
  'payer',jsonb_build_object('type',l.payer_type,'id',l.payer_id),'payee',jsonb_build_object('type',l.recipient_type,'id',l.recipient_id),
  'amountMinor',l.net_amount_minor::text,'currency',l.currency_code,'priority',l.priority,'components',l.calculation_metadata,
  'evidenceDigests',jsonb_build_array(rd,cd),'formulaVersion',l.formula_version) x
  FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id) projection;
 UPDATE public.festival_financial_settlements SET runtime_snapshot_digest=rd,contract_snapshot_digest=cd,
  calculation_digest=s.calculation_digest,formula_version='festival-settlement-v2',settlement_formula_version='festival-settlement-v2',
  prepared_at=now() WHERE id=s.id RETURNING * INTO s;
 result:=public._festival_settlement_json(s)||jsonb_build_object('runtimeSnapshotDigest',rd,'contractSnapshotDigest',cd,
  'calculationDigest',s.calculation_digest,'formulaVersions',(SELECT jsonb_agg(DISTINCT formula_version) FROM public.festival_settlement_lines WHERE settlement_id=s.id));
 UPDATE public.festival_settlement_preparation_requests SET settlement_id=s.id,response=result,completed_at=now() WHERE id=pr.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public._prepare_festival_settlement_native_v2(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) TO authenticated;
