-- Complete the durable Festival outcome chain. The browser can prepare/recover
-- its own settlement, but claiming, authority dispatch and acknowledgement stay
-- service-role operations performed by process-festival-settlement-effects.
ALTER TABLE public.festival_edition_settlement_effects
  ADD COLUMN IF NOT EXISTS first_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS canonical_handler text,
  ADD COLUMN IF NOT EXISTS repair_recommendation text,
  ADD COLUMN IF NOT EXISTS admin_decision jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.festival_edition_settlement_effects DROP CONSTRAINT IF EXISTS festival_effect_status_check;
ALTER TABLE public.festival_edition_settlement_effects ADD CONSTRAINT festival_effect_status_check
  CHECK(status IN('pending','applying','applied','not_applicable','failed','recovery_required','dead_letter'));

-- Proven links only: the subject and outcome type must agree. Ambiguous legacy
-- requests are retained as dead letters rather than attached to arbitrary rows.
UPDATE public.festival_edition_settlement_effects e SET outcome_id=o.id
FROM public.festival_edition_settlement_outcomes o
WHERE e.outcome_id IS NULL AND o.settlement_id=e.settlement_id
  AND o.subject_type=e.subject_type AND o.subject_id=e.subject_id
  AND (o.outcome_type=e.effect_type OR
       (o.outcome_type='artist' AND e.effect_type IN('performance_result','band_fans','band_fame','member_xp','band_chemistry','song_familiarity','song_popularity','artist_relationship')) OR
       (o.outcome_type='sponsor' AND e.effect_type='sponsor_relationship'));
UPDATE public.festival_edition_settlement_effects SET status='dead_letter',failure_code='FESTIVAL_EFFECT_OUTCOME_LINK_AMBIGUOUS',
 failure_details=jsonb_build_object('migration','20291218244100','provenance','legacy result request'),latest_failed_at=now(),repair_recommendation='Platform admin must select the evidence-matching outcome'
WHERE outcome_id IS NULL;

CREATE OR REPLACE FUNCTION public._festival_outcome_application_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.applied_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.outcome_id=NEW.id AND e.status NOT IN('applied','not_applicable')) THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_OUTCOME_NOT_READY');
 END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_outcome_application_guard ON public.festival_edition_settlement_outcomes;
CREATE TRIGGER festival_outcome_application_guard BEFORE UPDATE OF applied_at ON public.festival_edition_settlement_outcomes FOR EACH ROW EXECUTE FUNCTION public._festival_outcome_application_guard();

-- A worker may request the next settlement globally. Version and ownership are
-- checked when explicitly supplied; the function itself remains service-only.
CREATE OR REPLACE FUNCTION public.claim_next_festival_settlement_effect(p_settlement_id uuid DEFAULT NULL,p_worker_identity text DEFAULT 'festival-effect-worker',p_expected_settlement_version integer DEFAULT NULL,p_lease_seconds integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE; token uuid:=gen_random_uuid(); sid uuid;
BEGIN
 UPDATE public.festival_edition_settlement_effects SET status='pending',claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL
 WHERE status='applying' AND lease_expires_at<now();
 SELECT x.id INTO sid FROM public.festival_edition_settlements x WHERE (p_settlement_id IS NULL OR x.id=p_settlement_id)
  AND x.state IN('outcomes_calculated','applying_outcomes') AND EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects q WHERE q.settlement_id=x.id AND q.status='pending')
  ORDER BY x.updated_at,x.id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF sid IS NULL THEN RETURN NULL; END IF;
 IF p_expected_settlement_version IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlements WHERE id=sid AND settlement_version=p_expected_settlement_version) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_VERSION_CONFLICT'); END IF;
 UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now() WHERE id=sid AND state='outcomes_calculated';
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE settlement_id=sid AND status='pending' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 UPDATE public.festival_edition_settlement_effects SET status='applying',claim_token=token,worker_identity=nullif(btrim(p_worker_identity),''),lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,15),300)),attempt_count=attempt_count+1,expected_settlement_version=(SELECT settlement_version FROM public.festival_edition_settlements WHERE id=sid),canonical_handler=effect_type WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;

CREATE OR REPLACE FUNCTION public.resume_festival_settlement_effects(p_settlement_id uuid,p_effect_ids uuid[] DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; retried integer;
BEGIN
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF NOT FOUND OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 IF s.state<>'recovery_required' THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_INVALID_TRANSITION'); END IF;
 IF EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id AND status='applying' AND lease_expires_at>now()) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_ACTIVE_LEASE'); END IF;
 UPDATE public.festival_edition_settlement_effects SET status='pending',claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL
 WHERE settlement_id=s.id AND status IN('failed','recovery_required') AND (p_effect_ids IS NULL OR id=ANY(p_effect_ids)) AND attempt_count<5;
 GET DIAGNOSTICS retried=ROW_COUNT;
 IF retried=0 THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_NO_RECOVERABLE_WORK'); END IF;
 UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now(),audit_metadata=jsonb_set(coalesce(audit_metadata,'{}'),'{lastEffectResume}',jsonb_build_object('at',now(),'reason',p_reason,'retried',retried)) WHERE id=s.id;
 RETURN jsonb_build_object('settlementId',s.id,'retried',retried,'state','applying_outcomes');
END $$;

CREATE OR REPLACE FUNCTION public._festival_effect_completion_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.state='completed' AND (OLD.state<>'effects_complete'
   OR NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=NEW.id)
   OR EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=NEW.id AND e.status NOT IN('applied','not_applicable'))
   OR EXISTS(SELECT 1 FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=NEW.id AND o.applied_at IS NULL)
   OR (SELECT coalesce(sum(t.amount_minor),0) FROM public.festival_edition_tax_lines t WHERE t.settlement_id=NEW.id)<>NEW.tax_minor) THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_OUTCOME_NOT_READY');
 END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_effect_completion_guard ON public.festival_edition_settlements;
CREATE TRIGGER festival_effect_completion_guard BEFORE UPDATE OF state ON public.festival_edition_settlements FOR EACH ROW EXECUTE FUNCTION public._festival_effect_completion_guard();

CREATE OR REPLACE FUNCTION public.finalise_ready_festival_settlement_effects(p_limit integer DEFAULT 25) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.festival_edition_settlements s SET state='effects_complete',updated_at=now()
 WHERE s.id IN (SELECT x.id FROM public.festival_edition_settlements x WHERE x.state='applying_outcomes'
   AND EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=x.id)
   AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=x.id AND e.status NOT IN('applied','not_applicable')) LIMIT least(greatest(p_limit,1),100));
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_settlement_effect_progress(p_settlement_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id;
 IF NOT FOUND OR NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_SETTLEMENT_ACCESS_DENIED'); END IF;
 RETURN jsonb_build_object('settlementId',s.id,'state',s.state,'outcomesCalculated',EXISTS(SELECT 1 FROM public.festival_edition_settlement_outcomes WHERE settlement_id=s.id),
  'total',(SELECT count(*) FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id),
  'statuses',(SELECT coalesce(jsonb_object_agg(status,n),'{}') FROM (SELECT status,count(*) n FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id GROUP BY status) q),
  'lastFailure',(SELECT jsonb_build_object('code',failure_code,'at',latest_failed_at) FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id AND failure_code IS NOT NULL ORDER BY latest_failed_at DESC NULLS LAST LIMIT 1));
END $$;

-- Failure metadata is append-only in spirit: acknowledgement records both first
-- and latest failure, and moves exhausted work to manual repair.
CREATE OR REPLACE FUNCTION public.acknowledge_festival_settlement_effect(p_effect_id uuid,p_claim_token uuid,p_status text,p_applied_result jsonb,p_canonical_id text,p_failure_code text DEFAULT NULL,p_failure_details jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE; terminal text;
BEGIN SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id FOR UPDATE;
 IF NOT FOUND OR e.status<>'applying' OR e.claim_token IS DISTINCT FROM p_claim_token OR e.lease_expires_at<now() THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_RECOVERY_REQUIRED'); END IF;
 IF p_status='applied' AND (p_applied_result IS NULL OR nullif(p_canonical_id,'') IS NULL) THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_ID_MISSING'); END IF;
 terminal:=CASE WHEN p_status IN('failed','recovery_required') AND e.attempt_count>=5 THEN 'dead_letter' ELSE p_status END;
 UPDATE public.festival_edition_settlement_effects SET status=terminal,applied_result=CASE WHEN terminal IN('applied','not_applicable') THEN p_applied_result END,canonical_transaction_or_event_id=CASE WHEN terminal='applied' THEN p_canonical_id END,
  applied_at=CASE WHEN terminal IN('applied','not_applicable') THEN now() END,failure_code=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN coalesce(p_failure_code,'FESTIVAL_EFFECT_APPLICATION_FAILED') END,
  failure_details=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN p_failure_details END,first_failed_at=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN coalesce(first_failed_at,now()) ELSE first_failed_at END,
  latest_failed_at=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN now() ELSE latest_failed_at END,repair_recommendation=CASE WHEN terminal='dead_letter' THEN 'Inspect immutable evidence and retry through admin repair' ELSE repair_recommendation END,
  claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL WHERE id=e.id RETURNING * INTO e;
 IF terminal IN('failed','recovery_required','dead_letter') THEN UPDATE public.festival_edition_settlements SET state='recovery_required',updated_at=now() WHERE id=e.settlement_id; END IF;
 UPDATE public.festival_edition_settlement_outcomes o SET applied_at=now() WHERE o.id=e.outcome_id AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects x WHERE x.outcome_id=o.id AND x.status NOT IN('applied','not_applicable'));
 RETURN to_jsonb(e);
END $$;

REVOKE ALL ON FUNCTION public.claim_next_festival_settlement_effect(uuid,text,integer,integer),public.acknowledge_festival_settlement_effect(uuid,uuid,text,jsonb,text,text,jsonb),public.finalise_ready_festival_settlement_effects(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_festival_settlement_effect(uuid,text,integer,integer),public.acknowledge_festival_settlement_effect(uuid,uuid,text,jsonb,text,text,jsonb),public.finalise_ready_festival_settlement_effects(integer) TO service_role;
REVOKE ALL ON FUNCTION public.resume_festival_settlement_effects(uuid,uuid[],text),public.get_festival_settlement_effect_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resume_festival_settlement_effects(uuid,uuid[],text),public.get_festival_settlement_effect_progress(uuid) TO authenticated,service_role;

INSERT INTO public.cron_job_config(job_name,edge_function_name,display_name,description,schedule,is_active,allow_manual_trigger)
VALUES('process-festival-settlement-effects','process-festival-settlement-effects','Process Festival settlement effects','Applies prepared Festival effects through canonical authorities','*/2 * * * *',true,true)
ON CONFLICT(job_name) DO UPDATE SET edge_function_name=excluded.edge_function_name,schedule=excluded.schedule,is_active=true;
