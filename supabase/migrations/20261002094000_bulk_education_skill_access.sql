-- One bulk eligibility endpoint for every education surface.
-- Keeps Books, University, YouTube and Mentors aligned with the authoritative
-- skill_tier_unlocked() rule without issuing one RPC per card.
CREATE OR REPLACE FUNCTION public.skill_tier_access_bulk(
  p_profile_id uuid,
  p_slugs text[]
)
RETURNS TABLE(skill_slug text, is_unlocked boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT slug,
         public.skill_tier_unlocked(p_profile_id, slug)
  FROM unnest(coalesce(p_slugs, ARRAY[]::text[])) AS slug
  GROUP BY slug;
$function$;

COMMENT ON FUNCTION public.skill_tier_access_bulk(uuid, text[]) IS
  'Returns authoritative Professional/Mastery unlock eligibility for a set of skill slugs used by education discovery surfaces.';
