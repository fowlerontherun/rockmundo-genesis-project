-- Phase 1 continuation: derive professor specialisms from the live university course catalogue.
-- Use an explicit course-to-family map; never guess a family when awarding XP.
CREATE TABLE public.professor_skill_memberships (
  skill_slug text PRIMARY KEY REFERENCES public.skill_definitions(slug) ON DELETE CASCADE,
  skill_family text NOT NULL REFERENCES public.travelling_professors(skill_family) ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professor_skill_memberships_family_idx ON public.professor_skill_memberships(skill_family);

-- The same specialism spans Basic / Professional / Mastery.
-- Example: instruments_basic_electric_guitar -> instruments_electric_guitar.
-- Other slugs retain their original identity; admins can explicitly remap later.
WITH canonical AS (
  SELECT DISTINCT sd.slug,
    regexp_replace(sd.slug, '_(basic|professional|mastery)_', '_', 'g') AS family
  FROM public.skill_definitions sd
  JOIN public.university_courses uc ON uc.skill_slug = sd.slug
), families AS (
  SELECT DISTINCT family FROM canonical
)
INSERT INTO public.travelling_professors (name, skill_family, biography)
SELECT 'Professor of ' || initcap(replace(family, '_', ' ')),
       family,
       'A world-renowned visiting specialist in ' || replace(family, '_', ' ') || '.'
FROM families
ON CONFLICT (skill_family) DO NOTHING;

INSERT INTO public.professor_skill_memberships (skill_slug, skill_family)
SELECT c.slug, c.family FROM canonical c
ON CONFLICT (skill_slug) DO NOTHING;

ALTER TABLE public.professor_skill_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professor skill memberships are readable"
  ON public.professor_skill_memberships FOR SELECT TO authenticated USING (true);

-- Server-side read-only eligibility lookup, usable by attendance processors.
CREATE FUNCTION public.university_visiting_professor_bonus(
  p_university_id uuid,
  p_skill_slug text,
  p_at timestamptz DEFAULT now()
) RETURNS numeric
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.professor_residencies r
    JOIN public.travelling_professors p ON p.id = r.professor_id
    JOIN public.professor_skill_memberships m ON m.skill_family = p.skill_family
    WHERE r.university_id = p_university_id
      AND m.skill_slug = p_skill_slug
      AND p.is_enabled
      AND r.starts_at <= p_at AND p_at < r.ends_at
  ) THEN 0.70::numeric ELSE 0::numeric END;
$$;
REVOKE ALL ON FUNCTION public.university_visiting_professor_bonus(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.university_visiting_professor_bonus(uuid, text, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.university_visiting_professor_bonus(uuid, text, timestamptz) IS
  'Returns a 0.70 university-only XP bonus for an exact skill match during an active residency. Does not itself award XP.';
