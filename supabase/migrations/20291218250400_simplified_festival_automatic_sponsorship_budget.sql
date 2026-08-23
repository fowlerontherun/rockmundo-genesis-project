-- Simplified Festival commercial economy.
-- Sponsorship is game-generated from company/event strength rather than managed as a separate owner workflow.
-- The owner-facing budget forecast and final settlement use the same sponsorship authority.

CREATE OR REPLACE FUNCTION public._festival_automatic_sponsorship_minor(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_expected_capacity integer := 0;
  v_operating_cost_minor bigint := 0;
  v_marketing_basis_points integer := 10000;
  v_reputation integer := 0;
  v_marketing_upgrade_basis_points integer := 0;
  v_base_minor bigint := 0;
  v_cap_minor bigint := 0;
  v_projected_minor bigint := 0;
BEGIN
  SELECT
    greatest(coalesce(e.expected_capacity, 0), 0),
    greatest(coalesce(e.estimated_operating_cost_minor, 0), 0),
    coalesce((e.planning_effects->>'marketingDemandBasisPoints')::integer, 10000),
    coalesce(c.reputation_score, 0)
  INTO
    v_expected_capacity,
    v_operating_cost_minor,
    v_marketing_basis_points,
    v_reputation
  FROM public.festival_editions_v2 e
  JOIN public.festival_companies fc ON fc.id = e.festival_company_id
  JOIN public.companies c ON c.id = fc.company_id
  WHERE e.id = p_festival_edition_id
    AND e.festival_company_id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce((ul.effects->>'revenueBasisPoints')::integer, 0)
  INTO v_marketing_upgrade_basis_points
  FROM public.festival_company_upgrades u
  JOIN public.festival_upgrade_levels ul
    ON ul.catalogue_version = u.catalogue_version
   AND ul.category_key = u.category_key
   AND ul.level = u.active_level
   AND ul.active
  WHERE u.festival_company_id = p_festival_company_id
    AND u.category_key = 'marketing_media'
  LIMIT 1;

  v_marketing_upgrade_basis_points := coalesce(v_marketing_upgrade_basis_points, 0);

  -- £2.50 of baseline sponsor value per planned attendee, with a £500 floor.
  v_base_minor := greatest(50000::bigint, v_expected_capacity::bigint * 250);

  -- Sponsorship helps an event materially without underwriting the whole Festival.
  v_cap_minor := greatest(
    50000::bigint,
    round(v_operating_cost_minor::numeric * 0.35)::bigint
  );

  v_projected_minor := round(
    v_base_minor::numeric
      * greatest(5000, least(15000, v_marketing_basis_points)) / 10000
      * (
          10000
          + least(greatest(v_reputation, 0), 100) * 50
          + least(greatest(v_marketing_upgrade_basis_points, 0), 2500)
        ) / 10000
  )::bigint;

  RETURN greatest(0::bigint, least(v_projected_minor, v_cap_minor));
END;
$$;

COMMENT ON FUNCTION public._festival_automatic_sponsorship_minor(uuid, uuid)
IS 'Internal server-authoritative automatic sponsorship value for a simplified Festival edition.';

REVOKE ALL ON FUNCTION public._festival_automatic_sponsorship_minor(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_automatic_sponsorship_minor(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_festival_edition_budget_forecast(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor uuid := public._caller_profile_id();
  v_edition public.festival_editions_v2%ROWTYPE;
  v_ticket public.festival_ticket_plans%ROWTYPE;
  v_expected_tickets integer := 0;
  v_expected_attendance integer := 0;
  v_ticket_revenue_minor bigint := 0;
  v_sponsorship_revenue_minor bigint := 0;
  v_food_minor bigint := 0;
  v_merch_minor bigint := 0;
  v_total_revenue_minor bigint := 0;
  v_operating_cost_minor bigint := 0;
  v_net_profit_minor bigint := 0;
  v_currency text := 'GBP';
BEGIN
  IF auth.uid() IS NULL
     OR v_actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, v_actor)
  THEN
    RAISE EXCEPTION 'festival_budget_forecast_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ticket
  FROM public.festival_ticket_plans
  WHERE festival_edition_id = v_edition.id
  LIMIT 1;

  IF FOUND THEN
    v_currency := coalesce(v_ticket.currency_code, 'GBP');
    v_expected_tickets := greatest(
      0,
      coalesce(nullif(v_ticket.forecast->>'expectedTicketsSold', '')::integer, 0)
    );
    v_ticket_revenue_minor := greatest(
      0,
      coalesce(nullif(v_ticket.forecast->>'expectedNetTicketReceiptsMinor', '')::bigint, 0)
    );
  END IF;

  -- Match the simplified runtime's attendance and ancillary-spend assumptions.
  v_expected_attendance := greatest(0, round(v_expected_tickets::numeric * 0.96)::integer);
  v_food_minor := v_expected_attendance::bigint * 1200;
  v_merch_minor := v_expected_attendance::bigint * 500;
  v_sponsorship_revenue_minor := public._festival_automatic_sponsorship_minor(
    p_festival_company_id,
    p_festival_edition_id
  );
  v_operating_cost_minor := greatest(0, coalesce(v_edition.estimated_operating_cost_minor, 0));
  v_total_revenue_minor := v_ticket_revenue_minor
    + v_sponsorship_revenue_minor
    + v_food_minor
    + v_merch_minor;
  v_net_profit_minor := v_total_revenue_minor - v_operating_cost_minor;

  RETURN jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'festivalEditionId', p_festival_edition_id,
    'currencyCode', v_currency,
    'expectedTicketsSold', v_expected_tickets,
    'expectedAttendance', v_expected_attendance,
    'ticketRevenueMinor', v_ticket_revenue_minor,
    'sponsorshipRevenueMinor', v_sponsorship_revenue_minor,
    'foodAndDrinkRevenueMinor', v_food_minor,
    'merchandiseRevenueMinor', v_merch_minor,
    'totalRevenueMinor', v_total_revenue_minor,
    'operatingCostMinor', v_operating_cost_minor,
    'projectedNetProfitMinor', v_net_profit_minor,
    'projectionSource', 'simplified_budget_v1',
    'sponsorshipMode', 'automatic'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_edition_budget_forecast(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_budget_forecast(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._complete_simplified_festival_settlement(p_runtime_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  r public.festival_edition_runtimes%ROWTYPE;
  e public.festival_editions_v2%ROWTYPE;
  t public.festival_ticket_plans%ROWTYPE;
  d public.festival_runtime_completion_digests%ROWTYPE;
  existing_id uuid;
  result_id uuid;
  currency text := 'GBP';
  forecast_expected bigint := 0;
  forecast_ticket_net bigint := 0;
  forecast_tax bigint := 0;
  actual_ticket_net bigint := 0;
  actual_tax bigint := 0;
  sponsorship bigint := 0;
  food bigint := 0;
  merch bigint := 0;
  operating_cost bigint := 0;
  total_revenue bigint := 0;
  net_profit bigint := 0;
  audience_score integer := 0;
  reputation_change integer := 0;
  heads jsonb := '[]'::jsonb;
  lineup_snapshot jsonb := '[]'::jsonb;
  snapshot jsonb;
BEGIN
  SELECT * INTO r FROM public.festival_edition_runtimes WHERE id=p_runtime_id;
  IF NOT FOUND OR r.state <> 'completed' THEN
    RAISE EXCEPTION 'festival_runtime_not_complete' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO d FROM public.festival_runtime_completion_digests WHERE runtime_id=r.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_runtime_digest_missing' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO e FROM public.festival_editions_v2 WHERE id=r.edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001';
  END IF;
  SELECT id INTO existing_id
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id=e.id;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  SELECT * INTO t FROM public.festival_ticket_plans WHERE festival_edition_id=e.id;

  currency:=coalesce(t.currency_code,'GBP');
  forecast_expected:=greatest(0,coalesce(nullif(t.forecast->>'expectedTicketsSold','')::bigint,r.expected_attendance,0));
  forecast_ticket_net:=greatest(0,coalesce(nullif(t.forecast->>'expectedNetTicketReceiptsMinor','')::bigint,0));
  forecast_tax:=greatest(0,coalesce(nullif(t.forecast->>'estimatedTaxMinor','')::bigint,0));
  IF forecast_expected > 0 THEN
    actual_ticket_net:=round(forecast_ticket_net::numeric*r.admitted_attendance/forecast_expected)::bigint;
    actual_tax:=round(forecast_tax::numeric*r.admitted_attendance/forecast_expected)::bigint;
  END IF;
  sponsorship:=public._festival_automatic_sponsorship_minor(e.festival_company_id,e.id);
  food:=greatest(0,coalesce(nullif(r.sales_snapshot->>'foodAndDrinkMinor','')::bigint,0));
  merch:=greatest(0,coalesce(nullif(r.sales_snapshot->>'merchandiseMinor','')::bigint,0));
  operating_cost:=greatest(0,e.estimated_operating_cost_minor);
  total_revenue:=actual_ticket_net+sponsorship+food+merch;
  net_profit:=total_revenue-operating_cost;
  audience_score:=least(100,greatest(0,coalesce(nullif(r.satisfaction_snapshot->>'audience','')::integer,0)));
  reputation_change:=least(10,greatest(-10,round((audience_score-50)::numeric/5)::integer + CASE WHEN net_profit>0 THEN 2 WHEN net_profit<0 THEN -2 ELSE 0 END));

  SELECT coalesce(jsonb_agg(name ORDER BY rank DESC,name),'[]'::jsonb)
  INTO heads
  FROM (
    SELECT coalesce(p.display_name,p.username,b.name,'Confirmed act') name,
      CASE bk.billing_position WHEN 'headliner' THEN 60 WHEN 'sub_headliner' THEN 50 ELSE 10 END rank
    FROM public.festival_artist_programmes ap
    JOIN public.festival_artist_bookings bk ON bk.festival_artist_programme_id=ap.id
    LEFT JOIN public.profiles p ON p.id=bk.artist_profile_id
    LEFT JOIN public.bands b ON b.id=bk.band_id
    WHERE ap.festival_edition_id=e.id
      AND bk.status IN ('confirmed','awaiting_schedule','scheduled')
      AND bk.billing_position IN ('headliner','sub_headliner')
  ) x;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'artistType',bk.artist_type,'artistProfileId',bk.artist_profile_id,'bandId',bk.band_id,
      'billingPosition',bk.billing_position,'status',bk.status,'setMinutes',bk.set_minutes
    ) ORDER BY CASE bk.billing_position WHEN 'headliner' THEN 60 WHEN 'sub_headliner' THEN 50 WHEN 'featured' THEN 40 WHEN 'support' THEN 20 ELSE 10 END DESC,bk.confirmed_at),'[]'::jsonb)
  INTO lineup_snapshot
  FROM public.festival_artist_programmes ap
  JOIN public.festival_artist_bookings bk ON bk.festival_artist_programme_id=ap.id
  WHERE ap.festival_edition_id=e.id
    AND bk.status IN ('confirmed','awaiting_schedule','scheduled');

  snapshot:=jsonb_build_object(
    'source','simplified_runtime_v2','runtimeId',r.id,'runtimeDigest',d.runtime_digest,
    'evidenceDigest',d.evidence_digest,'attendance',r.admitted_attendance,'audienceScore',audience_score,
    'ticketRevenueMinor',actual_ticket_net,'sponsorshipRevenueMinor',sponsorship,
    'foodAndDrinkRevenueMinor',food,'merchRevenueMinor',merch,
    'operatingCostMinor',operating_cost,'taxMinor',actual_tax,'totalRevenueMinor',total_revenue,
    'netProfitMinor',net_profit,'reputationChange',reputation_change,'currencyCode',currency
  );

  INSERT INTO public.festival_simplified_edition_results(
    festival_company_id,festival_edition_id,runtime_id,completion_digest_id,rules_version,currency_code,
    attendance,audience_score,ticket_revenue_minor,food_and_drink_revenue_minor,merchandise_revenue_minor,
    operating_cost_minor,tax_minor,total_revenue_minor,net_profit_minor,profitability_band,reputation_change,
    headliners,lineup,published_schedule,result_snapshot,completed_at
  ) VALUES(
    e.festival_company_id,e.id,r.id,d.id,'simplified-festival-results-v2',currency,r.admitted_attendance,audience_score,
    actual_ticket_net,food,merch,operating_cost,actual_tax,total_revenue,net_profit,
    CASE WHEN net_profit>0 THEN 'profitable' WHEN net_profit=0 THEN 'break_even' ELSE 'loss' END,
    reputation_change,heads,lineup_snapshot,coalesce(r.generated_schedule->'items','[]'::jsonb),snapshot,coalesce(r.completed_at,now())
  ) RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public._complete_simplified_festival_settlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._complete_simplified_festival_settlement(uuid) TO service_role;

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
  IF NOT FOUND THEN RETURN NULL; END IF;

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
      'sponsorshipRevenueMinor', coalesce(nullif(v_result.result_snapshot->>'sponsorshipRevenueMinor','')::bigint,0),
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

REVOKE ALL ON FUNCTION public.get_festival_edition_results(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_results(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
