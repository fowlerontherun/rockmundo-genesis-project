-- Finish Festival settlement v3.  Forward-only: earlier settlement migrations
-- are intentionally left untouched.

-- Repair decisions are an immutable journal. Candidate evidence remains on the
-- backfill audit row and is never rewritten by a manual decision.
ALTER TABLE public.festival_plan_identity_repairs
  DROP CONSTRAINT IF EXISTS festival_plan_identity_repairs_plan_type_plan_id_key;
ALTER TABLE public.festival_plan_identity_repairs
  RENAME COLUMN festival_edition_id TO new_edition_id;
ALTER TABLE public.festival_plan_identity_repairs
  ADD COLUMN previous_edition_id uuid REFERENCES public.festival_editions(id),
  ADD COLUMN previous_identity_status text,
  ADD COLUMN new_identity_status text NOT NULL DEFAULT 'identity_ready',
  ADD COLUMN superseded_repair_id uuid REFERENCES public.festival_plan_identity_repairs(id),
  ADD COLUMN manual_resolution jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.festival_plan_identity_repairs
  ADD CONSTRAINT festival_plan_repair_statuses CHECK (
    previous_identity_status IN ('identity_ready','identity_repair_required') AND
    new_identity_status IN ('identity_ready','identity_repair_required'));
CREATE UNIQUE INDEX festival_plan_identity_one_correction
  ON public.festival_plan_identity_repairs(superseded_repair_id)
  WHERE superseded_repair_id IS NOT NULL;

CREATE FUNCTION public._festival_immutable_row() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 RAISE EXCEPTION 'festival_audit_rows_are_immutable';
END $$;
CREATE TRIGGER festival_plan_repairs_immutable BEFORE UPDATE OR DELETE
 ON public.festival_plan_identity_repairs FOR EACH ROW EXECUTE FUNCTION public._festival_immutable_row();

CREATE OR REPLACE FUNCTION public.repair_festival_plan_identity(
 p_plan_type text,p_plan_id uuid,p_edition_id uuid,p_reason text,p_evidence jsonb,
 p_superseded_repair_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); company uuid; festival uuid; tbl text;
 old_edition uuid; old_status text; audit public.festival_plan_edition_backfill_audit%ROWTYPE; repair uuid;
BEGIN
 IF length(btrim(coalesce(p_reason,'')))<8 OR p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
 THEN RAISE EXCEPTION 'festival_plan_repair_evidence_required'; END IF;
 tbl:=CASE p_plan_type WHEN 'artist_programme' THEN 'festival_artist_programmes'
  WHEN 'operations_plan' THEN 'festival_operations_plans' WHEN 'sponsorship_plan' THEN 'festival_sponsorship_plans'
  WHEN 'ticket_plan' THEN 'festival_ticket_plans' END;
 IF tbl IS NULL THEN RAISE EXCEPTION 'festival_plan_type_invalid'; END IF;
 SELECT * INTO STRICT audit FROM public.festival_plan_edition_backfill_audit
  WHERE plan_type=p_plan_type AND plan_id=p_plan_id FOR UPDATE;
 EXECUTE format('SELECT festival_company_id,festival_edition_id FROM public.%I WHERE id=$1 FOR UPDATE',tbl)
  INTO STRICT company,old_edition USING p_plan_id;
 IF company<>audit.festival_company_id OR NOT (public.current_user_is_platform_admin() OR EXISTS(
   SELECT 1 FROM public.festival_companies c WHERE c.id=company AND c.owner_profile_id=actor))
 THEN RAISE EXCEPTION 'festival_plan_repair_forbidden'; END IF;
 SELECT e.festival_id INTO STRICT festival FROM public.festival_editions e WHERE e.id=p_edition_id;
 IF NOT EXISTS(SELECT 1 FROM public.festival_launches l WHERE l.festival_company_id=company
   AND l.festival_id=festival AND l.festival_edition_id=p_edition_id)
 THEN RAISE EXCEPTION 'festival_plan_edition_ownership_mismatch'; END IF;
 IF p_superseded_repair_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_plan_identity_repairs r
   WHERE r.id=p_superseded_repair_id AND r.plan_type=p_plan_type AND r.plan_id=p_plan_id)
 THEN RAISE EXCEPTION 'festival_plan_superseded_repair_mismatch'; END IF;

 -- Existing public/runtime/contract evidence is edition-bound. A repair may
 -- confirm that edition but must never transport evidence to another edition.
 IF old_edition IS DISTINCT FROM p_edition_id AND public._festival_plan_is_used(p_plan_type,p_plan_id)
 THEN RAISE EXCEPTION 'festival_plan_repair_would_move_existing_evidence'; END IF;
 IF p_plan_type='artist_programme' AND EXISTS(SELECT 1 FROM public.festival_artist_bookings b
    JOIN public.festival_runtime_performances rp ON rp.artist_booking_id=b.id
    JOIN public.festival_runtime_sessions rs ON rs.id=rp.runtime_session_id
    JOIN public.festival_launches l ON l.id=rs.festival_launch_id
    WHERE b.festival_artist_programme_id=p_plan_id AND l.festival_edition_id<>p_edition_id)
 OR p_plan_type='ticket_plan' AND EXISTS(SELECT 1 FROM public.festival_ticket_products t
    JOIN public.festival_public_ticket_products pt ON pt.source_ticket_product_id=t.id
    JOIN public.festival_launches l ON l.id=pt.festival_launch_id
    WHERE t.festival_ticket_plan_id=p_plan_id AND l.festival_edition_id<>p_edition_id)
 THEN RAISE EXCEPTION 'festival_plan_repair_cross_edition_evidence'; END IF;

 old_status:=audit.identity_status;
 EXECUTE format('UPDATE public.%I SET festival_edition_id=$1 WHERE id=$2',tbl) USING p_edition_id,p_plan_id;
 INSERT INTO public.festival_plan_identity_repairs(plan_type,plan_id,previous_edition_id,new_edition_id,
   previous_identity_status,new_identity_status,actor_id,reason,evidence,manual_resolution,superseded_repair_id,previous_state)
 VALUES(p_plan_type,p_plan_id,old_edition,p_edition_id,old_status,'identity_ready',actor,p_reason,
   audit.resolution_evidence,p_evidence,p_superseded_repair_id,
   jsonb_build_object('editionId',old_edition,'identityStatus',old_status)) RETURNING id INTO repair;
 UPDATE public.festival_plan_edition_backfill_audit SET resolved_edition_id=p_edition_id,
   requires_owner_repair=false,identity_status='identity_ready',resolved_at=now()
 WHERE plan_type=p_plan_type AND plan_id=p_plan_id;
 RETURN jsonb_build_object('repairId',repair,'planType',p_plan_type,'planId',p_plan_id,
   'festivalEditionId',p_edition_id,'identityStatus','identity_ready');
END $$;

-- Separate request facts from append-only adjudications. Partial approval is a
-- first-class decision; supersession preserves every earlier decision.
CREATE TABLE public.festival_staff_overtime_requests_v3(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_checkin_id uuid NOT NULL REFERENCES public.festival_runtime_staff_checkins(id),
 requested_minutes integer NOT NULL CHECK(requested_minutes>0), reason text NOT NULL,
 requested_by uuid NOT NULL REFERENCES public.profiles(id), requested_at timestamptz NOT NULL DEFAULT now(),
 idempotency_key uuid NOT NULL UNIQUE);
CREATE TABLE public.festival_staff_overtime_decisions_v3(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public.festival_staff_overtime_requests_v3(id),
 decision_state text NOT NULL CHECK(decision_state IN('approved','partially_approved','rejected')),
 approved_minutes integer NOT NULL CHECK(approved_minutes>=0), reason text NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT now(), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 superseded_decision_id uuid REFERENCES public.festival_staff_overtime_decisions_v3(id), idempotency_key uuid NOT NULL UNIQUE);
CREATE UNIQUE INDEX festival_overtime_one_effective_decision_v3
 ON public.festival_staff_overtime_decisions_v3(request_id) WHERE superseded_decision_id IS NULL;
CREATE FUNCTION public._festival_overtime_decision_guard_v3() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE requested integer;
BEGIN
 SELECT requested_minutes INTO STRICT requested FROM public.festival_staff_overtime_requests_v3 WHERE id=NEW.request_id;
 IF NEW.approved_minutes>requested OR (NEW.decision_state='rejected' AND NEW.approved_minutes<>0)
  OR (NEW.decision_state='approved' AND NEW.approved_minutes<>requested)
  OR (NEW.decision_state='partially_approved' AND NEW.approved_minutes NOT BETWEEN 1 AND requested-1)
 THEN RAISE EXCEPTION 'festival_overtime_decision_minutes_invalid'; END IF;
 IF NEW.superseded_decision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_staff_overtime_decisions_v3 d
   WHERE d.id=NEW.superseded_decision_id AND d.request_id=NEW.request_id)
 THEN RAISE EXCEPTION 'festival_overtime_supersession_mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER festival_overtime_decision_guard_v3 BEFORE INSERT
 ON public.festival_staff_overtime_decisions_v3 FOR EACH ROW EXECUTE FUNCTION public._festival_overtime_decision_guard_v3();
CREATE TRIGGER festival_overtime_requests_immutable_v3 BEFORE UPDATE OR DELETE ON public.festival_staff_overtime_requests_v3
 FOR EACH ROW EXECUTE FUNCTION public._festival_immutable_row();
CREATE TRIGGER festival_overtime_decisions_immutable_v3 BEFORE UPDATE OR DELETE ON public.festival_staff_overtime_decisions_v3
 FOR EACH ROW EXECUTE FUNCTION public._festival_immutable_row();

ALTER TABLE public.festival_staff_shift_evidence_decisions
 DROP CONSTRAINT festival_staff_shift_evidence_decisions_decision_type_check;
ALTER TABLE public.festival_staff_shift_evidence_decisions
 ADD CONSTRAINT festival_staff_shift_evidence_decision_type_v3 CHECK(decision_type IN
  ('dispute_correction','manual_completion','authorised_absence','authorised_cancellation'));

CREATE OR REPLACE FUNCTION public._resolve_festival_staff_shift_evidence(p_runtime_session_id uuid,p_shift_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE raw public.festival_runtime_staff_checkins%ROWTYPE; decision public.festival_staff_shift_evidence_decisions%ROWTYPE;
BEGIN
 SELECT * INTO raw FROM public.festival_runtime_staff_checkins
  WHERE runtime_session_id=p_runtime_session_id AND staff_shift_id=p_shift_id ORDER BY created_at DESC,id DESC LIMIT 1;
 -- Only a leaf decision is effective; a chain may never resurrect an ancestor.
 SELECT d.* INTO decision FROM public.festival_staff_shift_evidence_decisions d
  WHERE d.staff_checkin_id=raw.id AND NOT EXISTS(SELECT 1 FROM public.festival_staff_shift_evidence_decisions n
    WHERE n.supersedes_decision_id=d.id)
  ORDER BY d.decision_at DESC,d.id DESC LIMIT 1;
 -- A complete clock is canonical unless the effective decision explicitly says
 -- it is a dispute correction. Manual completion is only a missing-clock fallback.
 IF raw.checked_in_at IS NOT NULL AND raw.checked_out_at IS NOT NULL
    AND coalesce(decision.decision_type,'')<>'dispute_correction' THEN
  RETURN jsonb_build_object('complete',true,'source','raw_checkin_checkout','checkIn',raw.checked_in_at,
   'checkOut',raw.checked_out_at,'effectiveWorkedMinutes',greatest(0,extract(epoch FROM(raw.checked_out_at-raw.checked_in_at))::int/60));
 ELSIF decision.id IS NOT NULL AND decision.decision_type IN('dispute_correction','manual_completion') THEN
  RETURN jsonb_build_object('complete',true,'source',decision.decision_type,'decisionId',decision.id,
   'checkIn',raw.checked_in_at,'checkOut',raw.checked_out_at,'effectiveWorkedMinutes',decision.effective_worked_minutes);
 ELSIF decision.id IS NOT NULL AND decision.decision_type='authorised_absence' THEN
  RETURN jsonb_build_object('complete',true,'source','authorised_absence','decisionId',decision.id,'absence',true,'effectiveWorkedMinutes',0);
 ELSIF decision.id IS NOT NULL AND decision.decision_type='authorised_cancellation' THEN
  RETURN jsonb_build_object('complete',true,'source','authorised_cancellation','decisionId',decision.id,'cancellation',true,'effectiveWorkedMinutes',0);
 END IF;
 RETURN jsonb_build_object('complete',false,'source','incomplete','checkIn',raw.checked_in_at,'checkOut',raw.checked_out_at);
END $$;

-- One lifecycle guard covers RPCs and direct writes. Publication/activation is
-- determined from the row's status, so harmless draft editing remains possible.
CREATE FUNCTION public._festival_plan_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE plan_id uuid; plan_type text; lifecycle text:=coalesce(to_jsonb(NEW)->>'status',to_jsonb(NEW)->>'launch_status','');
BEGIN
 plan_type:=TG_ARGV[0]; plan_id:=(to_jsonb(NEW)->>TG_ARGV[1])::uuid;
 IF TG_ARGV[2]='always' OR lifecycle=ANY(string_to_array(TG_ARGV[2],',')) THEN
   PERFORM public._assert_festival_plan_identity_ready(plan_type,plan_id);
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE x text[]; BEGIN
 FOREACH x SLICE 1 IN ARRAY ARRAY[
  ['festival_artist_bookings','artist_programme','festival_artist_programme_id','always'],
  ['festival_staff_assignments','operations_plan','festival_operations_plan_id','committed,active'],
  ['festival_staff_shifts','operations_plan','festival_operations_plan_id','published,active'],
  ['festival_supplier_contracts','operations_plan','festival_operations_plan_id','committed,awaiting_delivery,active'],
  ['festival_sponsor_contracts','sponsorship_plan','festival_sponsorship_plan_id','committed,awaiting_activation,active'],
  ['festival_ticket_products','ticket_plan','festival_ticket_plan_id','published,on_sale,active']
 ] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS festival_identity_lifecycle_guard ON public.%I',x[1]);
  EXECUTE format('CREATE TRIGGER festival_identity_lifecycle_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._festival_plan_lifecycle_guard(%L,%L,%L)',x[1],x[2],x[3],x[4]);
 END LOOP;
END $$;

-- Native receipt-first line primitive. The stable key never includes attempt.
-- A reserved receipt can therefore recover a transfer after any interruption.
CREATE OR REPLACE FUNCTION public._process_festival_settlement_line(p_line_id uuid,p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.festival_settlement_lines%ROWTYPE; s public.festival_financial_settlements%ROWTYPE;
 r public.festival_settlement_receipts%ROWTYPE; payment public.festival_settlement_payments%ROWTYPE;
 transfer_key text; tx public.financial_transactions%ROWTYPE; attempt integer;
BEGIN
 SELECT * INTO STRICT l FROM public.festival_settlement_lines WHERE id=p_line_id FOR UPDATE;
 SELECT * INTO STRICT s FROM public.festival_financial_settlements WHERE id=l.settlement_id;
 IF l.status IN('paid','waived','resolved','not_applicable','written_off') THEN RETURN true; END IF;
 IF l.net_amount_minor=0 THEN
  UPDATE public.festival_settlement_lines SET status='not_applicable',completed_at=now() WHERE id=l.id;
  RETURN true;
 END IF;
 transfer_key:='festival-settlement:'||s.id||':line:'||l.id;
 INSERT INTO public.festival_settlement_receipts(settlement_line_id,settlement_id,transfer_key,amount_minor,currency_code,receipt)
 VALUES(l.id,s.id,transfer_key,l.net_amount_minor,l.currency_code,jsonb_build_object('status','pending','transferKey',transfer_key))
 ON CONFLICT(settlement_line_id) DO NOTHING;
 SELECT * INTO STRICT r FROM public.festival_settlement_receipts WHERE settlement_line_id=l.id FOR UPDATE;
 IF r.canonical_transaction_id IS NOT NULL THEN
  UPDATE public.festival_settlement_lines SET status='paid',completed_at=coalesce(completed_at,now()) WHERE id=l.id; RETURN true;
 END IF;
 SELECT * INTO tx FROM public.financial_transactions WHERE idempotency_key=transfer_key ORDER BY created_at LIMIT 1;
 attempt:=coalesce((SELECT max(p.attempt) FROM public.festival_settlement_payments p WHERE p.settlement_line_id=l.id),0)+1;
 IF tx.id IS NULL THEN
  INSERT INTO public.festival_settlement_payments(settlement_line_id,attempt,amount_minor,currency_code,status,idempotency_key)
   VALUES(l.id,attempt,l.net_amount_minor,l.currency_code,'processing',transfer_key) RETURNING * INTO payment;
  BEGIN
   PERFORM public.finance_transfer(l.payer_type::public.financial_owner_type,l.payer_id,
    l.recipient_type::public.financial_owner_type,l.recipient_id,l.net_amount_minor,'festival_payment',
    'Festival settlement: '||replace(l.line_type,'_',' '),transfer_key,'festival_settlement_line',l.id,p_actor,
    jsonb_build_object('settlementId',s.id,'currencyCode',l.currency_code,'formulaVersion',l.formula_version));
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.festival_settlement_payments SET status='failed',completed_at=now() WHERE id=payment.id;
   INSERT INTO public.festival_settlement_failures(settlement_id,settlement_line_id,payment_id,error_code,retryable,attempt,private_detail)
    VALUES(s.id,l.id,payment.id,CASE WHEN SQLERRM ILIKE '%insufficient%' THEN 'insufficient_funds' ELSE 'finance_service_failure' END,true,attempt,left(SQLERRM,500));
   UPDATE public.festival_settlement_lines SET status=CASE WHEN SQLERRM ILIKE '%insufficient%' THEN 'outstanding' ELSE 'failed' END WHERE id=l.id;
   RETURN false;
  END;
  SELECT * INTO STRICT tx FROM public.financial_transactions WHERE idempotency_key=transfer_key ORDER BY created_at LIMIT 1;
 ELSE SELECT * INTO payment FROM public.festival_settlement_payments WHERE settlement_line_id=l.id ORDER BY attempt DESC LIMIT 1; END IF;
 UPDATE public.festival_settlement_receipts SET payment_id=payment.id,canonical_transaction_id=tx.id,
  source_account_id=tx.source_account_id,destination_account_id=tx.destination_account_id,
  debit_ledger_id=(SELECT id FROM public.financial_ledger_entries WHERE transaction_id=tx.id AND entry_direction='debit' ORDER BY created_at LIMIT 1),
  credit_ledger_id=(SELECT id FROM public.financial_ledger_entries WHERE transaction_id=tx.id AND entry_direction='credit' ORDER BY created_at LIMIT 1),
  receipt=jsonb_build_object('status','completed','transferKey',transfer_key,'transactionId',tx.id),completed_at=now() WHERE id=r.id;
 UPDATE public.festival_settlement_payments SET status='paid',financial_transaction_id=tx.id,completed_at=now() WHERE id=payment.id;
 UPDATE public.festival_settlement_lines SET status='paid',completed_at=now() WHERE id=l.id;
 RETURN true;
END $$;

-- Effects have a real pending/completed/failed state and a destination record.
ALTER TABLE public.festival_settlement_effect_receipts
 ALTER COLUMN completed_at DROP NOT NULL,
 ALTER COLUMN completed_at DROP DEFAULT,
 ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','completed','failed')),
 ADD COLUMN destination_table text,
 ADD COLUMN destination_record_id uuid,
 ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
 ADD COLUMN last_error text;
ALTER TABLE public.festival_settlement_receipts ADD COLUMN completed_at timestamptz;
ALTER TABLE public.festival_financial_settlements DROP CONSTRAINT IF EXISTS settlement_status_v2;
ALTER TABLE public.festival_financial_settlements DROP CONSTRAINT IF EXISTS festival_settlement_status_v2;
ALTER TABLE public.festival_financial_settlements ADD CONSTRAINT festival_settlement_status_v3 CHECK(status IN(
 'draft','calculated','processing','partially_settled','settled','failed','disputed','settlement_review','settling',
 'settlement_failed','ready_for_settlement','not_ready','finalising','finalised','finalisation_failed')) NOT VALID;
ALTER TABLE public.festival_settlement_lines DROP CONSTRAINT IF EXISTS festival_settlement_line_status_v2;
ALTER TABLE public.festival_settlement_lines ADD CONSTRAINT festival_settlement_line_status_v3 CHECK(status IN(
 'pending','processing','paid','failed','outstanding','waived','resolved','not_applicable','written_off','disputed')) NOT VALID;

-- No v3 preparation is permitted to conceal a missing calculation.
CREATE FUNCTION public._festival_semantic_component_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=NEW.id AND c.component_type='source_balance')
 THEN RAISE EXCEPTION 'festival_source_balance_components_forbidden'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER festival_semantic_component_guard AFTER INSERT OR UPDATE ON public.festival_settlement_lines
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._festival_semantic_component_guard();

REVOKE ALL ON FUNCTION public._festival_immutable_row(),public._festival_plan_lifecycle_guard(),
 public._festival_overtime_decision_guard_v3(),public._process_festival_settlement_line(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.repair_festival_plan_identity(text,uuid,uuid,text,jsonb,uuid) TO authenticated;
