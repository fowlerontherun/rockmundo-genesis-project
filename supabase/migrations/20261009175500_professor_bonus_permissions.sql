-- Protect the professor XP lookup from missing table grants on the
-- service-owned attendance path. This remains a read-only function.
CREATE OR REPLACE FUNCTION public.university_visiting_professor_bonus(
  p_university_id uuid,
  p_skill_slug text,
  p_at timestamptz DEFAULT now()
) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.professor_residencies r
    JOIN public.travelling_professors p ON p.id = r.professor_id
    JOIN public.professor_skill_memberships m ON m.skill_family = p.skill_family
    WHERE r.university_id = p_university_id
      AND m.skill_slug = p_skill_slug
      AND p.is_enabled
      AND r.starts_at <= p_at AND p_at < r.ends_at
  ) THEN 0.70::numeric ELSE 0::numeric END;
$fn$;
REVOKE ALL ON FUNCTION public.university_visiting_professor_bonus(uuid,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.university_visiting_professor_bonus(uuid,text,timestamptz) TO authenticated, service_role;
