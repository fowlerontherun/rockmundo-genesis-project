-- Recognise legacy general instrument experience without granting every
-- specialist skill in that family, or counting the same general skill twice.
-- Score calculation remains server-owned and completed songs are untouched.

CREATE OR REPLACE FUNCTION public.songwriting_selected_instrument_bonus(
  p_profile_id uuid, p_instruments text[]
) RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  WITH choices AS (
    SELECT btrim(item.slug) AS slug, min(item.ordinality)::bigint AS position
    FROM unnest(coalesce(p_instruments, ARRAY[]::text[]))
      WITH ORDINALITY AS item(slug, ordinality)
    WHERE nullif(btrim(item.slug), '') IS NOT NULL
    GROUP BY btrim(item.slug)
  ), mapped AS (
    SELECT choices.*,
      CASE
        WHEN slug IN ('instruments_basic_acoustic_guitar','instruments_basic_electric_guitar','instruments_basic_classical_guitar') THEN 'guitar'
        WHEN slug IN ('instruments_basic_bass_guitar','instruments_basic_upright_bass') THEN 'bass'
        WHEN slug IN ('instruments_basic_classical_piano','instruments_basic_jazz_piano','instruments_basic_hammond_organ','instruments_basic_rhodes') THEN 'keys'
        WHEN slug = 'instruments_basic_analog_synth' THEN 'electronic'
        WHEN slug IN ('instruments_basic_rock_drums','instruments_basic_jazz_drums') THEN 'drums'
        WHEN slug IN ('instruments_basic_latin_percussion','instruments_basic_cajon') THEN 'percussion'
        WHEN slug IN ('instruments_basic_vocal_performance','instruments_basic_rapping') THEN 'vocals'
        WHEN slug IN ('instruments_basic_alto_sax','instruments_basic_flute','instruments_basic_clarinet') THEN 'woodwinds'
        WHEN slug IN ('instruments_basic_trumpet','instruments_basic_trombone') THEN 'brass'
        ELSE NULL
      END AS general_family,
      CASE
        WHEN slug IN ('instruments_basic_acoustic_guitar','instruments_basic_electric_guitar','instruments_basic_classical_guitar') THEN ARRAY['guitar']
        WHEN slug IN ('instruments_basic_bass_guitar','instruments_basic_upright_bass') THEN ARRAY['bass']
        WHEN slug IN ('instruments_basic_classical_piano','instruments_basic_jazz_piano') THEN ARRAY['piano','basic_keyboard']
        WHEN slug IN ('instruments_basic_hammond_organ','instruments_basic_rhodes') THEN ARRAY['basic_keyboard']
        WHEN slug = 'instruments_basic_analog_synth' THEN ARRAY['basic_electronic_instruments']
        WHEN slug IN ('instruments_basic_rock_drums','instruments_basic_jazz_drums') THEN ARRAY['drums','instruments_basic_drum_kit']
        WHEN slug IN ('instruments_basic_latin_percussion','instruments_basic_cajon') THEN ARRAY['basic_percussions']
        WHEN slug = 'instruments_basic_vocal_performance' THEN ARRAY['vocals','basic_singing','lead_vocals_mastery']
        WHEN slug = 'instruments_basic_rapping' THEN ARRAY['vocals','rapping']
        WHEN slug IN ('instruments_basic_alto_sax','instruments_basic_flute','instruments_basic_clarinet') THEN ARRAY['basic_woodwinds']
        WHEN slug IN ('instruments_basic_trumpet','instruments_basic_trombone') THEN ARRAY['basic_brass']
        ELSE ARRAY[]::text[]
      END AS general_slugs
    FROM choices
  ), levels AS (
    SELECT m.*,
      coalesce((SELECT max(greatest(0,sp.current_level))
        FROM public.skill_progress sp
        WHERE sp.profile_id=p_profile_id AND sp.skill_slug = ANY(ARRAY[
          m.slug,
          replace(m.slug,'instruments_basic_','instruments_professional_'),
          replace(m.slug,'instruments_basic_','instruments_mastery_')
        ])),0) AS specialist_level,
      coalesce((SELECT max(greatest(0,sp.current_level))
        FROM public.skill_progress sp
        WHERE sp.profile_id=p_profile_id AND sp.skill_slug = ANY(m.general_slugs)),0) AS general_level
    FROM mapped m
  ), credited AS (
    SELECT levels.*,
      row_number() OVER (
        PARTITION BY CASE WHEN specialist_level>0 THEN slug ELSE coalesce(general_family,slug) END
        ORDER BY position
      ) AS family_use
    FROM levels
  )
  SELECT least(150, greatest(0, coalesce(round(sum(
    CASE
      WHEN specialist_level>0 THEN
        CASE WHEN position<=4 THEN least(30,specialist_level*1.5)
             ELSE least(15,specialist_level*0.75) END
      WHEN general_level>0 AND general_family IS NOT NULL AND family_use=1 THEN
        CASE WHEN position<=4 THEN least(15,general_level*0.75)
             ELSE least(7.5,general_level*0.375) END
      ELSE 0
    END
  )),0)))::integer FROM credited;
$$;

REVOKE ALL ON FUNCTION public.songwriting_selected_instrument_bonus(uuid,text[]) FROM PUBLIC,anon,authenticated;

-- Keep the guarded canonical completion flow, its idempotency and ownership
-- checks, and the original clothing calculation. Only the instrument lookup
-- changes; no historical song is rescored.
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
 v_result:=public.complete_songwriting_project(p_profile_id,p_project_id,p_catalog_status,p_band_id);
 IF coalesce((v_result->>'duplicate')::boolean,false) THEN RETURN v_result; END IF;

 SELECT * INTO v_project FROM public.songwriting_projects
 WHERE id=p_project_id AND profile_id=p_profile_id AND user_id=auth.uid()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SONGWRITING_PROJECT_NOT_OWNED' USING ERRCODE='42501'; END IF;

 IF v_project.completion_quality_breakdown->>'source' IS DISTINCT FROM 'live_songwriting_quality' THEN
   RETURN v_result||jsonb_build_object('bonus_applied',false,'bonus_reason','historical_project_preserved');
 END IF;

 v_song_id:=nullif(v_result->>'song_id','')::uuid;
 v_base:=least(1000,greatest(0,coalesce((v_result->>'final_score')::integer,0)));
 IF v_song_id IS NULL THEN RAISE EXCEPTION 'SONGWRITING_SONG_NOT_RETURNED'; END IF;

 v_instrument_bonus:=public.songwriting_selected_instrument_bonus(p_profile_id,v_project.instruments);

 SELECT coalesce(songwriting_pct,0),coalesce(equipped_bonus_items,0)
 INTO v_clothing_pct,v_equipped_count
 FROM public.get_equipped_clothing_bonuses(p_profile_id);
 v_clothing_pct:=least(20,greatest(0,coalesce(v_clothing_pct,0)));

 v_final:=least(1000,greatest(0,round((v_base+v_instrument_bonus)*(1+v_clothing_pct/100.0))::integer));
 v_breakdown:=coalesce(v_result->'breakdown','{}'::jsonb) ||
 jsonb_build_object(
   'balance_version','live_songwriting_bonuses_v2',
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
