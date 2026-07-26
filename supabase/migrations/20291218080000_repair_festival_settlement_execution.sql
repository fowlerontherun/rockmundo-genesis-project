-- Repair the native Festival settlement v2 execution path.  Everything in this
-- migration is consumed by the active prepare/process RPCs; there is no shadow
-- settlement implementation.

-- Keep an immutable explanation of the historical identity decision.
CREATE TABLE public.festival_launch_identity_backfill_audit (
  festival_launch_id uuid PRIMARY KEY REFERENCES public.festival_launches(id),
  festival_id uuid REFERENCES public.festivals(id),
  festival_edition_id uuid REFERENCES public.festival_editions(id),
  resolution_method text NOT NULL,
  candidate_count integer NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  diagnostic jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.festival_launch_identity_backfill_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_launch_identity_backfill_audit FROM PUBLIC, anon, authenticated;

-- Produce an intentional diagnostic instead of allowing a later CHECK to emit
-- an opaque deployment failure for an unknown historical status.
DO $$ DECLARE unknowns text; BEGIN
 SELECT string_agg(status,', ' ORDER BY status) INTO unknowns FROM (
  SELECT DISTINCT status FROM public.festival_financial_settlements
  WHERE status NOT IN('draft','calculated','processing','partially_settled','settled','failed','disputed',
    'settlement_review','settling','settlement_failed','ready_for_settlement','not_ready')) s;
 IF unknowns IS NOT NULL THEN
   RAISE EXCEPTION 'unknown historical festival settlement statuses: %',unknowns
     USING HINT='Map every listed status explicitly before enforcing settlement_status_v2.';
 END IF;
END $$;

-- The historical chain is company configuration -> public launch dates/city ->
-- canonical edition.  A name match is deliberately not used: names are mutable.
WITH candidates AS (
  SELECT l.id launch_id, e.id edition_id, e.festival_id,
         count(*) OVER (PARTITION BY l.id) candidate_count
  FROM public.festival_launches l
  JOIN public.festival_configurations cfg ON cfg.festival_company_id=l.festival_company_id
  JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
  JOIN public.festival_editions e
    ON e.city_id=pe.city_id
   AND e.start_at::date=pe.starts_at::date
   AND e.end_at::date=pe.ends_at::date
  WHERE l.festival_id IS NULL OR l.festival_edition_id IS NULL
), unique_candidates AS (
  SELECT * FROM candidates WHERE candidate_count=1
)
UPDATE public.festival_launches l
SET festival_id=c.festival_id, festival_edition_id=c.edition_id
FROM unique_candidates c WHERE l.id=c.launch_id;

INSERT INTO public.festival_launch_identity_backfill_audit(
  festival_launch_id,festival_id,festival_edition_id,resolution_method,candidate_count,diagnostic)
SELECT l.id,l.festival_id,l.festival_edition_id,
       CASE WHEN l.festival_edition_id IS NULL THEN 'unresolved'
            ELSE 'public_edition_city_and_exact_date_range' END,
       coalesce((SELECT count(*) FROM public.festival_editions e
         JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
         WHERE e.city_id=pe.city_id AND e.start_at::date=pe.starts_at::date
           AND e.end_at::date=pe.ends_at::date),0),
       jsonb_build_object('launchStatus',l.launch_status,'festivalCompanyId',l.festival_company_id)
FROM public.festival_launches l
ON CONFLICT(festival_launch_id) DO NOTHING;

-- Deployment audit query (also useful to operators before applying this file):
-- SELECT l.id,l.launch_status,a.candidate_count,a.diagnostic
-- FROM festival_launches l JOIN festival_launch_identity_backfill_audit a
--   ON a.festival_launch_id=l.id
-- WHERE l.festival_id IS NULL OR l.festival_edition_id IS NULL;
DO $$
DECLARE d text;
BEGIN
 SELECT string_agg(format('launch=%s status=%s candidates=%s',l.id,l.launch_status,a.candidate_count),'; ' ORDER BY l.id)
 INTO d FROM public.festival_launches l
 JOIN public.festival_launch_identity_backfill_audit a ON a.festival_launch_id=l.id
 WHERE l.festival_id IS NULL OR l.festival_edition_id IS NULL;
 IF d IS NOT NULL THEN
   RAISE EXCEPTION 'festival launch identity backfill unresolved or ambiguous: %',d
     USING HINT='Inspect festival_launch_identity_backfill_audit; do not choose an edition by company or name.';
 END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS festival_editions_id_festival_id_key
  ON public.festival_editions(id,festival_id);
ALTER TABLE public.festival_launches
  ALTER COLUMN festival_id SET NOT NULL,
  ALTER COLUMN festival_edition_id SET NOT NULL,
  ADD CONSTRAINT festival_launch_edition_belongs_to_festival_fk
    FOREIGN KEY(festival_edition_id,festival_id)
    REFERENCES public.festival_editions(id,festival_id) NOT VALID;
ALTER TABLE public.festival_launches VALIDATE CONSTRAINT festival_launch_edition_belongs_to_festival_fk;

-- Every planning source is edition-scoped.  The unique launch/company relation
-- makes this backfill deterministic, while the diagnostic rejects bad history.
ALTER TABLE public.festival_artist_programmes ADD COLUMN festival_edition_id uuid;
ALTER TABLE public.festival_operations_plans ADD COLUMN festival_edition_id uuid;
ALTER TABLE public.festival_sponsorship_plans ADD COLUMN festival_edition_id uuid;
ALTER TABLE public.festival_ticket_plans ADD COLUMN festival_edition_id uuid;
UPDATE public.festival_artist_programmes p SET festival_edition_id=l.festival_edition_id
 FROM public.festival_launches l WHERE l.festival_company_id=p.festival_company_id;
UPDATE public.festival_operations_plans p SET festival_edition_id=l.festival_edition_id
 FROM public.festival_launches l WHERE l.festival_company_id=p.festival_company_id;
UPDATE public.festival_sponsorship_plans p SET festival_edition_id=l.festival_edition_id
 FROM public.festival_launches l WHERE l.festival_company_id=p.festival_company_id;
UPDATE public.festival_ticket_plans p SET festival_edition_id=l.festival_edition_id
 FROM public.festival_launches l WHERE l.festival_company_id=p.festival_company_id;
DO $$ DECLARE d text; BEGIN
 SELECT string_agg(x,'; ') INTO d FROM (
  SELECT 'artist_programme='||id x FROM public.festival_artist_programmes WHERE festival_edition_id IS NULL
  UNION ALL SELECT 'operations_plan='||id FROM public.festival_operations_plans WHERE festival_edition_id IS NULL
  UNION ALL SELECT 'sponsorship_plan='||id FROM public.festival_sponsorship_plans WHERE festival_edition_id IS NULL
  UNION ALL SELECT 'ticket_plan='||id FROM public.festival_ticket_plans WHERE festival_edition_id IS NULL) q;
 IF d IS NOT NULL THEN RAISE EXCEPTION 'festival plan edition backfill unresolved: %',d; END IF;
END $$;
ALTER TABLE public.festival_artist_programmes ALTER COLUMN festival_edition_id SET NOT NULL,
 ADD CONSTRAINT festival_artist_programme_edition_fk FOREIGN KEY(festival_edition_id) REFERENCES public.festival_editions(id);
ALTER TABLE public.festival_operations_plans ALTER COLUMN festival_edition_id SET NOT NULL,
 ADD CONSTRAINT festival_operations_plan_edition_fk FOREIGN KEY(festival_edition_id) REFERENCES public.festival_editions(id);
ALTER TABLE public.festival_sponsorship_plans ALTER COLUMN festival_edition_id SET NOT NULL,
 ADD CONSTRAINT festival_sponsorship_plan_edition_fk FOREIGN KEY(festival_edition_id) REFERENCES public.festival_editions(id);
ALTER TABLE public.festival_ticket_plans ALTER COLUMN festival_edition_id SET NOT NULL,
 ADD CONSTRAINT festival_ticket_plan_edition_fk FOREIGN KEY(festival_edition_id) REFERENCES public.festival_editions(id);

-- Replace the historical whole-row projections with an explicit allow-list.
-- The existing builder is used only as a source adapter; mutable fields can
-- never cross this projection into the stored package.
ALTER FUNCTION public._build_festival_contract_package(uuid)
 RENAME TO _build_festival_contract_package_before_projection_repair;
CREATE FUNCTION public._build_festival_contract_package(p_runtime_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE raw jsonb:=public._build_festival_contract_package_before_projection_repair(p_runtime_session_id);
 package jsonb; category text; item jsonb; projected jsonb; edition uuid; launch uuid; festival uuid;
BEGIN
 SELECT l.id,l.festival_edition_id,l.festival_id INTO launch,edition,festival
 FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
 WHERE r.id=p_runtime_session_id;
 package:=jsonb_build_object('schemaVersion','festival-settlement-contract-package-v2',
   'runtimeSessionId',p_runtime_session_id,'festivalLaunchId',launch,
   'festivalEditionId',edition,'festivalId',festival);
 FOREACH category IN ARRAY ARRAY['artistBookingContracts','staffContracts','supplierContracts','sponsorContracts','merchandiseContracts','ticketRefundPolicies','bandSplitAgreements','taxRules'] LOOP
   projected:='[]'::jsonb;
   FOR item IN SELECT value FROM jsonb_array_elements(coalesce(raw->category,'[]')) LOOP
     projected:=projected||jsonb_build_array(jsonb_build_object(
       'contractId',coalesce(item->'sourceId',item->'id'),
       'contractType',coalesce(item->'sourceType',to_jsonb(category)),
       'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,
       'acceptedVersion',coalesce(item->'version',item->'contract_version',item->'planning_version','1'::jsonb),
       'effectiveDate',coalesce(item->'effectiveDate',item->'confirmed_at',item->'created_at'),
       'currency',coalesce(item->'currency',item->'currency_code'),
       'payerIdentity',coalesce(item->'payerIdentity',jsonb_build_object('companyId',item->'company_id')),
       'payeeIdentity',coalesce(item->'payeeIdentity',jsonb_build_object('profileId',item->'profile_id','bandId',item->'band_id','companyId',item->'supplier_company_id')),
       'acceptedClauses',coalesce(item->'clauses',item->'acceptedTerms'->'clauses',item->'contract_terms'->'clauses','[]'::jsonb),
       'acceptedRates',coalesce(item->'acceptedTerms'->'rates',item->'contract_terms'->'rates','{}'::jsonb),
       'acceptedThresholds',coalesce(item->'acceptedTerms'->'thresholds',item->'contract_terms'->'thresholds','{}'::jsonb),
       'acceptedCaps',coalesce(item->'acceptedTerms'->'caps',item->'contract_terms'->'caps','{}'::jsonb),
       'sourceDigest',coalesce(item->'sourceDigest',to_jsonb(public.festival_json_content_digest(item,ARRAY['contentDigest'])))));
   END LOOP;
   package:=package||jsonb_build_object(category,projected);
 END LOOP;
 RETURN package;
END $$;

-- One digest definition: the embedded contentDigest is excluded from its own hash.
CREATE OR REPLACE FUNCTION public.festival_contract_package_digest(p_package jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path='' AS $$
 SELECT public.festival_json_content_digest(p_package,ARRAY['contentDigest'])
$$;
CREATE OR REPLACE FUNCTION public._festival_contract_package_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text;
BEGIN
 IF TG_OP='INSERT' THEN NEW.package:=public._build_festival_contract_package(NEW.runtime_session_id); END IF;
 d:=public.festival_contract_package_digest(NEW.package);
 IF NEW.package ? 'contentDigest' AND NEW.package->>'contentDigest' IS DISTINCT FROM d
 THEN RAISE EXCEPTION 'festival_contract_package_embedded_digest_invalid'; END IF;
 NEW.package:=jsonb_set(NEW.package,'{contentDigest}',to_jsonb(d),true);
 NEW.content_digest:=d;
 RETURN NEW;
END $$;
DROP TRIGGER festival_contract_package_guard ON public.festival_settlement_contract_snapshots;
CREATE TRIGGER festival_contract_package_guard BEFORE INSERT OR UPDATE OF package,content_digest
 ON public.festival_settlement_contract_snapshots FOR EACH ROW
 EXECUTE FUNCTION public._festival_contract_package_guard();
ALTER TABLE public.festival_settlement_contract_snapshots
 DROP CONSTRAINT IF EXISTS festival_settlement_contract_snapshots_check;
ALTER TABLE public.festival_settlement_contract_snapshots
 ADD CONSTRAINT festival_contract_package_digest_check CHECK(
   content_digest=public.festival_contract_package_digest(package)
   AND package->>'contentDigest'=content_digest) NOT VALID;
ALTER TABLE public.festival_settlement_contract_snapshots VALIDATE CONSTRAINT festival_contract_package_digest_check;

-- Exact sponsor isolation includes the accepted contract deliverable represented
-- by the runtime activation; sharing a legal company is irrelevant.
CREATE OR REPLACE FUNCTION public._festival_sponsor_receivable_in_runtime(
 p_runtime_session_id uuid,p_receivable_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.festival_runtime_sessions r
 JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_sponsorship_plans sp ON sp.festival_edition_id=l.festival_edition_id
 JOIN public.festival_sponsor_contracts sc ON sc.festival_sponsorship_plan_id=sp.id
 JOIN public.festival_financial_receivables fr ON fr.sponsor_contract_id=sc.id
 JOIN public.festival_sponsor_deliverables d ON d.sponsor_contract_id=sc.id
 JOIN public.festival_runtime_sponsor_activations a
   ON a.runtime_session_id=r.id AND a.contract_deliverable_id=d.id
 WHERE r.id=p_runtime_session_id AND fr.id=p_receivable_id)
$$;

ALTER FUNCTION public._assert_festival_settlement_source_chain(uuid,text,uuid)
 RENAME TO _assert_festival_settlement_source_chain_before_edition_repair;
CREATE FUNCTION public._assert_festival_settlement_source_chain(
 p_runtime_session_id uuid,p_source_type text,p_source_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE edition_id uuid; ok boolean;
BEGIN
 SELECT l.festival_edition_id INTO edition_id FROM public.festival_runtime_sessions r
 JOIN public.festival_launches l ON l.id=r.festival_launch_id WHERE r.id=p_runtime_session_id;
 CASE p_source_type
 WHEN 'festival_artist_booking' THEN SELECT EXISTS(SELECT 1 FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes p ON p.id=b.festival_artist_programme_id WHERE b.id=p_source_id AND p.festival_edition_id=edition_id) INTO ok;
 WHEN 'festival_runtime_staff_checkin' THEN SELECT EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins c JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id JOIN public.festival_operations_plans p ON p.id=sh.festival_operations_plan_id WHERE c.id=p_source_id AND c.runtime_session_id=p_runtime_session_id AND p.festival_edition_id=edition_id) INTO ok;
 WHEN 'festival_supplier_contract' THEN SELECT EXISTS(SELECT 1 FROM public.festival_supplier_contracts c JOIN public.festival_operations_plans p ON p.id=c.festival_operations_plan_id JOIN public.festival_runtime_supplier_checkins ck ON ck.supplier_contract_id=c.id WHERE c.id=p_source_id AND ck.runtime_session_id=p_runtime_session_id AND p.festival_edition_id=edition_id) INTO ok;
 WHEN 'festival_financial_receivable' THEN ok:=public._festival_sponsor_receivable_in_runtime(p_runtime_session_id,p_source_id);
 ELSE PERFORM public._assert_festival_settlement_source_chain_before_edition_repair(p_runtime_session_id,p_source_type,p_source_id); RETURN;
 END CASE;
 IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'festival_settlement_source_chain_mismatch'; END IF;
END $$;

-- Effective minutes are shared by preparation and overtime approval.  Manual
-- evidence wins only when the raw checkout pair is incomplete.
CREATE OR REPLACE FUNCTION public._festival_effective_worked_minutes(p_checkin_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.festival_runtime_staff_checkins%ROWTYPE; m integer;
BEGIN
 SELECT * INTO c FROM public.festival_runtime_staff_checkins WHERE id=p_checkin_id;
 IF c.id IS NULL OR c.checked_in_at IS NULL THEN RETURN NULL; END IF;
 IF c.checked_out_at IS NOT NULL THEN
   RETURN greatest(0,extract(epoch FROM(c.checked_out_at-c.checked_in_at))/60)::integer;
 END IF;
 SELECT d.effective_worked_minutes INTO m FROM public.festival_staff_shift_evidence_decisions d
 WHERE d.staff_checkin_id=c.id AND NOT EXISTS(SELECT 1 FROM public.festival_staff_shift_evidence_decisions n WHERE n.supersedes_decision_id=d.id)
 ORDER BY d.decision_at DESC,d.id DESC LIMIT 1;
 RETURN m;
END $$;

-- Components are the calculation.  Never reverse-engineer them by distributing
-- a pre-existing line amount. Accepted JSON clause amounts are independently
-- projected and the line is then derived from their exact sum.
CREATE OR REPLACE FUNCTION public._populate_festival_payable_components(p_settlement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l record; contracted int; worked int; requested int; approved int; regular bigint; overtime bigint;
 k text; keys text[]; amount bigint; terms jsonb;
BEGIN
 DELETE FROM public.festival_settlement_line_components c USING public.festival_settlement_lines l2
 WHERE c.settlement_line_id=l2.id AND l2.settlement_id=p_settlement_id;
 FOR l IN SELECT sl.*,a.agreed_pay_minor,sh.starts_at,sh.ends_at,sh.break_minutes
  FROM public.festival_settlement_lines sl
  JOIN public.festival_runtime_staff_checkins c ON c.id=sl.source_id AND sl.source_type='festival_runtime_staff_checkin'
  JOIN public.festival_staff_shifts sh ON sh.id=c.staff_shift_id
  JOIN public.festival_staff_assignments a ON a.id=sh.staff_assignment_id
  WHERE sl.settlement_id=p_settlement_id LOOP
   worked:=public._festival_effective_worked_minutes(l.source_id);
   IF worked IS NULL THEN RAISE EXCEPTION 'festival_settlement_staff_checkout_missing'; END IF;
   contracted:=greatest(1,(extract(epoch FROM(l.ends_at-l.starts_at))/60)::int-l.break_minutes);
   SELECT coalesce(max(requested_minutes) FILTER(WHERE decision='requested'),0),
          coalesce(max(approved_minutes) FILTER(WHERE effective AND decision='approved'),0)
   INTO requested,approved FROM public.festival_staff_overtime_approvals WHERE staff_checkin_id=l.source_id;
   IF approved>requested OR requested>greatest(worked-contracted,0) THEN RAISE EXCEPTION 'festival_overtime_minutes_invalid'; END IF;
   regular:=(l.agreed_pay_minor*least(worked,contracted))/contracted;
   overtime:=(l.agreed_pay_minor*approved)/contracted;
   INSERT INTO public.festival_settlement_line_components(settlement_line_id,component_type,evidence,calculation,amount_minor,currency_code)
   VALUES(l.id,'contracted_regular_pay',jsonb_build_object('workedMinutes',worked,'contractedMinutes',contracted),'frozen base rate * regular minutes',regular,l.currency_code),
    (l.id,'approved_overtime',jsonb_build_object('actualOvertimeMinutes',greatest(worked-contracted,0),'requestedOvertimeMinutes',requested,'approvedOvertimeMinutes',approved),'frozen base rate * approved overtime minutes',overtime,l.currency_code),
    (l.id,'guaranteed_minimum','{}','frozen clause',0,l.currency_code),(l.id,'lateness_deduction','{}','frozen clause',0,l.currency_code),
    (l.id,'early_departure_deduction','{}','frozen clause',0,l.currency_code),(l.id,'absence','{}','frozen clause',0,l.currency_code),
    (l.id,'role_bonus','{}','frozen clause',0,l.currency_code),(l.id,'emergency_call_out','{}','frozen clause',0,l.currency_code),
    (l.id,'manual_authorised_adjustment','{}','authorised immutable adjustment',0,l.currency_code);
 END LOOP;
 FOR l IN SELECT * FROM public.festival_settlement_lines WHERE settlement_id=p_settlement_id
   AND line_type IN('artist_fee','supplier_invoice','sponsor_receivable') LOOP
   terms:=coalesce(l.calculation_metadata->'contractTerms',l.calculation_metadata->'acceptedTerms','{}');
   keys:=CASE l.line_type
    WHEN 'artist_fee' THEN ARRAY['appearanceGuarantee','completionBonus','performanceThreshold','attendanceThreshold','sellOutBonus','headlinerBonus','revenueShare','travelReimbursement','accommodationReimbursement','cancellationPayment','noShowDeduction','delayDeduction']
    WHEN 'supplier_invoice' THEN ARRAY['depositAlreadyPaid','remainingBaseFee','completion','earlyDelivery','quality','emergencyService','delayPenalty','partialDelivery','slaBreach','damage','cancellation','forceMajeure']
    ELSE ARRAY['fixedFee','milestone','attendanceTarget','exposureTarget','exclusivity','categoryConflict','underDelivery','cancellation','sponsorRefund','bonus'] END;
   FOREACH k IN ARRAY keys LOOP
    amount:=coalesce((terms->>k)::bigint,0);
    IF k IN('noShowDeduction','delayDeduction','depositAlreadyPaid','delayPenalty','partialDelivery','slaBreach','damage','categoryConflict','underDelivery','sponsorRefund') THEN amount:=-abs(amount); END IF;
    INSERT INTO public.festival_settlement_line_components(settlement_line_id,component_type,evidence,calculation,amount_minor,currency_code)
    VALUES(l.id,lower(regexp_replace(k,'([A-Z])','_\1','g')),jsonb_build_object('acceptedClause',terms->k),'independent frozen contract clause',amount,l.currency_code);
   END LOOP;
 END LOOP;
 UPDATE public.festival_settlement_lines sl SET net_amount_minor=x.total
 FROM (SELECT c.settlement_line_id,sum(c.amount_minor) total FROM public.festival_settlement_line_components c
       JOIN public.festival_settlement_lines z ON z.id=c.settlement_line_id
       WHERE z.settlement_id=p_settlement_id GROUP BY c.settlement_line_id)x WHERE sl.id=x.settlement_line_id;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines sl WHERE sl.settlement_id=p_settlement_id AND sl.line_category='liability'
  AND sl.net_amount_minor IS DISTINCT FROM (SELECT coalesce(sum(c.amount_minor),0) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=sl.id))
 THEN RAISE EXCEPTION 'festival_settlement_component_sum_mismatch'; END IF;
END $$;

-- Call the calculator inside the active ordered preparation transaction before
-- calculation evidence is digested and before status becomes calculated.
ALTER FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) RENAME TO _prepare_festival_settlement_before_component_repair;
CREATE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; sid uuid; pkg public.festival_settlement_contract_snapshots%ROWTYPE; calc text;
BEGIN
 PERFORM public._festival_settlement_identity(p_runtime_session_id);
 PERFORM public._assert_festival_settlement_evidence(p_runtime_session_id);
 result:=public._prepare_festival_settlement_before_component_repair(p_runtime_session_id,p_expected_runtime_version,p_idempotency_key);
 SELECT id INTO sid FROM public.festival_financial_settlements WHERE runtime_session_id=p_runtime_session_id FOR UPDATE;
 -- Temporarily return the draft produced by the legacy calculator to draft so
 -- component/tax evidence is created before the immutable calculated boundary.
 UPDATE public.festival_financial_settlements SET status='draft' WHERE id=sid;
 SELECT * INTO pkg FROM public.festival_settlement_contract_snapshots WHERE runtime_session_id=p_runtime_session_id;
 IF pkg.content_digest IS DISTINCT FROM public.festival_contract_package_digest(pkg.package)
    OR pkg.package->>'contentDigest' IS DISTINCT FROM pkg.content_digest THEN RAISE EXCEPTION 'festival_contract_package_tampered'; END IF;
 PERFORM public._populate_festival_payable_components(sid);
 INSERT INTO public.festival_tax_calculations(settlement_line_id,rule_id,source_category,jurisdiction,tax_type,rate,taxable_base_minor,tax_amount_minor,currency_code,rule_version,event_date)
 SELECT l.id,(pkg.package->'taxRules'->0->>'sourceId')::uuid,l.source_type,
   coalesce(pkg.package->'taxRules'->0->>'jurisdiction',pkg.package->>'countryId'),'festival'),
   CASE l.source_type WHEN 'festival_ticket_sale' THEN 'ticket_tax' WHEN 'festival_runtime_vendor_sales' THEN 'merchandise_tax' ELSE 'event_tax' END,
   CASE WHEN l.gross_amount_minor=0 THEN 0 ELSE l.net_amount_minor::numeric/l.gross_amount_minor END,
   l.gross_amount_minor,l.net_amount_minor,l.currency_code,
   coalesce(pkg.package->'taxRules'->0->>'version','1'),
   (SELECT pe.starts_at::date FROM public.festival_runtime_sessions r JOIN public.festival_public_editions pe ON pe.festival_launch_id=r.festival_launch_id WHERE r.id=p_runtime_session_id)
 FROM public.festival_settlement_lines l WHERE l.settlement_id=sid AND l.line_type='tax_liability'
 ON CONFLICT DO NOTHING;
 PERFORM public._assert_festival_settlement_evidence(p_runtime_session_id);
 SELECT public.festival_json_content_digest(jsonb_agg(x ORDER BY x->>'lineId'),ARRAY[]::text[]) INTO calc
 FROM (SELECT jsonb_build_object('lineId',l.id,'netAmountMinor',l.net_amount_minor,'components',
   (SELECT jsonb_agg(jsonb_build_object('type',c.component_type,'amountMinor',c.amount_minor) ORDER BY c.component_type,c.id) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id)) x
   FROM public.festival_settlement_lines l WHERE l.settlement_id=sid) q;
 UPDATE public.festival_financial_settlements SET status='calculated',calculation_digest=calc,updated_at=now() WHERE id=sid;
 UPDATE public.festival_settlement_preparation_requests SET response=response||jsonb_build_object('status','calculated'),completed_at=now()
 WHERE settlement_id=sid;
 RETURN result||jsonb_build_object('status','calculated');
END $$;

-- INSERT as well as UPDATE/DELETE is forbidden once calculated.  Runtime and
-- contract snapshots are resolved to their settlement through the runtime id.
CREATE OR REPLACE FUNCTION public._festival_calculated_evidence_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE sid uuid; line_id uuid; runtime_id uuid; st text;
BEGIN
 IF TG_TABLE_NAME='festival_settlement_lines' THEN sid:=coalesce(NEW.settlement_id,OLD.settlement_id);
 ELSIF TG_TABLE_NAME IN('festival_settlement_line_components','festival_tax_calculations') THEN
   line_id:=coalesce(NEW.settlement_line_id,OLD.settlement_line_id);
   SELECT settlement_id INTO sid FROM public.festival_settlement_lines WHERE id=line_id;
 ELSIF TG_TABLE_NAME='festival_settlement_contract_snapshots' THEN
   runtime_id:=coalesce(NEW.runtime_session_id,OLD.runtime_session_id);
   SELECT id INTO sid FROM public.festival_financial_settlements WHERE runtime_session_id=runtime_id;
 ELSE sid:=coalesce(NEW.settlement_id,OLD.settlement_id); END IF;
 SELECT status INTO st FROM public.festival_financial_settlements WHERE id=sid;
 IF st IN('calculated','processing','partially_settled','settled','failed','disputed') THEN
   RAISE EXCEPTION 'festival_settlement_prepared_evidence_immutable';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER festival_line_insert_immutable BEFORE INSERT ON public.festival_settlement_lines FOR EACH ROW EXECUTE FUNCTION public._festival_calculated_evidence_immutable();
CREATE TRIGGER festival_component_insert_immutable BEFORE INSERT ON public.festival_settlement_line_components FOR EACH ROW EXECUTE FUNCTION public._festival_calculated_evidence_immutable();
CREATE TRIGGER festival_tax_insert_immutable BEFORE INSERT ON public.festival_tax_calculations FOR EACH ROW EXECUTE FUNCTION public._festival_calculated_evidence_immutable();
CREATE TRIGGER festival_contract_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.festival_settlement_contract_snapshots FOR EACH ROW EXECUTE FUNCTION public._festival_calculated_evidence_immutable();

-- Durable processing idempotency wraps both active money-moving entry points.
ALTER FUNCTION public.process_festival_settlement(uuid,integer,uuid) RENAME TO _process_festival_settlement_without_request;
CREATE FUNCTION public.process_festival_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; q public.festival_settlement_processing_requests%ROWTYPE; d text; result jsonb; completion jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 d:=public.festival_json_content_digest(jsonb_build_object('settlementId',s.id,'version',p_expected_version,'calculationDigest',s.calculation_digest),ARRAY[]::text[]);
 INSERT INTO public.festival_settlement_processing_requests(settlement_id,action,idempotency_key,request_digest,settlement_version,calculation_digest)
 VALUES(s.id,'process',p_idempotency_key,d,p_expected_version,s.calculation_digest) ON CONFLICT DO NOTHING;
 SELECT * INTO q FROM public.festival_settlement_processing_requests WHERE settlement_id=s.id AND action='process' AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF q.request_digest<>d OR q.settlement_version<>p_expected_version OR q.calculation_digest<>s.calculation_digest THEN RAISE EXCEPTION 'festival_settlement_processing_idempotency_conflict'; END IF;
 IF q.completed_at IS NOT NULL THEN RETURN q.response; END IF;
 result:=public._process_festival_settlement_without_request(s.id,p_expected_version,p_idempotency_key);
 completion:=public._festival_settlement_completion(s.id);
 UPDATE public.festival_financial_settlements SET status=CASE WHEN (completion->>'allPayablesResolved')::boolean THEN 'settled' ELSE 'partially_settled' END WHERE id=s.id;
 result:=result||completion;
 UPDATE public.festival_settlement_processing_requests SET response=result,completed_at=now() WHERE id=q.id;
 RETURN result;
END $$;

ALTER FUNCTION public.retry_festival_settlement_liabilities(uuid,integer,uuid) RENAME TO _retry_festival_settlement_without_request;
CREATE FUNCTION public.retry_festival_settlement_liabilities(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; q public.festival_settlement_processing_requests%ROWTYPE; d text; result jsonb; tier int; completion jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 d:=public.festival_json_content_digest(jsonb_build_object('settlementId',s.id,'version',p_expected_version,'calculationDigest',s.calculation_digest,'action','retry'),ARRAY[]::text[]);
 INSERT INTO public.festival_settlement_processing_requests(settlement_id,action,idempotency_key,request_digest,settlement_version,calculation_digest)
 VALUES(s.id,'retry',p_idempotency_key,d,p_expected_version,s.calculation_digest) ON CONFLICT DO NOTHING;
 SELECT * INTO q FROM public.festival_settlement_processing_requests WHERE settlement_id=s.id AND action='retry' AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF q.request_digest<>d OR q.settlement_version<>p_expected_version OR q.calculation_digest<>s.calculation_digest THEN RAISE EXCEPTION 'festival_settlement_processing_idempotency_conflict'; END IF;
 IF q.completed_at IS NOT NULL THEN RETURN q.response; END IF;
 SELECT min(priority) INTO tier FROM public.festival_settlement_liabilities WHERE settlement_id=s.id AND status IN('outstanding','processing','failed','delayed','disputed');
 -- Hide lower tiers from the legacy worker for this transaction.
 IF tier IS NOT NULL THEN UPDATE public.festival_settlement_liabilities SET next_retry_at='infinity' WHERE settlement_id=s.id AND priority>tier AND status='outstanding'; END IF;
 result:=public._retry_festival_settlement_without_request(s.id,p_expected_version,p_idempotency_key);
 completion:=public._festival_settlement_completion(s.id); result:=result||completion;
 UPDATE public.festival_financial_settlements SET status=CASE WHEN (completion->>'allPayablesResolved')::boolean THEN 'settled' ELSE 'partially_settled' END WHERE id=s.id;
 UPDATE public.festival_settlement_processing_requests SET response=result,completed_at=now() WHERE id=q.id;
 RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid),public.process_festival_settlement(uuid,integer,uuid),public.retry_festival_settlement_liabilities(uuid,integer,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._prepare_festival_settlement_before_component_repair(uuid,integer,uuid),public._process_festival_settlement_without_request(uuid,integer,uuid),public._retry_festival_settlement_without_request(uuid,integer,uuid),public._festival_effective_worked_minutes(uuid),public._festival_sponsor_receivable_in_runtime(uuid,uuid),public.festival_contract_package_digest(jsonb) FROM PUBLIC,anon,authenticated;
