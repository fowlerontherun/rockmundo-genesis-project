-- Owner Results parity for the 2026-09-03 Festival settlement authority.
-- Financial details remain owner/manager only; public history stays redacted.

CREATE OR REPLACE FUNCTION public.get_festival_edition_results(p_festival_company_id uuid,p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_company public.festival_companies%ROWTYPE;
  v_result public.festival_simplified_edition_results%ROWTYPE;
  v_rich public.festival_results%ROWTYPE;
  v_review public.festival_result_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_RESULTS_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_edition FROM public.festival_editions_v2
   WHERE id=p_edition_id AND festival_company_id=p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_result FROM public.festival_simplified_edition_results WHERE festival_edition_id=p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_company FROM public.festival_companies WHERE id=p_festival_company_id;
  SELECT * INTO v_rich FROM public.festival_results WHERE festival_edition_id=p_edition_id;
  IF v_rich.id IS NOT NULL THEN SELECT * INTO v_review FROM public.festival_result_reviews WHERE festival_result_id=v_rich.id; END IF;

  RETURN jsonb_build_object(
    'festivalName',coalesce(v_company.public_name,v_edition.name,'Festival'),
    'editionYear',v_edition.edition_year,
    'dates',jsonb_build_object('startsOn',v_edition.starts_on,'endsOn',v_edition.ends_on),
    'location',jsonb_build_object('countryCode',v_edition.country_code,'cityId',v_edition.city_id,'city',CASE WHEN v_rich.id IS NULL THEN NULL ELSE v_rich.city END),
    'lineup',v_result.lineup,
    'headliners',v_result.headliners,
    'publishedSchedule',v_result.published_schedule,
    'attendance',v_result.attendance,
    'audienceScore',v_result.audience_score,
    'profitabilityBand',v_result.profitability_band,
    'completedAt',v_result.completed_at,
    'currencyCode',v_result.currency_code,
    'financials',jsonb_build_object(
      'ticketRevenueMinor',v_result.ticket_revenue_minor,
      'sponsorshipRevenueMinor',coalesce(nullif(v_result.result_snapshot->>'sponsorshipRevenueMinor','')::bigint,0),
      'foodAndDrinkRevenueMinor',v_result.food_and_drink_revenue_minor,
      'merchandiseRevenueMinor',v_result.merchandise_revenue_minor,
      'operatingCostMinor',v_result.operating_cost_minor,
      'taxMinor',v_result.tax_minor,
      'totalRevenueMinor',v_result.total_revenue_minor,
      'netProfitMinor',v_result.net_profit_minor,
      'ledgerFrozenAt',v_result.finance_ledger_frozen_at,
      'ledgerReconciled',v_result.finance_ledger_frozen_at IS NOT NULL
    ),
    'companyImpact',jsonb_build_object(
      'settlementApplied',v_result.settlement_applied_at IS NOT NULL,
      'settlementAppliedAt',v_result.settlement_applied_at,
      'companyTransactionId',v_result.company_transaction_id,
      'balanceBeforeMinor',v_result.company_balance_before_minor,
      'balanceAfterMinor',v_result.company_balance_after_minor,
      'reputationBefore',v_result.company_reputation_before,
      'reputationAfter',v_result.company_reputation_after,
      'baseReputationChange',v_result.reputation_change,
      'engagementReputationBonus',v_result.engagement_reputation_bonus,
      'reputationChange',v_result.reputation_change+v_result.engagement_reputation_bonus,
      'engagementFinalised',v_result.engagement_finalised_at IS NOT NULL,
      'engagementFinalisedAt',v_result.engagement_finalised_at,
      'realAttendance',v_result.real_attendance_signal
    ),
    'quality',CASE WHEN v_rich.id IS NULL THEN NULL ELSE jsonb_build_object(
      'overallRating',coalesce(v_review.overall_rating,v_rich.crowd_satisfaction),
      'organisation',v_review.organisation,'lineup',v_review.line_up,'crowdAtmosphere',v_review.crowd_atmosphere,
      'stageProduction',v_review.stage_production,'valueForMoney',v_review.value_for_money,'facilities',v_review.facilities
    ) END,
    'performanceCount',CASE WHEN v_rich.id IS NULL THEN 0 ELSE v_rich.performance_count END,
    'largestPerformanceCrowd',CASE WHEN v_rich.id IS NULL THEN 0 ELSE v_rich.largest_performance_crowd END,
    'highlights',CASE WHEN v_rich.id IS NULL THEN '[]'::jsonb ELSE v_rich.performance_highlights END,
    'incidentSummary',CASE WHEN v_rich.id IS NULL THEN '{}'::jsonb ELSE v_rich.incident_summary END,
    'awards',CASE WHEN v_rich.id IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(public.festival_award_public_json(a) ORDER BY a.category) FROM public.festival_awards a WHERE a.festival_result_id=v_rich.id),'[]'::jsonb) END,
    'recordsHeld',CASE WHEN v_rich.id IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(public.festival_record_public_json(w) ORDER BY w.category) FROM public.festival_world_records w WHERE w.festival_result_id=v_rich.id),'[]'::jsonb) END,
    'licenceProgress',public.get_festival_licence_progress(p_festival_company_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_festival_edition_results(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_results(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_company public.festival_companies%ROWTYPE;
  v_simplified public.festival_simplified_edition_results%ROWTYPE;
  v_result public.festival_results%ROWTYPE;
  v_review public.festival_result_reviews%ROWTYPE;
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions_v2 WHERE id=p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_simplified FROM public.festival_simplified_edition_results WHERE festival_edition_id=p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_company FROM public.festival_companies WHERE id=v_edition.festival_company_id;
  SELECT * INTO v_result FROM public.festival_results WHERE festival_edition_id=p_edition_id;

  IF v_result.id IS NOT NULL THEN
    SELECT * INTO v_review FROM public.festival_result_reviews WHERE festival_result_id=v_result.id;
    RETURN jsonb_build_object(
      'festivalName',v_result.festival_name,'editionYear',v_result.edition_year,
      'dates',jsonb_build_object('startsOn',v_edition.starts_on,'endsOn',v_edition.ends_on),
      'location',jsonb_build_object('countryCode',v_edition.country_code,'cityId',v_edition.city_id,'city',v_result.city),
      'lineup',v_result.line_up,'headliners',v_result.headliners,'publishedSchedule',v_result.timetable,
      'attendance',v_result.attendance,'audienceScore',v_result.crowd_satisfaction,
      'overallRating',coalesce(v_review.overall_rating,v_result.crowd_satisfaction),
      'profitabilityBand',CASE WHEN v_result.profit_loss_minor>0 THEN 'profitable' WHEN v_result.profit_loss_minor=0 THEN 'break_even' ELSE 'loss' END,
      'completedAt',v_simplified.completed_at,
      'awards',coalesce((SELECT jsonb_agg(public.festival_award_public_json(a) ORDER BY a.category) FROM public.festival_awards a WHERE a.festival_result_id=v_result.id),'[]'::jsonb),
      'achievements',coalesce((SELECT jsonb_agg(public.festival_award_public_json(a) ORDER BY a.category) FROM public.festival_awards a WHERE a.festival_result_id=v_result.id),'[]'::jsonb),
      'recordsHeld',coalesce((SELECT jsonb_agg(public.festival_record_public_json(w) ORDER BY w.category) FROM public.festival_world_records w WHERE w.festival_result_id=v_result.id),'[]'::jsonb),
      'highlights',v_result.performance_highlights,'performanceCount',v_result.performance_count,
      'largestPerformanceCrowd',v_result.largest_performance_crowd,'incidentSummary',v_result.incident_summary,
      'weatherSummary',v_result.weather_summary,
      'reputationChange',v_simplified.reputation_change+v_simplified.engagement_reputation_bonus,'fameChange',0
    );
  END IF;

  RETURN jsonb_build_object(
    'festivalName',coalesce(v_company.public_name,v_edition.name,'Festival'),'editionYear',v_edition.edition_year,
    'dates',jsonb_build_object('startsOn',v_edition.starts_on,'endsOn',v_edition.ends_on),
    'location',jsonb_build_object('countryCode',v_edition.country_code,'cityId',v_edition.city_id),
    'lineup',v_simplified.lineup,'headliners',v_simplified.headliners,'publishedSchedule',v_simplified.published_schedule,
    'attendance',v_simplified.attendance,'audienceScore',v_simplified.audience_score,'profitabilityBand',v_simplified.profitability_band,
    'completedAt',v_simplified.completed_at,'awards','[]'::jsonb,'achievements','[]'::jsonb,'recordsHeld','[]'::jsonb,
    'highlights',jsonb_build_array(jsonb_build_object('type','attendance','attendance',v_simplified.attendance),jsonb_build_object('type','audience_rating','audienceScore',v_simplified.audience_score)),
    'reputationChange',v_simplified.reputation_change+v_simplified.engagement_reputation_bonus,'fameChange',0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_festival_edition_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_history(uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
