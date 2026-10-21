-- Read-only certification for the 500-question media interview catalogue.
-- Run after the three content seed migrations and legacy effects rebalance.
DO $test$
DECLARE
  total_count integer;
  unique_questions integer;
  unique_answer_sets integer;
  malformed integer;
  broken_effects integer;
  bad_media integer;
  new_category_count integer;
  smallest_new_category integer;
  old_imbalanced integer;
  old_reputation_outliers integer;
  insufficient_media integer;
BEGIN
  SELECT COUNT(*),COUNT(DISTINCT lower(btrim(question_text))),
         COUNT(DISTINCT (option_a_text,option_b_text,option_c_text,option_d_text))
  INTO total_count,unique_questions,unique_answer_sets FROM public.interview_questions;

  SELECT COUNT(*) INTO malformed FROM public.interview_questions q
  WHERE question_text IS NULL OR btrim(question_text)=''
     OR (SELECT count(DISTINCT lower(btrim(v.answer)))
         FROM (VALUES(q.option_a_text),(q.option_b_text),(q.option_c_text),(q.option_d_text)) v(answer)
         WHERE v.answer IS NOT NULL AND btrim(v.answer)<>'')<>4;

  SELECT COUNT(*) INTO broken_effects FROM public.interview_questions q
  CROSS JOIN LATERAL (VALUES(q.option_a_effects),(q.option_b_effects),(q.option_c_effects),(q.option_d_effects)) e(effect)
  WHERE jsonb_typeof(effect->'fame_mult') IS DISTINCT FROM 'number'
     OR jsonb_typeof(effect->'fan_mult') IS DISTINCT FROM 'number'
     OR jsonb_typeof(effect->'cash_mult') IS DISTINCT FROM 'number'
     OR jsonb_typeof(effect->'reputation') IS DISTINCT FROM 'object'
     OR (effect->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10
     OR (effect->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10
     OR (effect->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10;

  SELECT COUNT(*) INTO bad_media FROM public.interview_questions
  WHERE media_types IS NULL OR cardinality(media_types)=0
    OR NOT media_types <@ ARRAY['all','tv','radio','podcast','magazine','newspaper','internet','film']::text[];

  SELECT COUNT(*),MIN(n) INTO new_category_count,smallest_new_category FROM (
    SELECT category,COUNT(*) AS n FROM public.interview_questions
    WHERE category=ANY(ARRAY[
      'education_learning','festival_management','performance_stage','world_cities',
      'recording_technology','music_economy','career_wellbeing','fans_social',
      'band_management','media_scandal','merch_design','nightclub_culture'
    ]) GROUP BY category
  ) new_categories;

  SELECT COUNT(*) INTO old_imbalanced FROM public.interview_questions q
  CROSS JOIN LATERAL (VALUES(q.option_a_effects),(q.option_b_effects),(q.option_c_effects),(q.option_d_effects)) e(effect)
  WHERE created_at::date=DATE '2026-02-14'
    AND ((effect->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10
      OR (effect->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10
      OR (effect->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10);

  SELECT COUNT(*) INTO old_reputation_outliers FROM public.interview_questions q
  CROSS JOIN LATERAL (VALUES(q.option_a_effects),(q.option_b_effects),(q.option_c_effects),(q.option_d_effects)) e(effect)
  CROSS JOIN LATERAL jsonb_each_text(e.effect->'reputation') r(axis,value)
  WHERE created_at::date=DATE '2026-02-14' AND abs(r.value::numeric)>3;

  SELECT COUNT(*) INTO insufficient_media FROM (
    SELECT v.media_type,v.required_count,COUNT(q.id) n
    FROM (VALUES ('tv',5),('radio',5),('podcast',7),('magazine',6),
                 ('newspaper',6),('internet',4),('film',6)) v(media_type,required_count)
    LEFT JOIN public.interview_questions q
      ON v.media_type=ANY(q.media_types) OR 'all'=ANY(q.media_types)
    GROUP BY 1,2
  ) media WHERE n < required_count;

  IF total_count<500 OR unique_questions<>total_count OR unique_answer_sets<>total_count
     OR malformed>0 OR broken_effects>0 OR bad_media>0
     OR new_category_count<>12 OR smallest_new_category<>10
     OR old_imbalanced>0 OR old_reputation_outliers>0 OR insufficient_media>0 THEN
    RAISE EXCEPTION 'Interview validation failed: total %, unique %, answer sets %, malformed %, bad effects %, invalid media %, categories %, minimum group %, old bad effect %, old reputation %, underfilled media %',
      total_count,unique_questions,unique_answer_sets,malformed,broken_effects,bad_media,new_category_count,smallest_new_category,old_imbalanced,old_reputation_outliers,insufficient_media;
  END IF;
END;
$test$;