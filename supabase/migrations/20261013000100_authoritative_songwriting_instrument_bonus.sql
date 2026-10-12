-- Snapshot selected instrument quality in the authoritative songwriting completion.
-- The browser cannot supply a bonus; skill levels are resolved from the active profile.
CREATE OR REPLACE FUNCTION public.complete_songwriting_project_with_instruments(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;v_instruments text[];v_bonus integer;v_base integer;v_final integer;
 v_song uuid;v_breakdown jsonb;
BEGIN
 v_result:=public.complete_songwriting_project(p_profile_id,p_project_id,p_catalog_status,p_band_id);
 IF coalesce((v_result->>'duplicate')::boolean,false) THEN RETURN v_result; END IF;
 SELECT instruments INTO v_instruments FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'songwriting_project_profile_mismatch'; END IF;
 SELECT coalesce(round(sum(CASE WHEN item.ordinality<=4 THEN least(30,coalesce(sp.current_level,0)*1.5)
 ELSE least(15,coalesce(sp.current_level,0)*0.75) END)),0)::integer INTO v_bonus
 FROM unnest(coalesce(v_instruments,ARRAY[]::text[])) WITH ORDINALITY AS item(slug,ordinality)
 LEFT JOIN public.skill_progress sp ON sp.profile_id=p_profile_id AND sp.skill_slug=item.slug;
 v_bonus:=least(150,greatest(0,coalesce(v_bonus,0)));
 v_song:=nullif(v_result->>'song_id','')::uuid;
 IF v_song IS NULL THEN RAISE EXCEPTION 'songwriting_completion_missing_song'; END IF;
 v_base:=coalesce((v_result->>'final_score')::integer,0);
 v_final:=least(1000,greatest(0,v_base+v_bonus*10));
 v_breakdown:=coalesce(v_result->'breakdown','{}'::jsonb) ||
 jsonb_build_object('instrument_quality_bonus',v_bonus,'instrument_selection',to_jsonb(v_instruments),
 'pre_instrument_score',v_base,'final_score',v_final);
 UPDATE public.songs SET quality_score=v_final,song_rating=v_final,
 songwriting_breakdown=v_breakdown WHERE id=v_song;
 IF NOT FOUND THEN RAISE EXCEPTION 'songwriting_completion_song_update_failed'; END IF;
 UPDATE public.songwriting_projects SET song_rating=v_final,quality_score=round(v_final/10.0),
 songwriting_breakdown=v_breakdown,
 songwriting_input_snapshot=coalesce(songwriting_input_snapshot,'{}'::jsonb) ||
 jsonb_build_object('instrument_quality_bonus',v_bonus,'instrument_selection',to_jsonb(v_instruments)),
 updated_at=now() WHERE id=p_project_id AND profile_id=p_profile_id;
 RETURN v_result || jsonb_build_object('final_score',v_final,'breakdown',v_breakdown);
END $$;
REVOKE ALL ON FUNCTION public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_songwriting_project_with_instruments(uuid,uuid,text,uuid) TO authenticated;

-- The 'keep song as-is' path gets the exact same authoritative bonus and
-- remains all-or-nothing with the skipped final polish.
CREATE OR REPLACE FUNCTION public.skip_and_complete_songwriting_project_with_instruments(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.skip_songwriting_polish(p_profile_id,p_project_id);
 v_result:=public.complete_songwriting_project_with_instruments(
   p_profile_id,p_project_id,p_catalog_status,p_band_id);
 RETURN v_result||jsonb_build_object('polishSkipped',true);
END $$;
REVOKE ALL ON FUNCTION public.skip_and_complete_songwriting_project_with_instruments(uuid,uuid,text,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.skip_and_complete_songwriting_project_with_instruments(uuid,uuid,text,uuid)
 TO authenticated;
