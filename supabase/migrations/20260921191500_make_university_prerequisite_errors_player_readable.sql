-- Keep university prerequisite enforcement authoritative in the database,
-- but never expose the internal exception key as the player-facing message.
-- Older/stale clients may still surface Postgres error.message directly, so the
-- trigger itself must return a useful explanation.

CREATE OR REPLACE FUNCTION public.validate_university_course_tier_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_slug text;
  v_target_name text;
  v_caps jsonb;
  v_prereq text;
  v_prereq_name text;
  v_required_level integer;
  v_current_level integer := 0;
  v_candidate text;
BEGIN
  SELECT uc.skill_slug, coalesce(sd.display_name, uc.name, uc.skill_slug), sd.tier_caps
    INTO v_slug, v_target_name, v_caps
  FROM public.university_courses uc
  LEFT JOIN public.skill_definitions sd ON sd.slug::text = uc.skill_slug
  WHERE uc.id = NEW.course_id;

  IF v_slug IS NULL OR public.skill_tier_unlocked(NEW.profile_id, v_slug) THEN
    RETURN NEW;
  END IF;

  IF coalesce(v_caps->>'requires', '') <> '' THEN
    v_prereq := v_caps->>'requires';
    v_required_level := CASE
      WHEN (v_caps->>'required_level') ~ '^[0-9]+$'
        THEN greatest(1, (v_caps->>'required_level')::integer)
      ELSE public.progression_skill_max_level(v_prereq)
    END;
  ELSIF position('_professional_' in v_slug) > 0 THEN
    v_prereq := replace(v_slug, '_professional_', '_basic_');
  ELSIF position('_mastery_' in v_slug) > 0 THEN
    v_prereq := replace(v_slug, '_mastery_', '_professional_');
  ELSIF v_slug LIKE 'professional\_%' ESCAPE '\' THEN
    v_candidate := 'basic_' || substring(v_slug from char_length('professional_') + 1);

    IF EXISTS (
      SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_candidate
    ) THEN
      v_prereq := v_candidate;
    ELSE
      v_prereq := CASE v_slug
        WHEN 'professional_ai_music_integration' THEN 'basic_ai_music_tools'
        WHEN 'professional_crowd_engagement' THEN 'basic_crowd_interaction'
        WHEN 'professional_daw_production' THEN 'basic_daw_use'
        WHEN 'professional_social_media_musician' THEN 'basic_social_media_performance'
        WHEN 'professional_streaming_shows' THEN 'basic_streaming_concerts'
        WHEN 'professional_visual_shows' THEN 'basic_visual_performance_integration'
        WHEN 'professional_vocal_production' THEN 'basic_vocal_tuning_processing'
        ELSE NULL
      END;
    END IF;
  END IF;

  IF v_prereq IS NOT NULL THEN
    IF v_required_level IS NULL THEN
      v_required_level := public.progression_skill_max_level(v_prereq);
    END IF;

    SELECT coalesce(sd.display_name, initcap(replace(v_prereq, '_', ' ')))
      INTO v_prereq_name
    FROM public.skill_definitions sd
    WHERE sd.slug::text = v_prereq
    LIMIT 1;

    v_prereq_name := coalesce(v_prereq_name, initcap(replace(v_prereq, '_', ' ')));

    SELECT coalesce(sp.current_level, 0)
      INTO v_current_level
    FROM public.skill_progress sp
    WHERE sp.profile_id = NEW.profile_id
      AND sp.skill_slug = v_prereq
    LIMIT 1;

    v_current_level := coalesce(v_current_level, 0);

    RAISE EXCEPTION '% requires % level % (you have %).',
      v_target_name, v_prereq_name, v_required_level, v_current_level
      USING
        ERRCODE = 'P0001',
        DETAIL = 'university_course_prerequisite_not_met:' || v_slug,
        HINT = 'Complete the required previous-tier skill before enrolling.';
  END IF;

  RAISE EXCEPTION 'The prerequisite for % has not been met.', v_target_name
    USING
      ERRCODE = 'P0001',
      DETAIL = 'university_course_prerequisite_not_met:' || v_slug,
      HINT = 'Complete the required prerequisite before enrolling.';
END;
$function$;

COMMENT ON FUNCTION public.validate_university_course_tier_enrollment() IS
  'Enforces university course tier prerequisites and returns a player-readable prerequisite error while retaining the technical key in DETAIL.';
