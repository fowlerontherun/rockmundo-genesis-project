\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE role_name text; fn text;
BEGIN
 -- Migration compatibility and score fixtures (shared with the TypeScript test).
 IF public.normalise_live_performance_score(0,0,25)<>0
   OR public.normalise_live_performance_score(25,0,25)<>100
   OR public.normalise_live_performance_score(12.5,0,25)<>50
   OR public.normalise_live_performance_score(50,0,100)<>50 THEN
   RAISE EXCEPTION 'score normalisation fixture mismatch';
 END IF;
 BEGIN PERFORM public.normalise_live_performance_score(26,0,25); RAISE EXCEPTION 'invalid score accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'LIVE_PERFORMANCE_SCORE_OUT_OF_RANGE' THEN RAISE; END IF; END;

 IF public.live_performance_canonical_record_type('performance_result')<>'performance_outcome'
 OR public.live_performance_canonical_record_type('band_fans')<>'fan_event'
 OR public.live_performance_canonical_record_type('band_fame')<>'fame_event'
 OR public.live_performance_canonical_record_type('member_xp')<>'xp_transaction'
 OR public.live_performance_canonical_record_type('band_chemistry')<>'contribution_event'
 OR public.live_performance_canonical_record_type('song_familiarity')<>'song_progression_event'
 OR public.live_performance_canonical_record_type('song_popularity')<>'song_popularity_event' THEN
   RAISE EXCEPTION 'canonical record catalogue mismatch';
 END IF;

 FOREACH role_name IN ARRAY ARRAY['PUBLIC','anon','authenticated'] LOOP
  FOREACH fn IN ARRAY ARRAY[
   '_apply_live_performance_progression(uuid,uuid,uuid,text,text,text,jsonb,text,text)',
   '_festival_record_authority_result(uuid,text,text,text,jsonb)',
   '_festival_effect_authority_context(uuid,uuid,uuid,text,text,text,jsonb,text)',
   '_festival_canonical_record_exists(text,uuid,jsonb)'] LOOP
   IF has_function_privilege(role_name,'public.'||fn,'EXECUTE') THEN
    RAISE EXCEPTION '% can execute internal function %',role_name,fn;
   END IF;
  END LOOP;
 END LOOP;

 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='festival_effect_authority_results' AND column_name IN ('authority','canonical_entity_type','canonical_entity_id')) THEN
   RAISE EXCEPTION 'obsolete authority receipt columns remain';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='live_performance_outcome_identity') THEN
   RAISE EXCEPTION 'performer identity constraint missing';
 END IF;
END $$;

-- This harness is destructive by design and therefore always rolls back. Full
-- seeded effect/replay assertions may be added below without leaking fixtures.
ROLLBACK;
