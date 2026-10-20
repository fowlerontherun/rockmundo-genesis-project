-- Repair omitted physical-vs-vocal distinction for the selectable
-- 'Vocal & Performance Skills' band role, without deleting legacy vocals skills.
BEGIN;
INSERT INTO public.skill_definitions(slug,display_name,description,tier_caps)
VALUES
  ('instruments_basic_vocal_performance','Vocal & Performance Skills','Develop pitch accuracy, breath management, and confident lead or backing vocals.','{}'::jsonb),
  ('instruments_professional_vocal_performance','Professional Vocal Performance','Blend harmonies, stage movement, and vocal dynamics across ensemble settings.','{}'::jsonb),
  ('instruments_mastery_vocal_performance','Vocal Performance Mastery','Command stages with expressive phrasing, show-ready presence, and adaptive harmonizing.','{}'::jsonb)
ON CONFLICT(slug) DO NOTHING;
WITH edges(child,parent) AS (VALUES
 ('instruments_professional_vocal_performance','instruments_basic_vocal_performance'),
 ('instruments_mastery_vocal_performance','instruments_professional_vocal_performance')
)
INSERT INTO public.skill_parent_links(skill_id,parent_skill_id,unlock_threshold)
SELECT c.id,p.id,20 FROM edges e
JOIN public.skill_definitions c ON c.slug=e.child
JOIN public.skill_definitions p ON p.slug=e.parent
WHERE NOT EXISTS (SELECT 1 FROM public.skill_parent_links l WHERE l.skill_id=c.id AND l.parent_skill_id=p.id);
COMMIT;
