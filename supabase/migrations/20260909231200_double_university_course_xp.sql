-- Double XP awarded by every university course while preserving the existing
-- university quality/prestige scaling introduced by the September rebalance.
--
-- Existing attendance history is left unchanged. This only affects XP awarded
-- for future attendance.

UPDATE public.university_courses
SET
  xp_per_day_min = xp_per_day_min * 2,
  xp_per_day_max = xp_per_day_max * 2;

-- The university rebalance trigger recalculates XP whenever quality/prestige
-- changes. Keep that recalculation on the new 2x XP scale so an admin edit does
-- not silently revert a university's courses to the old reward values.
CREATE OR REPLACE FUNCTION public.rebalance_university_course_xp_on_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT'
    OR NEW.prestige IS DISTINCT FROM OLD.prestige
    OR NEW.quality_of_learning IS DISTINCT FROM OLD.quality_of_learning THEN
    WITH course_inputs AS (
      SELECT
        course.id,
        CASE
          WHEN course.skill_slug ~* 'mastery|^master_' OR coalesce(course.required_skill_level, 0) >= 15 THEN 3
          WHEN course.skill_slug ~* '(^|_)professional_' OR coalesce(course.required_skill_level, 0) >= 5 THEN 2
          WHEN course.skill_slug ILIKE '%advanced%'
            OR course.name ILIKE '%advanced%'
            OR coalesce(course.required_skill_level, 0) >= 2 THEN 1
          ELSE 0
        END AS tier_rank,
        mod(
          hashtext(NEW.name || '|' || course.skill_slug || '|' || course.name || '|xp-min-v2')::bigint + 2147483648,
          2147483648
        ) AS xp_min_hash,
        mod(
          hashtext(NEW.name || '|' || course.skill_slug || '|' || course.name || '|xp-span-v2')::bigint + 2147483648,
          2147483648
        ) AS xp_span_hash,
        greatest(
          0.85,
          least(
            1.45,
            0.20
              + (coalesce(NEW.quality_of_learning, 50) * 0.010)
              + (coalesce(NEW.prestige, 50) * 0.0025)
          )
        ) AS learning_factor
      FROM public.university_courses AS course
      WHERE course.university_id = NEW.id
    ),
    course_bands AS (
      SELECT
        course_inputs.*,
        CASE course_inputs.tier_rank
          WHEN 3 THEN 32 + mod(course_inputs.xp_min_hash, 13)::integer
          WHEN 2 THEN 24 + mod(course_inputs.xp_min_hash, 11)::integer
          WHEN 1 THEN 18 + mod(course_inputs.xp_min_hash, 9)::integer
          ELSE 12 + mod(course_inputs.xp_min_hash, 7)::integer
        END AS base_xp_min,
        CASE course_inputs.tier_rank
          WHEN 3 THEN 16 + mod(course_inputs.xp_span_hash, 15)::integer
          WHEN 2 THEN 12 + mod(course_inputs.xp_span_hash, 13)::integer
          WHEN 1 THEN 10 + mod(course_inputs.xp_span_hash, 11)::integer
          ELSE 8 + mod(course_inputs.xp_span_hash, 9)::integer
        END AS base_xp_span
      FROM course_inputs
    ),
    new_xp AS (
      SELECT
        course_bands.id,
        2 * greatest(
          1,
          round(course_bands.base_xp_min * course_bands.learning_factor)::integer
        ) AS xp_per_day_min,
        2 * greatest(
          round(course_bands.base_xp_min * course_bands.learning_factor)::integer + 1,
          round((course_bands.base_xp_min + course_bands.base_xp_span) * course_bands.learning_factor)::integer
        ) AS xp_per_day_max
      FROM course_bands
    )
    UPDATE public.university_courses AS course
    SET
      xp_per_day_min = new_xp.xp_per_day_min,
      xp_per_day_max = new_xp.xp_per_day_max
    FROM new_xp
    WHERE new_xp.id = course.id;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.rebalance_university_course_xp_on_rating_change() IS
  'Keeps per-day course XP aligned with university quality and prestige ratings on the 2x university XP scale.';

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.university_courses
    WHERE xp_per_day_min < 2
      OR xp_per_day_max <= xp_per_day_min
  ) THEN
    RAISE EXCEPTION 'University course 2x XP migration produced invalid XP values';
  END IF;
END;
$validation$;
