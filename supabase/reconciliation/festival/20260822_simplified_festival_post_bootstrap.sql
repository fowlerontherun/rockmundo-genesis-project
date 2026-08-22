-- Final clean-build parity overlay for the 2026-08-22 production Festival repair.
--
-- WHY THIS IS NOT A NORMAL MIGRATION
-- The repository contains a frozen inherited Festival sequence dated in 2029.
-- Production did not receive that sequence and was reconciled forward in real 2026
-- timestamps. The matching migration files are therefore history markers only.
-- This overlay runs AFTER a clean db reset has completed the inherited 2029 chain.

-- The v1 Run body created by 20291218245900 uses pgcrypto digest(). After
-- 20291218245920 it is renamed and called through a normalising wrapper. Give the
-- inner function an explicit search path that includes extensions.
DO $$
BEGIN
  IF to_regprocedure('public._run_simplified_festival_edition_v1(uuid,uuid,integer,uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public._run_simplified_festival_edition_v1(uuid,uuid,integer,uuid) SET search_path TO pg_catalog, public, extensions';
  ELSIF to_regprocedure('public.run_simplified_festival_edition(uuid,uuid,integer,uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.run_simplified_festival_edition(uuid,uuid,integer,uuid) SET search_path TO pg_catalog, public, extensions';
  ELSE
    RAISE EXCEPTION 'Simplified Festival Run function is missing; the inherited Festival bootstrap did not complete';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.festival_simplified_edition_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE RESTRICT,
  festival_edition_id uuid NOT NULL UNIQUE REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  runtime_id uuid NOT NULL UNIQUE REFERENCES public.festival_edition_runtimes(id) ON DELETE RESTRICT,
  completion_digest_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_completion_digests(id) ON DELETE RESTRICT,
  rules_version text NOT NULL DEFAULT 'simplified-festival-results-v1',
  currency_code text NOT NULL,
  attendance integer NOT NULL CHECK (attendance >= 0),
  audience_score integer NOT NULL CHECK (audience_score BETWEEN 0 AND 100),
  ticket_revenue_minor bigint NOT NULL DEFAULT 0 CHECK (ticket_revenue_minor >= 0),
  food_and_drink_revenue_minor bigint NOT NULL DEFAULT 0 CHECK (food_and_drink_revenue_minor >= 0),
  merchandise_revenue_minor bigint NOT NULL DEFAULT 0 CHECK (merchandise_revenue_minor >= 0),
  operating_cost_minor bigint NOT NULL DEFAULT 0 CHECK (operating_cost_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_revenue_minor bigint NOT NULL DEFAULT 0 CHECK (total_revenue_minor >= 0),
  net_profit_minor bigint NOT NULL DEFAULT 0,
  profitability_band text NOT NULL CHECK (profitability_band IN ('profitable','break_even','loss')),
  reputation_change integer NOT NULL DEFAULT 0 CHECK (reputation_change BETWEEN -10 AND 10),
  headliners jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(headliners) = 'array'),
  lineup jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lineup) = 'array'),
  published_schedule jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(published_schedule) = 'array'),
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_snapshot) = 'object'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_simplified_edition_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_simplified_edition_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.festival_simplified_edition_results TO service_role;

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
  SELECT * INTO r FROM public.festival_edition_runtimes WHERE id = p_runtime_id;
  IF NOT FOUND OR r.state <> 'completed' THEN
    RAISE EXCEPTION 'festival_runtime_not_complete' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO d FROM public.festival_runtime_completion_digests WHERE runtime_id = r.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_runtime_digest_missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO e FROM public.festival_editions_v2 WHERE id = r.edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO existing_id
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id = e.id;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  SELECT * INTO t FROM public.festival_ticket_plans WHERE festival_edition_id = e.id;

  currency := coalesce(t.currency_code, 'GBP');
  forecast_expected := greatest(0, coalesce(nullif(t.forecast->>'expectedTicketsSold','')::bigint, r.expected_attendance, 0));
  forecast_ticket_net := greatest(0, coalesce(nullif(t.forecast->>'expectedNetTicketReceiptsMinor','')::bigint, 0));
  forecast_tax := greatest(0, coalesce(nullif(t.forecast->>'estimatedTaxMinor','')::bigint, 0));

  IF forecast_expected > 0 THEN
    actual_ticket_net := round(forecast_ticket_net::numeric * r.admitted_attendance / forecast_expected)::bigint;
    actual_tax := round(forecast_tax::numeric * r.admitted_attendance / forecast_expected)::bigint;
  END IF;

  food := greatest(0, coalesce(nullif(r.sales_snapshot->>'foodAndDrinkMinor','')::bigint, 0));
  merch := greatest(0, coalesce(nullif(r.sales_snapshot->>'merchandiseMinor','')::bigint, 0));
  operating_cost := greatest(0, e.estimated_operating_cost_minor);
  total_revenue := actual_ticket_net + food + merch;
  net_profit := total_revenue - operating_cost;
  audience_score := least(100, greatest(0, coalesce(nullif(r.satisfaction_snapshot->>'audience','')::integer, 0)));
  reputation_change := least(10, greatest(-10,
    round((audience_score - 50)::numeric / 5)::integer
    + CASE WHEN net_profit > 0 THEN 2 WHEN net_profit < 0 THEN -2 ELSE 0 END
  ));

  SELECT coalesce(jsonb_agg(name ORDER BY rank DESC, name), '[]'::jsonb)
  INTO heads
  FROM (
    SELECT
      coalesce(p.display_name, p.username, b.name, 'Confirmed act') AS name,
      CASE bk.billing_position WHEN 'headliner' THEN 60 WHEN 'sub_headliner' THEN 50 ELSE 10 END AS rank
    FROM public.festival_artist_programmes ap
    JOIN public.festival_artist_bookings bk ON bk.festival_artist_programme_id = ap.id
    LEFT JOIN public.profiles p ON p.id = bk.artist_profile_id
    LEFT JOIN public.bands b ON b.id = bk.band_id
    WHERE ap.festival_edition_id = e.id
      AND bk.status IN ('confirmed','awaiting_schedule','scheduled')
      AND bk.billing_position IN ('headliner','sub_headliner')
  ) x;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'artistType', bk.artist_type,
      'artistProfileId', bk.artist_profile_id,
      'bandId', bk.band_id,
      'billingPosition', bk.billing_position,
      'status', bk.status,
      'setMinutes', bk.set_minutes
    )
    ORDER BY CASE bk.billing_position
      WHEN 'headliner' THEN 60 WHEN 'sub_headliner' THEN 50
      WHEN 'featured' THEN 40 WHEN 'support' THEN 20 ELSE 10 END DESC,
      bk.confirmed_at
  ), '[]'::jsonb)
  INTO lineup_snapshot
  FROM public.festival_artist_programmes ap
  JOIN public.festival_artist_bookings bk ON bk.festival_artist_programme_id = ap.id
  WHERE ap.festival_edition_id = e.id
    AND bk.status IN ('confirmed','awaiting_schedule','scheduled');

  snapshot := jsonb_build_object(
    'source', 'simplified_runtime_v1',
    'runtimeId', r.id,
    'runtimeDigest', d.runtime_digest,
    'evidenceDigest', d.evidence_digest,
    'attendance', r.admitted_attendance,
    'audienceScore', audience_score,
    'ticketRevenueMinor', actual_ticket_net,
    'foodAndDrinkRevenueMinor', food,
    'merchRevenueMinor', merch,
    'operatingCostMinor', operating_cost,
    'taxMinor', actual_tax,
    'totalRevenueMinor', total_revenue,
    'netProfitMinor', net_profit,
    'reputationChange', reputation_change,
    'currencyCode', currency
  );

  INSERT INTO public.festival_simplified_edition_results(
    festival_company_id, festival_edition_id, runtime_id, completion_digest_id,
    rules_version, currency_code, attendance, audience_score,
    ticket_revenue_minor, food_and_drink_revenue_minor, merchandise_revenue_minor,
    operating_cost_minor, tax_minor, total_revenue_minor, net_profit_minor,
    profitability_band, reputation_change, headliners, lineup,
    published_schedule, result_snapshot, completed_at
  ) VALUES (
    e.festival_company_id, e.id, r.id, d.id,
    'simplified-festival-results-v1', currency, r.admitted_attendance, audience_score,
    actual_ticket_net, food, merch, operating_cost, actual_tax, total_revenue, net_profit,
    CASE WHEN net_profit > 0 THEN 'profitable' WHEN net_profit = 0 THEN 'break_even' ELSE 'loss' END,
    reputation_change, heads, lineup_snapshot,
    coalesce(r.generated_schedule->'items', '[]'::jsonb), snapshot,
    coalesce(r.completed_at, now())
  )
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public._complete_simplified_festival_settlement(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._complete_simplified_festival_settlement(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_auto_settle_simplified_runtime()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  PERFORM public._complete_simplified_festival_settlement(NEW.runtime_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._festival_auto_settle_simplified_runtime()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS festival_auto_settle_simplified_runtime
  ON public.festival_runtime_completion_digests;
CREATE CONSTRAINT TRIGGER festival_auto_settle_simplified_runtime
AFTER INSERT ON public.festival_runtime_completion_digests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public._festival_auto_settle_simplified_runtime();

CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  e public.festival_editions_v2%ROWTYPE;
  fc public.festival_companies%ROWTYPE;
  res public.festival_simplified_edition_results%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.festival_editions_v2 WHERE id = p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO res
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id = e.id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO fc FROM public.festival_companies WHERE id = e.festival_company_id;

  RETURN jsonb_build_object(
    'festivalName', coalesce(fc.public_name, e.name, 'Festival'),
    'editionYear', e.edition_year,
    'dates', jsonb_build_object('startsOn', e.starts_on, 'endsOn', e.ends_on),
    'location', jsonb_build_object('countryCode', e.country_code, 'cityId', e.city_id),
    'lineup', res.lineup,
    'headliners', res.headliners,
    'publishedSchedule', res.published_schedule,
    'attendance', res.attendance,
    'audienceScore', res.audience_score,
    'profitabilityBand', res.profitability_band,
    'completedAt', res.completed_at,
    'achievements', '[]'::jsonb,
    'highlights', jsonb_build_array(
      jsonb_build_object(
        'type', 'financial_result',
        'totalRevenueMinor', res.total_revenue_minor,
        'netProfitMinor', res.net_profit_minor,
        'currencyCode', res.currency_code
      ),
      jsonb_build_object('type', 'attendance', 'attendance', res.attendance)
    ),
    'reputationChange', res.reputation_change,
    'fameChange', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_festival_edition_history(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_history(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
