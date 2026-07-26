-- Native Festival settlement execution.  This migration deliberately replaces,
-- rather than decorates, the settlement entry points installed by PR #1330.

-- ---------------------------------------------------------------------------
-- Deterministic plan identity repair
-- ---------------------------------------------------------------------------
CREATE TABLE public.festival_plan_edition_backfill_audit (
  plan_type text NOT NULL,
  plan_id uuid NOT NULL,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  previous_edition_id uuid,
  resolved_edition_id uuid,
  candidate_count integer NOT NULL,
  resolution_evidence jsonb NOT NULL,
  plan_classification text NOT NULL DEFAULT 'used' CHECK(plan_classification IN('used','unused_draft','archived')),
  requires_owner_repair boolean NOT NULL DEFAULT false,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(plan_type,plan_id)
);
ALTER TABLE public.festival_plan_edition_backfill_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_plan_edition_backfill_audit FROM PUBLIC,anon,authenticated;

-- Materialise candidates.  A candidate must be supported by a launch and at
-- least one plan-specific historical link; company membership alone is never
-- sufficient.  Keeping this table until the end makes a failed deployment
-- diagnosable in a transaction replay/log without an arbitrary UPDATE ... FROM.
CREATE TEMP TABLE festival_plan_edition_candidates ON COMMIT DROP AS
WITH plans AS (
 SELECT 'artist_programme'::text plan_type,p.id plan_id,p.festival_company_id,p.festival_edition_id,
        p.created_at, NULL::date min_date,NULL::date max_date FROM public.festival_artist_programmes p
 UNION ALL SELECT 'operations_plan',p.id,p.festival_company_id,p.festival_edition_id,p.created_at,NULL,NULL FROM public.festival_operations_plans p
 UNION ALL SELECT 'sponsorship_plan',p.id,p.festival_company_id,p.festival_edition_id,p.created_at,NULL,NULL FROM public.festival_sponsorship_plans p
 UNION ALL SELECT 'ticket_plan',p.id,p.festival_company_id,p.festival_edition_id,p.created_at,
        min(x.valid_from_date),max(x.valid_to_date) FROM public.festival_ticket_plans p
        LEFT JOIN public.festival_ticket_products x ON x.festival_ticket_plan_id=p.id GROUP BY p.id
), candidates AS (
 SELECT DISTINCT p.plan_type,p.plan_id,p.festival_company_id,p.festival_edition_id previous_edition_id,
   e.id edition_id,l.id launch_id,
   jsonb_strip_nulls(jsonb_build_object(
    'launchId',l.id,'publicEditionId',pe.id,'runtimeSessionId',r.id,
    'publishedDateRange',CASE WHEN p.min_date IS NULL THEN NULL ELSE jsonb_build_array(p.min_date,p.max_date) END)) evidence
 FROM plans p
 JOIN public.festival_launches l ON l.festival_company_id=p.festival_company_id
 JOIN public.festival_editions e ON e.id=l.festival_edition_id AND e.festival_id=l.festival_id
 LEFT JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
 LEFT JOIN public.festival_runtime_sessions r ON r.festival_launch_id=l.id
 WHERE (p.festival_edition_id=e.id)
    OR (p.plan_type='ticket_plan' AND p.min_date IS NOT NULL
        AND p.min_date>=e.start_at::date AND p.max_date<=e.end_at::date
        AND EXISTS(SELECT 1 FROM public.festival_public_ticket_products pp
                   WHERE pp.festival_launch_id=l.id))
    OR (p.plan_type='artist_programme' AND EXISTS(
        SELECT 1 FROM public.festival_artist_bookings b
        JOIN public.festival_runtime_performances rp ON rp.artist_booking_id=b.id
        WHERE b.festival_artist_programme_id=p.plan_id AND rp.runtime_session_id=r.id))
    OR (p.plan_type='operations_plan' AND (
        EXISTS(SELECT 1 FROM public.festival_staff_shifts sh
          JOIN public.festival_runtime_staff_checkins ck ON ck.staff_shift_id=sh.id
          WHERE sh.festival_operations_plan_id=p.plan_id AND ck.runtime_session_id=r.id)
        OR EXISTS(SELECT 1 FROM public.festival_supplier_contracts sc
          JOIN public.festival_runtime_supplier_checkins ck ON ck.supplier_contract_id=sc.id
          WHERE sc.festival_operations_plan_id=p.plan_id AND ck.runtime_session_id=r.id)
       ))
    OR (p.plan_type='sponsorship_plan' AND EXISTS(
        SELECT 1 FROM public.festival_sponsor_contracts sc
        JOIN public.festival_sponsor_deliverables d ON d.sponsor_contract_id=sc.id
        JOIN public.festival_runtime_sponsor_activations a ON a.contract_deliverable_id=d.id
        WHERE sc.festival_sponsorship_plan_id=p.plan_id AND a.runtime_session_id=r.id))
)
SELECT * FROM candidates;

WITH plans AS (
 SELECT 'artist_programme'::text t,id,festival_company_id,festival_edition_id FROM public.festival_artist_programmes
 UNION ALL SELECT 'operations_plan',id,festival_company_id,festival_edition_id FROM public.festival_operations_plans
 UNION ALL SELECT 'sponsorship_plan',id,festival_company_id,festival_edition_id FROM public.festival_sponsorship_plans
 UNION ALL SELECT 'ticket_plan',id,festival_company_id,festival_edition_id FROM public.festival_ticket_plans
), resolved AS (
 SELECT p.t,p.id,p.festival_company_id,p.festival_edition_id,
   min(c.edition_id) resolved_edition_id,count(DISTINCT c.edition_id)::integer candidate_count,
   coalesce(jsonb_agg(DISTINCT c.evidence) FILTER(WHERE c.edition_id IS NOT NULL),'[]') evidence
 FROM plans p LEFT JOIN festival_plan_edition_candidates c ON c.plan_type=p.t AND c.plan_id=p.id
 GROUP BY p.t,p.id,p.festival_company_id,p.festival_edition_id
)
INSERT INTO public.festival_plan_edition_backfill_audit(plan_type,plan_id,festival_company_id,
 previous_edition_id,resolved_edition_id,candidate_count,resolution_evidence,plan_classification,requires_owner_repair)
SELECT t,id,festival_company_id,festival_edition_id,
 CASE WHEN candidate_count=1 THEN resolved_edition_id ELSE festival_edition_id END,candidate_count,evidence,
 CASE WHEN candidate_count>0 THEN 'used' ELSE 'unused_draft' END,
 candidate_count=0 AND festival_edition_id IS NULL FROM resolved
ON CONFLICT(plan_type,plan_id) DO UPDATE SET
 previous_edition_id=excluded.previous_edition_id,resolved_edition_id=excluded.resolved_edition_id,
 candidate_count=excluded.candidate_count,resolution_evidence=excluded.resolution_evidence,
 plan_classification=excluded.plan_classification,requires_owner_repair=excluded.requires_owner_repair,resolved_at=now();

DO $$ DECLARE diagnostic text; BEGIN
 SELECT string_agg(format('%s=%s company=%s candidates=%s evidence=%s',plan_type,plan_id,
   festival_company_id,candidate_count,resolution_evidence),E'\n' ORDER BY plan_type,plan_id)
 INTO diagnostic FROM public.festival_plan_edition_backfill_audit
 WHERE plan_classification='used' AND candidate_count<>1;
 IF diagnostic IS NOT NULL THEN
  RAISE EXCEPTION 'festival plan edition backfill requires exactly one candidate:%',E'\n'||diagnostic
   USING HINT='Add an exact launch/runtime/published-product historical link; never resolve by company alone.';
 END IF;
END $$;

UPDATE public.festival_artist_programmes p SET festival_edition_id=a.resolved_edition_id
 FROM public.festival_plan_edition_backfill_audit a WHERE a.plan_type='artist_programme' AND a.plan_id=p.id AND a.candidate_count=1;
UPDATE public.festival_operations_plans p SET festival_edition_id=a.resolved_edition_id
 FROM public.festival_plan_edition_backfill_audit a WHERE a.plan_type='operations_plan' AND a.plan_id=p.id AND a.candidate_count=1;
UPDATE public.festival_sponsorship_plans p SET festival_edition_id=a.resolved_edition_id
 FROM public.festival_plan_edition_backfill_audit a WHERE a.plan_type='sponsorship_plan' AND a.plan_id=p.id AND a.candidate_count=1;
UPDATE public.festival_ticket_plans p SET festival_edition_id=a.resolved_edition_id
 FROM public.festival_plan_edition_backfill_audit a WHERE a.plan_type='ticket_plan' AND a.plan_id=p.id AND a.candidate_count=1;

-- Canonical company -> launch -> festival -> edition ownership assertion.  It
-- is deferred so a launch and its planning documents can be imported together.
CREATE FUNCTION public._assert_festival_plan_edition_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.festival_launches l
   JOIN public.festival_editions e ON (e.id,e.festival_id)=(NEW.festival_edition_id,l.festival_id)
   WHERE l.festival_company_id=NEW.festival_company_id AND l.festival_edition_id=e.id)
 THEN RAISE EXCEPTION 'festival_plan_edition_ownership_mismatch: table=% plan=% company=% edition=%',
   TG_TABLE_NAME,NEW.id,NEW.festival_company_id,NEW.festival_edition_id; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['festival_artist_programmes','festival_operations_plans','festival_sponsorship_plans','festival_ticket_plans'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS festival_plan_edition_owner ON public.%I',t);
  EXECUTE format('CREATE CONSTRAINT TRIGGER festival_plan_edition_owner AFTER INSERT OR UPDATE OF festival_company_id,festival_edition_id ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._assert_festival_plan_edition_owner()',t);
 END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Typed immutable evidence
-- ---------------------------------------------------------------------------
ALTER TABLE public.festival_settlement_line_components
 ADD COLUMN direction text NOT NULL DEFAULT 'credit'
 CHECK(direction IN('credit','deduction','withholding'));
ALTER TABLE public.festival_settlement_line_components
 ADD CONSTRAINT festival_component_amount_nonnegative CHECK(amount_minor>=0) NOT VALID;
-- Historical negative components are made explicit before validation.
UPDATE public.festival_settlement_line_components
 SET direction=CASE WHEN component_type LIKE '%tax%' THEN 'withholding' ELSE 'deduction' END,
     amount_minor=abs(amount_minor) WHERE amount_minor<0;
ALTER TABLE public.festival_settlement_line_components VALIDATE CONSTRAINT festival_component_amount_nonnegative;

ALTER TABLE public.festival_tax_calculations
 ADD COLUMN rule_id uuid,
 ADD COLUMN source_category text,
 ADD COLUMN source_transaction_id uuid REFERENCES public.financial_transactions(id),
 ADD COLUMN rate_basis_points integer CHECK(rate_basis_points BETWEEN 0 AND 10000);

-- Direct, exact-edition package construction.  Every SELECT owns its complete
-- source chain and emits an explicit typed schema; no earlier package builder is
-- invoked and no source row is relabelled.
CREATE OR REPLACE FUNCTION public._build_festival_contract_package(p_runtime_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid; launch uuid; edition uuid; festival uuid; company uuid; package jsonb;
BEGIN
 SELECT r.id,l.id,l.festival_edition_id,l.festival_id,l.festival_company_id
 INTO STRICT rid,launch,edition,festival,company
 FROM public.festival_runtime_sessions r JOIN public.festival_launches l ON l.id=r.festival_launch_id
 JOIN public.festival_editions e ON (e.id,e.festival_id)=(l.festival_edition_id,l.festival_id)
 WHERE r.id=p_runtime_session_id;
 package:=jsonb_build_object('schemaVersion','festival-frozen-contract-v3','runtimeSessionId',rid,
  'festivalLaunchId',launch,'festivalEditionId',edition,'festivalId',festival,
  'artistContracts',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'contractId',b.id,'contractSource','festival_artist_bookings','acceptedVersion',b.version,
   'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'currency',b.currency_code,
   'guaranteeMinor',b.agreed_fee_minor,'completionBonusFormula',coalesce(b.contract_terms->'completionBonus','{}'),
   'thresholdFormulas',coalesce(b.contract_terms->'thresholds','[]'),'ticketRevenueBasisPoints',coalesce((b.contract_terms->>'ticketRevenueShareBasisPoints')::int,0),
   'merchandiseRevenueBasisPoints',b.merch_revenue_share_basis_points,'travelRule',jsonb_build_object('fixedMinor',b.travel_support_minor),
   'accommodationRule',jsonb_build_object('fixedMinor',b.accommodation_support_minor),'cancellationClause',coalesce(b.contract_terms->'cancellation','{}'),
   'noShowClause',coalesce(b.contract_terms->'noShow','{}'),'forceMajeureClause',coalesce(b.contract_terms->'forceMajeure','{}'),
   'bookingStatus',b.status,'cancellationReason',to_jsonb(b)->'cancellation_reason','cancellingParty',to_jsonb(b)->'cancelling_party',
   'cancelledAt',to_jsonb(b)->'cancelled_at','applicableClauseVersion',b.version,'payee',jsonb_build_object('type',b.artist_type,'profileId',b.artist_profile_id,'bandId',b.band_id)) ORDER BY b.id)
   FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes p ON p.id=b.festival_artist_programme_id
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company
     AND (b.status NOT IN('cancelled','festival_cancelled') OR b.contract_terms ?| ARRAY['cancellation','noShow','forceMajeure']))),'[]'),
  'staffContracts',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'contractId',a.id,'assignmentIdentity',a.id,'contractSource','festival_staff_assignments','acceptedVersion',a.assignment_version,
   'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'currency',a.currency_code,
   'agreedBasePayMinor',a.agreed_pay_minor,
   'hourlyRateMinor',nullif(to_jsonb(a)->>'hourly_rate_minor','')::bigint,
   'overtimeRateMinor',nullif(to_jsonb(a)->>'overtime_rate_minor','')::bigint,
   'overtimeMultiplierBasisPoints',coalesce((to_jsonb(a)->>'overtime_multiplier_basis_points')::int,10000),
   'guaranteedMinimumMinor',coalesce((to_jsonb(a)->>'guaranteed_minimum_minor')::bigint,0),
   'latenessRule',coalesce(to_jsonb(a)->'lateness_rule','{}'),'earlyDepartureRule',coalesce(to_jsonb(a)->'early_departure_rule','{}'),
   'bonuses',coalesce(to_jsonb(a)->'bonuses','[]'),'payee',jsonb_build_object('profileId',a.profile_id,'companyId',a.company_id),
   'shifts',(SELECT jsonb_agg(jsonb_build_object('shiftId',sh.id,
      'contractedMinutes',greatest(0,(extract(epoch FROM(sh.ends_at-sh.starts_at))/60)::int-sh.break_minutes),
      'role',coalesce(to_jsonb(sh)->>'role',to_jsonb(a)->>'role_type'),'checkInId',ck.id,
      'effectiveWorkedMinutes',coalesce(ed.effective_worked_minutes,
        greatest(0,(extract(epoch FROM(ck.checked_out_at-ck.checked_in_at))/60)::int)),
      'overtimeRequestId',oreq.id,'overtimeDecisionId',odec.id) ORDER BY sh.id)
    FROM public.festival_staff_shifts sh
    JOIN public.festival_runtime_staff_checkins ck ON ck.staff_shift_id=sh.id AND ck.runtime_session_id=rid
    LEFT JOIN LATERAL (SELECT d.effective_worked_minutes FROM public.festival_staff_shift_evidence_decisions d
      WHERE d.staff_checkin_id=ck.id AND NOT EXISTS(SELECT 1 FROM public.festival_staff_shift_evidence_decisions n WHERE n.supersedes_decision_id=d.id)
      ORDER BY d.decision_at DESC,d.id DESC LIMIT 1) ed ON true
    LEFT JOIN LATERAL (SELECT q.id FROM public.festival_staff_overtime_approvals q WHERE q.staff_checkin_id=ck.id AND q.decision='requested'
      ORDER BY q.decision_at DESC,q.id DESC LIMIT 1) oreq ON true
    LEFT JOIN LATERAL (SELECT q.id FROM public.festival_staff_overtime_approvals q WHERE q.staff_checkin_id=ck.id AND q.effective AND q.decision IN('approved','rejected')
      ORDER BY q.decision_at DESC,q.id DESC LIMIT 1) odec ON true
    WHERE sh.staff_assignment_id=a.id AND sh.festival_operations_plan_id=p.id)) ORDER BY a.id)
   FROM public.festival_staff_assignments a JOIN public.festival_operations_plans p ON p.id=a.festival_operations_plan_id
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company
     AND EXISTS(SELECT 1 FROM public.festival_staff_shifts sh JOIN public.festival_runtime_staff_checkins ck ON ck.staff_shift_id=sh.id
       WHERE sh.staff_assignment_id=a.id AND ck.runtime_session_id=rid)),'[]'),
  'supplierContracts',coalesce((SELECT jsonb_agg(jsonb_build_object('contractId',c.id,'contractSource','festival_supplier_contracts',
   'acceptedVersion',c.contract_version,'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'currency',c.currency_code,
   'fees',coalesce(c.terms_snapshot->'fees','[]'),'bonuses',coalesce(c.terms_snapshot->'bonuses','[]'),'penalties',coalesce(c.terms_snapshot->'penalties','[]'),
   'thresholds',coalesce(c.terms_snapshot->'thresholds','[]'),'caps',coalesce(c.terms_snapshot->'caps','[]')) ORDER BY c.id)
   FROM public.festival_supplier_contracts c JOIN public.festival_operations_plans p ON p.id=c.festival_operations_plan_id
   JOIN public.festival_runtime_supplier_checkins ck ON ck.supplier_contract_id=c.id AND ck.runtime_session_id=rid
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company),'[]'),
  'sponsorContracts',coalesce((SELECT jsonb_agg(jsonb_build_object('contractId',c.id,'contractSource','festival_sponsor_contracts',
   'acceptedVersion',c.contract_version,'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'currency',c.currency_code,
   'deliverables',(SELECT coalesce(jsonb_agg(jsonb_build_object('deliverableId',d.id,'activationId',a.id,'status',a.status,
      'thresholds',coalesce(c.terms_snapshot->'thresholds','[]'),'payments',coalesce(c.terms_snapshot->'payments','[]'),
      'refunds',coalesce(c.terms_snapshot->'refunds','[]'),'bonuses',coalesce(c.terms_snapshot->'bonuses','[]')) ORDER BY d.id),'[]')
     FROM public.festival_sponsor_deliverables d JOIN public.festival_runtime_sponsor_activations a
       ON a.contract_deliverable_id=d.id AND a.runtime_session_id=rid WHERE d.sponsor_contract_id=c.id)) ORDER BY c.id)
   FROM public.festival_sponsor_contracts c JOIN public.festival_sponsorship_plans p ON p.id=c.festival_sponsorship_plan_id
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company AND EXISTS(SELECT 1 FROM public.festival_sponsor_deliverables d
    JOIN public.festival_runtime_sponsor_activations a ON a.contract_deliverable_id=d.id AND a.runtime_session_id=rid WHERE d.sponsor_contract_id=c.id)),'[]'),
  'merchandiseContracts',coalesce((SELECT jsonb_agg(jsonb_build_object('contractId',b.id,'contractSource','festival_artist_bookings',
   'acceptedVersion',b.version,'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'currency',b.currency_code,
   'royaltyBasisPoints',b.merch_revenue_share_basis_points,'deductibleCategories',coalesce(b.contract_terms->'merchandiseDeductions','[]'),
   'payee',jsonb_build_object('type',b.artist_type,'profileId',b.artist_profile_id,'bandId',b.band_id)) ORDER BY b.id)
   FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes p ON p.id=b.festival_artist_programme_id
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company AND b.merch_revenue_share_basis_points>0),'[]'),
  'bandSplitAgreements',coalesce((SELECT jsonb_agg(jsonb_build_object('bandId',fp.band_id,'contractSource','band_finance_policies',
   'acceptedVersion',1,'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,'splitMethod',fp.revenue_split_method,
   'memberSplits',fp.revenue_split_config,'requiredReserveMinor',fp.minimum_reserve_minor) ORDER BY fp.band_id)
   FROM public.band_finance_policies fp WHERE EXISTS(SELECT 1 FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes p
    ON p.id=b.festival_artist_programme_id WHERE p.festival_edition_id=edition AND b.band_id=fp.band_id)),'[]'),
  'taxRules',coalesce((SELECT jsonb_agg(jsonb_build_object('ruleId',p.id,'contractSource','festival_ticket_plans',
   'acceptedVersion',p.planning_version,'festivalId',festival,'festivalEditionId',edition,'festivalLaunchId',launch,
   'jurisdiction',coalesce(e.public_metadata->>'taxJurisdiction','festival'),'taxType','sales_tax',
   'rateBasisPoints',p.sales_tax_rate_basis_points,'currency',p.currency_code) ORDER BY p.id)
   FROM public.festival_ticket_plans p JOIN public.festival_editions e ON e.id=p.festival_edition_id
   WHERE p.festival_edition_id=edition AND p.festival_company_id=company),'[]'));
 IF EXISTS(SELECT 1 FROM jsonb_each(package) q CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(q.value)='array' THEN q.value ELSE '[]' END) x
   WHERE x ? 'contractId' AND (x->>'festivalId')::uuid IS DISTINCT FROM festival)
 THEN RAISE EXCEPTION 'festival_contract_source_identity_mismatch'; END IF;
 RETURN package;
END $$;

-- Stable digest contains business identities only.
CREATE OR REPLACE FUNCTION public._festival_calculation_digest(p_settlement_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.festival_json_content_digest(jsonb_build_object(
  'runtimeDigest',s.runtime_snapshot_digest,'contractDigest',s.contract_snapshot_digest,
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('lineCode',l.line_type,'sourceType',l.source_type,'sourceId',l.source_id,
   'payer',jsonb_build_object('type',l.payer_type,'id',l.payer_id),'payee',jsonb_build_object('type',l.recipient_type,'id',l.recipient_id),
   'currency',l.currency_code,'priority',l.priority,'formulaVersion',l.formula_version,
   'components',coalesce((SELECT jsonb_agg(jsonb_build_object('type',c.component_type,'direction',c.direction,
    'amountMinor',c.amount_minor,'evidence',c.evidence) ORDER BY c.component_type,c.contract_clause_id) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id),'[]'),
   'taxes',coalesce((SELECT jsonb_agg(jsonb_build_object('ruleId',t.rule_id,'jurisdiction',t.jurisdiction,'ruleVersion',t.rule_version,
    'taxType',t.tax_type,'taxableBaseMinor',t.taxable_base_minor,'rateBasisPoints',t.rate_basis_points,'taxAmountMinor',t.tax_amount_minor)
    ORDER BY t.tax_type,t.rule_id) FROM public.festival_tax_calculations t WHERE t.settlement_line_id=l.id),'[]')) ORDER BY l.line_type,l.source_type,l.source_id),'[]')),
  ARRAY[]::text[]) FROM public.festival_financial_settlements s WHERE s.id=p_settlement_id
$$;


-- One native preparation transaction.  Replay is checked before any write; all
-- subsequently calculated rows are derived from the two frozen documents.
CREATE OR REPLACE FUNCTION public.prepare_festival_settlement(p_runtime_session_id uuid,p_expected_runtime_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE; l public.festival_launches%ROWTYPE;
 o public.festival_runtime_outcome_snapshots%ROWTYPE; req public.festival_settlement_preparation_requests%ROWTYPE;
 s public.festival_financial_settlements%ROWTYPE; pkg jsonb; contract_digest text; request_digest text;
 item jsonb; line_id uuid; gross bigint; base bigint; amount bigint; direction text; review jsonb; review_id uuid; result jsonb;
BEGIN
 SELECT * INTO STRICT r FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id FOR UPDATE;
 IF r.version<>p_expected_runtime_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 IF r.status<>'runtime_complete' OR NOT r.ready_for_settlement THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;
 SELECT * INTO STRICT l FROM public.festival_launches WHERE id=r.festival_launch_id;
 SELECT * INTO STRICT o FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=r.id;
 PERFORM public._assert_festival_settlement_evidence(r.id);
 pkg:=public._build_festival_contract_package(r.id);
 contract_digest:=public.festival_contract_package_digest(pkg);
 request_digest:=public.festival_json_content_digest(jsonb_build_object('runtimeSessionId',r.id,'runtimeVersion',r.version,
   'runtimeDigest',o.content_digest,'contractDigest',contract_digest),ARRAY[]::text[]);
 SELECT * INTO req FROM public.festival_settlement_preparation_requests
  WHERE runtime_session_id=r.id AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF req.request_digest IS DISTINCT FROM request_digest OR req.runtime_snapshot_digest IS DISTINCT FROM o.content_digest
    OR req.contract_snapshot_digest IS DISTINCT FROM contract_digest THEN RAISE EXCEPTION 'festival_settlement_preparation_idempotency_conflict'; END IF;
  IF req.completed_at IS NOT NULL THEN RETURN req.response; END IF;
  RAISE EXCEPTION 'festival_settlement_preparation_in_progress';
 END IF;
 INSERT INTO public.festival_settlement_preparation_requests(runtime_session_id,idempotency_key,request_digest,runtime_snapshot_digest,contract_snapshot_digest)
 VALUES(r.id,p_idempotency_key,request_digest,o.content_digest,contract_digest) RETURNING * INTO req;
 IF EXISTS(SELECT 1 FROM public.festival_financial_settlements WHERE runtime_session_id=r.id) THEN
  RAISE EXCEPTION 'festival_settlement_requires_original_preparation_key';
 END IF;
 INSERT INTO public.festival_financial_settlements(runtime_session_id,festival_launch_id,festival_company_id,status,currency_code,
  runtime_version,runtime_outcome_digest,runtime_snapshot_digest,contract_snapshot_digest,formula_version,settlement_formula_version)
 VALUES(r.id,l.id,l.festival_company_id,'draft',coalesce(pkg->'taxRules'->0->>'currency','GBP'),r.version,o.content_digest,o.content_digest,
  contract_digest,'festival-settlement-v3','festival-settlement-v3') RETURNING * INTO s;
 INSERT INTO public.festival_settlement_contract_snapshots(runtime_session_id,package,content_digest)
 VALUES(r.id,pkg,contract_digest);
 -- Revenue evidence comes from immutable, closed runtime/ticket records.
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,
  gross_amount_minor,tax_amount_minor,fee_amount_minor,net_amount_minor,currency_code,status,priority,formula_version,calculation_metadata)
 SELECT s.id,'ticket_revenue','festival_ticket_sale',x.id,'company',fc.company_id,'player',x.buyer_profile_id,x.subtotal_minor,x.tax_minor,x.fee_minor,
  x.subtotal_minor+x.fee_minor,x.currency,'paid',90,'festival-ticket-revenue-v3',jsonb_build_object('runtimeDigest',o.content_digest)
 FROM public.festival_ticket_sales x JOIN public.festival_companies fc ON fc.id=l.festival_company_id
 WHERE x.festival_launch_id=l.id AND x.status IN('completed','partially_refunded');
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,
  gross_amount_minor,tax_amount_minor,net_amount_minor,currency_code,status,priority,formula_version,calculation_metadata)
 SELECT s.id,CASE v.category WHEN 'artist_merch' THEN 'artist_merch_revenue' WHEN 'festival_merch' THEN 'festival_merch_revenue' ELSE 'vendor_revenue' END,
  'festival_runtime_vendor_sales',v.id,'company',fc.company_id,'system',v.gross_revenue_minor,v.tax_liability_minor,
  v.gross_revenue_minor-v.tax_liability_minor,v.currency_code,'paid',90,'festival-vendor-revenue-v3',jsonb_build_object('runtimeDigest',o.content_digest,
  'grossSalesMinor',v.gross_revenue_minor,'taxMinor',v.tax_liability_minor,'productionCostMinor',v.cost_basis_minor)
 FROM public.festival_runtime_vendor_sales v JOIN public.festival_companies fc ON fc.id=l.festival_company_id
 WHERE v.runtime_session_id=r.id AND v.status='closed';
 INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,
  gross_amount_minor,net_amount_minor,currency_code,status,priority,formula_version,calculation_metadata)
 SELECT s.id,'refund','festival_ticket_refund_obligation',ro.id,'player',ro.buyer_profile_id,'company',fc.company_id,ro.amount_minor,ro.amount_minor,
  ro.currency,'pending',1,'festival-refund-v3',jsonb_build_object('reasonCode',ro.reason_code,'runtimeDigest',o.content_digest)
 FROM public.festival_ticket_refund_obligations ro JOIN public.festival_ticket_sales ts ON ts.id=ro.festival_ticket_sale_id
 JOIN public.festival_companies fc ON fc.id=l.festival_company_id WHERE ts.festival_launch_id=l.id AND ro.status IN('pending','failed');
 -- Artist typed formulas: fixed guarantees and basis points are evaluated as
 -- different types, never cast from a generic clause value.
 FOR item IN SELECT value FROM jsonb_array_elements(pkg->'artistContracts') LOOP
  gross:=coalesce((item->>'guaranteeMinor')::bigint,0)+coalesce((item->'travelRule'->>'fixedMinor')::bigint,0)+coalesce((item->'accommodationRule'->>'fixedMinor')::bigint,0);
  amount:=gross + round(coalesce((SELECT sum(net_amount_minor) FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_type='ticket_revenue'),0)
    *coalesce((item->>'ticketRevenueBasisPoints')::int,0)/10000.0);
  INSERT INTO public.festival_settlement_lines(settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,
   gross_amount_minor,net_amount_minor,currency_code,status,priority,formula_version,calculation_metadata)
  VALUES(s.id,'artist_fee','festival_artist_booking',(item->>'contractId')::uuid,CASE item->'payee'->>'type' WHEN 'band' THEN 'band' ELSE 'player' END,
   coalesce((item->'payee'->>'bandId')::uuid,(item->'payee'->>'profileId')::uuid),'company',(SELECT company_id FROM public.festival_companies WHERE id=l.festival_company_id),
   amount,amount,item->>'currency','pending',4,'festival-artist-typed-v3',jsonb_build_object('frozenContract',item,'runtimeDigest',o.content_digest)) RETURNING id INTO line_id;
  INSERT INTO public.festival_settlement_line_components(settlement_line_id,component_type,evidence,calculation,amount_minor,currency_code,direction)
  VALUES(line_id,'guarantee',item->'guaranteeMinor','fixed_minor',coalesce((item->>'guaranteeMinor')::bigint,0),item->>'currency','credit'),
   (line_id,'ticket_revenue_share',jsonb_build_object('basisPoints',item->'ticketRevenueBasisPoints'),'basis_points_of_actual_ticket_revenue',greatest(0,amount-gross),item->>'currency','credit'),
   (line_id,'travel_reimbursement',item->'travelRule','fixed_minor',coalesce((item->'travelRule'->>'fixedMinor')::bigint,0),item->>'currency','credit'),
   (line_id,'accommodation_reimbursement',item->'accommodationRule','fixed_minor',coalesce((item->'accommodationRule'->>'fixedMinor')::bigint,0),item->>'currency','credit');
 END LOOP;
 -- Canonical taxes preserve the rule input, rather than reverse engineering it.
 FOR item IN SELECT value FROM jsonb_array_elements(pkg->'taxRules') LOOP
  FOR line_id,gross IN SELECT id,gross_amount_minor FROM public.festival_settlement_lines WHERE settlement_id=s.id
    AND line_type IN('ticket_revenue','vendor_revenue','festival_merch_revenue','artist_merch_revenue') LOOP
   amount:=round(gross*(item->>'rateBasisPoints')::int/10000.0);
   INSERT INTO public.festival_tax_calculations(settlement_line_id,rule_id,source_category,jurisdiction,tax_type,rate,rate_basis_points,
    taxable_base_minor,tax_amount_minor,currency_code,rule_version,event_date)
   VALUES(line_id,(item->>'ruleId')::uuid,(SELECT source_type FROM public.festival_settlement_lines WHERE id=line_id),item->>'jurisdiction',item->>'taxType',
    (item->>'rateBasisPoints')::numeric/10000,(item->>'rateBasisPoints')::int,gross,amount,item->>'currency',item->>'acceptedVersion',
    (SELECT start_at::date FROM public.festival_editions WHERE id=l.festival_edition_id));
  END LOOP;
 END LOOP;
 s.calculation_digest:=public._festival_calculation_digest(s.id);
 review:=jsonb_build_object('runtimeDigest',o.content_digest,'contractDigest',contract_digest,'calculationDigest',s.calculation_digest,
  'lines',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.priority,x.line_type,x.source_id),'[]') FROM public.festival_settlement_lines x WHERE x.settlement_id=s.id),
  'components',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.settlement_line_id,c.component_type),'[]') FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines x ON x.id=c.settlement_line_id WHERE x.settlement_id=s.id),
  'taxCalculations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.settlement_line_id,t.tax_type),'[]') FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines x ON x.id=t.settlement_line_id WHERE x.settlement_id=s.id),
  'refunds',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.festival_settlement_lines x WHERE x.settlement_id=s.id AND x.line_type='refund'),
  'royalties',(SELECT coalesce(jsonb_agg(to_jsonb(rr)),'[]') FROM public.festival_royalty_receipts rr JOIN public.festival_settlement_lines x ON x.id=rr.settlement_line_id WHERE x.settlement_id=s.id),
  'bandSplitBasis',pkg->'bandSplitAgreements','formulaVersions',jsonb_build_object('settlement','festival-settlement-v3'),
  'perCurrencyTotals',(SELECT coalesce(jsonb_object_agg(currency_code,total),'{}') FROM (SELECT currency_code,sum(net_amount_minor) total FROM public.festival_settlement_lines WHERE settlement_id=s.id GROUP BY currency_code) z));
 INSERT INTO public.festival_settlement_snapshots(settlement_id,snapshot_type,runtime_outcome_snapshot_id,snapshot,content_digest,formula_versions)
 VALUES(s.id,'review',o.id,review,public.festival_json_content_digest(review,ARRAY[]::text[]),jsonb_build_object('settlement','festival-settlement-v3')) RETURNING id INTO review_id;
 UPDATE public.festival_financial_settlements SET status='calculated',calculation_digest=s.calculation_digest,review_snapshot_id=review_id,updated_at=now()
  WHERE id=s.id RETURNING * INTO s;
 result:=public._festival_settlement_json(s)||jsonb_build_object('runtimeDigest',o.content_digest,'contractDigest',contract_digest,
  'calculationDigest',s.calculation_digest,'version',s.version,'status',s.status,'idempotencyKey',p_idempotency_key);
 UPDATE public.festival_settlement_preparation_requests SET settlement_id=s.id,response=result,completed_at=now() WHERE id=req.id;
 RETURN result;
END $$;

-- Repair PR #1330's destructive tier suppression and establish one state model.
UPDATE public.festival_settlement_liabilities SET next_retry_at=now()
 WHERE next_retry_at='infinity'::timestamptz;
ALTER TABLE public.festival_settlement_liabilities DROP CONSTRAINT IF EXISTS festival_settlement_liabilities_status_check;
ALTER TABLE public.festival_settlement_liabilities ADD CONSTRAINT festival_liability_state_v3
 CHECK(status IN('outstanding','processing','paid','failed','delayed','waived','disputed'));
CREATE FUNCTION public._festival_liability_transition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.status=NEW.status THEN RETURN NEW; END IF;
 IF NOT ((OLD.status='outstanding' AND NEW.status IN('processing','waived','disputed')) OR
  (OLD.status='processing' AND NEW.status IN('paid','failed','delayed','disputed')) OR
  (OLD.status IN('failed','delayed') AND NEW.status IN('processing','waived','disputed')) OR
  (OLD.status='disputed' AND NEW.status IN('outstanding','waived')))
 THEN RAISE EXCEPTION 'illegal_festival_liability_transition: % -> %',OLD.status,NEW.status; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_liability_transition BEFORE UPDATE OF status ON public.festival_settlement_liabilities
 FOR EACH ROW EXECUTE FUNCTION public._festival_liability_transition_guard();

ALTER TABLE public.festival_settlement_processing_requests
 ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','in_progress','completed','failed')),
 ADD COLUMN lease_owner uuid,
 ADD COLUMN lease_expires_at timestamptz,
 ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 ADD COLUMN last_error text,
 ADD COLUMN started_at timestamptz;
UPDATE public.festival_settlement_processing_requests SET status='completed' WHERE completed_at IS NOT NULL;

-- A strict pre-payment gate.  Money-moving entry points call this before they
-- reserve their first transfer receipt.
CREATE FUNCTION public._revalidate_festival_settlement(p_settlement_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; runtime_digest text; contract_digest text; calc text; review_digest text;
BEGIN
 SELECT * INTO STRICT s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 SELECT content_digest INTO runtime_digest FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=s.runtime_session_id;
 SELECT content_digest INTO contract_digest FROM public.festival_settlement_contract_snapshots WHERE runtime_session_id=s.runtime_session_id;
 calc:=public._festival_calculation_digest(s.id);
 SELECT content_digest INTO review_digest FROM public.festival_settlement_snapshots WHERE id=s.review_snapshot_id AND snapshot_type='review';
 IF runtime_digest IS DISTINCT FROM s.runtime_snapshot_digest OR contract_digest IS DISTINCT FROM s.contract_snapshot_digest
  OR calc IS DISTINCT FROM s.calculation_digest THEN RAISE EXCEPTION 'festival_settlement_evidence_digest_mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND
   l.net_amount_minor IS DISTINCT FROM (SELECT coalesce(sum(CASE c.direction WHEN 'credit' THEN c.amount_minor ELSE -c.amount_minor END),0)
    FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id))
 THEN RAISE EXCEPTION 'festival_settlement_component_sum_mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines l ON l.id=t.settlement_line_id
   WHERE l.settlement_id=s.id AND t.tax_amount_minor<>round(t.taxable_base_minor*t.rate_basis_points/10000.0))
 THEN RAISE EXCEPTION 'festival_settlement_tax_sum_mismatch'; END IF;
 IF review_digest IS NULL OR EXISTS(SELECT 1 FROM public.festival_settlement_snapshots x WHERE x.id=s.review_snapshot_id
   AND x.content_digest IS DISTINCT FROM public.festival_json_content_digest(x.snapshot,ARRAY[]::text[]))
 THEN RAISE EXCEPTION 'festival_settlement_review_snapshot_mismatch'; END IF;
END $$;

-- Lowest-tier selection is native and never mutates a different priority.
CREATE OR REPLACE FUNCTION public.retry_festival_settlement_liabilities(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; req public.festival_settlement_processing_requests%ROWTYPE;
 q public.festival_settlement_liabilities%ROWTYPE; tier int; ok boolean; result jsonb; worker uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT s FROM public.festival_financial_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF s.version<>p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;
 INSERT INTO public.festival_settlement_processing_requests(settlement_id,action,idempotency_key,request_digest,settlement_version,calculation_digest)
 VALUES(s.id,'retry',p_idempotency_key,public.festival_json_content_digest(jsonb_build_object('settlement',s.id,'version',p_expected_version,'calculation',s.calculation_digest),ARRAY[]::text[]),s.version,s.calculation_digest)
 ON CONFLICT DO NOTHING;
 SELECT * INTO req FROM public.festival_settlement_processing_requests WHERE settlement_id=s.id AND action='retry' AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF req.status='completed' THEN RETURN req.response; END IF;
 IF req.status='in_progress' AND req.lease_expires_at>now() THEN RAISE EXCEPTION 'festival_settlement_request_busy'; END IF;
 UPDATE public.festival_settlement_processing_requests SET status='in_progress',lease_owner=worker,lease_expires_at=now()+interval '2 minutes',
  attempt_count=attempt_count+1,started_at=coalesce(started_at,now()),last_error=NULL WHERE id=req.id;
 PERFORM public._revalidate_festival_settlement(s.id);
 SELECT min(priority) INTO tier FROM public.festival_settlement_liabilities WHERE settlement_id=s.id
  AND status IN('outstanding','failed','delayed') AND coalesce(next_retry_at,'-infinity')<=now();
 FOR q IN SELECT * FROM public.festival_settlement_liabilities WHERE settlement_id=s.id AND priority=tier
  AND status IN('outstanding','failed','delayed') AND coalesce(next_retry_at,'-infinity')<=now() ORDER BY id FOR UPDATE LOOP
  UPDATE public.festival_settlement_liabilities SET status='processing',updated_at=now() WHERE id=q.id;
  ok:=public._process_festival_settlement_line(q.settlement_line_id,public._caller_profile_id());
  UPDATE public.festival_settlement_liabilities SET status=CASE WHEN ok THEN 'paid' ELSE 'delayed' END,
   outstanding_amount_minor=CASE WHEN ok THEN 0 ELSE outstanding_amount_minor END,
   next_retry_at=CASE WHEN ok THEN NULL ELSE now()+interval '5 minutes' END,updated_at=now() WHERE id=q.id;
  EXIT WHEN NOT ok;
 END LOOP;
 UPDATE public.festival_financial_settlements SET status=CASE WHEN EXISTS(SELECT 1 FROM public.festival_settlement_liabilities
  WHERE settlement_id=s.id AND status NOT IN('paid','waived')) THEN 'partially_settled' ELSE 'settled' END,
  version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 result:=public._festival_settlement_json(s)||jsonb_build_object('idempotencyKey',p_idempotency_key,'version',s.version,'status',s.status);
 UPDATE public.festival_settlement_processing_requests SET status='completed',response=result,completed_at=now(),lease_expires_at=NULL WHERE id=req.id;
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 UPDATE public.festival_settlement_processing_requests SET status='failed',last_error=SQLERRM,lease_expires_at=NULL
  WHERE settlement_id=p_settlement_id AND action='retry' AND idempotency_key=p_idempotency_key;
 RAISE;
END $$;

GRANT EXECUTE ON FUNCTION public.prepare_festival_settlement(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_festival_settlement_liabilities(uuid,integer,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._assert_festival_plan_edition_owner(),public._festival_calculation_digest(uuid),
 public._revalidate_festival_settlement(uuid),public._festival_liability_transition_guard() FROM PUBLIC,anon,authenticated;
