-- Owner/private and public/redacted simplified Festival Results boundaries.
CREATE OR REPLACE FUNCTION public.get_festival_edition_results(
  p_festival_company_id uuid,
  p_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_festival_company public.festival_companies%ROWTYPE;
  v_result public.festival_simplified_edition_results%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_RESULTS_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_edition_id
    AND festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_result
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id = v_edition.id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_festival_company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  RETURN jsonb_build_object(
    'festivalName', coalesce(v_festival_company.public_name, v_edition.name, 'Festival'),
    'editionYear', v_edition.edition_year,
    'dates', jsonb_build_object('startsOn', v_edition.starts_on, 'endsOn', v_edition.ends_on),
    'location', jsonb_build_object('countryCode', v_edition.country_code, 'cityId', v_edition.city_id),
    'lineup', v_result.lineup,
    'headliners', v_result.headliners,
    'publishedSchedule', v_result.published_schedule,
    'attendance', v_result.attendance,
    'audienceScore', v_result.audience_score,
    'profitabilityBand', v_result.profitability_band,
    'completedAt', v_result.completed_at,
    'currencyCode', v_result.currency_code,
    'financials', jsonb_build_object(
      'ticketRevenueMinor', v_result.ticket_revenue_minor,
      'foodAndDrinkRevenueMinor', v_result.food_and_drink_revenue_minor,
      'merchandiseRevenueMinor', v_result.merchandise_revenue_minor,
      'operatingCostMinor', v_result.operating_cost_minor,
      'taxMinor', v_result.tax_minor,
      'totalRevenueMinor', v_result.total_revenue_minor,
      'netProfitMinor', v_result.net_profit_minor
    ),
    'companyImpact', jsonb_build_object(
      'settlementApplied', v_result.settlement_applied_at IS NOT NULL,
      'settlementAppliedAt', v_result.settlement_applied_at,
      'companyTransactionId', v_result.company_transaction_id,
      'balanceBeforeMinor', v_result.company_balance_before_minor,
      'balanceAfterMinor', v_result.company_balance_after_minor,
      'reputationBefore', v_result.company_reputation_before,
      'reputationAfter', v_result.company_reputation_after,
      'reputationChange', v_result.reputation_change
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_edition_results(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_results(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_festival_company public.festival_companies%ROWTYPE;
  v_result public.festival_simplified_edition_results%ROWTYPE;
BEGIN
  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_result
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id = v_edition.id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_festival_company
  FROM public.festival_companies
  WHERE id = v_edition.festival_company_id;

  RETURN jsonb_build_object(
    'festivalName', coalesce(v_festival_company.public_name, v_edition.name, 'Festival'),
    'editionYear', v_edition.edition_year,
    'dates', jsonb_build_object('startsOn', v_edition.starts_on, 'endsOn', v_edition.ends_on),
    'location', jsonb_build_object('countryCode', v_edition.country_code, 'cityId', v_edition.city_id),
    'lineup', v_result.lineup,
    'headliners', v_result.headliners,
    'publishedSchedule', v_result.published_schedule,
    'attendance', v_result.attendance,
    'audienceScore', v_result.audience_score,
    'profitabilityBand', v_result.profitability_band,
    'completedAt', v_result.completed_at,
    'achievements', '[]'::jsonb,
    'highlights', jsonb_build_array(
      jsonb_build_object('type', 'attendance', 'attendance', v_result.attendance),
      jsonb_build_object('type', 'audience_rating', 'audienceScore', v_result.audience_score)
    ),
    'reputationChange', v_result.reputation_change,
    'fameChange', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_festival_edition_history(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_history(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
