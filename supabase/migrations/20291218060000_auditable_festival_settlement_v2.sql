-- Close the native-v2 safety gaps before the first executable settlement.
-- This migration deliberately strengthens the existing settlement model rather
-- than introducing a parallel accounting domain.

CREATE TABLE public.festival_staff_shift_evidence_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_checkin_id uuid NOT NULL REFERENCES public.festival_runtime_staff_checkins(id),
  decision_type text NOT NULL CHECK (decision_type IN ('manual_completion','authorised_absence','authorised_cancellation')),
  effective_worked_minutes integer NOT NULL CHECK (effective_worked_minutes >= 0),
  approver_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 10),
  supersedes_decision_id uuid REFERENCES public.festival_staff_shift_evidence_decisions(id),
  idempotency_key uuid NOT NULL UNIQUE,
  decision_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX festival_shift_evidence_superseded_once
  ON public.festival_staff_shift_evidence_decisions(supersedes_decision_id)
  WHERE supersedes_decision_id IS NOT NULL;

ALTER TABLE public.festival_staff_shift_evidence_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_staff_shift_evidence_decisions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.festival_settlement_receipts
  ADD COLUMN settlement_id uuid REFERENCES public.festival_financial_settlements(id),
  ADD COLUMN transfer_key text,
  ADD COLUMN source_account_id uuid,
  ADD COLUMN destination_account_id uuid,
  ADD COLUMN amount_minor bigint CHECK (amount_minor >= 0),
  ADD COLUMN currency_code text CHECK (currency_code ~ '^[A-Z]{3}$'),
  ADD COLUMN debit_ledger_id uuid,
  ADD COLUMN credit_ledger_id uuid;
CREATE UNIQUE INDEX festival_settlement_receipt_transfer_key
  ON public.festival_settlement_receipts(transfer_key) WHERE transfer_key IS NOT NULL;

ALTER TABLE public.festival_tax_calculations
  ADD COLUMN rule_id uuid,
  ADD COLUMN source_category text;

ALTER TABLE public.festival_settlement_lines
  ADD COLUMN line_category text NOT NULL DEFAULT 'liability'
    CHECK (line_category IN ('liability','revenue','receivable')),
  ADD COLUMN revenue_order integer;
UPDATE public.festival_settlement_lines SET line_category=CASE
  WHEN line_type IN ('ticket_revenue','vendor_revenue','festival_merch_revenue','artist_merch_revenue') THEN 'revenue'
  WHEN line_type IN ('sponsor_receivable','other_income') THEN 'receivable'
  ELSE 'liability' END;
UPDATE public.festival_settlement_lines SET priority=CASE line_type
  WHEN 'refund' THEN 1 WHEN 'tax_liability' THEN 2 WHEN 'staff_wage' THEN 3
  WHEN 'artist_fee' THEN 4 WHEN 'supplier_invoice' THEN 6
  WHEN 'artist_merch_royalty' THEN 7 WHEN 'sponsor_refund' THEN 8 ELSE 9 END
WHERE line_category='liability';
ALTER TABLE public.festival_settlement_lines ADD CONSTRAINT festival_payable_priority_v2
  CHECK (line_category<>'liability' OR priority BETWEEN 1 AND 9) NOT VALID;

CREATE OR REPLACE FUNCTION public._assert_festival_settlement_source_chain(
  p_runtime_session_id uuid, p_source_type text, p_source_id uuid
) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ok boolean;
BEGIN
  IF p_source_type='festival_artist_booking' THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
      JOIN public.festival_launches l ON l.id=r.festival_launch_id
      JOIN public.festival_public_editions e ON e.festival_launch_id=l.id
      JOIN public.festival_artist_programmes ap ON ap.festival_company_id=l.festival_company_id
      JOIN public.festival_artist_bookings b ON b.festival_artist_programme_id=ap.id
      JOIN public.festival_runtime_performances rp ON rp.runtime_session_id=r.id AND rp.artist_booking_id=b.id
      WHERE r.id=p_runtime_session_id AND b.id=p_source_id) INTO ok;
  ELSIF p_source_type='festival_runtime_staff_checkin' THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
      JOIN public.festival_launches l ON l.id=r.festival_launch_id
      JOIN public.festival_public_editions e ON e.festival_launch_id=l.id
      JOIN public.festival_operations_plans op ON op.festival_company_id=l.festival_company_id
      JOIN public.festival_staff_assignments a ON a.festival_operations_plan_id=op.id
      JOIN public.festival_staff_shifts sh ON sh.staff_assignment_id=a.id AND sh.festival_operations_plan_id=op.id
      JOIN public.festival_runtime_staff_checkins c ON c.runtime_session_id=r.id AND c.staff_shift_id=sh.id
      WHERE r.id=p_runtime_session_id AND c.id=p_source_id) INTO ok;
  ELSIF p_source_type='festival_supplier_contract' THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
      JOIN public.festival_launches l ON l.id=r.festival_launch_id
      JOIN public.festival_public_editions e ON e.festival_launch_id=l.id
      JOIN public.festival_operations_plans op ON op.festival_company_id=l.festival_company_id
      JOIN public.festival_supplier_contracts sc ON sc.festival_operations_plan_id=op.id
      JOIN public.festival_runtime_supplier_checkins c ON c.runtime_session_id=r.id AND c.supplier_contract_id=sc.id
      WHERE r.id=p_runtime_session_id AND sc.id=p_source_id) INTO ok;
  ELSIF p_source_type='festival_financial_receivable' THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
      JOIN public.festival_launches l ON l.id=r.festival_launch_id
      JOIN public.festival_public_editions e ON e.festival_launch_id=l.id
      JOIN public.festival_sponsorship_plans sp ON sp.festival_company_id=l.festival_company_id
      JOIN public.festival_sponsor_contracts sc ON sc.festival_sponsorship_plan_id=sp.id
      JOIN public.festival_financial_receivables fr ON fr.sponsor_contract_id=sc.id
      WHERE r.id=p_runtime_session_id AND fr.id=p_source_id) INTO ok;
  ELSIF p_source_type='festival_runtime_vendor_sales' THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales v
      JOIN public.festival_runtime_days d ON d.id=v.runtime_day_id AND d.runtime_session_id=v.runtime_session_id
      WHERE v.runtime_session_id=p_runtime_session_id AND v.id=p_source_id) INTO ok;
  ELSIF p_source_type IN ('festival_ticket_sale','festival_ticket_refund_obligation') THEN
    SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
      JOIN public.festival_ticket_sales ts ON ts.festival_launch_id=r.festival_launch_id
      LEFT JOIN public.festival_ticket_refund_obligations ro ON ro.festival_ticket_sale_id=ts.id
      WHERE r.id=p_runtime_session_id AND
        ((p_source_type='festival_ticket_sale' AND ts.id=p_source_id) OR
         (p_source_type='festival_ticket_refund_obligation' AND ro.id=p_source_id))) INTO ok;
  ELSE
    RAISE EXCEPTION 'festival_settlement_source_type_invalid';
  END IF;
  IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'festival_settlement_source_chain_mismatch'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._assert_festival_settlement_evidence(p_runtime_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x record;
BEGIN
  -- A real checkout or the latest append-only authorised decision is mandatory.
  IF EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins c
    WHERE c.runtime_session_id=p_runtime_session_id AND c.checked_in_at IS NOT NULL
      AND c.checked_out_at IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.festival_staff_shift_evidence_decisions d
        WHERE d.staff_checkin_id=c.id
          AND NOT EXISTS (SELECT 1 FROM public.festival_staff_shift_evidence_decisions n
                          WHERE n.supersedes_decision_id=d.id)))
  THEN RAISE EXCEPTION 'festival_settlement_staff_checkout_missing'; END IF;
  FOR x IN SELECT source_type,source_id FROM public.festival_settlement_lines l
    JOIN public.festival_financial_settlements s ON s.id=l.settlement_id
    WHERE s.runtime_session_id=p_runtime_session_id
  LOOP PERFORM public._assert_festival_settlement_source_chain(p_runtime_session_id,x.source_type,x.source_id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._festival_contract_item(
  p_id uuid,p_type text,p_launch uuid,p_company uuid,p_version integer,
  p_effective timestamptz,p_currency text,p_terms jsonb,p_clauses jsonb
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT x || jsonb_build_object('sourceDigest',public.festival_json_content_digest(x,ARRAY[]::text[]))
  FROM (SELECT jsonb_build_object('sourceId',p_id,'sourceType',p_type,
    'festivalCompanyId',p_company,'festivalLaunchId',p_launch,'version',p_version,
    'effectiveDate',p_effective,'currency',p_currency,'acceptedTerms',coalesce(p_terms,'{}'),
    'clauses',coalesce(p_clauses,'[]')) x) q
$$;

CREATE OR REPLACE FUNCTION public._build_festival_contract_package(p_runtime_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE launch_id uuid; company_id uuid; package jsonb;
BEGIN
 SELECT l.id,l.festival_company_id INTO launch_id,company_id FROM public.festival_runtime_sessions r
 JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_public_editions e ON e.festival_launch_id=l.id WHERE r.id=p_runtime_session_id;
 IF launch_id IS NULL THEN RAISE EXCEPTION 'festival_settlement_runtime_chain_mismatch'; END IF;
 package:=jsonb_build_object('schemaVersion','festival-settlement-contract-package-v2','runtimeSessionId',p_runtime_session_id,
 'festivalLaunchId',launch_id,'festivalCompanyId',company_id,
 'artistBookingContracts',coalesce((SELECT jsonb_agg(public._festival_contract_item(b.id,'artist_booking',launch_id,company_id,b.version,b.confirmed_at,b.currency_code,b.contract_terms,coalesce(b.contract_terms->'clauses','[]')) ORDER BY b.id)
   FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id WHERE ap.festival_company_id=company_id),'[]'),
 'staffContracts',coalesce((SELECT jsonb_agg(public._festival_contract_item(a.id,'staff_assignment',launch_id,company_id,a.assignment_version,a.created_at,a.currency_code,to_jsonb(a)-ARRAY['updated_at','status'],coalesce(to_jsonb(a)->'clauses','[]')) ORDER BY a.id)
   FROM public.festival_staff_assignments a JOIN public.festival_operations_plans op ON op.id=a.festival_operations_plan_id WHERE op.festival_company_id=company_id),'[]'),
 'supplierContracts',coalesce((SELECT jsonb_agg(public._festival_contract_item(c.id,'supplier_contract',launch_id,company_id,c.contract_version,c.created_at,c.currency_code,c.terms_snapshot,coalesce(c.terms_snapshot->'clauses','[]')) ORDER BY c.id)
   FROM public.festival_supplier_contracts c JOIN public.festival_operations_plans op ON op.id=c.festival_operations_plan_id WHERE op.festival_company_id=company_id),'[]'),
 'sponsorContracts',coalesce((SELECT jsonb_agg(public._festival_contract_item(c.id,'sponsor_contract',launch_id,company_id,c.contract_version,c.confirmed_at,c.currency_code,c.terms_snapshot,coalesce(c.terms_snapshot->'clauses','[]')) ORDER BY c.id)
   FROM public.festival_sponsor_contracts c JOIN public.festival_sponsorship_plans sp ON sp.id=c.festival_sponsorship_plan_id WHERE sp.festival_company_id=company_id),'[]'),
 'merchandiseContracts',coalesce((SELECT jsonb_agg(public._festival_contract_item(b.id,'artist_merchandise',launch_id,company_id,b.version,b.confirmed_at,b.currency_code,
     jsonb_build_object('royaltyRateBasisPoints',coalesce((b.contract_terms->>'merchRevenueShareBasisPoints')::integer,0),'deductions',coalesce(b.contract_terms->'merchandiseDeductions','[]')),
     coalesce(b.contract_terms->'merchandiseClauses','[]')) ORDER BY b.id)
   FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
   WHERE ap.festival_company_id=company_id AND coalesce((b.contract_terms->>'merchRevenueShareBasisPoints')::integer,0)>0),'[]'),
 'ticketRefundPolicies',coalesce((SELECT jsonb_agg(public._festival_contract_item(tp.id,'ticket_refund_policy',launch_id,company_id,tp.planning_version,tp.created_at,tp.currency_code,
     jsonb_build_object('refundPolicy',tp.refund_policy,'transferPolicy',tp.transfer_policy),'[]') ORDER BY tp.id)
   FROM public.festival_ticket_plans tp WHERE tp.festival_company_id=company_id),'[]'),
 'bandSplitAgreements',coalesce((SELECT jsonb_agg(public._festival_contract_item(fp.band_id,'band_split_agreement',launch_id,company_id,1,fp.updated_at,
     (SELECT currency_code FROM public.festival_artist_programmes WHERE festival_company_id=company_id),
     jsonb_build_object('splitMethod',fp.revenue_split_method,'splitConfig',fp.revenue_split_config,'minimumReserveMinor',fp.minimum_reserve_minor::text),
     jsonb_build_array(jsonb_build_object('code','member_distribution','accepted',true))) ORDER BY fp.band_id)
   FROM public.band_finance_policies fp WHERE EXISTS(SELECT 1 FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id WHERE ap.festival_company_id=company_id AND b.band_id=fp.band_id)),'[]'),
 'taxRules',coalesce((SELECT jsonb_agg(public._festival_contract_item(tp.id,'festival_sales_tax_rule',launch_id,company_id,tp.planning_version,tp.created_at,tp.currency_code,
     jsonb_build_object('rateBasisPoints',tp.sales_tax_rate_basis_points,'transactionCategories',jsonb_build_array('ticket_sale','merchandise_revenue','vendor_sale')),
     jsonb_build_array(jsonb_build_object('code','sales_tax','rateBasisPoints',tp.sales_tax_rate_basis_points))) ORDER BY tp.id)
   FROM public.festival_ticket_plans tp WHERE tp.festival_company_id=company_id),'[]'));
 RETURN package;
END $$;

-- Overtime decisions are immutable facts; effective state is always derived.
CREATE OR REPLACE FUNCTION public.request_festival_overtime(p_staff_checkin_id uuid,p_requested_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE; actor uuid:=public._caller_profile_id(); d public.festival_staff_overtime_approvals%ROWTYPE;
BEGIN
 SELECT * INTO d FROM public.festival_staff_overtime_approvals WHERE idempotency_key=p_idempotency_key; IF FOUND THEN RETURN to_jsonb(d); END IF;
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id;
 IF c.profile_id IS DISTINCT FROM actor OR p_requested_minutes<0 THEN RAISE EXCEPTION 'festival_overtime_forbidden'; END IF;
 INSERT INTO public.festival_staff_overtime_approvals(staff_checkin_id,approver_profile_id,requested_minutes,approved_minutes,reason,idempotency_key,decision,effective)
 VALUES(c.id,actor,p_requested_minutes,0,p_reason,p_idempotency_key,'rejected',false) RETURNING * INTO d; RETURN to_jsonb(d);
END $$;

CREATE OR REPLACE FUNCTION public.decide_festival_overtime(p_staff_checkin_id uuid,p_approved_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); old public.festival_staff_overtime_approvals%ROWTYPE; d public.festival_staff_overtime_approvals%ROWTYPE;
BEGIN
 IF NOT public._festival_runtime_owner((SELECT runtime_session_id FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id),actor) THEN RAISE EXCEPTION 'festival_overtime_forbidden'; END IF;
 SELECT * INTO d FROM public.festival_staff_overtime_approvals WHERE idempotency_key=p_idempotency_key; IF FOUND THEN RETURN to_jsonb(d); END IF;
 SELECT * INTO old FROM public.festival_staff_overtime_approvals WHERE staff_checkin_id=p_staff_checkin_id AND effective ORDER BY decision_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF old.id IS NOT NULL THEN UPDATE public.festival_staff_overtime_approvals SET effective=false WHERE id=old.id; END IF;
 INSERT INTO public.festival_staff_overtime_approvals(staff_checkin_id,approver_profile_id,requested_minutes,approved_minutes,reason,idempotency_key,decision,effective,supersedes_decision_id)
 VALUES(p_staff_checkin_id,actor,greatest(coalesce(old.requested_minutes,p_approved_minutes),p_approved_minutes),p_approved_minutes,p_reason,p_idempotency_key,CASE WHEN p_approved_minutes>0 THEN 'approved' ELSE 'rejected' END,true,old.id) RETURNING * INTO d;
 RETURN to_jsonb(d);
END $$;

CREATE OR REPLACE FUNCTION public.supersede_festival_overtime_decision(p_decision_id uuid,p_approved_minutes integer,p_reason text,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.decide_festival_overtime(staff_checkin_id,p_approved_minutes,p_reason,p_idempotency_key)
 FROM public.festival_staff_overtime_approvals WHERE id=p_decision_id
$$;
CREATE OR REPLACE FUNCTION public.get_festival_overtime_history(p_staff_checkin_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_staff_checkin_id;
 IF c.id IS NULL OR NOT (public._festival_runtime_owner(c.runtime_session_id,public._caller_profile_id()) OR c.profile_id=public._caller_profile_id())
 THEN RAISE EXCEPTION 'festival_overtime_forbidden'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.decision_at,d.id) FROM public.festival_staff_overtime_approvals d WHERE d.staff_checkin_id=c.id),'[]');
END
$$;

CREATE OR REPLACE FUNCTION public._festival_contract_package_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.package:=public._build_festival_contract_package(NEW.runtime_session_id);
 NEW.content_digest:=public.festival_json_content_digest(NEW.package,ARRAY[]::text[]);
 RETURN NEW;
END $$;
CREATE TRIGGER festival_contract_package_guard BEFORE INSERT ON public.festival_settlement_contract_snapshots
 FOR EACH ROW EXECUTE FUNCTION public._festival_contract_package_guard();

CREATE OR REPLACE FUNCTION public._festival_settlement_line_chain_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE runtime_id uuid;
BEGIN
 SELECT runtime_session_id INTO runtime_id FROM public.festival_financial_settlements WHERE id=NEW.settlement_id;
 PERFORM public._assert_festival_settlement_source_chain(runtime_id,NEW.source_type,NEW.source_id);
 RETURN NEW;
END $$;
CREATE TRIGGER festival_settlement_line_chain_guard BEFORE INSERT OR UPDATE OF source_type,source_id,settlement_id
 ON public.festival_settlement_lines FOR EACH ROW EXECUTE FUNCTION public._festival_settlement_line_chain_guard();

ALTER FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) RENAME TO _prepare_festival_settlement_v2_unchecked;
CREATE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; contract_digest text; settlement_id uuid; runtime_digest text; calculation_digest text;
BEGIN
 -- Validate incomplete shifts before the immutable package is inserted. Source
 -- ownership is then checked synchronously for every line produced.
 PERFORM public._assert_festival_settlement_evidence(p_runtime_session_id);
 SELECT response INTO result FROM public.festival_settlement_preparation_requests
 WHERE runtime_session_id=p_runtime_session_id AND idempotency_key=p_idempotency_key AND completed_at IS NOT NULL;
 IF result IS NOT NULL THEN RETURN result; END IF;
 result:=public._prepare_festival_settlement_v2_unchecked(p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
 SELECT cs.content_digest,s.id,s.runtime_snapshot_digest INTO contract_digest,settlement_id,runtime_digest
 FROM public.festival_settlement_contract_snapshots cs JOIN public.festival_financial_settlements s ON s.runtime_session_id=cs.runtime_session_id
 WHERE cs.runtime_session_id=p_runtime_session_id;
 -- Rebind the deterministic calculation projection to the package actually
 -- stored by the BEFORE trigger (never to the caller's discarded placeholder).
 SELECT public.festival_json_content_digest(coalesce(jsonb_agg(x ORDER BY x->>'lineCode',x->>'sourceIdentity'),'[]'),ARRAY[]::text[])
 INTO calculation_digest FROM (SELECT jsonb_build_object('lineCode',l.line_type,'sourceIdentity',l.source_type||':'||l.source_id,
   'payer',jsonb_build_object('type',l.payer_type,'id',l.payer_id),'payee',jsonb_build_object('type',l.recipient_type,'id',l.recipient_id),
   'priority',l.priority,'components',coalesce((SELECT jsonb_agg(jsonb_build_object('type',c.component_type,'clause',c.contract_clause_id,
     'amountMinor',c.amount_minor::text,'evidence',c.evidence) ORDER BY c.component_type,c.id) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id),'[]'),
   'componentAmountMinor',l.net_amount_minor::text,'currency',l.currency_code,'evidenceDigests',jsonb_build_array(runtime_digest,contract_digest),
   'formulaVersion',l.formula_version) x FROM public.festival_settlement_lines l WHERE l.settlement_id=settlement_id) p;
 UPDATE public.festival_financial_settlements SET contract_snapshot_digest=contract_digest,calculation_digest=calculation_digest WHERE id=settlement_id;
 UPDATE public.festival_settlement_preparation_requests SET contract_snapshot_digest=contract_digest,
   response=response||jsonb_build_object('contractSnapshotDigest',contract_digest,'calculationDigest',calculation_digest)
 WHERE runtime_session_id=p_runtime_session_id AND idempotency_key=p_idempotency_key;
 RETURN result||jsonb_build_object('contractSnapshotDigest',contract_digest,'calculationDigest',calculation_digest);
END $$;

-- Prevent future relabelling: native snapshots, settlements and lines must agree.
CREATE OR REPLACE FUNCTION public._festival_settlement_formula_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.formula_version IS DISTINCT FROM NEW.settlement_formula_version THEN RAISE EXCEPTION 'festival_settlement_formula_version_mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_settlement_formula_guard BEFORE INSERT OR UPDATE OF formula_version,settlement_formula_version
 ON public.festival_financial_settlements FOR EACH ROW EXECUTE FUNCTION public._festival_settlement_formula_guard();

CREATE OR REPLACE FUNCTION public._festival_snapshot_formula_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.snapshot_type IN ('review','final') THEN
   NEW.snapshot:=jsonb_set(NEW.snapshot,'{formulaVersion}','"festival-settlement-v2"'::jsonb,true);
   NEW.formula_versions:=jsonb_set(coalesce(NEW.formula_versions,'{}'),'{settlement}','"festival-settlement-v2"'::jsonb,true);
   NEW.content_digest:=encode(digest(NEW.snapshot::text,'sha256'),'hex');
 END IF;
 IF NEW.formula_versions->>'settlement' IS DISTINCT FROM NEW.snapshot->>'formulaVersion'
 THEN RAISE EXCEPTION 'festival_settlement_formula_version_mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_snapshot_formula_guard BEFORE INSERT OR UPDATE OF snapshot,formula_versions
 ON public.festival_settlement_snapshots FOR EACH ROW EXECUTE FUNCTION public._festival_snapshot_formula_guard();

CREATE OR REPLACE FUNCTION public.process_festival_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; l public.festival_settlement_lines%ROWTYPE;
 actor uuid:=public._caller_profile_id(); paid boolean; tx public.financial_transactions%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF NOT public._festival_settlement_owner(s.id,actor) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 IF s.version<>p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 IF s.calculation_digest IS NULL THEN RAISE EXCEPTION 'festival_settlement_calculation_digest_missing'; END IF;
 UPDATE public.festival_financial_settlements SET status='settling',version=version+1 WHERE id=s.id RETURNING * INTO s;
 FOR l IN SELECT * FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_category='liability'
   AND status IN ('pending','failed','outstanding') ORDER BY priority,id FOR UPDATE
 LOOP
   -- The stable key is attempt-independent; _process performs canonical
   -- finance_transfer lookup and the unique receipt makes replay harmless.
   paid:=public._process_festival_settlement_line(l.id,actor);
   IF NOT paid THEN
     INSERT INTO public.festival_settlement_liabilities(settlement_id,settlement_line_id,priority,original_amount_minor,outstanding_amount_minor,currency_code,status,next_retry_at)
     VALUES(s.id,l.id,l.priority,l.net_amount_minor,l.net_amount_minor,l.currency_code,'outstanding',now())
     ON CONFLICT(settlement_line_id) DO UPDATE SET outstanding_amount_minor=excluded.outstanding_amount_minor,status='outstanding',updated_at=now();
     EXIT; -- Never jump an insolvent priority tier.
   END IF;
   SELECT ft.* INTO tx FROM public.festival_settlement_receipts r JOIN public.financial_transactions ft ON ft.id=r.canonical_transaction_id WHERE r.settlement_line_id=l.id;
   IF tx.id IS NOT NULL THEN
     UPDATE public.festival_settlement_receipts r SET settlement_id=s.id,transfer_key='festival-settlement:'||s.id||':line:'||l.id,
       source_account_id=tx.source_account_id,destination_account_id=tx.destination_account_id,
       amount_minor=l.net_amount_minor,currency_code=l.currency_code,
       debit_ledger_id=(SELECT e.id FROM public.financial_ledger_entries e WHERE e.transaction_id=tx.id AND e.entry_direction='debit' ORDER BY e.created_at LIMIT 1),
       credit_ledger_id=(SELECT e.id FROM public.financial_ledger_entries e WHERE e.transaction_id=tx.id AND e.entry_direction='credit' ORDER BY e.created_at LIMIT 1)
     WHERE r.settlement_line_id=l.id;
   END IF;
 END LOOP;
 UPDATE public.festival_financial_settlements SET status=CASE WHEN EXISTS(
   SELECT 1 FROM public.festival_settlement_liabilities q WHERE q.settlement_id=s.id AND q.status IN('outstanding','processing'))
   THEN 'partially_settled' ELSE 'settled' END,version=version+1,
   settled_at=CASE WHEN NOT EXISTS(SELECT 1 FROM public.festival_settlement_liabilities q WHERE q.settlement_id=s.id AND q.status IN('outstanding','processing')) THEN now() ELSE NULL END,
   updated_at=now() WHERE id=s.id RETURNING * INTO s;
 RETURN public._festival_settlement_json(s)||jsonb_build_object('idempotencyKey',p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.retry_festival_settlement_liabilities(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; q public.festival_settlement_liabilities%ROWTYPE; ok boolean;
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF NOT public._festival_settlement_owner(s.id,public._caller_profile_id()) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
 IF s.version<>p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 FOR q IN SELECT * FROM public.festival_settlement_liabilities WHERE settlement_id=s.id AND status='outstanding'
   AND coalesce(next_retry_at,'-infinity')<=now() ORDER BY priority,id FOR UPDATE
 LOOP
   UPDATE public.festival_settlement_liabilities SET status='processing',updated_at=now() WHERE id=q.id;
   ok:=public._process_festival_settlement_line(q.settlement_line_id,public._caller_profile_id());
   IF NOT ok THEN UPDATE public.festival_settlement_liabilities SET status='outstanding',next_retry_at=now()+interval '5 minutes',updated_at=now() WHERE id=q.id; EXIT; END IF;
   UPDATE public.festival_settlement_liabilities SET status='paid',outstanding_amount_minor=0,updated_at=now() WHERE id=q.id;
 END LOOP;
 UPDATE public.festival_financial_settlements SET status=CASE WHEN EXISTS(SELECT 1 FROM public.festival_settlement_liabilities q2 WHERE q2.settlement_id=s.id AND q2.status IN('outstanding','processing')) THEN 'partially_settled' ELSE 'settled' END,
 version=version+1,settled_at=CASE WHEN NOT EXISTS(SELECT 1 FROM public.festival_settlement_liabilities q2 WHERE q2.settlement_id=s.id AND q2.status IN('outstanding','processing')) THEN now() ELSE NULL END,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 RETURN public._festival_settlement_json(s)||jsonb_build_object('idempotencyKey',p_idempotency_key);
END $$;

GRANT EXECUTE ON FUNCTION public.request_festival_overtime(uuid,integer,text,uuid),public.decide_festival_overtime(uuid,integer,text,uuid),public.supersede_festival_overtime_decision(uuid,integer,text,uuid),public.get_festival_overtime_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_festival_settlement(uuid,integer,uuid),public.retry_festival_settlement_liabilities(uuid,integer,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._prepare_festival_settlement_v2_unchecked(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._assert_festival_settlement_source_chain(uuid,text,uuid),public._assert_festival_settlement_evidence(uuid),public._build_festival_contract_package(uuid),public._festival_contract_item(uuid,text,uuid,uuid,integer,timestamptz,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
