-- Guarantee discoverable learning routes for every active Professional/Mastery skill.
-- This deliberately derives coverage from skill_definitions so new higher-tier
-- skills cannot silently ship without books, courses, videos or mentors.

WITH higher_tier AS (
  SELECT sd.slug::text AS slug,
         coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) AS display_name,
         CASE
           WHEN sd.slug::text ILIKE '%mastery%' OR coalesce(sd.display_name,'') ILIKE '%mastery%' THEN 'mastery'
           ELSE 'professional'
         END AS tier
  FROM public.skill_definitions sd
  WHERE coalesce(sd.is_active, true)
    AND (
      sd.slug::text ILIKE '%professional%'
      OR sd.slug::text ILIKE '%mastery%'
      OR coalesce(sd.display_name,'') ILIKE '%professional%'
      OR coalesce(sd.display_name,'') ILIKE '%mastery%'
    )
)
INSERT INTO public.skill_books (
  title, author, description, skill_slug, skill_percentage_gain,
  base_reading_days, required_skill_level, price, is_active, category,
  daily_reading_time
)
SELECT
  ht.display_name || CASE WHEN ht.tier='mastery' THEN ': Masterclass Handbook' ELSE ': Professional Handbook' END,
  'RockMundo Press',
  CASE WHEN ht.tier='mastery'
    THEN 'Advanced reference material for mastery-level technique, judgement and practice.'
    ELSE 'Practical professional-level technique, application and structured practice.'
  END,
  ht.slug,
  CASE WHEN ht.tier='mastery' THEN 0.18 ELSE 0.12 END,
  CASE WHEN ht.tier='mastery' THEN 6 ELSE 4 END,
  0,
  CASE WHEN ht.tier='mastery' THEN 220 ELSE 120 END,
  true,
  initcap(ht.tier),
  CASE WHEN ht.tier='mastery' THEN 60 ELSE 45 END
FROM higher_tier ht
WHERE NOT EXISTS (
  SELECT 1 FROM public.skill_books b
  WHERE b.skill_slug=ht.slug AND coalesce(b.is_active,true)
);

WITH higher_tier AS (
  SELECT sd.slug::text AS slug,
         coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) AS display_name,
         CASE WHEN sd.slug::text ILIKE '%mastery%' OR coalesce(sd.display_name,'') ILIKE '%mastery%' THEN 'mastery' ELSE 'professional' END AS tier
  FROM public.skill_definitions sd
  WHERE coalesce(sd.is_active,true)
    AND (sd.slug::text ILIKE '%professional%' OR sd.slug::text ILIKE '%mastery%'
      OR coalesce(sd.display_name,'') ILIKE '%professional%' OR coalesce(sd.display_name,'') ILIKE '%mastery%')
), chosen_university AS (
  SELECT u.id
  FROM public.universities u
  ORDER BY CASE WHEN u.name='Rockmundo School Of Rock' THEN 0 ELSE 1 END,
           u.prestige DESC NULLS LAST, u.quality_of_learning DESC NULLS LAST, u.id
  LIMIT 1
)
INSERT INTO public.university_courses (
  university_id, name, description, skill_slug, base_price,
  base_duration_days, xp_per_day_min, xp_per_day_max,
  required_skill_level, is_active, class_start_hour, class_end_hour
)
SELECT
  u.id,
  ht.display_name || CASE WHEN ht.tier='mastery' THEN ' Masterclass' ELSE ' Professional Course' END,
  CASE WHEN ht.tier='mastery'
    THEN 'Advanced mastery programme with intensive applied training.'
    ELSE 'Professional programme combining theory with applied practice.'
  END,
  ht.slug,
  CASE WHEN ht.tier='mastery' THEN 4200 ELSE 2600 END,
  CASE WHEN ht.tier='mastery' THEN 8 ELSE 6 END,
  CASE WHEN ht.tier='mastery' THEN 360 ELSE 240 END,
  CASE WHEN ht.tier='mastery' THEN 480 ELSE 330 END,
  0, true, 10, 14
FROM higher_tier ht
CROSS JOIN chosen_university u
WHERE NOT EXISTS (
  SELECT 1 FROM public.university_courses c
  WHERE c.skill_slug=ht.slug AND coalesce(c.is_active,true)
);

WITH higher_tier AS (
  SELECT sd.slug::text AS slug,
         coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) AS display_name,
         CASE WHEN sd.slug::text ILIKE '%mastery%' OR coalesce(sd.display_name,'') ILIKE '%mastery%' THEN 'mastery' ELSE 'professional' END AS tier
  FROM public.skill_definitions sd
  WHERE coalesce(sd.is_active,true)
    AND (sd.slug::text ILIKE '%professional%' OR sd.slug::text ILIKE '%mastery%'
      OR coalesce(sd.display_name,'') ILIKE '%professional%' OR coalesce(sd.display_name,'') ILIKE '%mastery%')
)
INSERT INTO public.education_youtube_resources (
  title, description, video_url, channel_name, duration_minutes,
  difficulty_level, skill_slug, category, tags, is_featured
)
SELECT
  ht.display_name || ' video course',
  'A curated YouTube learning route for this skill tier.',
  'https://www.youtube.com/results?search_query=' ||
    trim(both '+' from regexp_replace(lower(ht.display_name), '[^a-z0-9]+', '+', 'g')) || '+course',
  'YouTube Learning',
  NULL,
  CASE WHEN ht.tier='mastery' THEN 5 ELSE 4 END,
  ht.slug,
  initcap(ht.tier),
  ARRAY[ht.tier,'skill-learning','course']::text[],
  false
FROM higher_tier ht
WHERE NOT EXISTS (
  SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=ht.slug
);

WITH higher_tier AS (
  SELECT sd.slug::text AS slug,
         coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) AS display_name,
         CASE WHEN sd.slug::text ILIKE '%mastery%' OR coalesce(sd.display_name,'') ILIKE '%mastery%' THEN 'mastery' ELSE 'professional' END AS tier
  FROM public.skill_definitions sd
  WHERE coalesce(sd.is_active,true)
    AND (sd.slug::text ILIKE '%professional%' OR sd.slug::text ILIKE '%mastery%'
      OR coalesce(sd.display_name,'') ILIKE '%professional%' OR coalesce(sd.display_name,'') ILIKE '%mastery%')
)
INSERT INTO public.education_mentors (
  name, focus_skill, description, specialty, cost, cooldown_hours,
  base_xp, difficulty, skill_gain_ratio, city_id, available_day,
  discovery_type, is_discoverable, lore_biography, discovery_hint, is_active
)
SELECT
  ht.display_name || CASE WHEN ht.tier='mastery' THEN ' Master' ELSE ' Coach' END,
  ht.slug,
  CASE WHEN ht.tier='mastery'
    THEN 'A top-level mentor for mastery progression.'
    ELSE 'An experienced mentor for professional progression.'
  END,
  ht.display_name,
  CASE WHEN ht.tier='mastery' THEN 50000 ELSE 30000 END,
  72,
  CASE WHEN ht.tier='mastery' THEN 350 ELSE 250 END,
  'advanced',
  CASE WHEN ht.tier='mastery' THEN 3.0 ELSE 2.5 END,
  NULL,
  NULL,
  'exploration',
  true,
  'A specialist mentor available through the education system once the skill tier is unlocked.',
  'Available from Education after unlocking this skill tier.',
  true
FROM higher_tier ht
WHERE NOT EXISTS (
  SELECT 1 FROM public.education_mentors m
  WHERE m.focus_skill=ht.slug AND coalesce(m.is_active,true)
);

-- Admin/QA coverage view: any row returned here is a content gap.
CREATE OR REPLACE VIEW public.skill_learning_source_gaps AS
WITH higher_tier AS (
  SELECT sd.slug::text AS skill_slug,
         coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) AS display_name
  FROM public.skill_definitions sd
  WHERE coalesce(sd.is_active,true)
    AND (sd.slug::text ILIKE '%professional%' OR sd.slug::text ILIKE '%mastery%'
      OR coalesce(sd.display_name,'') ILIKE '%professional%' OR coalesce(sd.display_name,'') ILIKE '%mastery%')
)
SELECT h.skill_slug, h.display_name,
  NOT EXISTS (SELECT 1 FROM public.skill_books b WHERE b.skill_slug=h.skill_slug AND coalesce(b.is_active,true)) AS missing_book,
  NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.skill_slug=h.skill_slug AND coalesce(c.is_active,true)) AS missing_course,
  NOT EXISTS (SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=h.skill_slug) AS missing_youtube,
  NOT EXISTS (SELECT 1 FROM public.education_mentors m WHERE m.focus_skill=h.skill_slug AND coalesce(m.is_active,true)) AS missing_mentor
FROM higher_tier h
WHERE
  NOT EXISTS (SELECT 1 FROM public.skill_books b WHERE b.skill_slug=h.skill_slug AND coalesce(b.is_active,true))
  OR NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.skill_slug=h.skill_slug AND coalesce(c.is_active,true))
  OR NOT EXISTS (SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=h.skill_slug)
  OR NOT EXISTS (SELECT 1 FROM public.education_mentors m WHERE m.focus_skill=h.skill_slug AND coalesce(m.is_active,true));

COMMENT ON VIEW public.skill_learning_source_gaps IS
  'QA view. Must return zero rows: every active Professional/Mastery skill needs book, university, YouTube and mentor coverage.';
