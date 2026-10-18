-- PooTube is a fictional in-game educational activity.
-- Backfill occurs in 20261018142732_education_pootube_mentor_reconciliation.sql.
-- Ensure future skill definitions automatically receive the same two lessons.
-- Applied and smoke-tested directly on production 2026-10-18.
CREATE UNIQUE INDEX IF NOT EXISTS uq_education_pootube_internal_lesson_ref
  ON public.education_youtube_resources(video_url)
  WHERE video_url LIKE 'pooutube://lesson/%';

CREATE OR REPLACE FUNCTION public.seed_pootube_skill_lessons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $f$
BEGIN
 INSERT INTO public.education_youtube_resources
 (title, description, video_url, category, difficulty_level, duration_minutes,
  tags, skill_slug, channel_name, is_featured)
 SELECT left(NEW.display_name || ' — ' || episode.suffix,240),
        format(episode.description,NEW.display_name),
        'pooutube://lesson/' || NEW.slug::text || '/' || episode.idx::text,
        'PooTube Originals',episode.difficulty,episode.duration,
        ARRAY['in-game lesson','PooTube',episode.topic]::text[],
        NEW.slug,'Rockmundo Academy',false
 FROM (VALUES
 (1,'Essentials','Discover the key ideas behind %s, with examples, useful terminology and a guided demonstration.',1,10,'essentials'),
 (2,'Practice Session','Follow an in-game practice workshop for %s, review common mistakes and test what you learned.',2,14,'practice')
 ) AS episode(idx,suffix,description,difficulty,duration,topic)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.education_youtube_resources r
   WHERE r.video_url='pooutube://lesson/' || NEW.slug::text || '/' || episode.idx::text
 );
 RETURN NEW;
END $f$;

-- Internal trigger, not a publicly callable RPC.
REVOKE EXECUTE ON FUNCTION public.seed_pootube_skill_lessons()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_skill_definition_seed_pootube ON public.skill_definitions;
CREATE TRIGGER trg_skill_definition_seed_pootube
 AFTER INSERT ON public.skill_definitions
 FOR EACH ROW EXECUTE FUNCTION public.seed_pootube_skill_lessons();
