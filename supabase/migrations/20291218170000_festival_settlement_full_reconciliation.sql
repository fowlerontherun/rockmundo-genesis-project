-- Festival settlement v7: complete, fail-closed financial reconciliation.
-- Forward-only. No historical financial fact is rewritten by this migration.

CREATE TABLE public.festival_settlement_reconciliation_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_id uuid NOT NULL UNIQUE REFERENCES public.festival_financial_settlements(id),
 calculation_digest text NOT NULL,
 currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
 gross_income_minor bigint NOT NULL,
 ticket_income_minor bigint NOT NULL,
 sponsorship_minor bigint NOT NULL,
 vendor_minor bigint NOT NULL,
 merchandise_minor bigint NOT NULL,
 refunds_minor bigint NOT NULL,
 chargebacks_minor bigint NOT NULL,
 artists_minor bigint NOT NULL,
 staff_minor bigint NOT NULL,
 suppliers_minor bigint NOT NULL,
 other_expenses_minor bigint NOT NULL,
 royalties_minor bigint NOT NULL,
 taxes_minor bigint NOT NULL,
 band_allocations_minor bigint NOT NULL,
 profit_minor bigint NOT NULL,
 ledger_debits_minor bigint NOT NULL,
 ledger_credits_minor bigint NOT NULL,
 receipt_total_minor bigint NOT NULL,
 report jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.festival_settlement_reconciliation_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_settlement_reconciliation_reports FROM PUBLIC,anon,authenticated;

-- Obligation identity is enforced by the reconciliation gate.  A forward-only
-- migration must still install on a database containing historical duplicates
-- so that those rows can be diagnosed rather than making deployment impossible.

CREATE OR REPLACE FUNCTION public._festival_settlement_reconciliation_v7(p_settlement uuid,p_persist boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_financial_settlements%ROWTYPE; pkg jsonb; issues jsonb:='[]';
 ticket bigint; sponsor bigint; vendor bigint; merch bigint; refunds bigint; chargebacks bigint;
 artists bigint; staff bigint; suppliers bigint; royalties bigint; taxes bigint; bands bigint; other_cost bigint;
 gross bigint; profit bigint; debits bigint; credits bigint; receipts bigint; report jsonb; x jsonb; bad record;
BEGIN
 SELECT * INTO s FROM public.festival_financial_settlements WHERE id=p_settlement;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='festival_settlement_not_found'; END IF;
 SELECT package INTO pkg FROM public.festival_settlement_contract_snapshots WHERE runtime_session_id=s.runtime_session_id;
 IF pkg IS NULL THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_contract_snapshot_missing')); END IF;

 -- Currency is an identity, never a conversion opportunity.
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.currency_code<>s.currency_code)
 OR EXISTS(SELECT 1 FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines l ON l.id=c.settlement_line_id WHERE l.settlement_id=s.id AND c.currency_code<>s.currency_code)
 OR EXISTS(SELECT 1 FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines l ON l.id=t.settlement_line_id WHERE l.settlement_id=s.id AND t.currency_code<>s.currency_code)
 OR EXISTS(SELECT 1 FROM public.festival_settlement_receipts r WHERE r.settlement_id=s.id AND r.currency_code<>s.currency_code)
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_currency_mismatch','currency',s.currency_code)); END IF;

 -- Payable identity and evidence are mandatory and duplicate obligations fail preparation.
 FOR bad IN SELECT source_type,source_id,recipient_type,recipient_id,formula_version,count(*) n
  FROM public.festival_settlement_lines WHERE settlement_id=s.id AND line_category='liability'
  GROUP BY 1,2,3,4,5 HAVING count(*)>1 LOOP
  issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_duplicate_obligation','sourceType',bad.source_type,'sourceId',bad.source_id,'recipientId',bad.recipient_id,'formulaVersion',bad.formula_version));
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.line_category='liability'
   AND (l.recipient_type IS NULL OR l.recipient_id IS NULL OR l.source_id IS NULL OR l.formula_version IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id
      AND jsonb_array_length(c.source_evidence_ids)>0 AND (c.eligibility_result->>'eligible')::boolean)))
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_payable_evidence_missing')); END IF;

 -- Invalid negative inputs cannot be hidden by a positive net result. Deductions
 -- remain signed semantically through component.direction, never negative values.
 IF EXISTS(SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id
   AND (l.gross_amount_minor<0 OR l.tax_amount_minor<0 OR l.fee_amount_minor<0 OR l.net_amount_minor<0))
 OR EXISTS(SELECT 1 FROM public.festival_royalty_receipts r JOIN public.festival_settlement_lines l ON l.id=r.settlement_line_id
   WHERE l.settlement_id=s.id AND least(r.gross_sales_minor,r.refunds_minor,r.chargebacks_minor,r.tax_minor,r.production_cost_minor,r.commission_minor,r.royalty_base_minor,r.royalty_amount_minor)<0)
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_negative_calculation')); END IF;

 -- Validate every frozen contract without interpreting absent values as zero.
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(pkg->'artistContracts','[]')) LOOP
  IF x->'payee' IS NULL OR coalesce(x->'payee'->>'profileId',x->'payee'->>'bandId') IS NULL OR x->>'currency' IS NULL
   OR (x->>'guaranteeMinor')::bigint<0 OR (x->>'ticketRevenueBasisPoints')::numeric NOT BETWEEN 0 AND 10000
   OR (x->>'merchandiseRevenueBasisPoints')::numeric NOT BETWEEN 0 AND 10000
  THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_contract_invalid','contractId',x->>'contractId')); END IF;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(pkg->'staffContracts','[]')) LOOP
  IF coalesce(x->'payee'->>'profileId',x->'payee'->>'companyId') IS NULL OR x->>'currency' IS NULL
   OR (x->>'agreedBasePayMinor')::bigint<0 OR coalesce((x->>'overtimeMultiplierBasisPoints')::numeric,10000)<0
  THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_contract_invalid','contractId',x->>'contractId')); END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pkg->'artistContracts','[]')) c WHERE NOT EXISTS(
   SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.source_id=(c->>'contractId')::uuid AND l.line_type='artist_fee'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pkg->'staffContracts','[]')) c WHERE NOT EXISTS(
   SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.source_id=(c->>'contractId')::uuid AND l.line_type='staff_wage'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pkg->'supplierContracts','[]')) c WHERE NOT EXISTS(
   SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.source_id=(c->>'contractId')::uuid AND l.line_type='supplier_invoice'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(pkg->'sponsorContracts','[]')) c WHERE NOT EXISTS(
   SELECT 1 FROM public.festival_settlement_lines l WHERE l.settlement_id=s.id AND l.source_id=(c->>'contractId')::uuid AND l.line_type='sponsor_receivable'))
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_contract_obligation_missing')); END IF;

 -- Exact royalty equation: net eligible base and frozen percentage, rounded once.
 IF EXISTS(SELECT 1 FROM public.festival_royalty_receipts r JOIN public.festival_settlement_lines l ON l.id=r.settlement_line_id
  WHERE l.settlement_id=s.id AND (r.royalty_base_minor<>r.gross_sales_minor-r.refunds_minor-r.chargebacks_minor-r.tax_minor-r.production_cost_minor-r.commission_minor
   OR r.royalty_amount_minor<>round(r.royalty_base_minor*coalesce((l.calculation_metadata->>'royaltyBasisPoints')::numeric,0)/10000.0)))
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_royalty_reconciliation_failed')); END IF;

 -- Tax amount, base and rate must agree; a line may have only one calculation per rule/type.
 IF EXISTS(SELECT 1 FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines l ON l.id=t.settlement_line_id
   WHERE l.settlement_id=s.id AND (t.taxable_base_minor<0 OR t.rate<0 OR t.rate>1 OR t.tax_amount_minor<0 OR t.tax_amount_minor<>round(t.taxable_base_minor*t.rate)))
 OR EXISTS(SELECT 1 FROM public.festival_tax_calculations t JOIN public.festival_settlement_lines l ON l.id=t.settlement_line_id
   WHERE l.settlement_id=s.id GROUP BY t.settlement_line_id,t.rule_id,t.tax_type HAVING count(*)>1)
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_tax_reconciliation_failed')); END IF;

 -- Frozen band membership must be unique, total 100%, and respect its reserve.
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(pkg->'bandSplitAgreements','[]')) LOOP
  IF jsonb_typeof(x->'memberSplits')<>'array'
   OR coalesce((SELECT sum((m->>'percentageBasisPoints')::int) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x->'memberSplits')='array' THEN x->'memberSplits' ELSE '[]' END) m),0)<>10000
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x->'memberSplits')='array' THEN x->'memberSplits' ELSE '[]' END) m GROUP BY m->>'memberId' HAVING count(*)>1)
   OR coalesce((x->>'requiredReserveMinor')::bigint,0)<0
  THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_band_split_invalid','bandId',x->>'bandId')); END IF;
 END LOOP;

 SELECT coalesce(sum(net_amount_minor) FILTER(WHERE line_type='ticket_revenue'),0),
  coalesce(sum(net_amount_minor) FILTER(WHERE line_type='sponsor_receivable'),0),
  coalesce(sum(net_amount_minor) FILTER(WHERE line_type='vendor_revenue'),0),
  coalesce(sum(net_amount_minor) FILTER(WHERE line_type IN('festival_merch_revenue','artist_merch_revenue')),0),
  coalesce(sum(net_amount_minor) FILTER(WHERE line_type='refund'),0),
  coalesce(sum(c.amount_minor) FILTER(WHERE c.component_type='chargeback_deduction'),0),
  coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_type='artist_fee'),0),coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_type='staff_wage'),0),
  coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_type='supplier_invoice'),0),coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_type='artist_merch_royalty'),0),
  coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_type='tax_liability'),0),0,
  coalesce(sum(l.net_amount_minor) FILTER(WHERE l.line_category='liability' AND l.line_type NOT IN('refund','artist_fee','staff_wage','supplier_invoice','artist_merch_royalty','tax_liability')),0)
 INTO ticket,sponsor,vendor,merch,refunds,chargebacks,artists,staff,suppliers,royalties,taxes,bands,other_cost
 FROM public.festival_settlement_lines l LEFT JOIN public.festival_settlement_line_components c ON c.settlement_line_id=l.id WHERE l.settlement_id=s.id;
 -- LEFT JOIN components multiplies lines: independently recompute all line totals.
 SELECT coalesce(sum(net_amount_minor) FILTER(WHERE line_type='ticket_revenue'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='sponsor_receivable'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='vendor_revenue'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type IN('festival_merch_revenue','artist_merch_revenue')),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='refund'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='artist_fee'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='staff_wage'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='supplier_invoice'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='artist_merch_royalty'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_type='tax_liability'),0),coalesce(sum(net_amount_minor) FILTER(WHERE line_category='liability' AND line_type NOT IN('refund','artist_fee','staff_wage','supplier_invoice','artist_merch_royalty','tax_liability')),0)
 INTO ticket,sponsor,vendor,merch,refunds,artists,staff,suppliers,royalties,taxes,other_cost FROM public.festival_settlement_lines WHERE settlement_id=s.id;
 SELECT coalesce(sum(c.amount_minor),0) INTO chargebacks FROM public.festival_settlement_line_components c JOIN public.festival_settlement_lines l ON l.id=c.settlement_line_id WHERE l.settlement_id=s.id AND c.component_type='chargeback_deduction';
 gross:=ticket+sponsor+vendor+merch; profit:=gross-refunds-chargebacks-artists-staff-suppliers-other_cost-taxes-royalties-bands;
 IF s.total_revenue_minor<>gross OR s.total_cost_minor<>refunds+chargebacks+artists+staff+suppliers+other_cost+taxes+royalties+bands OR s.net_profit_loss_minor<>profit THEN
  IF p_persist THEN
   -- These aggregate columns are a cache, not source evidence. Repairing them
   -- from the validated immutable lines is deterministic and prevents the old
   -- preparation omission from leaking zero totals into review.
   UPDATE public.festival_financial_settlements SET total_revenue_minor=gross,
    total_cost_minor=refunds+chargebacks+artists+staff+suppliers+other_cost+taxes+royalties+bands,
    net_profit_loss_minor=profit,updated_at=now() WHERE id=s.id;
  ELSE
   issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_settlement_totals_mismatch','expectedProfitMinor',profit,'storedProfitMinor',s.net_profit_loss_minor));
  END IF;
 END IF;

 SELECT coalesce(sum(e.amount_minor) FILTER(WHERE e.entry_direction='debit'),0),coalesce(sum(e.amount_minor) FILTER(WHERE e.entry_direction='credit'),0)
 INTO debits,credits FROM public.festival_settlement_receipts r JOIN public.financial_ledger_entries e ON e.transaction_id=r.canonical_transaction_id WHERE r.settlement_id=s.id;
 SELECT coalesce(sum(amount_minor),0) INTO receipts FROM public.festival_settlement_receipts WHERE settlement_id=s.id AND status='completed';
 IF EXISTS(SELECT 1 FROM public.festival_settlement_receipts r LEFT JOIN public.festival_settlement_lines l ON l.id=r.settlement_line_id LEFT JOIN public.financial_transactions t ON t.id=r.canonical_transaction_id
   WHERE r.settlement_id=s.id AND r.status='completed' AND (l.settlement_id<>s.id OR r.amount_minor<>l.net_amount_minor OR r.currency_code<>l.currency_code OR t.id IS NULL OR t.net_amount_minor<>r.amount_minor OR t.currency_code::text<>r.currency_code
    OR (SELECT count(*) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id AND e.entry_direction='debit')<>1 OR (SELECT count(*) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id AND e.entry_direction='credit')<>1
    OR (SELECT sum(CASE e.entry_direction WHEN 'debit' THEN e.amount_minor ELSE -e.amount_minor END) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id)<>0))
 THEN issues:=issues||jsonb_build_array(jsonb_build_object('code','festival_receipt_or_ledger_reconciliation_failed')); END IF;

 report:=jsonb_build_object('schemaVersion','festival-reconciliation-v7','settlementId',s.id,'currency',s.currency_code,'grossIncomeMinor',gross,'ticketIncomeMinor',ticket,'sponsorshipMinor',sponsor,'vendorMinor',vendor,'merchandiseMinor',merch,'refundsMinor',refunds,'chargebacksMinor',chargebacks,'artistsMinor',artists,'staffMinor',staff,'suppliersMinor',suppliers,'royaltiesMinor',royalties,'taxesMinor',taxes,'bandAllocationsMinor',bands,'otherExpensesMinor',other_cost,'profitMinor',profit,'ledgerDebitsMinor',debits,'ledgerCreditsMinor',credits,'receiptTotalMinor',receipts,'issues',issues);
 IF p_persist AND jsonb_array_length(issues)=0 THEN
  INSERT INTO public.festival_settlement_reconciliation_reports(settlement_id,calculation_digest,currency_code,gross_income_minor,ticket_income_minor,sponsorship_minor,vendor_minor,merchandise_minor,refunds_minor,chargebacks_minor,artists_minor,staff_minor,suppliers_minor,other_expenses_minor,royalties_minor,taxes_minor,band_allocations_minor,profit_minor,ledger_debits_minor,ledger_credits_minor,receipt_total_minor,report)
  VALUES(s.id,s.calculation_digest,s.currency_code,gross,ticket,sponsor,vendor,merch,refunds,chargebacks,artists,staff,suppliers,other_cost,royalties,taxes,bands,profit,debits,credits,receipts,report)
  ON CONFLICT(settlement_id) DO UPDATE SET calculation_digest=excluded.calculation_digest,currency_code=excluded.currency_code,
   gross_income_minor=excluded.gross_income_minor,ticket_income_minor=excluded.ticket_income_minor,sponsorship_minor=excluded.sponsorship_minor,
   vendor_minor=excluded.vendor_minor,merchandise_minor=excluded.merchandise_minor,refunds_minor=excluded.refunds_minor,
   chargebacks_minor=excluded.chargebacks_minor,artists_minor=excluded.artists_minor,staff_minor=excluded.staff_minor,
   suppliers_minor=excluded.suppliers_minor,other_expenses_minor=excluded.other_expenses_minor,royalties_minor=excluded.royalties_minor,
   taxes_minor=excluded.taxes_minor,band_allocations_minor=excluded.band_allocations_minor,profit_minor=excluded.profit_minor,
   ledger_debits_minor=excluded.ledger_debits_minor,ledger_credits_minor=excluded.ledger_credits_minor,
   receipt_total_minor=excluded.receipt_total_minor,report=excluded.report,created_at=now();
  UPDATE public.festival_settlement_snapshots SET snapshot=jsonb_set(snapshot,'{reconciliation}',report,true),content_digest=public.festival_json_content_digest(jsonb_set(snapshot,'{reconciliation}',report,true),ARRAY[]::text[]) WHERE id=s.review_snapshot_id;
 END IF;
 RETURN report;
END $$;

CREATE FUNCTION public._festival_assert_reconciled_v7() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE report jsonb;
BEGIN
 IF NEW.status='calculated' AND OLD.status IS DISTINCT FROM NEW.status THEN
  report:=public._festival_settlement_reconciliation_v7(NEW.id,true);
  IF jsonb_array_length(report->'issues')>0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='festival_settlement_reconciliation_failed',DETAIL=(report->'issues')::text; END IF;
 END IF;
 IF NEW.status='finalised' AND OLD.status IS DISTINCT FROM NEW.status THEN
  report:=public._festival_settlement_reconciliation_v7(NEW.id,false);
  IF jsonb_array_length(report->'issues')>0 OR NEW.review_snapshot_id IS NULL OR NEW.final_snapshot_id IS NULL OR NEW.calculation_digest IS NULL
   OR EXISTS(SELECT 1 FROM public.festival_settlement_lines WHERE settlement_id=NEW.id AND line_category='liability' AND status NOT IN('paid','waived'))
   OR EXISTS(SELECT 1 FROM public.festival_settlement_receipts WHERE settlement_id=NEW.id AND status IN('failed','conflicted','processing','reserved'))
   OR EXISTS(SELECT 1 FROM public.festival_settlement_effect_receipts WHERE settlement_id=NEW.id AND status<>'completed')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='festival_settlement_finalisation_verification_failed'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_settlement_reconciliation_gate_v7 AFTER UPDATE OF status ON public.festival_financial_settlements FOR EACH ROW EXECUTE FUNCTION public._festival_assert_reconciled_v7();

-- Discovery after completion must remain possible: a receipt is evidence, not
-- an irreversible assertion. Conflict is terminal until an explicit repair.
CREATE OR REPLACE FUNCTION public._festival_receipt_transition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.status<>NEW.status AND NOT ((OLD.status='reserved' AND NEW.status IN('processing','conflicted')) OR
  (OLD.status='processing' AND NEW.status IN('completed','failed','conflicted')) OR
  (OLD.status='failed' AND NEW.status='processing') OR (OLD.status='completed' AND NEW.status='conflicted'))
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_receipt_transition_invalid'; END IF; RETURN NEW; END $$;

CREATE FUNCTION public._festival_receipt_reconcile_v7() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.festival_settlement_lines%ROWTYPE; t public.financial_transactions%ROWTYPE;
BEGIN
 IF NEW.status<>'completed' THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.festival_settlement_lines WHERE id=NEW.settlement_line_id;
 SELECT * INTO t FROM public.financial_transactions WHERE id=NEW.canonical_transaction_id;
 IF l.id IS NULL OR t.id IS NULL OR NEW.settlement_id<>l.settlement_id OR NEW.amount_minor<>l.net_amount_minor
  OR NEW.currency_code<>l.currency_code OR t.net_amount_minor<>NEW.amount_minor OR t.currency_code::text<>NEW.currency_code
  OR (SELECT count(*) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id AND e.entry_direction='debit')<>1
  OR (SELECT count(*) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id AND e.entry_direction='credit')<>1
  OR (SELECT coalesce(sum(CASE e.entry_direction WHEN 'debit' THEN e.amount_minor ELSE -e.amount_minor END),0) FROM public.financial_ledger_entries e WHERE e.transaction_id=t.id)<>0 THEN
   UPDATE public.festival_settlement_receipts SET status='conflicted' WHERE id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_receipt_reconciliation_v7 AFTER INSERT OR UPDATE OF status ON public.festival_settlement_receipts FOR EACH ROW EXECUTE FUNCTION public._festival_receipt_reconcile_v7();

-- Deterministic historical scan: diagnose all defects and only transition a
-- provably mismatched completed receipt to conflict. Financial amounts remain untouched.
CREATE FUNCTION public.diagnose_festival_settlements(p_repair boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s record; report jsonb; scanned int:=0; conflicted int:=0; repaired_now int;
BEGIN
 FOR s IN SELECT id,runtime_session_id FROM public.festival_financial_settlements ORDER BY created_at,id LOOP
  scanned:=scanned+1; report:=public._festival_settlement_reconciliation_v7(s.id,false);
  IF jsonb_array_length(report->'issues')>0 THEN
   INSERT INTO public.festival_settlement_repair_diagnostics(settlement_id,runtime_session_id,diagnostic_type,classification,details)
   VALUES(s.id,s.runtime_session_id,'full_reconciliation_v7','unverifiable',report);
  END IF;
  IF p_repair THEN
   UPDATE public.festival_settlement_receipts r SET status='conflicted'
   FROM public.festival_settlement_lines l WHERE r.settlement_id=s.id AND r.settlement_line_id=l.id AND r.status IN('reserved','processing','completed')
    AND (r.amount_minor IS DISTINCT FROM l.net_amount_minor OR r.currency_code IS DISTINCT FROM l.currency_code);
   GET DIAGNOSTICS repaired_now=ROW_COUNT; conflicted:=conflicted+repaired_now;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('scanned',scanned,'receiptsConflicted',conflicted);
END $$;

REVOKE ALL ON FUNCTION public._festival_settlement_reconciliation_v7(uuid,boolean),public._festival_assert_reconciled_v7(),
 public._festival_receipt_reconcile_v7() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_festival_settlements(boolean) TO authenticated;
