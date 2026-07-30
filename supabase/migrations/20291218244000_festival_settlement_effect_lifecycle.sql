-- Festival settlement effects are durable work, not evidence that work happened.
-- Canonical authority inventory: docs/festivals/settlement-progression-authorities.md.
ALTER TABLE public.festival_edition_settlement_effects
  ADD COLUMN outcome_id uuid REFERENCES public.festival_edition_settlement_outcomes(id),
  ADD COLUMN requested_payload jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN applied_result jsonb,
  ADD COLUMN canonical_transaction_or_event_id text,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN failure_code text,
  ADD COLUMN failure_details jsonb,
  ADD COLUMN claim_token uuid,
  ADD COLUMN worker_identity text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN expected_settlement_version integer;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN applied_at DROP NOT NULL;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN applied_at DROP DEFAULT;
ALTER TABLE public.festival_edition_settlement_effects ADD CONSTRAINT festival_effect_status_check CHECK(status IN('pending','applying','applied','not_applicable','failed','recovery_required'));
CREATE INDEX festival_settlement_effect_claim_idx ON public.festival_edition_settlement_effects(settlement_id,status,created_at);

-- Correct rows created by the previous placeholder migration. They have no
-- canonical result identifier and therefore were never applied.
UPDATE public.festival_edition_settlement_effects SET requested_payload=result,status='pending',result='{}',applied_at=NULL
WHERE canonical_transaction_or_event_id IS NULL;
UPDATE public.festival_edition_settlement_outcomes SET applied_at=NULL
WHERE EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=festival_edition_settlement_outcomes.settlement_id AND e.canonical_transaction_or_event_id IS NULL);

CREATE OR REPLACE FUNCTION public.claim_next_festival_settlement_effect(p_settlement_id uuid,p_worker_identity text,p_expected_settlement_version integer,p_lease_seconds integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE; token uuid:=gen_random_uuid();
BEGIN
 IF NOT public._festival_edition_settlement_authorised((SELECT festival_company_id FROM public.festival_edition_settlements WHERE id=p_settlement_id)) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.festival_edition_settlements WHERE id=p_settlement_id AND settlement_version=p_expected_settlement_version AND state='applying_outcomes') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_OUTCOME_NOT_READY'); END IF;
 UPDATE public.festival_edition_settlement_effects SET status='pending',claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL
 WHERE settlement_id=p_settlement_id AND status='applying' AND lease_expires_at<now();
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE settlement_id=p_settlement_id AND status IN('pending','failed') ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.festival_edition_settlement_effects SET status='applying',claim_token=token,worker_identity=nullif(btrim(p_worker_identity),''),lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),300)),attempt_count=attempt_count+1,expected_settlement_version=p_expected_settlement_version,failure_code=NULL,failure_details=NULL WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;

-- Called by the trusted effect worker only after the canonical authority returns.
-- The stable reference is supplied to that authority, so its own uniqueness is
-- the final defence against a worker crash between authority and acknowledgement.
CREATE OR REPLACE FUNCTION public.acknowledge_festival_settlement_effect(p_effect_id uuid,p_claim_token uuid,p_status text,p_applied_result jsonb,p_canonical_id text,p_failure_code text DEFAULT NULL,p_failure_details jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_NOT_FOUND'); END IF;
 IF e.status IN('applied','not_applicable') THEN RETURN to_jsonb(e); END IF;
 IF e.status<>'applying' OR e.claim_token IS DISTINCT FROM p_claim_token OR e.lease_expires_at<now() THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_RECOVERY_REQUIRED'); END IF;
 IF p_status NOT IN('applied','not_applicable','failed','recovery_required') THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_APPLICATION_FAILED'); END IF;
 IF p_status='applied' AND (p_applied_result IS NULL OR nullif(p_canonical_id,'') IS NULL) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_APPLICATION_FAILED'); END IF;
 UPDATE public.festival_edition_settlement_effects SET status=p_status,applied_result=CASE WHEN p_status='applied' THEN p_applied_result END,canonical_transaction_or_event_id=CASE WHEN p_status='applied' THEN p_canonical_id END,failure_code=CASE WHEN p_status IN('failed','recovery_required') THEN coalesce(p_failure_code,'FESTIVAL_EFFECT_APPLICATION_FAILED') END,failure_details=CASE WHEN p_status IN('failed','recovery_required') THEN p_failure_details END,applied_at=CASE WHEN p_status IN('applied','not_applicable') THEN now() END,claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL WHERE id=e.id RETURNING * INTO e;
 IF p_status IN('failed','recovery_required') THEN UPDATE public.festival_edition_settlements SET state='recovery_required',updated_at=now() WHERE id=e.settlement_id; END IF;
 UPDATE public.festival_edition_settlement_outcomes o SET applied_at=now() WHERE o.id=e.outcome_id AND o.applied_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects x WHERE x.outcome_id=o.id AND x.status NOT IN('applied','not_applicable'));
 RETURN to_jsonb(e);
END $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_settlement_effects(p_settlement_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pending integer; failed integer;
BEGIN
 IF NOT public._festival_edition_settlement_authorised((SELECT festival_company_id FROM public.festival_edition_settlements WHERE id=p_settlement_id)) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 SELECT count(*) FILTER(WHERE status NOT IN('applied','not_applicable')),count(*) FILTER(WHERE status IN('failed','recovery_required')) INTO pending,failed FROM public.festival_edition_settlement_effects WHERE settlement_id=p_settlement_id;
 IF failed>0 THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_RECOVERY_REQUIRED'); END IF;
 IF pending>0 OR NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_outcomes WHERE settlement_id=p_settlement_id) OR EXISTS(SELECT 1 FROM public.festival_edition_settlement_outcomes WHERE settlement_id=p_settlement_id AND applied_at IS NULL) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_OUTCOME_NOT_READY'); END IF;
 RETURN jsonb_build_object('settlementId',p_settlement_id,'state','effects_complete','appliedEffects',(SELECT count(*) FROM public.festival_edition_settlement_effects WHERE settlement_id=p_settlement_id AND status='applied'),'notApplicableEffects',(SELECT count(*) FROM public.festival_edition_settlement_effects WHERE settlement_id=p_settlement_id AND status='not_applicable'));
END $$;
REVOKE ALL ON FUNCTION public.claim_next_festival_settlement_effect(uuid,text,integer,integer),public.acknowledge_festival_settlement_effect(uuid,uuid,text,jsonb,text,text,jsonb),public.finalise_festival_settlement_effects(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_festival_settlement_effect(uuid,text,integer,integer),public.acknowledge_festival_settlement_effect(uuid,uuid,text,jsonb,text,text,jsonb),public.finalise_festival_settlement_effects(uuid) TO service_role;
