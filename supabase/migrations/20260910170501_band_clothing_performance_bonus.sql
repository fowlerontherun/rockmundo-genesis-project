-- Band-level resolver for equipped clothing performance bonuses.
-- Uses the average active, non-touring member bonus so band size cannot stack the effect.

CREATE OR REPLACE FUNCTION public.get_band_equipped_clothing_performance_bonus(p_band_id uuid)
RETURNS TABLE (
  performance_pct numeric,
  active_members integer,
  members_with_bonus integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH active_members AS (
    SELECT DISTINCT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = p_band_id
      AND bm.member_status = 'active'
      AND COALESCE(bm.is_touring_member, false) = false
      AND bm.profile_id IS NOT NULL
  ), resolved AS (
    SELECT
      am.profile_id,
      COALESCE((SELECT b.performance_pct FROM public.get_equipped_clothing_bonuses(am.profile_id) b), 0)::numeric AS performance_pct
    FROM active_members am
  )
  SELECT
    LEAST(20, COALESCE(AVG(r.performance_pct), 0))::numeric,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE r.performance_pct > 0)::integer
  FROM resolved r;
$$;

GRANT EXECUTE ON FUNCTION public.get_band_equipped_clothing_performance_bonus(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_band_equipped_clothing_performance_bonus(uuid) IS
  'Returns the capped average equipped clothing performance bonus across active non-touring band members. Use this value once in the authoritative gig completion rating before fame, fans, commerce, chemistry, morale and reputation are calculated.';
