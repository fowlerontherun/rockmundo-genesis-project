-- Rebalance future university attendance to at least 2x the previously
-- published daily XP, with a larger quality-of-learning premium. Completion
-- bonuses are already proportional to attendance (20%), so they grow with it.
-- The deterministic recalculation makes this safe to apply after the live DB
-- has already received the same change; past attendance is never rewritten.

CREATE OR REPLACE FUNCTION public.rebalance_university_course_xp_on_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.prestige IS NOT DISTINCT FROM OLD.prestige
    AND NEW.quality_of_learning IS NOT DISTINCT FROM OLD.quality_of_learning THEN
    RETURN NEW;
  END IF;

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
      mod(hashtext(NEW.name || '|' || course.skill_slug || '|' || course.name || '|xp-min-v2')::bigint + 2147483648, 2147483648) AS xp_min_hash,
      mod(hashtext(NEW.name || '|' || course.skill_slug || '|' || course.name || '|xp-span-v2')::bigint + 2147483648, 2147483648) AS xp_span_hash,
      least(
        2.05,
        greatest(0.85, least(1.45,
          0.20 + coalesce(NEW.quality_of_learning, 50) * 0.010
               + coalesce(NEW.prestige, 50) * 0.0025
        )) + greatest(0, coalesce(NEW.quality_of_learning, 50) - 50) * 0.012
      ) AS learning_factor
    FROM public.university_courses course
    WHERE course.university_id = NEW.id
  ),
  course_bands AS (
    SELECT
      ci.*,
      CASE ci.tier_rank
        WHEN 3 THEN 32 + mod(ci.xp_min_hash, 13)::integer
        WHEN 2 THEN 24 + mod(ci.xp_min_hash, 11)::integer
        WHEN 1 THEN 18 + mod(ci.xp_min_hash, 9)::integer
        ELSE 12 + mod(ci.xp_min_hash, 7)::integer
      END AS base_xp_min,
      CASE ci.tier_rank
        WHEN 3 THEN 16 + mod(ci.xp_span_hash, 15)::integer
        WHEN 2 THEN 12 + mod(ci.xp_span_hash, 13)::integer
        WHEN 1 THEN 10 + mod(ci.xp_span_hash, 11)::integer
        ELSE 8 + mod(ci.xp_span_hash, 9)::integer
      END AS base_xp_span
    FROM course_inputs ci
  ),
  new_xp AS (
    SELECT id,
      4 * greatest(1, round(base_xp_min * learning_factor)::integer) AS xp_per_day_min,
      4 * greatest(
        round(base_xp_min * learning_factor)::integer + 1,
        round((base_xp_min + base_xp_span) * learning_factor)::integer
      ) AS xp_per_day_max
    FROM course_bands
  )
  UPDATE public.university_courses course
  SET xp_per_day_min = new_xp.xp_per_day_min,
      xp_per_day_max = new_xp.xp_per_day_max
  FROM new_xp WHERE course.id = new_xp.id
    AND (course.xp_per_day_min, course.xp_per_day_max)
        IS DISTINCT FROM (new_xp.xp_per_day_min, new_xp.xp_per_day_max);

  -- Preserve courses seeded with deliberate high XP bands in October.
  WITH authored AS (
    SELECT c.id,
      greatest(0.85,least(1.45,0.20+coalesce(NEW.quality_of_learning,50)*0.010+coalesce(NEW.prestige,50)*0.0025)) AS old_factor,
      least(2.05,greatest(0.85,least(1.45,0.20+coalesce(NEW.quality_of_learning,50)*0.010+coalesce(NEW.prestige,50)*0.0025))
        +greatest(0,coalesce(NEW.quality_of_learning,50)-50)*0.012) AS new_factor,
      CASE
        WHEN c.skill_slug IN ('tattooing_mastery','luthiery_mastery_technical') THEN 360
        WHEN c.skill_slug='professional_party_management' THEN 260
        WHEN c.skill_slug='luthiery_professional_technical' THEN 250
        WHEN c.skill_slug='luthiery_basic_technical' THEN 140
        WHEN c.name LIKE '% Masterclass' AND c.base_price=4200 AND c.base_duration_days=8 THEN 360
        WHEN c.name LIKE '% Professional Course' AND c.base_price=2600 AND c.base_duration_days=6 THEN 240
      END AS seed_min,
      CASE
        WHEN c.skill_slug IN ('tattooing_mastery','luthiery_mastery_technical') THEN 480
        WHEN c.skill_slug='professional_party_management' THEN 340
        WHEN c.skill_slug='luthiery_professional_technical' THEN 350
        WHEN c.skill_slug='luthiery_basic_technical' THEN 220
        WHEN c.name LIKE '% Masterclass' AND c.base_price=4200 AND c.base_duration_days=8 THEN 480
        WHEN c.name LIKE '% Professional Course' AND c.base_price=2600 AND c.base_duration_days=6 THEN 330
      END AS seed_max
    FROM public.university_courses c WHERE c.university_id=NEW.id
  )
  UPDATE public.university_courses c
  SET xp_per_day_min=greatest(c.xp_per_day_min,ceil(2*a.seed_min*a.new_factor/a.old_factor)::integer),
      xp_per_day_max=greatest(c.xp_per_day_max,ceil(2*a.seed_max*a.new_factor/a.old_factor)::integer)
  FROM authored a WHERE a.id=c.id AND a.seed_min IS NOT NULL;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.rebalance_university_course_xp_on_rating_change() IS
  'Maintains the 4x base course XP scale, with additional learning-quality impact, on university upgrades.';

-- One-time backfill at the same deterministic scale as the trigger. Re-running
-- it does not multiply rewards again or alter any recorded attendance.
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
    mod(hashtext(u.name || '|' || course.skill_slug || '|' || course.name || '|xp-min-v2')::bigint + 2147483648, 2147483648) AS xp_min_hash,
    mod(hashtext(u.name || '|' || course.skill_slug || '|' || course.name || '|xp-span-v2')::bigint + 2147483648, 2147483648) AS xp_span_hash,
    least(
      2.05,
      greatest(0.85, least(1.45,
        0.20 + coalesce(u.quality_of_learning, 50) * 0.010
             + coalesce(u.prestige, 50) * 0.0025
      )) + greatest(0, coalesce(u.quality_of_learning, 50) - 50) * 0.012
    ) AS learning_factor
  FROM public.university_courses course
  JOIN public.universities u ON u.id = course.university_id
),
course_bands AS (
  SELECT ci.*,
    CASE ci.tier_rank
      WHEN 3 THEN 32 + mod(ci.xp_min_hash, 13)::integer
      WHEN 2 THEN 24 + mod(ci.xp_min_hash, 11)::integer
      WHEN 1 THEN 18 + mod(ci.xp_min_hash, 9)::integer
      ELSE 12 + mod(ci.xp_min_hash, 7)::integer
    END AS base_xp_min,
    CASE ci.tier_rank
      WHEN 3 THEN 16 + mod(ci.xp_span_hash, 15)::integer
      WHEN 2 THEN 12 + mod(ci.xp_span_hash, 13)::integer
      WHEN 1 THEN 10 + mod(ci.xp_span_hash, 11)::integer
      ELSE 8 + mod(ci.xp_span_hash, 9)::integer
    END AS base_xp_span
  FROM course_inputs ci
),
new_xp AS (
  SELECT id,
    4 * greatest(1, round(base_xp_min * learning_factor)::integer) AS xp_per_day_min,
    4 * greatest(
      round(base_xp_min * learning_factor)::integer + 1,
      round((base_xp_min + base_xp_span) * learning_factor)::integer
    ) AS xp_per_day_max
  FROM course_bands
)
UPDATE public.university_courses course
SET xp_per_day_min = new_xp.xp_per_day_min,
    xp_per_day_max = new_xp.xp_per_day_max
FROM new_xp WHERE course.id = new_xp.id
  AND (course.xp_per_day_min, course.xp_per_day_max)
      IS DISTINCT FROM (new_xp.xp_per_day_min, new_xp.xp_per_day_max);

-- Backfill the special October course bands separately. This is idempotent
-- and ensures they never earn less than twice their original authored XP.
WITH authored AS (
  SELECT c.id,
    greatest(0.85,least(1.45,0.20+coalesce(u.quality_of_learning,50)*0.010+coalesce(u.prestige,50)*0.0025)) AS old_factor,
    least(2.05,greatest(0.85,least(1.45,0.20+coalesce(u.quality_of_learning,50)*0.010+coalesce(u.prestige,50)*0.0025))
      +greatest(0,coalesce(u.quality_of_learning,50)-50)*0.012) AS new_factor,
    CASE
      WHEN c.skill_slug IN ('tattooing_mastery','luthiery_mastery_technical') THEN 360
      WHEN c.skill_slug='professional_party_management' THEN 260
      WHEN c.skill_slug='luthiery_professional_technical' THEN 250
      WHEN c.skill_slug='luthiery_basic_technical' THEN 140
      WHEN c.name LIKE '% Masterclass' AND c.base_price=4200 AND c.base_duration_days=8 THEN 360
      WHEN c.name LIKE '% Professional Course' AND c.base_price=2600 AND c.base_duration_days=6 THEN 240
    END AS seed_min,
    CASE
      WHEN c.skill_slug IN ('tattooing_mastery','luthiery_mastery_technical') THEN 480
      WHEN c.skill_slug='professional_party_management' THEN 340
      WHEN c.skill_slug='luthiery_professional_technical' THEN 350
      WHEN c.skill_slug='luthiery_basic_technical' THEN 220
      WHEN c.name LIKE '% Masterclass' AND c.base_price=4200 AND c.base_duration_days=8 THEN 480
      WHEN c.name LIKE '% Professional Course' AND c.base_price=2600 AND c.base_duration_days=6 THEN 330
    END AS seed_max
  FROM public.university_courses c
  JOIN public.universities u ON u.id=c.university_id
)
UPDATE public.university_courses c
SET xp_per_day_min=greatest(c.xp_per_day_min,ceil(2*a.seed_min*a.new_factor/a.old_factor)::integer),
    xp_per_day_max=greatest(c.xp_per_day_max,ceil(2*a.seed_max*a.new_factor/a.old_factor)::integer)
FROM authored a WHERE a.id=c.id AND a.seed_min IS NOT NULL;

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.university_courses
    WHERE xp_per_day_min < 4 OR xp_per_day_max <= xp_per_day_min
  ) THEN
    RAISE EXCEPTION 'Expanded university XP generated an invalid course range';
  END IF;
END;
$validation$;
