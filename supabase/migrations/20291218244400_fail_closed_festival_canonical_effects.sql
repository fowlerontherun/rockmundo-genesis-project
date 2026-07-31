-- A Festival receipt is an audit pointer, never the progression authority.
ALTER TABLE public.festival_effect_authority_results
  RENAME COLUMN authority TO canonical_authority;
ALTER TABLE public.festival_effect_authority_results
  RENAME COLUMN canonical_entity_type TO canonical_table_or_service;
ALTER TABLE public.festival_effect_authority_results
  RENAME COLUMN canonical_entity_id TO canonical_record_id;
ALTER TABLE public.festival_effect_authority_results
  ADD COLUMN subject_type text,
  ADD COLUMN subject_id text,
  ADD COLUMN before_state jsonb,
  ADD COLUMN requested_change jsonb,
  ADD COLUMN validated_change jsonb,
  ADD COLUMN after_state jsonb,
  ADD COLUMN applied_at timestamptz;

UPDATE public.festival_effect_authority_results r SET
 subject_type=e.subject_type, subject_id=e.subject_id,
 requested_change=e.requested_payload, applied_at=r.created_at
FROM public.festival_edition_settlement_effects e WHERE e.id=r.effect_id;

-- Old rows were surrogate receipts.  They deliberately remain unverifiable;
-- replay must repair them through a domain adapter rather than grandfather them.
ALTER TABLE public.festival_effect_authority_results
  ADD CONSTRAINT festival_authority_applied_shape CHECK (
    applied_at IS NULL OR (subject_type IS NOT NULL AND subject_id IS NOT NULL
      AND before_state IS NOT NULL AND requested_change IS NOT NULL
      AND validated_change IS NOT NULL AND after_state IS NOT NULL)) NOT VALID;

CREATE OR REPLACE FUNCTION public._festival_effect_authority_context(
 p_effect_id uuid,p_settlement_id uuid,p_outcome_id uuid,p_subject_type text,p_subject_id text,
 p_stable_reference text,p_requested_payload jsonb,p_expected_type text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE;o public.festival_edition_settlement_outcomes%ROWTYPE;s public.festival_edition_settlements%ROWTYPE;r public.festival_effect_authority_results%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_NOT_FOUND'); END IF;
 IF e.settlement_id<>p_settlement_id OR e.outcome_id<>p_outcome_id OR e.effect_type<>p_expected_type
  OR e.subject_type<>p_subject_type OR e.subject_id<>p_subject_id OR e.stable_reference<>p_stable_reference
  OR e.requested_payload<>coalesce(p_requested_payload,'{}') THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_VALIDATION_MISMATCH');
 END IF;
 SELECT * INTO o FROM public.festival_edition_settlement_outcomes WHERE id=e.outcome_id AND settlement_id=e.settlement_id;
 SELECT * INTO s FROM public.festival_edition_settlements WHERE id=e.settlement_id;
 IF o.id IS NULL OR s.id IS NULL OR o.evidence_references IS NULL OR o.rules_version IS NULL OR s.input_digest IS NULL THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_IMMUTABLE_EVIDENCE_MISSING');
 END IF;
 SELECT * INTO r FROM public.festival_effect_authority_results WHERE effect_id=e.id;
 IF r.id IS NOT NULL THEN
  -- #1448 receipts cannot be replayed without loading their domain record. Since
  -- they did not identify a verifiable record type, force explicit repair.
  IF r.before_state IS NULL OR r.after_state IS NULL OR r.validated_change IS NULL THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RECORD_MISSING');
  END IF;
  RETURN jsonb_build_object('replay',true,'canonicalId',r.canonical_record_id,'result',r.applied_result,
   'outcome',to_jsonb(o),'settlement',to_jsonb(s));
 END IF;
 RETURN jsonb_build_object('replay',false,'outcome',to_jsonb(o),'settlement',to_jsonb(s));
END $$;

-- World events have their own crash-safe canonical idempotency boundary.
CREATE UNIQUE INDEX IF NOT EXISTS world_events_festival_stable_reference_unique
 ON public.world_events ((metadata->>'stableReference'))
 WHERE metadata ? 'stableReference' AND metadata->>'stableReference' LIKE 'festival-%';

-- The former implementation calculated a bounded delta, generated a UUID and
-- called that success.  There is intentionally no fallback now.  A wrapper not
-- yet replaced by a real domain adapter fails permanently and blocks completion.
CREATE OR REPLACE FUNCTION public._festival_apply_canonical_effect(
 p_effect_id uuid,p_settlement_id uuid,p_outcome_id uuid,p_subject_type text,p_subject_id text,
 p_stable_reference text,p_requested_payload jsonb,p_effect_type text,p_handler text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public._festival_effect_authority_context(p_effect_id,p_settlement_id,p_outcome_id,
   p_subject_type,p_subject_id,p_stable_reference,p_requested_payload,p_effect_type);
 PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING');
 RETURN NULL;
END $$;

-- Acknowledgement is independently gated.  Only a typed, evidence-bearing
-- domain result can cross the worker/database trust boundary.
CREATE OR REPLACE FUNCTION public._festival_assert_canonical_result(
 p_effect public.festival_edition_settlement_effects,p_canonical_id text,p_result jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE expected text;
BEGIN
 expected:=CASE p_effect.effect_type
  WHEN 'performance_result' THEN 'performance_outcome' WHEN 'band_fans' THEN 'fan_event'
  WHEN 'band_fame' THEN 'fame_event' WHEN 'member_xp' THEN 'xp_transaction'
  WHEN 'band_chemistry' THEN 'contribution_event' WHEN 'song_familiarity' THEN 'song_progression_event'
  WHEN 'song_popularity' THEN 'song_popularity_event' WHEN 'festival_company_reputation' THEN 'company_reputation_event'
  WHEN 'festival_company_fame' THEN 'company_fame_event' WHEN 'artist_relationship' THEN 'artist_relationship_event'
  WHEN 'sponsor_relationship' THEN 'sponsor_relationship_event' WHEN 'achievement_award' THEN 'achievement_award'
  WHEN 'licence_progress' THEN 'licence_progress_record' WHEN 'world_event' THEN 'world_event'
  WHEN 'notification' THEN 'notification' WHEN 'tax_projection' THEN 'tax_projection' END;
 IF expected IS NULL OR p_canonical_id IS NULL OR p_result->>'canonical_record_id'<>p_canonical_id
   OR p_result->>'canonical_record_type'<>expected OR p_result->>'stable_reference'<>p_effect.stable_reference
   OR p_result->>'subject_type'<>p_effect.subject_type OR p_result->>'subject_id'<>p_effect.subject_id
   OR nullif(p_result->>'evidence_digest','') IS NULL OR p_result->'before_state' IS NULL
   OR p_result->'validated_change' IS NULL OR p_result->'after_state' IS NULL THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END IF;
 -- Receipts can never point at themselves.
 IF EXISTS(SELECT 1 FROM public.festival_effect_authority_results r
   WHERE r.id::text=p_canonical_id) THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END IF;
END $$;

REVOKE ALL ON FUNCTION public._festival_assert_canonical_result(public.festival_edition_settlement_effects,text,jsonb)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.acknowledge_festival_settlement_effect(p_effect_id uuid,p_claim_token uuid,p_status text,p_applied_result jsonb,p_canonical_id text,p_failure_code text DEFAULT NULL,p_failure_details jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE; terminal text;
BEGIN
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id FOR UPDATE;
 IF NOT FOUND OR e.status<>'applying' OR e.claim_token IS DISTINCT FROM p_claim_token OR e.lease_expires_at<now() THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_RECOVERY_REQUIRED');
 END IF;
 IF p_status='applied' THEN PERFORM public._festival_assert_canonical_result(e,p_canonical_id,p_applied_result); END IF;
 terminal:=CASE WHEN p_status IN('failed','recovery_required') AND (e.attempt_count>=5 OR p_failure_code IN
  ('FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING','FESTIVAL_EFFECT_CANONICAL_RECORD_MISSING','FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID'))
  THEN 'dead_letter' ELSE p_status END;
 UPDATE public.festival_edition_settlement_effects SET status=terminal,
  applied_result=CASE WHEN terminal IN('applied','not_applicable') THEN p_applied_result END,
  canonical_transaction_or_event_id=CASE WHEN terminal='applied' THEN p_canonical_id END,
  applied_at=CASE WHEN terminal IN('applied','not_applicable') THEN now() END,
  failure_code=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN coalesce(p_failure_code,'FESTIVAL_EFFECT_APPLICATION_FAILED') END,
  failure_details=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN p_failure_details END,
  first_failed_at=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN coalesce(first_failed_at,now()) ELSE first_failed_at END,
  latest_failed_at=CASE WHEN terminal IN('failed','recovery_required','dead_letter') THEN now() ELSE latest_failed_at END,
  repair_recommendation=CASE WHEN terminal='dead_letter' THEN 'Install or repair the canonical domain adapter; receipts cannot be promoted' ELSE repair_recommendation END,
  claim_token=NULL,worker_identity=NULL,lease_expires_at=NULL WHERE id=e.id RETURNING * INTO e;
 IF terminal IN('failed','recovery_required','dead_letter') THEN
  UPDATE public.festival_edition_settlements SET state='recovery_required',updated_at=now() WHERE id=e.settlement_id;
 END IF;
 UPDATE public.festival_edition_settlement_outcomes o SET applied_at=now() WHERE o.id=e.outcome_id
  AND NOT EXISTS(SELECT 1 FROM public.festival_edition_settlement_effects x WHERE x.outcome_id=o.id AND x.status NOT IN('applied','not_applicable'));
 RETURN to_jsonb(e);
END $$;
