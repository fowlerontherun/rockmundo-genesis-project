-- Complete learning-source coverage for legacy-named Professional/Mastery skills
-- and migrate DJ XP that was previously written to obsolete skill slugs.

WITH higher_tier AS (
  SELECT
    sd.slug::text AS slug,
    sd.display_name,
    CASE
      WHEN sd.slug::text ILIKE '%mastery%' OR sd.display_name ILIKE '%mastery%' THEN 'mastery'
      WHEN sd.slug::text ILIKE '%professional%' OR sd.display_name ILIKE '%professional%' THEN 'professional'
      ELSE NULL
    END AS tier
  FROM public.skill_definitions sd
  WHERE sd.slug::text ILIKE '%professional%'
     OR sd.slug::text ILIKE '%mastery%'
     OR sd.display_name ILIKE '%professional%'
     OR sd.display_name ILIKE '%mastery%'
)
INSERT INTO public.skill_books (
  title, author, description, skill_slug, skill_percentage_gain,
  base_reading_days, required_skill_level, price, is_active, category,
  daily_reading_time
)
SELECT
  CASE WHEN ht.tier = 'mastery'
    THEN ht.display_name || ': Masterclass Handbook'
    ELSE ht.display_name || ': Professional Handbook'
  END,
  'RockMundo Press',
  CASE WHEN ht.tier = 'mastery'
    THEN 'An intensive reference for mastery-level techniques, decision-making and practice.'
    ELSE 'A practical guide to professional-level techniques and structured practice.'
  END,
  ht.slug,
  CASE WHEN ht.tier = 'mastery' THEN 0.18 ELSE 0.12 END,
  4,
  0,
  CASE WHEN ht.tier = 'mastery' THEN 220 ELSE 120 END,
  true,
  initcap(ht.tier),
  CASE WHEN ht.tier = 'mastery' THEN 60 ELSE 45 END
FROM higher_tier ht
WHERE ht.tier IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.skill_books sb
    WHERE sb.skill_slug = ht.slug AND sb.is_active = true
  );

WITH higher_tier AS (
  SELECT
    sd.slug::text AS slug,
    sd.display_name,
    CASE
      WHEN sd.slug::text ILIKE '%mastery%' OR sd.display_name ILIKE '%mastery%' THEN 'mastery'
      WHEN sd.slug::text ILIKE '%professional%' OR sd.display_name ILIKE '%professional%' THEN 'professional'
      ELSE NULL
    END AS tier
  FROM public.skill_definitions sd
  WHERE sd.slug::text ILIKE '%professional%'
     OR sd.slug::text ILIKE '%mastery%'
     OR sd.display_name ILIKE '%professional%'
     OR sd.display_name ILIKE '%mastery%'
)
INSERT INTO public.education_youtube_resources (
  title, description, video_url, channel_name, duration_minutes,
  difficulty_level, skill_slug, category, tags, is_featured
)
SELECT
  'Find ' || ht.display_name || ' tutorials',
  'Open YouTube search results for tutorials focused on this skill tier.',
  'https://www.youtube.com/results?search_query=' ||
    trim(both '+' from regexp_replace(lower(ht.display_name), '[^a-z0-9]+', '+', 'g')) ||
    '+tutorial',
  'YouTube Search',
  NULL,
  CASE WHEN ht.tier = 'mastery' THEN 5 ELSE 4 END,
  ht.slug,
  initcap(ht.tier),
  ARRAY[ht.tier, 'skill-learning']::text[],
  false
FROM higher_tier ht
WHERE ht.tier IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.education_youtube_resources yr
    WHERE yr.skill_slug = ht.slug
  );

WITH chosen_university AS (
  SELECT u.id
  FROM public.universities u
  ORDER BY
    CASE WHEN u.name = 'Rockmundo School Of Rock' THEN 0 ELSE 1 END,
    u.prestige DESC NULLS LAST,
    u.quality_of_learning DESC NULLS LAST,
    u.id
  LIMIT 1
), course_seed AS (
  SELECT * FROM (VALUES
    ('tattooing_mastery'::text, 'Tattoo Mastery',
     'An intensive mastery programme covering advanced tattoo artistry, planning and execution.',
     3600::integer, 8::integer, 360::integer, 480::integer),
    ('professional_party_management'::text, 'Professional Party Management',
     'Advanced event and party management covering logistics, promotion, guest experience and operations.',
     2400::integer, 6::integer, 260::integer, 340::integer)
  ) AS v(skill_slug, name, description, base_price, base_duration_days, xp_per_day_min, xp_per_day_max)
)
INSERT INTO public.university_courses (
  university_id, name, description, skill_slug, base_price,
  base_duration_days, xp_per_day_min, xp_per_day_max,
  required_skill_level, is_active, class_start_hour, class_end_hour
)
SELECT
  cu.id, cs.name, cs.description, cs.skill_slug, cs.base_price,
  cs.base_duration_days, cs.xp_per_day_min, cs.xp_per_day_max,
  0, true, 10, 14
FROM course_seed cs
CROSS JOIN chosen_university cu
WHERE NOT EXISTS (
  SELECT 1 FROM public.university_courses uc
  WHERE uc.skill_slug = cs.skill_slug AND coalesce(uc.is_active, true)
);

-- Use the single canonical unlock rule for university enrolment too.
CREATE OR REPLACE FUNCTION public.validate_university_course_tier_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_slug text;
BEGIN
  SELECT uc.skill_slug INTO v_slug
  FROM public.university_courses uc
  WHERE uc.id = NEW.course_id;

  IF v_slug IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.skill_tier_unlocked(NEW.profile_id, v_slug) IS FALSE THEN
    RAISE EXCEPTION 'university_course_prerequisite_not_met:%', v_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- Merge every bit of XP from the four obsolete DJ sub-skills into the real
-- Basic DJ Controller skill and rebuild its level using the canonical curve.
DO $dj_migration$
DECLARE
  v_profile record;
  v_row record;
  v_target public.skill_progress%rowtype;
  v_total_xp bigint;
  v_level integer;
  v_remaining bigint;
  v_required integer;
  v_max integer;
  i integer;
BEGIN
  FOR v_profile IN
    SELECT DISTINCT sp.profile_id
    FROM public.skill_progress sp
    WHERE sp.skill_slug IN (
      'dj_basic_beatmatching', 'dj_basic_mixing',
      'dj_basic_crowd_reading', 'dj_basic_set_building'
    )
  LOOP
    v_total_xp := 0;

    SELECT * INTO v_target
    FROM public.skill_progress
    WHERE profile_id = v_profile.profile_id
      AND skill_slug = 'basic_dj_controller'
    FOR UPDATE;

    IF FOUND THEN
      IF coalesce(v_target.current_level, 0) > 0 THEN
        FOR i IN 0..(v_target.current_level - 1) LOOP
          v_total_xp := v_total_xp + public.progression_skill_required_xp(i);
        END LOOP;
      END IF;
      v_total_xp := v_total_xp + greatest(coalesce(v_target.current_xp, 0), 0);
    END IF;

    FOR v_row IN
      SELECT * FROM public.skill_progress
      WHERE profile_id = v_profile.profile_id
        AND skill_slug IN (
          'dj_basic_beatmatching', 'dj_basic_mixing',
          'dj_basic_crowd_reading', 'dj_basic_set_building'
        )
      FOR UPDATE
    LOOP
      IF coalesce(v_row.current_level, 0) > 0 THEN
        FOR i IN 0..(v_row.current_level - 1) LOOP
          v_total_xp := v_total_xp + public.progression_skill_required_xp(i);
        END LOOP;
      END IF;
      v_total_xp := v_total_xp + greatest(coalesce(v_row.current_xp, 0), 0);
    END LOOP;

    v_max := public.progression_skill_max_level('basic_dj_controller');
    v_level := 0;
    v_remaining := greatest(v_total_xp, 0);
    v_required := public.progression_skill_required_xp(0);

    WHILE v_level < v_max AND v_remaining >= v_required LOOP
      v_remaining := v_remaining - v_required;
      v_level := v_level + 1;
      v_required := CASE
        WHEN v_level < v_max THEN public.progression_skill_required_xp(v_level)
        ELSE 0
      END;
    END LOOP;

    IF v_level >= v_max THEN
      v_level := v_max;
      v_remaining := 0;
      v_required := 0;
    END IF;

    INSERT INTO public.skill_progress (
      profile_id, skill_slug, current_level, current_xp,
      required_xp, last_practiced_at, metadata
    ) VALUES (
      v_profile.profile_id, 'basic_dj_controller', v_level,
      v_remaining::integer, v_required, timezone('utc', now()),
      jsonb_build_object('legacy_dj_progress_migrated', true)
    )
    ON CONFLICT (profile_id, skill_slug) DO UPDATE
    SET current_level = EXCLUDED.current_level,
        current_xp = EXCLUDED.current_xp,
        required_xp = EXCLUDED.required_xp,
        last_practiced_at = EXCLUDED.last_practiced_at,
        updated_at = timezone('utc', now()),
        metadata = coalesce(public.skill_progress.metadata, '{}'::jsonb)
          || jsonb_build_object('legacy_dj_progress_migrated', true);

    DELETE FROM public.skill_progress
    WHERE profile_id = v_profile.profile_id
      AND skill_slug IN (
        'dj_basic_beatmatching', 'dj_basic_mixing',
        'dj_basic_crowd_reading', 'dj_basic_set_building'
      );
  END LOOP;
END;
$dj_migration$;
