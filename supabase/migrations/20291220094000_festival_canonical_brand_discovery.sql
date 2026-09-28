-- Owner-facing canonical brand discovery, backed by the existing brand catalogue.
-- This does not create shadow NPC brands or mutate sponsor contracts.
CREATE OR REPLACE FUNCTION public.get_festival_canonical_brand_candidates(
  p_festival_company_id uuid,
  p_search text DEFAULT '',
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  logo_url text,
  category text,
  region text,
  available_budget numeric,
  wealth_score integer,
  exclusivity_pref boolean,
  already_prospected boolean,
  already_contracted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_id uuid;
  v_profile_id uuid;
BEGIN
  v_profile_id := public._caller_profile_id();
  IF v_profile_id IS NULL OR NOT public._festival_sponsorship_authorised(p_festival_company_id, v_profile_id) THEN
    RAISE EXCEPTION 'festival_sponsorship_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_plan_id
  FROM public.festival_sponsorship_plans
  WHERE festival_company_id = p_festival_company_id;

  IF v_plan_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT b.id, b.name, b.logo_url, b.category, b.region,
         b.available_budget::numeric, b.wealth_score::integer,
         coalesce(b.exclusivity_pref, false),
         EXISTS (
           SELECT 1 FROM public.festival_sponsor_prospects sp
           WHERE sp.festival_sponsorship_plan_id = v_plan_id
             AND sp.sponsorship_brand_id = b.id
         ),
         EXISTS (
           SELECT 1 FROM public.festival_sponsor_contracts sc
           WHERE sc.festival_sponsorship_plan_id = v_plan_id
             AND sc.sponsorship_brand_id = b.id
             AND sc.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
         )
  FROM public.sponsorship_brands b
  WHERE b.is_active
    AND coalesce(b.available_budget, 0) > 0
    AND (coalesce(btrim(p_search), '') = ''
         OR b.name ILIKE '%' || replace(replace(replace(btrim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' ESCAPE E'\\'
         OR b.category ILIKE '%' || replace(replace(replace(btrim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' ESCAPE E'\\')
  ORDER BY b.name, b.id
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
TO authenticated;

COMMENT ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
IS 'Owner-authorised canonical brand discovery for festivals; returns existing brand IDs, logos, eligibility and current plan usage.';
