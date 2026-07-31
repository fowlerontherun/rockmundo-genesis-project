-- Complete the replay boundary and publish deterministic rules for all live performances.
-- SQL is the authority; TypeScript contains a preview-only mirror of these functions.

ALTER TABLE public.live_performance_outcomes DROP CONSTRAINT live_performance_outcomes_source_type_check;
ALTER TABLE public.live_performance_outcomes ADD CONSTRAINT live_performance_outcomes_source_type_check
 CHECK (source_type IN ('ordinary_gig','festival_performance','battle_of_the_bands','live_event'));

ALTER TABLE public.live_performance_outcomes
 ADD COLUMN audience integer NOT NULL DEFAULT 0 CHECK (audience >= 0),
 ADD COLUMN completed_song_ids uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN participating_profile_ids uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN stage jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN billing text,
 ADD COLUMN crowd_response jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN reversed_at timestamptz,
 ADD COLUMN reversal_event_id uuid;

ALTER TABLE public.band_fan_progression_events ADD COLUMN reversed_at timestamptz;
ALTER TABLE public.band_fame_progression_events ADD COLUMN reversed_at timestamptz;
ALTER TABLE public.member_xp_transactions ADD COLUMN reversed_at timestamptz;
ALTER TABLE public.song_performance_progression_events ADD COLUMN reversed_at timestamptz;

CREATE TABLE public.live_performance_progression_repairs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ledger_table text NOT NULL,
 original_event_id uuid NOT NULL, reason text NOT NULL, actor_id uuid NOT NULL,
 correction_amount jsonb NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (ledger_table, original_event_id)
);
ALTER TABLE public.live_performance_progression_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_performance_progression_repairs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calculate_live_performance_fans(e jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 WITH x AS (SELECT greatest(0,(e->>'audience')::int) audience,
   greatest(0,least(100,(e->>'normalised_score')::numeric)) score,
   greatest(0,coalesce((e->>'existing_fame')::numeric,0)) fame,
   greatest(.8,least(1.2,coalesce((e->>'frozen_variance')::numeric,1))) variance),
 t AS (SELECT least(1000000,greatest(0,floor(audience*.02*(1+score/100)*greatest(.3,1-fame/10000)*variance)))::int total,score FROM x),
 a AS (SELECT total,floor(total*(CASE WHEN score>=88 THEN .15 WHEN score>=64 THEN .05 ELSE .02 END))::int superfans,
   floor(total*(CASE WHEN score>=88 THEN .35 WHEN score>=64 THEN .25 ELSE .10 END))::int dedicated FROM t)
 SELECT jsonb_build_object('total',total,'casual',total-dedicated-superfans,'dedicated',dedicated,'superfans',superfans) FROM a $$;

CREATE OR REPLACE FUNCTION public.calculate_live_performance_fame(e jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT least(20,greatest(-10,
 round(((e->>'normalised_score')::numeric-55)/10)::int + CASE WHEN (e->>'audience')::int>=5000 THEN 2 WHEN (e->>'audience')::int>=1000 THEN 1 ELSE 0 END)) $$;
CREATE OR REPLACE FUNCTION public.calculate_live_performance_member_xp(e jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT CASE WHEN e->>'attendance' IN ('present','late')
 THEN least(100,greatest(1,round((e->>'normalised_score')::numeric/5)::int)) ELSE 0 END $$;
CREATE OR REPLACE FUNCTION public.calculate_live_performance_chemistry_impact(e jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT CASE WHEN e->>'attendance' NOT IN ('present','late') THEN '{}'
 ELSE jsonb_build_object('familiarity',2,'trust',2,'performance_chemistry',CASE WHEN (e->>'normalised_score')::numeric>=75 THEN 4 ELSE 2 END,'reliability_confidence',CASE WHEN e->>'attendance'='late' THEN 0 ELSE 1 END) END $$;
-- Familiarity is stored in rehearsal-equivalent minutes (band_song_familiarity.familiarity_minutes), capped at 10,000.
CREATE OR REPLACE FUNCTION public.calculate_live_performance_song_familiarity(e jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT CASE WHEN coalesce((e->>'completed')::boolean,false)
 THEN least(10,greatest(1,round((e->>'normalised_score')::numeric/20)::int)) ELSE 0 END $$;
CREATE OR REPLACE FUNCTION public.calculate_live_performance_song_popularity(e jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$ SELECT CASE WHEN coalesce((e->>'completed')::boolean,false) THEN least(10,greatest(0,
 round(((e->>'normalised_score')::numeric-50)/10)::int + CASE WHEN (e->>'audience')::int>=1000 THEN 1 ELSE 0 END)) ELSE 0 END $$;

-- Put replay in front of every mutation.  The shipped implementation remains the
-- fresh-application worker, but can no longer run when a receipt already exists.
ALTER FUNCTION public._apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text)
 RENAME TO _apply_live_performance_progression_fresh;
CREATE FUNCTION public._apply_live_performance_progression(
 p_effect_id uuid,p_settlement_id uuid,p_outcome_id uuid,p_subject_type text,p_subject_id text,p_stable_reference text,p_requested_payload jsonb,p_kind text,p_authority text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; persisted jsonb; table_name text; record_id uuid;
BEGIN
 c:=public._festival_effect_authority_context(p_effect_id,p_settlement_id,p_outcome_id,p_subject_type,p_subject_id,p_stable_reference,p_requested_payload,p_kind);
 IF coalesce((c->>'replay')::boolean,false) THEN
  persisted:=c->'result'; table_name:=persisted->>'canonical_table_or_service'; record_id:=(persisted->>'canonical_record_id')::uuid;
  IF persisted->>'canonical_authority'<>p_authority OR persisted->>'stable_reference'<>p_stable_reference
    OR persisted->>'subject_type'<>p_subject_type OR persisted->>'subject_id'<>p_subject_id
    OR NOT public._festival_canonical_record_exists(table_name,record_id,persisted) THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CONFLICTING_REPLAY');
  END IF;
  -- Return the byte-for-byte persisted envelope, including the domain event's original applied_at.
  RETURN jsonb_build_object('status','applied','canonicalId',record_id,'result',persisted);
 END IF;
 RETURN public._apply_live_performance_progression_fresh(p_effect_id,p_settlement_id,p_outcome_id,p_subject_type,p_subject_id,p_stable_reference,p_requested_payload,p_kind,p_authority);
END $$;

-- Fresh timestamps are transport metadata, not progression semantics.
CREATE OR REPLACE FUNCTION public._festival_authority_results_semantically_equal(a jsonb,b jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT (a-'applied_at')=(b-'applied_at') $$;

REVOKE ALL ON FUNCTION public._apply_live_performance_progression_fresh(uuid,uuid,uuid,text,text,text,jsonb,text,text),
 public._apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text),
 public._festival_authority_results_semantically_equal(jsonb,jsonb),
 public.calculate_live_performance_fans(jsonb),public.calculate_live_performance_fame(jsonb),
 public.calculate_live_performance_member_xp(jsonb),public.calculate_live_performance_chemistry_impact(jsonb),
 public.calculate_live_performance_song_familiarity(jsonb),public.calculate_live_performance_song_popularity(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text),
 public._festival_authority_results_semantically_equal(jsonb,jsonb),public.calculate_live_performance_fans(jsonb),
 public.calculate_live_performance_fame(jsonb),public.calculate_live_performance_member_xp(jsonb),
 public.calculate_live_performance_chemistry_impact(jsonb),public.calculate_live_performance_song_familiarity(jsonb),
 public.calculate_live_performance_song_popularity(jsonb) TO service_role;


-- Receipt replay compares authoritative fields while ignoring transport timestamps.
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
  IF r.canonical_authority<>p_authority OR r.canonical_record_id<>p_entity_id OR NOT public._festival_authority_results_semantically_equal(r.applied_result,p_result)
    OR NOT public._festival_canonical_record_exists(r.canonical_table_or_service,r.canonical_record_id::uuid,r.applied_result) THEN
    PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CONFLICTING_REPLAY');
  END IF;
  -- Never replace the stored envelope or its original domain timestamp on replay.
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

-- Rebind public adapters after renaming the shipped fresh worker.
CREATE OR REPLACE FUNCTION public.apply_festival_performance_result_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'performance_result','apply_festival_performance_result_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_band_fans_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'band_fans','apply_festival_band_fans_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_band_fame_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'band_fame','apply_festival_band_fame_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_member_xp_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'member_xp','apply_festival_member_xp_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_band_chemistry_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'band_chemistry','apply_festival_band_chemistry_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_song_familiarity_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'song_familiarity','apply_festival_song_familiarity_effect')$$;
CREATE OR REPLACE FUNCTION public.apply_festival_song_popularity_effect(uuid,uuid,uuid,text,text,text,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$SELECT public._apply_live_performance_progression($1,$2,$3,$4,$5,$6,$7,'song_popularity','apply_festival_song_popularity_effect')$$;
