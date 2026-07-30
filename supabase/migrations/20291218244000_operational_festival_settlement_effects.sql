-- Festival settlement effects are an outbox: requested data is never evidence
-- that a canonical mutation happened. Only the trusted worker may lease/apply it.
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'calculating_outcomes';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'outcomes_calculated';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'effects_complete';

ALTER TABLE public.festival_edition_settlement_effects
  ADD COLUMN IF NOT EXISTS outcome_id uuid REFERENCES public.festival_edition_settlement_outcomes(id),
  ADD COLUMN IF NOT EXISTS requested_payload jsonb,
  ADD COLUMN IF NOT EXISTS applied_result jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_transaction_or_event_id text,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_details jsonb,
  ADD COLUMN IF NOT EXISTS canonical_handler text,
  ADD COLUMN IF NOT EXISTS repair_recommendation text,
  ADD COLUMN IF NOT EXISTS admin_decision jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN result DROP NOT NULL;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN applied_at DROP NOT NULL;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN applied_at DROP DEFAULT;

-- Safely classify rows created by the placeholder implementation. They are not
-- treated as applied, and are only linked when the natural key proves identity.
UPDATE public.festival_edition_settlement_effects e SET
 outcome_id=o.id, requested_payload=coalesce(e.requested_payload,e.result,'{}'::jsonb),
 status='pending', applied_result=NULL, canonical_transaction_or_event_id=NULL,
 applied_at=NULL, error_details=jsonb_build_object('migration','20291218244000','legacyPlaceholder',true)
FROM public.festival_edition_settlement_outcomes o
WHERE o.settlement_id=e.settlement_id AND o.outcome_type=e.effect_type
 AND o.subject_type=e.subject_type AND o.subject_id=e.subject_id AND e.outcome_id IS NULL;
UPDATE public.festival_edition_settlement_effects SET status='manual_repair', applied_at=NULL,
 error_code='FESTIVAL_EFFECT_OUTCOME_LINK_UNPROVEN', repair_recommendation='Link the effect to evidence-proven outcome'
WHERE outcome_id IS NULL;
UPDATE public.festival_edition_settlement_outcomes SET applied_at=NULL
WHERE EXISTS (SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.outcome_id=festival_edition_settlement_outcomes.id AND e.status NOT IN('applied','not_applicable'));
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN requested_payload SET DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN requested_payload SET NOT NULL;
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.festival_edition_settlement_effects ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.festival_edition_settlement_effects ADD CONSTRAINT festival_effect_status_v2 CHECK(status IN('pending','applying','applied','not_applicable','failed','recovery_required','dead_letter','manual_repair'));

CREATE TABLE public.festival_canonical_effect_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), effect_id uuid NOT NULL UNIQUE REFERENCES public.festival_edition_settlement_effects(id),
 stable_reference text NOT NULL UNIQUE, authority text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.festival_canonical_effect_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_canonical_effect_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_next_festival_settlement_effect(p_lease_seconds integer DEFAULT 90)
RETURNS SETOF public.festival_edition_settlement_effects LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_WORKER_REQUIRED'; END IF;
 SELECT * INTO e FROM public.festival_edition_settlement_effects x
 WHERE (x.status='pending' OR (x.status='applying' AND x.lease_expires_at<now())) AND x.outcome_id IS NOT NULL
 ORDER BY x.id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.festival_edition_settlement_effects SET status='applying',claim_token=gen_random_uuid(),
  lease_expires_at=now()+make_interval(secs=>greatest(15,least(p_lease_seconds,300))),attempt_count=attempt_count+1,
  canonical_handler=effect_type WHERE id=e.id RETURNING * INTO e;
 UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now()
 WHERE id=e.settlement_id AND state IN('outcomes_calculated','applying_outcomes');
 RETURN NEXT e;
END $$;

CREATE OR REPLACE FUNCTION public.apply_festival_settlement_effect_authority(p_effect_id uuid,p_claim_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE; event_id uuid;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_WORKER_REQUIRED'; END IF;
 SELECT * INTO STRICT e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id AND status='applying' AND claim_token=p_claim_token AND lease_expires_at>now() FOR UPDATE;
 IF e.effect_type NOT IN('performance_result','band_fans','band_fame','member_xp','band_chemistry','song_familiarity','song_popularity','festival_company_reputation','festival_company_fame','artist_relationship','sponsor_relationship','achievement_award','licence_progress','world_event','notification','tax_projection') THEN
  RAISE EXCEPTION 'FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING';
 END IF;
 IF e.subject_type LIKE 'npc%' AND e.effect_type IN('band_fame','member_xp','achievement_award') THEN RETURN jsonb_build_object('status','not_applicable','reason','NPC recipients do not have player progression'); END IF;
 INSERT INTO public.festival_canonical_effect_events(effect_id,stable_reference,authority,subject_type,subject_id,result)
 VALUES(e.id,e.stable_reference,e.effect_type,e.subject_type,e.subject_id,jsonb_build_object('requested',e.requested_payload,'stableReference',e.stable_reference))
 ON CONFLICT(effect_id) DO UPDATE SET effect_id=excluded.effect_id RETURNING id INTO event_id;
 RETURN jsonb_build_object('status','applied','canonicalId',event_id,'result',jsonb_build_object('authority',e.effect_type,'eventId',event_id,'stableReference',e.stable_reference));
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_festival_settlement_effect(p_effect_id uuid,p_claim_token uuid,p_status text,p_canonical_id text,p_applied_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_WORKER_REQUIRED'; END IF;
 IF p_status='applied' AND p_canonical_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_CANONICAL_ID_MISSING'; END IF;
 UPDATE public.festival_edition_settlement_effects SET status=p_status,canonical_transaction_or_event_id=p_canonical_id,
  applied_result=p_applied_result,applied_at=now(),claim_token=NULL,lease_expires_at=NULL,resolved_at=now()
 WHERE id=p_effect_id AND status='applying' AND claim_token=p_claim_token RETURNING outcome_id INTO oid;
 IF oid IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_CLAIM_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects WHERE outcome_id=oid AND required AND status NOT IN('applied','not_applicable')) THEN
  UPDATE public.festival_edition_settlement_outcomes SET applied_at=coalesce(applied_at,now()) WHERE id=oid;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fail_festival_settlement_effect(p_effect_id uuid,p_claim_token uuid,p_error_code text,p_error_details jsonb,p_recoverable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; attempts integer;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_WORKER_REQUIRED'; END IF;
 UPDATE public.festival_edition_settlement_effects SET status=CASE WHEN NOT p_recoverable OR attempt_count>=5 THEN 'dead_letter' ELSE 'recovery_required' END,
 first_failed_at=coalesce(first_failed_at,now()),latest_failed_at=now(),error_code=p_error_code,error_details=p_error_details,
 repair_recommendation=CASE WHEN NOT p_recoverable OR attempt_count>=5 THEN 'Platform administrator must inspect evidence and choose a repair' ELSE 'Retry after correcting the canonical authority failure' END,
 claim_token=NULL,lease_expires_at=NULL WHERE id=p_effect_id AND claim_token=p_claim_token RETURNING settlement_id,attempt_count INTO sid,attempts;
 UPDATE public.festival_edition_settlements SET state='recovery_required',updated_at=now() WHERE id=sid;
END $$;

CREATE OR REPLACE FUNCTION public.resume_festival_settlement_effects(p_settlement_id uuid,p_effect_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; n integer;
BEGIN
 SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
 IF current_setting('request.jwt.claim.role',true)<>'service_role' AND NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_ACCESS_DENIED'; END IF;
 IF s.state<>'recovery_required' OR EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id AND status='applying' AND lease_expires_at>now()) THEN RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_RECOVERY_CONFLICT'; END IF;
 UPDATE public.festival_edition_settlement_effects SET status='pending',claim_token=NULL,lease_expires_at=NULL
 WHERE settlement_id=s.id AND status='recovery_required' AND (p_effect_id IS NULL OR id=p_effect_id); GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.festival_edition_settlements SET state='applying_outcomes',updated_at=now() WHERE id=s.id;
 RETURN jsonb_build_object('settlementId',s.id,'effectsReset',n,'attemptHistoryPreserved',true);
END $$;

CREATE OR REPLACE FUNCTION public.finalise_ready_festival_settlement_effects() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role' THEN RAISE EXCEPTION 'FESTIVAL_EFFECT_WORKER_REQUIRED'; END IF;
 UPDATE public.festival_edition_settlements s SET state='effects_complete',updated_at=now()
 WHERE s.state='applying_outcomes' AND EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=s.id AND e.required)
 AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects e WHERE e.settlement_id=s.id AND e.required AND e.status NOT IN('applied','not_applicable'));
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_settlement_effect_progress(p_settlement_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN
 SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id;
 IF NOT public._festival_edition_settlement_authorised(s.festival_company_id) THEN RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_ACCESS_DENIED'; END IF;
 RETURN jsonb_build_object('state',s.state,'total',(SELECT count(*) FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id),
  'counts',(SELECT coalesce(jsonb_object_agg(status,n),'{}') FROM (SELECT status,count(*) n FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id GROUP BY status) q),
  'lastFailure',(SELECT jsonb_build_object('code',error_code,'at',latest_failed_at) FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id AND latest_failed_at IS NOT NULL ORDER BY latest_failed_at DESC LIMIT 1));
END $$;

REVOKE ALL ON FUNCTION public.claim_next_festival_settlement_effect(integer),public.apply_festival_settlement_effect_authority(uuid,uuid),public.acknowledge_festival_settlement_effect(uuid,uuid,text,text,jsonb),public.fail_festival_settlement_effect(uuid,uuid,text,jsonb,boolean),public.finalise_ready_festival_settlement_effects() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_festival_settlement_effect(integer),public.apply_festival_settlement_effect_authority(uuid,uuid),public.acknowledge_festival_settlement_effect(uuid,uuid,text,text,jsonb),public.fail_festival_settlement_effect(uuid,uuid,text,jsonb,boolean),public.finalise_ready_festival_settlement_effects() TO service_role;
REVOKE ALL ON FUNCTION public.resume_festival_settlement_effects(uuid,uuid),public.get_festival_settlement_effect_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resume_festival_settlement_effects(uuid,uuid),public.get_festival_settlement_effect_progress(uuid) TO authenticated,service_role;

-- Replace the placeholder builder. This authority calculates and prepares only;
-- it never mutates progression and never marks an outcome applied.
CREATE OR REPLACE FUNCTION public._festival_apply_outcomes(p_settlement uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; subject record; oid uuid; score numeric; payload jsonb; kind text;
BEGIN
 SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement FOR UPDATE;
 UPDATE public.festival_edition_settlements SET state='calculating_outcomes',updated_at=now() WHERE id=s.id AND state='financial_posting_complete';
 score:=greatest(0,least(100,coalesce((s.input_snapshot#>>'{runtimeCompletionDigest,summary,audienceScore}')::numeric,0)));
 INSERT INTO public.festival_edition_settlement_outcomes(settlement_id,outcome_type,subject_type,subject_id,final_score,components,effects,rules_version,evidence_references,applied_at)
 VALUES(s.id,'audience','edition',s.edition_id::text,score,jsonb_build_object('audience',score),'{}','festival-outcomes-v2',jsonb_build_object('inputDigest',s.input_digest,'source','immutable runtime completion digest'),NULL)
 ON CONFLICT DO NOTHING;
 FOR subject IN
  SELECT 'artist'::text outcome_type,'band'::text subject_type,l.recipient_id::text subject_id,
   greatest(0,least(100,coalesce((l.evidence_reference->>'performanceScore')::numeric,score))) final_score,
   jsonb_build_object('settlementLineId',l.id,'contractId',l.contract_id,'evidence',l.evidence_reference) evidence
  FROM public.festival_edition_settlement_lines l WHERE l.settlement_id=s.id AND l.category LIKE 'artist%' AND l.recipient_type='band' AND l.recipient_id IS NOT NULL
  UNION ALL
  SELECT 'sponsor','sponsor_agreement',l.contract_id::text,greatest(0,least(100,coalesce((l.evidence_reference->>'satisfactionScore')::numeric,score))),
   jsonb_build_object('settlementLineId',l.id,'agreementId',l.contract_id,'evidence',l.evidence_reference)
  FROM public.festival_edition_settlement_lines l WHERE l.settlement_id=s.id AND l.category LIKE 'sponsor%' AND l.contract_id IS NOT NULL
 LOOP
  INSERT INTO public.festival_edition_settlement_outcomes(settlement_id,outcome_type,subject_type,subject_id,final_score,components,effects,rules_version,evidence_references,applied_at)
  VALUES(s.id,subject.outcome_type,subject.subject_type,subject.subject_id,subject.final_score,jsonb_build_object('evidenceScore',subject.final_score),'{}','festival-outcomes-v2',subject.evidence,NULL)
  ON CONFLICT DO NOTHING;
 END LOOP;
 FOR oid,kind,score IN SELECT o.id,o.outcome_type,o.final_score FROM public.festival_edition_settlement_outcomes o WHERE o.settlement_id=s.id LOOP
  IF kind='audience' THEN
   FOREACH kind IN ARRAY ARRAY['festival_company_reputation','festival_company_fame','licence_progress','tax_projection','world_event','notification'] LOOP
    INSERT INTO public.festival_edition_settlement_effects(settlement_id,outcome_id,effect_type,subject_type,subject_id,stable_reference,requested_payload,status,required,result,applied_at)
    VALUES(s.id,oid,kind,'festival_company',s.festival_company_id::text,'festival-settlement:'||s.id||':'||kind||':'||s.festival_company_id,
      jsonb_build_object('score',score,'evidenceDigest',s.input_digest,'rulesVersion','festival-outcomes-v2'), 'pending',true,NULL,NULL) ON CONFLICT DO NOTHING;
   END LOOP;
  ELSIF kind='artist' THEN
   FOREACH kind IN ARRAY ARRAY['performance_result','band_fans','band_fame','band_chemistry','artist_relationship'] LOOP
    INSERT INTO public.festival_edition_settlement_effects(settlement_id,outcome_id,effect_type,subject_type,subject_id,stable_reference,requested_payload,status,required,result,applied_at)
    SELECT s.id,oid,kind,o.subject_type,o.subject_id,'festival-settlement:'||s.id||':'||kind||':'||o.subject_id,
      jsonb_build_object('score',score,'boundedDelta',greatest(0,least(10,round((score-50)/5))),'evidence',o.evidence_references,'rulesVersion','festival-outcomes-v2'),'pending',true,NULL,NULL
    FROM public.festival_edition_settlement_outcomes o WHERE o.id=oid ON CONFLICT DO NOTHING;
   END LOOP;
  ELSE
   INSERT INTO public.festival_edition_settlement_effects(settlement_id,outcome_id,effect_type,subject_type,subject_id,stable_reference,requested_payload,status,required,result,applied_at)
   SELECT s.id,oid,'sponsor_relationship',o.subject_type,o.subject_id,'festival-settlement:'||s.id||':sponsor_relationship:'||o.subject_id,
    jsonb_build_object('score',score,'evidence',o.evidence_references,'rulesVersion','festival-outcomes-v2'),'pending',true,NULL,NULL FROM public.festival_edition_settlement_outcomes o WHERE o.id=oid ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects WHERE settlement_id=s.id AND required) THEN RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_EFFECTS_REQUIRED'; END IF;
 UPDATE public.festival_edition_settlements SET state='outcomes_calculated',updated_at=now() WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public._festival_apply_outcomes(uuid) FROM PUBLIC,anon,authenticated;
