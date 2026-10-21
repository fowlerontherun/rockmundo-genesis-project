-- Media interview catalogue expansion regression gate.
-- This script is read-only and can run in CI or against the live catalogue.
DO $test$
DECLARE
  total_questions integer;
  unique_questions integer;
  unique_sets integer;
  bad_options integer;
  bad_effects integer;
  bad_media integer;
  category_count integer;
  category_min integer;
BEGIN
  SELECT count(*), count(DISTINCT lower(btrim(question_text))),
         count(DISTINCT (option_a_text,option_b_text,option_c_text,option_d_text))
  INTO total_questions,unique_questions,unique_sets
  FROM public.interview_questions;

  SELECT count(*) INTO bad_options
  FROM public.interview_questions
  WHERE btrim(question_text)='' OR btrim(option_a_text)=''
     OR btrim(option_b_text)='' OR btrim(option_c_text)='' OR btrim(option_d_text)=''
     OR (SELECT count(DISTINCT lower(btrim(option_text)))
         FROM (VALUES (option_a_text),(option_b_text),(option_c_text),(option_d_text)) v(option_text))<>4;

  SELECT count(*) INTO bad_effects
  FROM public.interview_questions
  WHERE EXISTS (
    SELECT 1
    FROM (VALUES(option_a_effects),(option_b_effects),(option_c_effects),(option_d_effects)) e(effect)
    WHERE jsonb_typeof(effect->'fame_mult') <> 'number'
       OR jsonb_typeof(effect->'fan_mult') <> 'number'
       OR jsonb_typeof(effect->'cash_mult') <> 'number'
       OR jsonb_typeof(effect->'reputation') <> 'object'
       OR (effect->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.15
       OR (effect->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.15
       OR (effect->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.15
  );

  SELECT count(*) INTO bad_media FROM public.interview_questions
  WHERE media_types IS NULL OR cardinality(media_types)=0
     OR NOT media_types <@ ARRAY['all','tv','radio','podcast','magazine','newspaper','internet','film']::text[];

  SELECT count(*),min(n) INTO category_count,category_min FROM (
    SELECT category,count(*) AS n FROM public.interview_questions
    WHERE category=ANY(ARRAY[
      'songwriting','release_artwork','festival_circuit','tour_life','studio_craft',
      'gear_craft','media_persona','fan_community','dj_nightlife','career_business'
    ])
    GROUP BY category
  ) categories;

  IF total_questions < 380 OR unique_questions <> total_questions
     OR unique_sets <> total_questions OR bad_options > 0 OR bad_effects > 0 OR bad_media > 0
     OR category_count <> 10 OR category_min < 8 THEN
    RAISE EXCEPTION 'Interview validation failed: total=%,unique=%,sets=%,invalid options=%,invalid effects=%,invalid media=%,expanded categories=%,min size=%',
      total_questions, unique_questions, unique_sets, bad_options, bad_effects, bad_media, category_count, category_min;
  END IF;
END;
$test$;