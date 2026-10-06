-- Ensure the Luthiery career has a discoverable learning route at every tier.
-- These skills were introduced after the generic 2026-10-02 learning-source backfill.

WITH skills(slug, display_name, tier) AS (
  VALUES
    ('luthiery_basic_technical','Luthiery Basics','basic'),
    ('luthiery_professional_technical','Professional Luthiery','professional'),
    ('luthiery_mastery_technical','Master Luthier','mastery')
)
INSERT INTO public.skill_books
  (title,author,description,skill_slug,skill_percentage_gain,base_reading_days,required_skill_level,price,is_active,category,daily_reading_time)
SELECT
  CASE tier WHEN 'basic' THEN 'Building Your First Electric Guitar'
            WHEN 'professional' THEN 'Professional Luthiery Workshop Manual'
            ELSE 'The Master Luthier''s Bench' END,
  'RockMundo Craft Press',
  CASE tier WHEN 'basic' THEN 'An accessible introduction to instrument construction, materials, setup and workshop practice.'
            WHEN 'professional' THEN 'Advanced construction, component selection, finishing and quality control for working Luthiers.'
            ELSE 'Master-level instrument design, material judgement, precision construction and artisan finishing.' END,
  slug,
  CASE tier WHEN 'basic' THEN 0.10 WHEN 'professional' THEN 0.14 ELSE 0.18 END,
  CASE tier WHEN 'basic' THEN 3 WHEN 'professional' THEN 4 ELSE 4 END,
  0,
  CASE tier WHEN 'basic' THEN 80 WHEN 'professional' THEN 160 ELSE 260 END,
  true,'Luthiery',
  CASE tier WHEN 'basic' THEN 30 WHEN 'professional' THEN 45 ELSE 60 END
FROM skills s
WHERE NOT EXISTS (SELECT 1 FROM public.skill_books b WHERE b.skill_slug=s.slug AND coalesce(b.is_active,true));

WITH skills(slug, display_name, tier) AS (
  VALUES
    ('luthiery_basic_technical','Luthiery Basics','basic'),
    ('luthiery_professional_technical','Professional Luthiery','professional'),
    ('luthiery_mastery_technical','Master Luthier','mastery')
), chosen_university AS (
  SELECT id FROM public.universities
  ORDER BY CASE WHEN name='Rockmundo School Of Rock' THEN 0 ELSE 1 END,
           prestige DESC NULLS LAST, quality_of_learning DESC NULLS LAST, id
  LIMIT 1
)
INSERT INTO public.university_courses
  (university_id,name,description,skill_slug,base_price,base_duration_days,xp_per_day_min,xp_per_day_max,required_skill_level,is_active,class_start_hour,class_end_hour)
SELECT u.id,
  CASE tier WHEN 'basic' THEN 'Introduction to Luthiery'
            WHEN 'professional' THEN 'Professional Instrument Construction'
            ELSE 'Master Luthier Programme' END,
  CASE tier WHEN 'basic' THEN 'Structured practical study of guitar and bass construction.'
            WHEN 'professional' THEN 'Advanced instrument construction, electronics, materials and finishing.'
            ELSE 'Intensive artisan instrument design and master-level workshop practice.' END,
  slug,
  CASE tier WHEN 'basic' THEN 1400 WHEN 'professional' THEN 2800 ELSE 4500 END,
  CASE tier WHEN 'basic' THEN 5 WHEN 'professional' THEN 7 ELSE 9 END,
  CASE tier WHEN 'basic' THEN 140 WHEN 'professional' THEN 250 ELSE 360 END,
  CASE tier WHEN 'basic' THEN 220 WHEN 'professional' THEN 350 ELSE 480 END,
  0,true,10,14
FROM skills s CROSS JOIN chosen_university u
WHERE NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.skill_slug=s.slug AND coalesce(c.is_active,true));

WITH skills(slug, display_name, tier) AS (
  VALUES
    ('luthiery_basic_technical','Luthiery Basics','basic'),
    ('luthiery_professional_technical','Professional Luthiery','professional'),
    ('luthiery_mastery_technical','Master Luthier','mastery')
)
INSERT INTO public.education_youtube_resources
  (title,description,video_url,channel_name,duration_minutes,difficulty_level,skill_slug,category,tags,is_featured)
SELECT
  CASE tier WHEN 'basic' THEN 'Luthiery Basics: Build Your First Guitar'
            WHEN 'professional' THEN 'Professional Luthiery Techniques'
            ELSE 'Master Luthier Workshop' END,
  'A curated video-learning route for ' || display_name || '.',
  'https://www.youtube.com/results?search_query=' ||
    CASE tier WHEN 'basic' THEN 'guitar+luthiery+basics'
              WHEN 'professional' THEN 'professional+luthiery+guitar+building'
              ELSE 'master+luthier+guitar+building' END,
  'RockMundo Luthiery Learning',NULL,
  CASE tier WHEN 'basic' THEN 1 WHEN 'professional' THEN 2 ELSE 3 END,
  slug,'Luthiery',ARRAY['luthiery',tier,'instrument-building']::text[],tier='basic'
FROM skills s
WHERE NOT EXISTS (SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=s.slug);

WITH skills(slug, display_name, tier) AS (
  VALUES
    ('luthiery_basic_technical','Luthiery Basics','basic'),
    ('luthiery_professional_technical','Professional Luthiery','professional'),
    ('luthiery_mastery_technical','Master Luthier','mastery')
)
INSERT INTO public.education_mentors
  (name,focus_skill,description,specialty,cost,cooldown_hours,base_xp,difficulty,skill_gain_ratio,city_id,available_day,discovery_type,is_discoverable,lore_biography,discovery_hint,is_active)
SELECT
  CASE tier WHEN 'basic' THEN 'Sam Woodwright' WHEN 'professional' THEN 'Elena Fretwell' ELSE 'Marco Bellini' END,
  slug,
  CASE tier WHEN 'basic' THEN 'A patient workshop teacher who introduces players to instrument construction.'
            WHEN 'professional' THEN 'A working custom-guitar maker specialising in precision builds and finishing.'
            ELSE 'A renowned artisan builder who teaches master-level instrument design and judgement.' END,
  display_name,
  CASE tier WHEN 'basic' THEN 12000 WHEN 'professional' THEN 30000 ELSE 50000 END,
  72,
  CASE tier WHEN 'basic' THEN 160 WHEN 'professional' THEN 250 ELSE 350 END,
  CASE tier WHEN 'basic' THEN 'intermediate' ELSE 'advanced' END,
  CASE tier WHEN 'basic' THEN 1.8 WHEN 'professional' THEN 2.5 ELSE 3.0 END,
  NULL,NULL,'exploration',true,
  'A specialist instrument maker available through the Education mentor network.',
  CASE tier WHEN 'basic' THEN 'Look in Education → Mentors to begin your Luthiery career.'
            ELSE 'Available in Education → Mentors once the previous Luthiery tier is mastered.' END,
  true
FROM skills s
WHERE NOT EXISTS (SELECT 1 FROM public.education_mentors m WHERE m.focus_skill=s.slug AND coalesce(m.is_active,true));

CREATE OR REPLACE VIEW public.luthiery_learning_source_gaps AS
WITH skills(skill_slug) AS (
  VALUES ('luthiery_basic_technical'),('luthiery_professional_technical'),('luthiery_mastery_technical')
)
SELECT s.skill_slug,
  NOT EXISTS (SELECT 1 FROM public.skill_books b WHERE b.skill_slug=s.skill_slug AND coalesce(b.is_active,true)) AS missing_book,
  NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.skill_slug=s.skill_slug AND coalesce(c.is_active,true)) AS missing_course,
  NOT EXISTS (SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=s.skill_slug) AS missing_youtube,
  NOT EXISTS (SELECT 1 FROM public.education_mentors m WHERE m.focus_skill=s.skill_slug AND coalesce(m.is_active,true)) AS missing_mentor
FROM skills s
WHERE NOT EXISTS (SELECT 1 FROM public.skill_books b WHERE b.skill_slug=s.skill_slug AND coalesce(b.is_active,true))
   OR NOT EXISTS (SELECT 1 FROM public.university_courses c WHERE c.skill_slug=s.skill_slug AND coalesce(c.is_active,true))
   OR NOT EXISTS (SELECT 1 FROM public.education_youtube_resources y WHERE y.skill_slug=s.skill_slug)
   OR NOT EXISTS (SELECT 1 FROM public.education_mentors m WHERE m.focus_skill=s.skill_slug AND coalesce(m.is_active,true));

COMMENT ON VIEW public.luthiery_learning_source_gaps IS
  'QA view: must return zero rows. Every Luthiery tier needs an active book, university course, video and mentor.';
