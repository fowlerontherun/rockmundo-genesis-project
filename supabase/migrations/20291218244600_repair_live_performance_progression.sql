-- Repair and certification boundary for the shared live-performance authority.
-- This migration is additive because 20291218244500 has already shipped.

ALTER TABLE public.live_performance_outcomes ALTER COLUMN band_id DROP NOT NULL;
ALTER TABLE public.live_performance_outcomes
  ADD COLUMN performer_type text,
  ADD COLUMN performer_id uuid,
  ADD COLUMN solo_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN npc_artist_id uuid,
  ADD COLUMN score numeric,
  ADD COLUMN score_min numeric,
  ADD COLUMN score_max numeric,
  ADD COLUMN normalised_score numeric,
  ADD COLUMN performance_grade text;

UPDATE public.live_performance_outcomes SET
 performer_type='band', performer_id=band_id,
 score=coalesce((evidence->>'score')::numeric,0), score_min=0, score_max=100,
 normalised_score=least(100,greatest(0,coalesce((evidence->>'score')::numeric,0))),
 performance_grade=CASE WHEN coalesce((evidence->>'score')::numeric,0)>=90 THEN 'S'
   WHEN coalesce((evidence->>'score')::numeric,0)>=75 THEN 'A'
   WHEN coalesce((evidence->>'score')::numeric,0)>=60 THEN 'B'
   WHEN coalesce((evidence->>'score')::numeric,0)>=40 THEN 'C' ELSE 'D' END;

ALTER TABLE public.live_performance_outcomes
 ALTER COLUMN performer_type SET NOT NULL, ALTER COLUMN performer_id SET NOT NULL,
 ALTER COLUMN score SET NOT NULL, ALTER COLUMN score_min SET NOT NULL,
 ALTER COLUMN score_max SET NOT NULL, ALTER COLUMN normalised_score SET NOT NULL,
 ALTER COLUMN performance_grade SET NOT NULL,
 ADD CONSTRAINT live_performance_outcome_performer_type CHECK (performer_type IN ('band','solo_artist','npc_artist')),
 ADD CONSTRAINT live_performance_outcome_identity CHECK (
   (performer_type='band' AND performer_id=band_id AND band_id IS NOT NULL AND solo_profile_id IS NULL AND npc_artist_id IS NULL) OR
   (performer_type='solo_artist' AND performer_id=solo_profile_id AND band_id IS NULL AND solo_profile_id IS NOT NULL AND npc_artist_id IS NULL) OR
   (performer_type='npc_artist' AND performer_id=npc_artist_id AND band_id IS NULL AND solo_profile_id IS NULL AND npc_artist_id IS NOT NULL)),
 ADD CONSTRAINT live_performance_outcome_score_scale CHECK
   (score_max>score_min AND score BETWEEN score_min AND score_max AND normalised_score BETWEEN 0 AND 100);

-- Keep the already-shipped shared RPC compatible while deriving identity and
-- scale from the immutable runtime performance. New callers may set these
-- fields explicitly; the trigger verifies/fills only missing values.
CREATE OR REPLACE FUNCTION public._prepare_live_performance_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.festival_runtime_performances%ROWTYPE; raw_score numeric;
BEGIN
 IF NEW.source_type='festival_performance' THEN
  SELECT * INTO p FROM public.festival_runtime_performances WHERE id=NEW.source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LIVE_PERFORMANCE_SOURCE_MISSING'; END IF;
  NEW.performer_type:=coalesce(NEW.performer_type,CASE WHEN p.band_id IS NOT NULL THEN 'band' WHEN p.solo_artist_profile_id IS NOT NULL THEN 'solo_artist' ELSE 'npc_artist' END);
  NEW.band_id:=coalesce(NEW.band_id,p.band_id); NEW.solo_profile_id:=coalesce(NEW.solo_profile_id,p.solo_artist_profile_id);
  NEW.npc_artist_id:=coalesce(NEW.npc_artist_id,p.npc_artist_id);
  NEW.performer_id:=coalesce(NEW.performer_id,p.band_id,p.solo_artist_profile_id,p.npc_artist_id);
  NEW.subject_type:=NEW.performer_type; NEW.subject_id:=NEW.performer_id;
  NEW.stable_reference:=coalesce(NEW.stable_reference,'festival-performance:'||p.id||':performance_result:'||NEW.performer_id);
 END IF;
 raw_score:=coalesce(NEW.score,(NEW.evidence->>'score')::numeric,0);
 NEW.score:=raw_score; NEW.score_min:=coalesce(NEW.score_min,0);
 -- Festival runtime scores are contractually 0..100. A 0..25 caller must pass
 -- its scale explicitly; values are never guessed from magnitude.
 NEW.score_max:=coalesce(NEW.score_max,100);
 NEW.normalised_score:=coalesce(NEW.normalised_score,public.normalise_live_performance_score(raw_score,NEW.score_min,NEW.score_max));
 NEW.performance_grade:=coalesce(NEW.performance_grade,CASE WHEN NEW.normalised_score>=90 THEN 'S' WHEN NEW.normalised_score>=75 THEN 'A' WHEN NEW.normalised_score>=60 THEN 'B' WHEN NEW.normalised_score>=40 THEN 'C' ELSE 'D' END);
 RETURN NEW;
END $$;
CREATE TRIGGER prepare_live_performance_outcome BEFORE INSERT ON public.live_performance_outcomes
 FOR EACH ROW EXECUTE FUNCTION public._prepare_live_performance_outcome();

-- LIKE does not copy foreign keys. Make every cloned ledger point at its domain outcome.
ALTER TABLE public.band_fame_progression_events ADD CONSTRAINT band_fame_progression_outcome_fk
 FOREIGN KEY (performance_outcome_id) REFERENCES public.live_performance_outcomes(id) ON DELETE RESTRICT;
ALTER TABLE public.member_xp_transactions ADD CONSTRAINT member_xp_transaction_outcome_fk
 FOREIGN KEY (performance_outcome_id) REFERENCES public.live_performance_outcomes(id) ON DELETE RESTRICT;
ALTER TABLE public.song_performance_progression_events ADD CONSTRAINT song_progression_outcome_fk
 FOREIGN KEY (performance_outcome_id) REFERENCES public.live_performance_outcomes(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.normalise_live_performance_score(p_score numeric,p_min numeric,p_max numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE STRICT SET search_path='' AS $$
BEGIN
 IF p_max<=p_min OR p_score<p_min OR p_score>p_max THEN RAISE EXCEPTION 'LIVE_PERFORMANCE_SCORE_OUT_OF_RANGE'; END IF;
 RETURN round(((p_score-p_min)/(p_max-p_min))*100,4);
END $$;

CREATE OR REPLACE FUNCTION public.live_performance_canonical_record_type(p_effect_type text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT CASE $1
 WHEN 'performance_result' THEN 'performance_outcome' WHEN 'band_fans' THEN 'fan_event'
 WHEN 'band_fame' THEN 'fame_event' WHEN 'member_xp' THEN 'xp_transaction'
 WHEN 'band_chemistry' THEN 'contribution_event' WHEN 'song_familiarity' THEN 'song_progression_event'
 WHEN 'song_popularity' THEN 'song_popularity_event' END $$;

-- A receipt is valid only while its typed domain row exists. This intentionally
-- checks ledger identity, not a historical event's after_state against today's projection.
CREATE OR REPLACE FUNCTION public._festival_canonical_record_exists(p_table text,p_id uuid,p_result jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE ok boolean:=false;
BEGIN
 CASE p_table
  WHEN 'live_performance_outcomes' THEN SELECT EXISTS(SELECT 1 FROM public.live_performance_outcomes x WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest' AND x.rules_version=p_result->>'rules_version') INTO ok;
  WHEN 'band_fan_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.band_fan_progression_events x WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest' AND x.validated_change=p_result->'validated_change') INTO ok;
  WHEN 'band_fame_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.band_fame_progression_events x WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest' AND x.validated_change=p_result->'validated_change') INTO ok;
  WHEN 'member_xp_transactions' THEN SELECT EXISTS(SELECT 1 FROM public.member_xp_transactions x WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest' AND x.validated_change=p_result->'validated_change') INTO ok;
  WHEN 'band_contribution_events' THEN SELECT EXISTS(SELECT 1 FROM public.band_contribution_events x WHERE x.id=p_id AND x.metadata->>'stable_reference'=p_result->>'stable_reference') INTO ok;
  WHEN 'song_performance_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.song_performance_progression_events x WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest' AND x.validated_change=p_result->'validated_change') INTO ok;
  ELSE ok:=false;
 END CASE;
 RETURN ok;
END $$;

-- Persist the complete canonical envelope using the post-rename receipt schema.
CREATE OR REPLACE FUNCTION public._festival_record_authority_result(p_effect_id uuid,p_authority text,p_entity_type text,p_entity_id text,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_edition_settlement_effects%ROWTYPE;o public.festival_edition_settlement_outcomes%ROWTYPE;r public.festival_effect_authority_results%ROWTYPE; typ text; rid uuid; expected_digest text;
BEGIN
 SELECT * INTO e FROM public.festival_edition_settlement_effects WHERE id=p_effect_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_NOT_FOUND'); END IF;
 SELECT * INTO o FROM public.festival_edition_settlement_outcomes WHERE id=e.outcome_id;
 typ:=public.live_performance_canonical_record_type(e.effect_type);
 IF typ IS NULL THEN typ:=p_entity_type; END IF;
 rid:=p_entity_id::uuid;
 expected_digest:=encode(digest((o.evidence_references||jsonb_build_object('rulesVersion',o.rules_version))::text,'sha256'),'hex');
 p_result:=p_result||jsonb_build_object('canonical_record_type',typ,'canonical_record_id',p_entity_id);
 IF p_result->>'canonical_authority'<>p_authority OR p_result->>'stable_reference'<>e.stable_reference
   OR p_result->>'subject_type'<>e.subject_type OR p_result->>'subject_id'<>e.subject_id
   OR p_result->'requested_change' IS DISTINCT FROM e.requested_payload
   OR p_result->>'evidence_digest'<>expected_digest OR p_result->>'rules_version'<>o.rules_version
   OR NOT public._festival_canonical_record_exists(p_result->>'canonical_table_or_service',rid,p_result) THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END IF;
 SELECT * INTO r FROM public.festival_effect_authority_results WHERE effect_id=e.id;
 IF FOUND THEN
  IF r.canonical_authority<>p_authority OR r.canonical_record_id<>p_entity_id OR r.applied_result<>p_result
    OR NOT public._festival_canonical_record_exists(r.canonical_table_or_service,r.canonical_record_id::uuid,r.applied_result) THEN
    PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CONFLICTING_REPLAY');
  END IF;
  RETURN jsonb_build_object('status','applied','canonicalId',r.canonical_record_id,'result',r.applied_result);
 END IF;
 INSERT INTO public.festival_effect_authority_results(effect_id,settlement_id,outcome_id,canonical_authority,stable_reference,
  canonical_table_or_service,canonical_record_id,subject_type,subject_id,before_state,requested_change,validated_change,after_state,
  applied_at,applied_result,evidence_digest,rules_version)
 VALUES(e.id,e.settlement_id,e.outcome_id,p_authority,e.stable_reference,p_result->>'canonical_table_or_service',p_entity_id,
  e.subject_type,e.subject_id,p_result->'before_state',p_result->'requested_change',p_result->'validated_change',p_result->'after_state',
  (p_result->>'applied_at')::timestamptz,p_result,expected_digest,o.rules_version) RETURNING * INTO r;
 RETURN jsonb_build_object('status','applied','canonicalId',r.canonical_record_id,'result',r.applied_result);
END $$;

-- Verification helpers deliberately expose only boolean evidence checks.
CREATE OR REPLACE FUNCTION public.verify_live_performance_outcome(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('live_performance_outcomes',$1,$2)$$;
CREATE OR REPLACE FUNCTION public.verify_band_fan_progression_event(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('band_fan_progression_events',$1,$2)$$;
CREATE OR REPLACE FUNCTION public.verify_band_fame_progression_event(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('band_fame_progression_events',$1,$2)$$;
CREATE OR REPLACE FUNCTION public.verify_member_xp_transaction(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('member_xp_transactions',$1,$2)$$;
CREATE OR REPLACE FUNCTION public.verify_band_performance_contribution(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('band_contribution_events',$1,$2)$$;
CREATE OR REPLACE FUNCTION public.verify_song_performance_progression_event(uuid,jsonb) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS $$SELECT public._festival_canonical_record_exists('song_performance_progression_events',$1,$2)$$;

-- Append-only domain ledgers and least-privilege RPCs.
REVOKE UPDATE,DELETE ON public.band_contribution_events,public.relationship_events,public.song_performance_progression_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public._apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text),
 public._festival_record_authority_result(uuid,text,text,text,jsonb),public._festival_effect_authority_context(uuid,uuid,uuid,text,text,text,jsonb,text),
 public._festival_canonical_record_exists(text,uuid,jsonb),public.normalise_live_performance_score(numeric,numeric,numeric),
 public.live_performance_canonical_record_type(text),public._prepare_live_performance_outcome() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text),
 public._festival_record_authority_result(uuid,text,text,text,jsonb),public._festival_effect_authority_context(uuid,uuid,uuid,text,text,text,jsonb,text),
 public._festival_canonical_record_exists(text,uuid,jsonb),public.normalise_live_performance_score(numeric,numeric,numeric),
 public.live_performance_canonical_record_type(text),public._prepare_live_performance_outcome() TO service_role;

REVOKE ALL ON FUNCTION public.verify_live_performance_outcome(uuid,jsonb),public.verify_band_fan_progression_event(uuid,jsonb),
 public.verify_band_fame_progression_event(uuid,jsonb),public.verify_member_xp_transaction(uuid,jsonb),
 public.verify_band_performance_contribution(uuid,jsonb),public.verify_song_performance_progression_event(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_live_performance_outcome(uuid,jsonb),public.verify_band_fan_progression_event(uuid,jsonb),
 public.verify_band_fame_progression_event(uuid,jsonb),public.verify_member_xp_transaction(uuid,jsonb),
 public.verify_band_performance_contribution(uuid,jsonb),public.verify_song_performance_progression_event(uuid,jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.apply_festival_performance_result_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_band_fans_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_band_fame_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_member_xp_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_band_chemistry_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_song_familiarity_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_song_popularity_effect(uuid,uuid,uuid,text,text,text,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_performance_result_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_band_fans_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_band_fame_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_member_xp_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_band_chemistry_effect(uuid,uuid,uuid,text,text,text,jsonb),
 public.apply_festival_song_familiarity_effect(uuid,uuid,uuid,text,text,text,jsonb),public.apply_festival_song_popularity_effect(uuid,uuid,uuid,text,text,text,jsonb)
 TO service_role;
