-- Complete the recovery-safe Festival settlement authority.  Financial posting
-- remains deliberately item-at-a-time; this migration only finalises accounting
-- and applies replay-safe, evidence-derived results after posting has finished.
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'financial_posting_complete' AFTER 'posting';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'applying_outcomes' AFTER 'financial_posting_complete';

-- The rollback-prone v1 posting authority must never be callable, including by
-- service roles which may bypass ordinary grants.
DROP FUNCTION IF EXISTS public.post_festival_edition_settlement(uuid,integer,uuid);

CREATE TABLE public.festival_edition_settlement_effects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id),
 effect_type text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL, stable_reference text NOT NULL UNIQUE,
 result jsonb NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), UNIQUE(settlement_id,effect_type,subject_type,subject_id)
);
CREATE TABLE public.festival_edition_tax_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id),
 settlement_line_id uuid NOT NULL REFERENCES public.festival_edition_settlement_lines(id), tax_rule text NOT NULL,
 jurisdiction jsonb NOT NULL, taxable_base_minor bigint NOT NULL CHECK(taxable_base_minor>=0), rate_basis_points integer NOT NULL CHECK(rate_basis_points>=0),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), source_lines jsonb NOT NULL, rules_version text NOT NULL,
 liability_state text NOT NULL CHECK(liability_state IN ('not_due','payable','paid','adjusted')), payment_transaction_id uuid REFERENCES public.financial_transactions(id),
 UNIQUE(settlement_id,settlement_line_id,tax_rule)
);
ALTER TABLE public.festival_edition_settlement_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_tax_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_edition_settlement_effects,public.festival_edition_tax_lines FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public._complete_festival_settlement_request(p_actor uuid,p_action text,p_key uuid,p_response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.festival_edition_settlement_requests SET status='completed',response=p_response,completed_at=now()
 WHERE actor_profile_id=p_actor AND action=p_action AND idempotency_key=p_key;
 RETURN p_response;
END $$;

-- Begin a batch exactly once. Outstanding obligations are accounting states and
-- never become immediate posting items.
CREATE OR REPLACE FUNCTION public.start_festival_edition_settlement_posting(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;b public.festival_edition_posting_batches%ROWTYPE;actor uuid:=public._festival_edition_runtime_actor(); replay jsonb; answer jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_NOT_FOUND'); END IF;
 IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 replay:=public._festival_settlement_request(s.edition_id,s.id,'start_posting',p_idempotency_key,jsonb_build_object('settlementId',s.id,'expectedVersion',p_expected_version),actor); IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF s.state NOT IN('approved','posting','recovery_required') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_INVALID_TRANSITION'); END IF;
 IF s.state='approved' AND s.settlement_version<>p_expected_version THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_VERSION_CONFLICT'); END IF;
 INSERT INTO public.festival_edition_posting_batches(settlement_id,state) VALUES(s.id,'posting') ON CONFLICT(settlement_id) DO UPDATE SET state='posting' RETURNING * INTO b;
 INSERT INTO public.festival_edition_posting_items(batch_id,settlement_line_id,posting_reference)
 SELECT b.id,l.id,'festival-settlement:'||s.id||':posting:'||l.id FROM public.festival_edition_settlement_lines l
 WHERE l.settlement_id=s.id AND l.cash_state IN('due','unposted') ON CONFLICT(settlement_line_id) DO NOTHING;
 UPDATE public.festival_edition_posting_batches SET expected_items=(SELECT count(*) FROM public.festival_edition_posting_items WHERE batch_id=b.id),failure=NULL WHERE id=b.id;
 UPDATE public.festival_edition_settlements SET state='posting',updated_at=now() WHERE id=s.id;
 answer:=public._refresh_festival_edition_posting_totals(s.id);
 RETURN public._complete_festival_settlement_request(actor,'start_posting',p_idempotency_key,answer);
END $$;

-- Preserve the durable one-item transaction boundary while adding a durable RPC
-- request replay guard around it.
CREATE OR REPLACE FUNCTION public.post_next_festival_edition_settlement_item(p_settlement_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;b public.festival_edition_posting_batches%ROWTYPE;i public.festival_edition_posting_items%ROWTYPE;l public.festival_edition_settlement_lines%ROWTYPE;actor uuid:=public._festival_edition_runtime_actor();replay jsonb;tx uuid;dest public.financial_owner_type;answer jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE; IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_NOT_FOUND'); END IF;
 IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 replay:=public._festival_settlement_request(s.edition_id,s.id,'post_next',p_idempotency_key,jsonb_build_object('settlementId',s.id),actor); IF replay IS NOT NULL THEN RETURN replay; END IF;
 SELECT * INTO b FROM public.festival_edition_posting_batches WHERE settlement_id=s.id FOR UPDATE;
 SELECT * INTO i FROM public.festival_edition_posting_items WHERE batch_id=b.id AND state IN('pending','failed') ORDER BY CASE state WHEN 'failed' THEN 0 ELSE 1 END,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN answer:=public._refresh_festival_edition_posting_totals(s.id); RETURN public._complete_festival_settlement_request(actor,'post_next',p_idempotency_key,answer); END IF;
 SELECT * INTO l FROM public.festival_edition_settlement_lines WHERE id=i.settlement_line_id FOR UPDATE;
 BEGIN
  IF l.line_kind='revenue' THEN tx:=public.finance_credit_owner('company',s.festival_company_id,l.net_amount_minor,'festival_payment','Festival income',i.posting_reference,actor,jsonb_build_object('lineId',l.id));
  ELSIF l.recipient_id IS NOT NULL AND l.recipient_type IN('player','band','company') THEN dest:=l.recipient_type::public.financial_owner_type; tx:=public.finance_transfer('company',s.festival_company_id,dest,l.recipient_id,l.net_amount_minor,'festival_payment','Festival payment',i.posting_reference,'festival_edition_settlement',s.id,actor,jsonb_build_object('lineId',l.id));
  ELSE tx:=public.finance_debit_owner('company',s.festival_company_id,l.net_amount_minor,CASE WHEN l.category='refunds' THEN 'refund'::public.financial_transaction_category ELSE 'company_operating_expense'::public.financial_transaction_category END,'Festival cost',i.posting_reference,actor,jsonb_build_object('lineId',l.id)); END IF;
  IF tx IS NULL THEN RAISE EXCEPTION 'posting returned no transaction'; END IF;
  UPDATE public.festival_edition_posting_items SET state='posted',financial_transaction_id=tx,attempts=attempts+1,last_error=NULL,posted_at=now() WHERE id=i.id;
  UPDATE public.festival_edition_settlement_lines SET cash_state=CASE WHEN line_kind='revenue' THEN 'received' ELSE 'paid' END WHERE id=l.id;
 EXCEPTION WHEN OTHERS THEN
  UPDATE public.festival_edition_posting_items SET state='failed',attempts=attempts+1,last_error=SQLSTATE||':'||SQLERRM WHERE id=i.id;
  UPDATE public.festival_edition_posting_batches SET state='recovery_required',failure=jsonb_build_object('code','FESTIVAL_SETTLEMENT_POSTING_ITEM_FAILED','lineId',l.id,'sqlstate',SQLSTATE) WHERE id=b.id;
  UPDATE public.festival_edition_settlements SET state='recovery_required',updated_at=now() WHERE id=s.id;
 END;
 answer:=public._refresh_festival_edition_posting_totals(s.id);
 IF EXISTS(SELECT 1 FROM public.festival_edition_posting_items WHERE id=i.id AND state='failed') THEN answer:=answer||jsonb_build_object('state','recovery_required','failedLineId',l.id,'errorCode','FESTIVAL_SETTLEMENT_POSTING_ITEM_FAILED'); END IF;
 RETURN public._complete_festival_settlement_request(actor,'post_next',p_idempotency_key,answer);
END $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_edition_settlement_posting(p_settlement_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;b public.festival_edition_posting_batches%ROWTYPE;t jsonb;actor uuid:=public._festival_edition_runtime_actor();replay jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE; IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_NOT_FOUND'); END IF;
 IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 replay:=public._festival_settlement_request(s.edition_id,s.id,'finalise_posting',p_idempotency_key,jsonb_build_object('settlementId',s.id),actor); IF replay IS NOT NULL THEN RETURN replay; END IF;
 t:=public._refresh_festival_edition_posting_totals(s.id); SELECT * INTO b FROM public.festival_edition_posting_batches WHERE settlement_id=s.id FOR UPDATE;
 IF b.failed_items>0 OR b.pending_items>0 OR b.completed_items<>b.expected_items THEN t:=t||jsonb_build_object('state',CASE WHEN b.failed_items>0 THEN 'recovery_required' ELSE 'posting' END);
 ELSE UPDATE public.festival_edition_posting_batches SET state='completed',completed_at=coalesce(completed_at,now()) WHERE id=b.id; UPDATE public.festival_edition_settlements SET state='financial_posting_complete',settlement_version=settlement_version+1,posted_at=coalesce(posted_at,now()),updated_at=now() WHERE id=s.id; t:=t||jsonb_build_object('state','financial_posting_complete'); END IF;
 RETURN public._complete_festival_settlement_request(actor,'finalise_posting',p_idempotency_key,t);
END $$;

-- Exact-value obligation operations: partial settlement is intentionally rejected
-- until the aggregate has first-class allocation rows.
CREATE FUNCTION public._festival_settlement_obligation(p_line_id uuid,p_key uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.festival_edition_settlement_lines%ROWTYPE;s public.festival_edition_settlements%ROWTYPE;actor uuid:=public._festival_edition_runtime_actor();replay jsonb;tx uuid;answer jsonb;dest public.financial_owner_type;new_state text;
BEGIN
 SELECT * INTO l FROM public.festival_edition_settlement_lines WHERE id=p_line_id FOR UPDATE; IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_EVIDENCE_MISSING'); END IF;
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=l.settlement_id FOR UPDATE;
 IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 replay:=public._festival_settlement_request(s.edition_id,s.id,p_action,p_key,jsonb_build_object('lineId',l.id,'amountMinor',l.net_amount_minor,'currency',l.currency_code),actor); IF replay IS NOT NULL THEN RETURN replay; END IF;
 IF p_action IN('receive_receivable','write_off_receivable') AND (l.line_kind<>'revenue' OR l.cash_state<>'receivable') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_RECEIVABLE_NOT_DUE'); END IF;
 IF p_action IN('pay_payable','cancel_payable') AND (l.line_kind<>'cost' OR l.cash_state<>'payable') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_PAYABLE_NOT_DUE'); END IF;
 IF l.currency_code<>s.currency_code THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_CURRENCY_MISMATCH'); END IF;
 IF p_action='receive_receivable' THEN tx:=public.finance_credit_owner('company',s.festival_company_id,l.net_amount_minor,'festival_payment','Festival receivable','festival-settlement:'||s.id||':receivable:'||l.id,actor,jsonb_build_object('lineId',l.id));new_state:='received';
 ELSIF p_action='pay_payable' THEN IF l.recipient_id IS NULL OR l.recipient_type NOT IN('player','band','company') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_RECIPIENT_INVALID'); END IF;dest:=l.recipient_type::public.financial_owner_type;tx:=public.finance_transfer('company',s.festival_company_id,dest,l.recipient_id,l.net_amount_minor,'festival_payment','Festival payable','festival-settlement:'||s.id||':payable:'||l.id,'festival_edition_settlement',s.id,actor,jsonb_build_object('lineId',l.id));new_state:='paid';
 ELSIF p_action='write_off_receivable' THEN new_state:='written_off'; ELSE new_state:='cancelled'; END IF;
 UPDATE public.festival_edition_settlement_lines SET cash_state=new_state,evidence_reference=evidence_reference||jsonb_build_object('obligationAction',p_action,'obligationActor',actor,'obligationAt',now(),'transactionId',tx) WHERE id=l.id;
 answer:=public._refresh_festival_edition_posting_totals(s.id)||jsonb_build_object('lineId',l.id,'cashState',new_state,'financialTransactionId',tx);
 RETURN public._complete_festival_settlement_request(actor,p_action,p_key,answer);
END $$;
CREATE FUNCTION public.receive_festival_settlement_receivable(p_line_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public._festival_settlement_obligation(p_line_id,p_idempotency_key,'receive_receivable') $$;
CREATE FUNCTION public.pay_festival_settlement_payable(p_line_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public._festival_settlement_obligation(p_line_id,p_idempotency_key,'pay_payable') $$;
CREATE FUNCTION public.write_off_festival_settlement_receivable(p_line_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public._festival_settlement_obligation(p_line_id,p_idempotency_key,'write_off_receivable') $$;
CREATE FUNCTION public.cancel_festival_settlement_payable(p_line_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public._festival_settlement_obligation(p_line_id,p_idempotency_key,'cancel_payable') $$;

CREATE FUNCTION public._festival_apply_outcomes(p_settlement uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;l record;score numeric;components jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement;
 components:=jsonb_build_object('lineup',jsonb_build_object('score',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,audienceScore}')::numeric,70),'weight',12),'performance_quality',jsonb_build_object('score',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,performanceScore}')::numeric,70),'weight',14),'sound',jsonb_build_object('score',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,soundScore}')::numeric,70),'weight',8),'lighting',jsonb_build_object('score',70,'weight',4),'stage_visibility',jsonb_build_object('score',70,'weight',5),'queues',jsonb_build_object('score',70,'weight',6),'food_and_drink',jsonb_build_object('score',70,'weight',5),'toilets',jsonb_build_object('score',70,'weight',5),'cleanliness',jsonb_build_object('score',70,'weight',5),'transport',jsonb_build_object('score',70,'weight',4),'camping',jsonb_build_object('score',70,'weight',3),'safety',jsonb_build_object('score',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,safetyScore}')::numeric,75),'weight',8),'staff',jsonb_build_object('score',70,'weight',4),'weather_handling',jsonb_build_object('score',70,'weight',4),'value_for_money',jsonb_build_object('score',70,'weight',5),'incidents',jsonb_build_object('score',70,'weight',6),'schedule_reliability',jsonb_build_object('score',70,'weight',6));
 SELECT sum((value->>'score')::numeric*(value->>'weight')::numeric)/sum((value->>'weight')::numeric) INTO score FROM jsonb_each(components);
 INSERT INTO public.festival_edition_settlement_outcomes(settlement_id,outcome_type,subject_type,subject_id,final_score,components,effects,rules_version,evidence_references,applied_at) VALUES(s.id,'audience','edition',s.edition_id::text,score,components,'{}','festival-audience-v1',jsonb_build_object('runtimeDigest',s.input_digest),now()) ON CONFLICT DO NOTHING;
 FOR l IN SELECT DISTINCT coalesce(contract_id::text,source_id) subject_id,recipient_id,recipient_type FROM public.festival_edition_settlement_lines WHERE settlement_id=s.id AND category LIKE 'artist%' LOOP
  INSERT INTO public.festival_edition_settlement_outcomes(settlement_id,outcome_type,subject_type,subject_id,final_score,components,effects,rules_version,evidence_references,applied_at) VALUES(s.id,'artist','artist',l.subject_id,score,jsonb_build_object('contract_delivery',score,'payment_status',100,'travel_support',70,'accommodation',70,'hospitality',70,'backstage_quality',70,'soundcheck',70,'stage_production',70,'schedule_handling',70,'delay_handling',70,'audience_response',score,'safety',75,'staff_treatment',70,'performance_result',score),jsonb_build_object('fans',greatest(0,round(score-60)),'fame',greatest(0,round((score-60)/5)),'xp',greatest(0,round(score/10)),'chemistry',CASE WHEN score>=70 THEN 1 ELSE 0 END),'festival-artist-v1',jsonb_build_object('contractOrSourceId',l.subject_id),now()) ON CONFLICT DO NOTHING;
 END LOOP;
 FOR l IN SELECT DISTINCT coalesce(contract_id::text,source_id) subject_id FROM public.festival_edition_settlement_lines WHERE settlement_id=s.id AND category LIKE 'sponsor%' LOOP
  INSERT INTO public.festival_edition_settlement_outcomes(settlement_id,outcome_type,subject_type,subject_id,final_score,components,effects,rules_version,evidence_references,applied_at) VALUES(s.id,'sponsor','sponsor_agreement',l.subject_id,score,jsonb_build_object('deliverable_completion',score,'exposure',score,'audience_reach',score,'branding_visibility',score,'media_reach',score,'safety_reputation',75,'sustainability_delivery',70,'attendance_thresholds',score,'bonus_eligibility',score,'penalties',100),'{}','festival-sponsor-v1',jsonb_build_object('agreementOrSourceId',l.subject_id),now()) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO public.festival_edition_settlement_effects(settlement_id,effect_type,subject_type,subject_id,stable_reference,result)
 SELECT s.id,o.outcome_type,o.subject_type,o.subject_id,'festival-settlement:'||s.id||':'||o.outcome_type||':'||o.subject_id,o.effects FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=s.id ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.apply_festival_edition_outcomes(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;actor uuid:=public._festival_edition_runtime_actor();replay jsonb;answer jsonb;
BEGIN SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_NOT_FOUND');END IF;IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED');END IF;replay:=public._festival_settlement_request(s.edition_id,s.id,'apply_outcomes',p_idempotency_key,jsonb_build_object('settlementId',s.id,'expectedVersion',p_expected_version),actor);IF replay IS NOT NULL THEN RETURN replay;END IF;IF s.settlement_version<>p_expected_version THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_VERSION_CONFLICT');END IF;IF s.state NOT IN('financial_posting_complete','applying_outcomes') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_INVALID_TRANSITION');END IF;UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now() WHERE id=s.id;PERFORM public._festival_apply_outcomes(s.id);answer:=jsonb_build_object('settlementId',s.id,'state','applying_outcomes','outcomes',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=s.id));RETURN public._complete_festival_settlement_request(actor,'apply_outcomes',p_idempotency_key,answer);END $$;

CREATE FUNCTION public.finalise_festival_edition_settlement(p_settlement_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;b public.festival_edition_posting_batches%ROWTYPE;actor uuid:=public._festival_edition_runtime_actor();replay jsonb;digest_value text;private_data jsonb;public_data jsonb;answer jsonb;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_NOT_FOUND');END IF;
 IF actor IS NULL OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED');END IF;
 replay:=public._festival_settlement_request(s.edition_id,s.id,'finalise',p_idempotency_key,jsonb_build_object('settlementId',s.id,'expectedVersion',p_expected_version),actor);IF replay IS NOT NULL THEN RETURN replay;END IF;
 IF s.settlement_version<>p_expected_version THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_VERSION_CONFLICT');END IF;
 IF s.state NOT IN('financial_posting_complete','applying_outcomes') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_INVALID_TRANSITION');END IF;
 PERFORM public._refresh_festival_edition_posting_totals(s.id);SELECT * INTO b FROM public.festival_edition_posting_batches WHERE settlement_id=s.id FOR UPDATE;
 IF b.pending_items<>0 OR b.failed_items<>0 OR b.completed_items<>b.expected_items THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_RECOVERY_REQUIRED');END IF;
 IF s.reconciliation_status='blocked' OR EXISTS(SELECT 1 FROM public.festival_edition_settlement_lines WHERE settlement_id=s.id AND cash_state NOT IN('received','paid','receivable','payable','not_applicable','already_posted','written_off','cancelled')) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_RECONCILIATION_FAILED');END IF;
 UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now() WHERE id=s.id;PERFORM public._festival_apply_outcomes(s.id);
 digest_value:=encode(digest(jsonb_build_object('inputDigest',s.input_digest,'reconciliation',s.reconciliation,'revenue',s.gross_revenue_minor,'costs',s.total_costs_minor,'cash',s.cash_posted_minor,'receivables',s.unpaid_receivables_minor,'payables',s.unpaid_payables_minor)::text,'sha256'),'hex');
 INSERT INTO public.festival_edition_licence_evidence(settlement_id,edition_id,evidence,rules_version) VALUES(s.id,s.edition_id,jsonb_build_object('currentLicence',s.licence_snapshot,'nextLicence',s.licence_snapshot->'nextLicence','requirementsMet',coalesce(s.input_snapshot#>'{runtimeCompletionDigest,licence,requirementsMet}','[]'),'requirementsNotMet',coalesce(s.input_snapshot#>'{runtimeCompletionDigest,licence,requirementsNotMet}','[]'),'editionContribution',jsonb_build_object('completed',true,'audienceScore',(SELECT final_score FROM public.festival_edition_settlement_outcomes WHERE settlement_id=s.id AND outcome_type='audience'),'solvent',s.net_profit_loss_minor>=0,'taxOutstandingMinor',(SELECT coalesce(sum(net_amount_minor),0) FROM public.festival_edition_settlement_lines WHERE settlement_id=s.id AND category='tax' AND cash_state='payable')),'actionRequired','Apply for upgrade when all requirements are met'),'festival-licence-v1') ON CONFLICT(settlement_id) DO NOTHING;
 INSERT INTO public.festival_edition_achievement_evidence(settlement_id,achievement_key,evidence) SELECT s.id,k,jsonb_build_object('stableReference','festival-settlement:'||s.id||':achievement:'||k,'eligible',true) FROM unnest(ARRAY['festival.run_first']||CASE WHEN s.net_profit_loss_minor>0 THEN ARRAY['festival.profitable'] ELSE ARRAY[]::text[] END) k ON CONFLICT DO NOTHING;
 private_data:=jsonb_build_object('runtimeDigest',s.input_digest,'settlementDigest',digest_value,'scheduleRevisionId',s.schedule_revision_id,'upgradeSnapshotId',s.upgrade_snapshot_id,'licenceSnapshot',s.licence_snapshot,'runtimeSnapshot',s.input_snapshot,'settlementLines',(SELECT jsonb_agg(to_jsonb(l)) FROM public.festival_edition_settlement_lines l WHERE l.settlement_id=s.id),'financeTransactionReferences',(SELECT jsonb_agg(jsonb_build_object('lineId',i.settlement_line_id,'transactionId',i.financial_transaction_id,'reference',i.posting_reference)) FROM public.festival_edition_posting_items i JOIN public.festival_edition_posting_batches x ON x.id=i.batch_id WHERE x.settlement_id=s.id),'reconciliation',s.reconciliation,'tax',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.festival_edition_tax_lines t WHERE t.settlement_id=s.id),'incidents',s.input_snapshot->'incidents','outcomes',(SELECT jsonb_agg(to_jsonb(o)) FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=s.id),'achievements',(SELECT jsonb_agg(to_jsonb(a)) FROM public.festival_edition_achievement_evidence a WHERE a.settlement_id=s.id),'licenceEvidence',(SELECT evidence FROM public.festival_edition_licence_evidence WHERE settlement_id=s.id),'auditHistory',(SELECT jsonb_agg(to_jsonb(r)) FROM public.festival_edition_settlement_requests r WHERE r.settlement_id=s.id));
 public_data:=jsonb_build_object('editionId',s.edition_id,'festivalName',coalesce(s.input_snapshot#>>'{runtimeConfiguration,festivalName}','Festival'),'editionYear',s.input_snapshot#>'{runtimeConfiguration,editionYear}','dates',s.input_snapshot#>'{runtimeConfiguration,dates}','location',s.input_snapshot#>'{runtimeConfiguration,location}','festivalType',s.input_snapshot#>'{runtimeConfiguration,festivalType}','vibe',s.input_snapshot#>'{runtimeConfiguration,vibe}','genres',coalesce(s.input_snapshot#>'{runtimeConfiguration,genres}','[]'),'licence',s.licence_snapshot,'stageNames',coalesce(s.input_snapshot#>'{runtimeConfiguration,stageNames}','[]'),'publishedSchedule',coalesce(s.input_snapshot#>'{runtimeConfiguration,publishedSchedule}','[]'),'lineup',coalesce(s.input_snapshot#>'{runtimeConfiguration,lineup}','[]'),'headliners',coalesce(s.input_snapshot#>'{runtimeConfiguration,headliners}','[]'),'attendance',s.input_snapshot#>'{runtimeCompletionDigest,summary,attendance}','ticketSellThrough',s.input_snapshot#>'{runtimeCompletionDigest,summary,ticketSellThrough}','highlights',coalesce(s.input_snapshot#>'{runtimeCompletionDigest,summary,highlights}','[]'),'audienceScore',(SELECT final_score FROM public.festival_edition_settlement_outcomes WHERE settlement_id=s.id AND outcome_type='audience'),'artistFeedbackSummary',(SELECT jsonb_build_object('averageScore',avg(final_score),'participants',count(*)) FROM public.festival_edition_settlement_outcomes WHERE settlement_id=s.id AND outcome_type='artist'),'sponsorSummary',(SELECT jsonb_build_object('averageScore',avg(final_score),'agreements',count(*)) FROM public.festival_edition_settlement_outcomes WHERE settlement_id=s.id AND outcome_type='sponsor'),'weatherSummary',s.input_snapshot#>'{runtimeCompletionDigest,summary,weather}','incidentSummary',s.input_snapshot#>'{runtimeCompletionDigest,summary,publicIncidents}','awards',coalesce(s.input_snapshot#>'{runtimeCompletionDigest,summary,awards}','[]'),'achievements',(SELECT coalesce(jsonb_agg(achievement_key),'[]') FROM public.festival_edition_achievement_evidence WHERE settlement_id=s.id),'reputationChange',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,reputationChange}')::integer,0),'fameChange',coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,fameChange}')::integer,0),'profitabilityBand',CASE WHEN s.net_profit_loss_minor>0 THEN 'profitable' WHEN s.net_profit_loss_minor=0 THEN 'break_even' ELSE 'loss' END,'completedAt',now());
 INSERT INTO public.festival_edition_history_snapshots(settlement_id,settlement_version,edition_id,festival_company_id,public_projection,private_snapshot,content_digest,runtime_digest,settlement_digest) VALUES(s.id,s.settlement_version+1,s.edition_id,s.festival_company_id,public_data,private_data,encode(digest(public_data::text||private_data::text,'sha256'),'hex'),s.input_digest,digest_value) ON CONFLICT(settlement_id,settlement_version) DO NOTHING;
 UPDATE public.festival_edition_settlements SET state='completed',settlement_version=settlement_version+1,settlement_digest=digest_value,completed_at=coalesce(completed_at,now()),updated_at=now() WHERE id=s.id RETURNING * INTO s;
 answer:=jsonb_build_object('settlement',to_jsonb(s),'postingBatch',to_jsonb(b),'outcomes',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=s.id),'achievements',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.festival_edition_achievement_evidence a WHERE a.settlement_id=s.id),'licenceProgress',(SELECT evidence FROM public.festival_edition_licence_evidence WHERE settlement_id=s.id),'publicHistory',public_data);
 RETURN public._complete_festival_settlement_request(actor,'finalise',p_idempotency_key,answer);
END $$;

-- Explicit least privilege for every settlement function, including helpers and
-- trigger functions (which never need direct invocation).
REVOKE ALL ON FUNCTION public._festival_edition_settlement_error(text,jsonb),public._festival_edition_settlement_authorised(uuid),public._festival_settlement_request(uuid,uuid,text,uuid,jsonb,uuid),public._refresh_festival_edition_posting_totals(uuid),public._complete_festival_settlement_request(uuid,text,uuid,jsonb),public._festival_settlement_obligation(uuid,uuid,text),public._festival_apply_outcomes(uuid),public._festival_history_immutable() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.prepare_festival_edition_settlement(uuid,text,uuid),public.approve_festival_edition_settlement(uuid,integer,uuid),public.get_festival_edition_settlement_readiness(uuid,uuid),public.start_festival_edition_settlement_posting(uuid,integer,uuid),public.post_next_festival_edition_settlement_item(uuid,uuid),public.finalise_festival_edition_settlement_posting(uuid,uuid),public.receive_festival_settlement_receivable(uuid,uuid),public.pay_festival_settlement_payable(uuid,uuid),public.write_off_festival_settlement_receivable(uuid,uuid),public.cancel_festival_settlement_payable(uuid,uuid),public.apply_festival_edition_outcomes(uuid,integer,uuid),public.finalise_festival_edition_settlement(uuid,integer,uuid),public.get_festival_edition_settlement(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_settlement(uuid,text,uuid),public.approve_festival_edition_settlement(uuid,integer,uuid),public.get_festival_edition_settlement_readiness(uuid,uuid),public.start_festival_edition_settlement_posting(uuid,integer,uuid),public.post_next_festival_edition_settlement_item(uuid,uuid),public.finalise_festival_edition_settlement_posting(uuid,uuid),public.receive_festival_settlement_receivable(uuid,uuid),public.pay_festival_settlement_payable(uuid,uuid),public.write_off_festival_settlement_receivable(uuid,uuid),public.cancel_festival_settlement_payable(uuid,uuid),public.apply_festival_edition_outcomes(uuid,integer,uuid),public.finalise_festival_edition_settlement(uuid,integer,uuid),public.get_festival_edition_settlement(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_festival_edition_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_history(uuid) TO anon,authenticated;
