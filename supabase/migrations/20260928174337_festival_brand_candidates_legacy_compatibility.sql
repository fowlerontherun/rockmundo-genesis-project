-- Restore the brand directory on databases that predate the edition-aware
-- festival sponsorship planning tables. This is a narrow compatibility RPC:
-- it reads existing sponsorship_brands without duplicating them.
--
-- 20291220094000_festival_canonical_brand_discovery.sql replaces this with
-- prospect and contract status from the edition-aware sponsorship plan.
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
AS $rpc$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public._festival_company_manager_authorized(
       p_festival_company_id, public._caller_profile_id()
     )
  THEN
    RAISE EXCEPTION 'festival_sponsorship_forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      b.id, b.name, b.logo_url, b.category, b.region,
      b.available_budget::numeric, b.wealth_score::integer,
      coalesce(b.exclusivity_pref, false),
      false, -- Plan-aware prospect tracking is not available on legacy deployments.
      EXISTS (
        SELECT 1
        FROM public.festival_sponsorships fs
        JOIN public.festivals f ON f.id = fs.festival_id
        JOIN public.festival_companies fc ON fc.company_id = f.owner_company_id
        WHERE fc.id = p_festival_company_id AND fs.brand_id = b.id
      )
    FROM public.sponsorship_brands b
    WHERE b.is_active
      AND coalesce(b.available_budget, 0) > 0
      AND (
        coalesce(btrim(p_search), '') = ''
        OR b.name ILIKE '%' || replace(replace(replace(btrim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' ESCAPE E'\\'
        OR b.category ILIKE '%' || replace(replace(replace(btrim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' ESCAPE E'\\'
      )
    ORDER BY b.name, b.id
    LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
  TO authenticated;
COMMENT ON FUNCTION public.get_festival_canonical_brand_candidates(uuid,text,integer)
IS 'Compatibility brand discovery for authorised festival managers until edition-aware sponsorship tables are deployed.';

NOTIFY pgrst, 'reload schema';
