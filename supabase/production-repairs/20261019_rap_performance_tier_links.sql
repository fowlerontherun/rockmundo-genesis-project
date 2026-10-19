-- Complete the legacy rap performance progressions left out of the physical
-- instrument migration. 20 levels in Basic unlock Professional; 20 in
-- Professional unlock Mastery. Non-destructive to existing progress.
BEGIN;
WITH tracks(slug) AS (
  VALUES ('rapping'),('freestyle_rap'),('battle_rap'),
         ('flow_and_cadence'),('rap_songwriting'),('ad_libs_and_vocal_fx')
), edges(child,parent) AS (
  SELECT 'instruments_professional_'||slug, 'instruments_basic_'||slug FROM tracks
  UNION ALL
  SELECT 'instruments_mastery_'||slug,'instruments_professional_'||slug FROM tracks
)
INSERT INTO public.skill_parent_links(skill_id,parent_skill_id,unlock_threshold)
SELECT c.id,p.id,20 FROM edges e
JOIN public.skill_definitions c ON c.slug=e.child
JOIN public.skill_definitions p ON p.slug=e.parent
WHERE NOT EXISTS (
  SELECT 1 FROM public.skill_parent_links l WHERE l.skill_id=c.id AND l.parent_skill_id=p.id
);
COMMIT;
