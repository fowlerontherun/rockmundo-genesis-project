CREATE OR REPLACE FUNCTION public.normalize_university_higher_tier_course_requirement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.skill_definitions sd
    WHERE sd.slug::text = NEW.skill_slug
      AND (
        sd.slug::text ILIKE '%professional%'
        OR sd.slug::text ILIKE '%mastery%'
        OR coalesce(sd.display_name, '') ILIKE '%professional%'
        OR coalesce(sd.display_name, '') ILIKE '%mastery%'
      )
  ) THEN
    NEW.required_skill_level := 0;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalize_university_higher_tier_course_requirement
  ON public.university_courses;

CREATE TRIGGER trg_normalize_university_higher_tier_course_requirement
BEFORE INSERT OR UPDATE OF skill_slug, required_skill_level
ON public.university_courses
FOR EACH ROW
EXECUTE FUNCTION public.normalize_university_higher_tier_course_requirement();

COMMENT ON FUNCTION public.normalize_university_higher_tier_course_requirement() IS
  'Prevents Professional/Mastery university courses from requiring levels in the target skill; tier prerequisites are enforced by skill_tier_unlocked().';
