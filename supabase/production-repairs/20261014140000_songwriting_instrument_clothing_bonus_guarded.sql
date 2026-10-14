-- RockMundo songwriting quality provenance and one-time bounded gameplay bonuses.
-- Production reconciliation only: do not replay the historical instrument migration.
-- Existing completed projects have no new-completion provenance marker, preserving their scores.
ALTER TABLE public.songwriting_projects
 ADD COLUMN IF NOT EXISTS songwriting_breakdown jsonb,
 ADD COLUMN IF NOT EXISTS songwriting_input_snapshot jsonb;
ALTER TABLE public.songs
 ADD COLUMN IF NOT EXISTS songwriting_breakdown jsonb;

CREATE OR REPLACE FUNCTION public.complete_songwriting_project_with_instruments(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_result jsonb;
 v_project public.songwriting_projects%ROWTYPE;
 v_song_id uuid;
 v_base integer;
 v_instrument_bonus integer := 0;
 v_clothing_pct numeric := 0;
 v_equipped_count integer := 0;
 v_final integer;
 v_breakdown jsonb;
BEGIN
 -- Core completion holds a row lock and either links the existing canonical
 -- song once or returns duplicate=true. All updates here share its transaction.
 v_result:=public.complete_songwriting_project(p_profile_id,p_project_id,p_catalog_status,p_band_id);
 IF coalesce((v_result->>'duplicate')::boolean,false) THEN RETURN v_result; END IF;

 SELECT * INTO v_project FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=auth.uid()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_OWNED' USING ERRCODE='42501'; END IF;

 -- Historical completed songs must never receive retroactive instrument/clothing
 -- bonuses just because their old empty project.song_id is resolved now.
 IF v_project.completion_quality_breakdown->>'source' IS DISTINCT FROM 'live_songwriting_quality' THEN
   RETURN v_result||jsonb_build_object('bonus_applied',false,'bonus_reason','historical_project_preserved');
 END IF;

 v_song_id:=nullif(v_result->>'song_id','')::uuid;
 v_base:=least(1000,greatest(0,coalesce((v_result->>'final_score')::integer,0)));
 IF v_song_id IS NULL THEN RAISE EXCEPTION 'SONGWRITING_SONG_NOT_RETURNED'; END IF;

 -- Dedupe declared instrument slugs before querying server-owned skill levels.
 SELECT coalesce(round(sum(
   CASE WHEN choices.position<=4
      THEN least(30,greatest(0,coalesce(levels.skill_level,0))*1.5)
      ELSE least(15,greatest(0,coalesce(levels.skill_level,0))*0.75)
   END
 )),0)::integer INTO v_instrument_bonus
 FROM (
   SELECT btrim(slug) slug,min(ordinality)::bigint position
   FROM unnest(coalesce(v_project.instruments,ARRAY[]::text[]))
      WITH ORDINALITY AS item(slug,ordinality)
   WHERE nullif(btrim(slug),'') IS NOT NULL
   GROUP BY btrim(slug)
 ) choices
 LEFT JOIN LATERAL (
   SELECT max(current_level) skill_level FROM public.skill_progress sp
   WHERE sp.profile_id=p_profile_id AND sp.skill_slug=choices.slug
 ) levels ON true;
 v_instrument_bonus:=least(150,greatest(0,coalesce(v_instrument_bonus,0)));

 SELECT coalesce(songwriting_pct,0),coalesce(equipped_bonus_items,0)
 INTO v_clothing_pct,v_equipped_count
 FROM public.get_equipped_clothing_bonuses(p_profile_id);
 v_clothing_pct:=least(20,greatest(0,coalesce(v_clothing_pct,0)));

 -- Both bonuses are bounded 0-1000 quality points. Crucially, do not multiply
 -- the skill bonus by 10: doing so can routinely make every song 1000/1000.
 v_final:=least(1000,greatest(0,round((v_base+v_instrument_bonus)*(1+v_clothing_pct/100.0))::integer));
 v_breakdown:=coalesce(v_result->'breakdown','{}'::jsonb) ||
 jsonb_build_object(
   'balance_version','live_songwriting_bonuses_v1',
   'base_score',v_base,
   'instrument_selection',to_jsonb(coalesce(v_project.instruments,ARRAY[]::text[])),
   'instrument_quality_bonus',v_instrument_bonus,
   'clothing_bonus_pct',v_clothing_pct,
   'clothing_bonus_items',v_equipped_count,
   'final_score',v_final
 );
 UPDATE public.songs SET
   quality_score=v_final,song_rating=v_final,
   songwriting_breakdown=v_breakdown,updated_at=now()
 WHERE id=v_song_id AND songwriting_project_id=p_project_id
   AND user_id=auth.uid() AND profile_id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_CANONICAL_SONG_OWNERSHIP_MISMATCH'; END IF;

 UPDATE public.songwriting_projects SET
   quality_score=v_final,song_rating=v_final,
   songwriting_breakdown=v_breakdown,
   songwriting_input_snapshot=coalesce(songwriting_input_snapshot,'{}'::jsonb) ||
    jsonb_build_object('instrument_quality_bonus',v_instrument_bonus,
      'clothing_bonus_pct',v_clothing_pct,'source','server_authoritative')
 WHERE id=p_project_id AND profile_id=p_profile_id;

 RETURN v_result || jsonb_build_object('final_score',v_final,'breakdown',v_breakdown,'bonus_applied',true);
END $$;
REVOKE ALL ON FUNCTION public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';