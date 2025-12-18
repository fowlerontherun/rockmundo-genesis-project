-- Update YouTube videos to map to valid skill slugs
-- Map: Guitar -> guitar, Bass -> bass, Drums -> drums, 
-- Keyboard -> songwriting, Performance -> performance, 
-- Production -> songwriting, DJ -> performance, Genres -> songwriting, Vocals -> vocals

UPDATE public.education_youtube_resources
SET category = CASE
  WHEN category = 'Guitar' THEN 'guitar'
  WHEN category = 'Bass' THEN 'bass'
  WHEN category = 'Drums' THEN 'drums'
  WHEN category = 'Vocals' THEN 'vocals'
  WHEN category = 'Performance' THEN 'performance'
  WHEN category = 'Keyboard' THEN 'songwriting'
  WHEN category = 'Production' THEN 'songwriting'
  WHEN category = 'DJ' THEN 'performance'
  WHEN category = 'Genres' THEN 'songwriting'
  ELSE LOWER(category)
END
WHERE category IS NOT NULL;