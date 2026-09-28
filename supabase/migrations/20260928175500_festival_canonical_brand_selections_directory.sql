-- Persist sponsor prospects on the current festival schema without creating
-- contracts or shadow sponsorship brands. The edition-aware sponsorship workflow
-- can later backfill these selections into festival_sponsor_prospects.
CREATE TABLE IF NOT EXISTS public.festival_canonical_brand_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.sponsorship_brands(id),
  selected_by_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_company_id, brand_id)
);

ALTER TABLE public.festival_canonical_brand_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_canonical_brand_selections FROM PUBLIC, anon, authenticated;

-- A distinct RPC name avoids a return-type collision when the edition-aware
-- add_festival_canonical_brand_prospect(uuid,uuid) migration is deployed.
CREATE OR REPLACE FUNCTION public.add_festival_legacy_brand_prospect(
  p_festival_company_id uuid,
  p_brand_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rpc$
DECLARE
  v_actor uuid := public._caller_profile_id();
  v_selection public.festival_canonical_brand_selections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, v_actor)
  THEN
    RAISE EXCEPTION 'festival_sponsorship_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sponsorship_brands
    WHERE id = p_brand_id AND is_active AND coalesce(available_budget, 0) > 0
  ) THEN
    RAISE EXCEPTION 'festival_sponsor_brand_ineligible' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_sponsorships fs
    JOIN public.festivals f ON f.id = fs.festival_id
    JOIN public.festival_companies fc ON fc.company_id = f.owner_company_id
    WHERE fc.id = p_festival_company_id AND fs.brand_id = p_brand_id
  ) THEN
    RAISE EXCEPTION 'festival_sponsor_brand_already_contracted' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_canonical_brand_selections
    (festival_company_id, brand_id, selected_by_profile_id)
  VALUES (p_festival_company_id, p_brand_id, v_actor)
  ON CONFLICT (festival_company_id, brand_id) DO NOTHING;

  SELECT * INTO v_selection
  FROM public.festival_canonical_brand_selections
  WHERE festival_company_id = p_festival_company_id AND brand_id = p_brand_id;

  RETURN jsonb_build_object(
    'id', v_selection.id,
    'festival_company_id', v_selection.festival_company_id,
    'sponsorship_brand_id', v_selection.brand_id,
    'already_prospected', true
  );
END;
$rpc$;

REVOKE ALL ON FUNCTION public.add_festival_legacy_brand_prospect(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_festival_legacy_brand_prospect(uuid,uuid) TO authenticated;

-- Server-side A-Z letter filter, stable alphabetical pagination and real
-- selected-state flags. Do not filter a truncated initial page in the browser.
CREATE OR REPLACE FUNCTION public.list_festival_canonical_brands(
  p_festival_company_id uuid,
  p_search text DEFAULT '',
  p_initial text DEFAULT '',
  p_sort text DEFAULT 'asc',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  brand_id uuid, brand_name text, logo_url text, category text, region text,
  available_budget numeric, wealth_score integer, exclusivity_pref boolean,
  already_prospected boolean, already_contracted boolean, total_count bigint
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
  WITH eligible AS (
    SELECT b.id, b.name, b.logo_url, b.category, b.region,
           b.available_budget, b.wealth_score, b.exclusivity_pref
    FROM public.sponsorship_brands b
    WHERE b.is_active AND coalesce(b.available_budget,0) > 0
      AND (
        coalesce(btrim(p_initial),'') = ''
        OR upper(left(btrim(b.name),1)) = upper(left(btrim(p_initial),1))
      )
      AND (
        coalesce(btrim(p_search),'') = ''
        OR position(lower(btrim(p_search)) in lower(b.name)) > 0
        OR position(lower(btrim(p_search)) in lower(coalesce(b.category,''))) > 0
      )
  )
  SELECT
    b.id, b.name, b.logo_url, b.category, b.region,
    b.available_budget::numeric, b.wealth_score::integer,
    coalesce(b.exclusivity_pref,false),
    EXISTS (
      SELECT 1 FROM public.festival_canonical_brand_selections s
      WHERE s.festival_company_id = p_festival_company_id AND s.brand_id = b.id
    ),
    EXISTS (
      SELECT 1 FROM public.festival_sponsorships fs
      JOIN public.festivals f ON f.id = fs.festival_id
      JOIN public.festival_companies fc ON fc.company_id = f.owner_company_id
      WHERE fc.id = p_festival_company_id AND fs.brand_id = b.id
    ),
    count(*) OVER ()
  FROM eligible b
  ORDER BY
    CASE WHEN lower(p_sort) = 'desc' THEN lower(b.name) END DESC NULLS LAST,
    CASE WHEN lower(p_sort) <> 'desc' OR p_sort IS NULL THEN lower(b.name) END ASC NULLS LAST,
    b.id
  LIMIT least(greatest(coalesce(p_limit,40),1),100)
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.list_festival_canonical_brands(uuid,text,text,text,integer,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_festival_canonical_brands(uuid,text,text,text,integer,integer)
  TO authenticated;
COMMENT ON FUNCTION public.list_festival_canonical_brands(uuid,text,text,text,integer,integer)
IS 'Owner-authorised paginated canonical brand directory, searchable and filterable by first letter; selected-state from legacy prospects.';

NOTIFY pgrst, 'reload schema';
