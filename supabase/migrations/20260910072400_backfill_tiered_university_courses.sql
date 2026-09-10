-- Ensure university education supports the full Basic -> Professional -> Mastery
-- skill progression instead of stopping at the basic tier.
--
-- Canonical tiered skill slugs use <category>_<tier>_<topic>, for example:
--   genres_basic_punk_rock
--   genres_professional_punk_rock
--   genres_mastery_punk_rock
--
-- The original university seed only searched for slugs beginning with
-- professional_, so canonical genre/instrument/songwriting/stage skills were
-- not reliably given higher-tier courses.

WITH tiered_skills AS (
  SELECT
    sd.slug,
    sd.display_name,
    CASE
      WHEN sd.slug LIKE '%\_professional\_%' ESCAPE '\' THEN 'professional'
      WHEN sd.slug LIKE '%\_mastery\_%' ESCAPE '\' THEN 'mastery'
    END AS tier
  FROM public.skill_definitions sd
  WHERE sd.slug LIKE '%\_professional\_%' ESCAPE '\'
     OR sd.slug LIKE '%\_mastery\_%' ESCAPE '\'
),
course_candidates AS (
  SELECT
    u.id AS university_id,
    ts.slug AS skill_slug,
    CASE ts.tier
      WHEN 'professional' THEN
        COALESCE(ts.display_name, INITCAP(REPLACE(ts.slug, '_', ' '))) || ' - Professional'
      ELSE
        COALESCE(ts.display_name, INITCAP(REPLACE(ts.slug, '_', ' '))) || ' - Mastery'
    END AS course_name,
    CASE ts.tier
      WHEN 'professional' THEN
        'Professional-level tuition for players who have mastered the corresponding basic skill.'
      ELSE
        'Mastery-level tuition for players who have completed the corresponding professional skill.'
    END AS description,
    CASE ts.tier
      WHEN 'professional' THEN 1400
      ELSE 2400
    END AS base_price,
    CASE ts.tier
      WHEN 'professional' THEN 10
      ELSE 16
    END AS base_duration_days,
    -- Tier eligibility is enforced against the PREVIOUS tier by the enrollment
    -- trigger below, not against the target skill itself.
    0 AS required_skill_level,
    CASE ts.tier
      WHEN 'professional' THEN greatest(
        2,
        2 * round((24 + mod(hashtext(u.name || '|' || ts.slug || '|xp-min-v2')::bigint + 2147483648, 11)::integer)
          * greatest(0.85, least(1.45, 0.20 + coalesce(u.quality_of_learning, 50) * 0.010 + coalesce(u.prestige, 50) * 0.0025)))::integer
      )
      ELSE greatest(
        2,
        2 * round((32 + mod(hashtext(u.name || '|' || ts.slug || '|xp-min-v2')::bigint + 2147483648, 13)::integer)
          * greatest(0.85, least(1.45, 0.20 + coalesce(u.quality_of_learning, 50) * 0.010 + coalesce(u.prestige, 50) * 0.0025)))::integer
      )
    END AS xp_per_day_min,
    CASE ts.tier
      WHEN 'professional' THEN greatest(
        4,
        2 * round((36 + mod(hashtext(u.name || '|' || ts.slug || '|xp-max-v2')::bigint + 2147483648, 13)::integer)
          * greatest(0.85, least(1.45, 0.20 + coalesce(u.quality_of_learning, 50) * 0.010 + coalesce(u.prestige, 50) * 0.0025)))::integer
      )
      ELSE greatest(
        4,
        2 * round((48 + mod(hashtext(u.name || '|' || ts.slug || '|xp-max-v2')::bigint + 2147483648, 15)::integer)
          * greatest(0.85, least(1.45, 0.20 + coalesce(u.quality_of_learning, 50) * 0.010 + coalesce(u.prestige, 50) * 0.0025)))::integer
      )
    END AS xp_per_day_max,
    CASE ts.tier WHEN 'professional' THEN 20 ELSE 12 END AS max_enrollments,
    CASE ts.tier WHEN 'professional' THEN 14 ELSE 16 END AS class_start_hour,
    CASE ts.tier WHEN 'professional' THEN 18 ELSE 20 END AS class_end_hour
  FROM public.universities u
  CROSS JOIN tiered_skills ts
)
INSERT INTO public.university_courses (
  university_id,
  skill_slug,
  name,
  description,
  base_price,
  base_duration_days,
  required_skill_level,
  xp_per_day_min,
  xp_per_day_max,
  max_enrollments,
  is_active,
  class_start_hour,
  class_end_hour
)
SELECT
  cc.university_id,
  cc.skill_slug,
  cc.course_name,
  cc.description,
  cc.base_price,
  cc.base_duration_days,
  cc.required_skill_level,
  cc.xp_per_day_min,
  greatest(cc.xp_per_day_min + 2, cc.xp_per_day_max),
  cc.max_enrollments,
  true,
  cc.class_start_hour,
  cc.class_end_hour
FROM course_candidates cc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.university_courses existing
  WHERE existing.university_id = cc.university_id
    AND existing.skill_slug = cc.skill_slug
);

-- Existing canonical higher-tier courses may carry required_skill_level values
-- such as 25 that are checked against the target skill itself by the current UI.
-- That makes an unlearned Professional/Mastery skill impossible to start. Reset
-- this legacy field for canonical tiered courses; the real prerequisite is the
-- previous tier and is enforced below.
UPDATE public.university_courses
SET required_skill_level = 0
WHERE skill_slug LIKE '%\_professional\_%' ESCAPE '\'
   OR skill_slug LIKE '%\_mastery\_%' ESCAPE '\';

-- Enforce the actual tier rule at the database boundary so players cannot start
-- a Professional/Mastery university course before maxing the preceding tier.
-- This also protects direct API/database inserts, not only the web UI.
CREATE OR REPLACE FUNCTION public.validate_university_course_tier_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_slug text;
  v_prerequisite_slug text;
  v_prerequisite_level integer;
  v_max_level integer := 20;
BEGIN
  SELECT uc.skill_slug
  INTO v_slug
  FROM public.university_courses uc
  WHERE uc.id = NEW.course_id;

  IF v_slug IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_slug LIKE '%\_professional\_%' ESCAPE '\' THEN
    v_prerequisite_slug := replace(v_slug, '_professional_', '_basic_');
  ELSIF v_slug LIKE '%\_mastery\_%' ESCAPE '\' THEN
    v_prerequisite_slug := replace(v_slug, '_mastery_', '_professional_');
  ELSE
    RETURN NEW;
  END IF;

  SELECT sp.current_level
  INTO v_prerequisite_level
  FROM public.skill_progress sp
  WHERE sp.profile_id = NEW.profile_id
    AND sp.skill_slug = v_prerequisite_slug;

  IF coalesce(v_prerequisite_level, 0) < v_max_level THEN
    RAISE EXCEPTION 'university_course_prerequisite_not_met:%:%',
      v_prerequisite_slug,
      v_max_level
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_university_course_tier_enrollment
  ON public.player_university_enrollments;

CREATE TRIGGER trg_validate_university_course_tier_enrollment
BEFORE INSERT OR UPDATE OF course_id
ON public.player_university_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.validate_university_course_tier_enrollment();

COMMENT ON FUNCTION public.validate_university_course_tier_enrollment() IS
  'Requires the previous canonical skill tier to be level 20 before enrolling in a Professional or Mastery university course.';

DO $validation$
DECLARE
  v_missing_count integer;
BEGIN
  -- Every university should now have every canonical Professional/Mastery skill
  -- represented exactly once or already represented by an existing row.
  SELECT count(*)
  INTO v_missing_count
  FROM public.universities u
  CROSS JOIN public.skill_definitions sd
  WHERE (sd.slug LIKE '%\_professional\_%' ESCAPE '\'
      OR sd.slug LIKE '%\_mastery\_%' ESCAPE '\')
    AND NOT EXISTS (
      SELECT 1
      FROM public.university_courses uc
      WHERE uc.university_id = u.id
        AND uc.skill_slug = sd.slug
    );

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'Tiered university course backfill left % university/skill combinations missing', v_missing_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.university_courses
    WHERE (skill_slug LIKE '%\_professional\_%' ESCAPE '\'
        OR skill_slug LIKE '%\_mastery\_%' ESCAPE '\')
      AND (xp_per_day_min < 2 OR xp_per_day_max <= xp_per_day_min)
  ) THEN
    RAISE EXCEPTION 'Tiered university course backfill produced invalid XP values';
  END IF;
END;
$validation$;
