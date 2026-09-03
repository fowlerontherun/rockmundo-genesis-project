-- Rebalance every university and course without replacing catalogue rows.
-- Existing enrollment payment_amount and scheduled_end_date snapshots remain unchanged.

WITH music_scene(city, score) AS (
  VALUES
    ('London', 10),
    ('New York', 10),
    ('Los Angeles', 10),
    ('Nashville', 10),
    ('Liverpool', 9),
    ('Manchester', 9),
    ('Glasgow', 9),
    ('Berlin', 9),
    ('Paris', 9),
    ('Tokyo', 9),
    ('Seoul', 9),
    ('Chicago', 9),
    ('New Orleans', 9),
    ('Detroit', 9),
    ('Kingston', 9),
    ('Austin', 8),
    ('Seattle', 8),
    ('Atlanta', 8),
    ('Lagos', 8),
    ('Mumbai', 8),
    ('São Paulo', 8),
    ('Toronto', 8),
    ('Melbourne', 8),
    ('Sydney', 8),
    ('Stockholm', 8),
    ('Vienna', 8),
    ('Amsterdam', 8),
    ('Barcelona', 7),
    ('Ibiza', 7),
    ('Miami', 7),
    ('Montreal', 7),
    ('Hong Kong', 7),
    ('Singapore', 7),
    ('Bristol', 7),
    ('Dublin', 7),
    ('Edinburgh', 7),
    ('Birmingham', 7)
),
new_ratings AS (
  SELECT
    university.id,
    CASE
      WHEN lower(university.name) = 'rockmundo school of rock' THEN 100
      WHEN lower(university.name) = 'cambridge university' THEN 99
      WHEN lower(university.name) = 'manchester university' THEN 92
      WHEN university.name ILIKE '%conservatory%' THEN least(
        96,
        65
          + round(coalesce(music_scene.score, 5) * 1.2)::integer
          + mod(hashtext(university.name || '|prestige-v2')::bigint + 2147483648, 14)::integer
      )
      WHEN university.name ILIKE '%school of music%' THEN least(
        82,
        42
          + round(coalesce(music_scene.score, 5) * 1.4)::integer
          + mod(hashtext(university.name || '|prestige-v2')::bigint + 2147483648, 13)::integer
      )
      ELSE least(
        94,
        54
          + coalesce(music_scene.score, 5)
          + mod(hashtext(university.name || '|prestige-v2')::bigint + 2147483648, 23)::integer
      )
    END AS prestige,
    CASE
      WHEN lower(university.name) = 'rockmundo school of rock' THEN 100
      WHEN lower(university.name) = 'cambridge university' THEN 98
      WHEN lower(university.name) = 'manchester university' THEN 94
      WHEN university.name ILIKE '%conservatory%' THEN least(
        97,
        68
          + coalesce(music_scene.score, 5)
          + mod(hashtext(university.name || '|quality-v2')::bigint + 2147483648, 17)::integer
      )
      WHEN university.name ILIKE '%school of music%' THEN least(
        84,
        48
          + coalesce(music_scene.score, 5)
          + mod(hashtext(university.name || '|quality-v2')::bigint + 2147483648, 19)::integer
      )
      ELSE least(
        94,
        58
          + coalesce(music_scene.score, 5)
          + mod(hashtext(university.name || '|quality-v2')::bigint + 2147483648, 23)::integer
      )
    END AS quality_of_learning
  FROM public.universities AS university
  LEFT JOIN music_scene ON music_scene.city = university.city
)
UPDATE public.universities AS university
SET
  prestige = new_ratings.prestige,
  quality_of_learning = new_ratings.quality_of_learning,
  course_cost_modifier = CASE
    WHEN lower(university.name) = 'cambridge university' THEN 1.65
    WHEN lower(university.name) = 'rockmundo school of rock' THEN 1.60
    ELSE round(greatest(
      0.90,
      least(
        1.65,
        0.45 + (new_ratings.prestige * 0.007) + (new_ratings.quality_of_learning * 0.004)
      )
    )::numeric, 2)
  END
FROM new_ratings
WHERE new_ratings.id = university.id;

WITH course_inputs AS (
  SELECT
    course.id,
    course.required_skill_level,
    CASE
      WHEN course.skill_slug ~* 'mastery|^master_' OR coalesce(course.required_skill_level, 0) >= 15 THEN 3
      WHEN course.skill_slug ~* '(^|_)professional_' OR coalesce(course.required_skill_level, 0) >= 5 THEN 2
      WHEN course.skill_slug ILIKE '%advanced%'
        OR course.name ILIKE '%advanced%'
        OR coalesce(course.required_skill_level, 0) >= 2 THEN 1
      ELSE 0
    END AS tier_rank,
    mod(
      hashtext(university.name || '|' || course.skill_slug || '|' || course.name || '|price-v2')::bigint + 2147483648,
      2147483648
    ) AS price_hash,
    mod(
      hashtext(university.name || '|' || course.skill_slug || '|' || course.name || '|duration-v2')::bigint + 2147483648,
      2147483648
    ) AS duration_hash,
    mod(
      hashtext(university.name || '|' || course.skill_slug || '|' || course.name || '|xp-min-v2')::bigint + 2147483648,
      2147483648
    ) AS xp_min_hash,
    mod(
      hashtext(university.name || '|' || course.skill_slug || '|' || course.name || '|xp-span-v2')::bigint + 2147483648,
      2147483648
    ) AS xp_span_hash,
    greatest(
      0.85,
      least(
        1.45,
        0.20
          + (coalesce(university.quality_of_learning, 50) * 0.010)
          + (coalesce(university.prestige, 50) * 0.0025)
      )
    ) AS learning_factor
  FROM public.university_courses AS course
  JOIN public.universities AS university ON university.id = course.university_id
),
course_bands AS (
  SELECT
    course_inputs.*,
    CASE course_inputs.tier_rank
      WHEN 3 THEN 2100 + mod(course_inputs.price_hash, 1901)::integer + coalesce(course_inputs.required_skill_level, 0) * 25
      WHEN 2 THEN 1250 + mod(course_inputs.price_hash, 1251)::integer + coalesce(course_inputs.required_skill_level, 0) * 20
      WHEN 1 THEN 750 + mod(course_inputs.price_hash, 851)::integer + coalesce(course_inputs.required_skill_level, 0) * 15
      ELSE 400 + mod(course_inputs.price_hash, 601)::integer + coalesce(course_inputs.required_skill_level, 0) * 10
    END AS base_price,
    CASE course_inputs.tier_rank
      WHEN 3 THEN 13 + mod(course_inputs.duration_hash, 9)::integer
      WHEN 2 THEN 9 + mod(course_inputs.duration_hash, 7)::integer
      WHEN 1 THEN 7 + mod(course_inputs.duration_hash, 6)::integer
      ELSE 5 + mod(course_inputs.duration_hash, 6)::integer
    END AS base_duration_days,
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
new_course_balance AS (
  SELECT
    course_bands.id,
    course_bands.base_price,
    course_bands.base_duration_days,
    greatest(1, round(course_bands.base_xp_min * course_bands.learning_factor)::integer) AS xp_per_day_min,
    greatest(
      round(course_bands.base_xp_min * course_bands.learning_factor)::integer + 1,
      round((course_bands.base_xp_min + course_bands.base_xp_span) * course_bands.learning_factor)::integer
    ) AS xp_per_day_max
  FROM course_bands
)
UPDATE public.university_courses AS course
SET
  base_price = new_course_balance.base_price,
  base_duration_days = new_course_balance.base_duration_days,
  xp_per_day_min = new_course_balance.xp_per_day_min,
  xp_per_day_max = new_course_balance.xp_per_day_max
FROM new_course_balance
WHERE new_course_balance.id = course.id;

-- Keep course XP aligned if an administrator or city mayor changes a university rating.
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
        greatest(1, round(course_bands.base_xp_min * course_bands.learning_factor)::integer) AS xp_per_day_min,
        greatest(
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

DROP TRIGGER IF EXISTS trg_rebalance_university_course_xp
  ON public.universities;

CREATE TRIGGER trg_rebalance_university_course_xp
AFTER INSERT OR UPDATE OF prestige, quality_of_learning
ON public.universities
FOR EACH ROW
EXECUTE FUNCTION public.rebalance_university_course_xp_on_rating_change();

COMMENT ON FUNCTION public.rebalance_university_course_xp_on_rating_change() IS
  'Keeps per-day course XP aligned with university quality and prestige ratings.';

DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.universities
    WHERE prestige NOT BETWEEN 0 AND 100
      OR quality_of_learning NOT BETWEEN 0 AND 100
      OR course_cost_modifier NOT BETWEEN 0.5 AND 2.0
  ) THEN
    RAISE EXCEPTION 'University rebalance produced an out-of-range rating or cost modifier';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.university_courses
    WHERE base_price < 0
      OR base_duration_days < 1
      OR xp_per_day_min < 1
      OR xp_per_day_max <= xp_per_day_min
  ) THEN
    RAISE EXCEPTION 'University course rebalance produced invalid price, duration, or XP values';
  END IF;
END;
$validation$;
