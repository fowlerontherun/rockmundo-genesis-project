-- Organiser action: add a real catalogue brand as an NPC sponsor prospect.
-- The canonical brand ID is also used as the stable NPC identity so the
-- existing invitation/proposal workflow can use it without a shadow catalogue.
CREATE OR REPLACE FUNCTION public.add_festival_canonical_brand_prospect(
  p_festival_company_id uuid,
  p_brand_id uuid
)
RETURNS public.festival_sponsor_prospects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_plan public.festival_sponsorship_plans%ROWTYPE;
  v_brand public.sponsorship_brands%ROWTYPE;
  v_result public.festival_sponsor_prospects%ROWTYPE;
  v_actor uuid := public._caller_profile_id();
BEGIN
  IF v_actor IS NULL OR NOT public._festival_sponsorship_authorised(p_festival_company_id, v_actor) THEN
    RAISE EXCEPTION 'festival_sponsorship_forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_plan FROM public.festival_sponsorship_plans
    WHERE festival_company_id = p_festival_company_id FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'festival_sponsorship_plan_missing' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_brand FROM public.sponsorship_brands
    WHERE id = p_brand_id AND is_active AND coalesce(available_budget, 0) > 0;
  IF v_brand.id IS NULL THEN
    RAISE EXCEPTION 'festival_sponsor_brand_ineligible' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.festival_sponsor_contracts
    WHERE festival_sponsorship_plan_id = v_plan.id
      AND sponsorship_brand_id = p_brand_id
      AND status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
  ) THEN
    RAISE EXCEPTION 'festival_sponsor_brand_already_contracted' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.festival_sponsor_prospects(
    festival_sponsorship_plan_id, sponsor_source, npc_sponsor_id,
    sponsorship_brand_id, compatibility_score, audience_fit_score,
    genre_fit_score, festival_fit_score, reputation_fit_score,
    commercial_capacity_score, community_value_score, relationship_score, risk_score
  ) VALUES (
    v_plan.id, 'npc_company', p_brand_id, p_brand_id,
    50, 50, 50, 50, 50, 50, 50, 50, 25
  )
  ON CONFLICT (festival_sponsorship_plan_id, sponsorship_brand_id)
    WHERE sponsorship_brand_id IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.add_festival_canonical_brand_prospect(uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_festival_canonical_brand_prospect(uuid,uuid)
  TO authenticated;

COMMENT ON FUNCTION public.add_festival_canonical_brand_prospect(uuid,uuid)
IS 'Owner-authorised canonical NPC prospect selection. Scores are neutral placeholders, not calculated suitability.';
