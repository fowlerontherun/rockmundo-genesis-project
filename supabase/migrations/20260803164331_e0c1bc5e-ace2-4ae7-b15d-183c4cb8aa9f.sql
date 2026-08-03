-- Phase 9B: Festival results, reputation-free legacy projection, awards and records.

CREATE TABLE IF NOT EXISTS public.festival_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_edition_id uuid NOT NULL UNIQUE REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  festival_name text NOT NULL,
  edition_year integer NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  festival_type text NOT NULL DEFAULT 'music',
  genres text[] NOT NULL DEFAULT '{}',
  attendance integer NOT NULL DEFAULT 0 CHECK (attendance >= 0),
  peak_attendance integer NOT NULL DEFAULT 0 CHECK (peak_attendance >= 0),
  site_capacity integer NOT NULL DEFAULT 1 CHECK (site_capacity > 0),
  sell_out_percentage numeric NOT NULL DEFAULT 0 CHECK (sell_out_percentage BETWEEN 0 AND 100),
  fastest_sell_out_seconds bigint CHECK (fastest_sell_out_seconds >= 0),
  revenue_minor bigint NOT NULL DEFAULT 0,
  profit_loss_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
  sold_out boolean NOT NULL DEFAULT false,
  crowd_satisfaction numeric NOT NULL DEFAULT 50 CHECK (crowd_satisfaction BETWEEN 0 AND 100),
  weather_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  incident_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_count integer NOT NULL DEFAULT 0 CHECK (performance_count >= 0),
  largest_performance_crowd integer NOT NULL DEFAULT 0 CHECK (largest_performance_crowd >= 0),
  performance_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  headliners jsonb NOT NULL DEFAULT '[]'::jsonb,
  sponsor_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  merchandise_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  food_drink_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  timetable jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_up jsonb NOT NULL DEFAULT '[]'::jsonb,
  poster_url text,
  source_digests jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula_versions jsonb NOT NULL DEFAULT '{"result":"festival-result-v1"}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.festival_results TO anon;
GRANT SELECT ON public.festival_results TO authenticated;
GRANT ALL ON public.festival_results TO service_role;
ALTER TABLE public.festival_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published festival results are public" ON public.festival_results FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_result_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_result_id uuid NOT NULL UNIQUE REFERENCES public.festival_results(id) ON DELETE CASCADE,
  organisation numeric NOT NULL CHECK (organisation BETWEEN 0 AND 100),
  line_up numeric NOT NULL CHECK (line_up BETWEEN 0 AND 100),
  crowd_atmosphere numeric NOT NULL CHECK (crowd_atmosphere BETWEEN 0 AND 100),
  stage_production numeric NOT NULL CHECK (stage_production BETWEEN 0 AND 100),
  value_for_money numeric NOT NULL CHECK (value_for_money BETWEEN 0 AND 100),
  food_drink numeric NOT NULL CHECK (food_drink BETWEEN 0 AND 100),
  facilities numeric NOT NULL CHECK (facilities BETWEEN 0 AND 100),
  overall_rating numeric NOT NULL CHECK (overall_rating BETWEEN 0 AND 100),
  formula_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula_version text NOT NULL DEFAULT 'festival-review-v1',
  published_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.festival_result_reviews TO anon;
GRANT SELECT ON public.festival_result_reviews TO authenticated;
GRANT ALL ON public.festival_result_reviews TO service_role;
ALTER TABLE public.festival_result_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival reviews are public" ON public.festival_result_reviews FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year integer NOT NULL,
  category text NOT NULL CHECK (category IN ('festival_of_the_year','best_small_festival','best_major_festival','best_headliner','best_performance','best_new_artist','best_crowd','best_stage_production','best_sponsor_activation','best_organised_festival')),
  winner_type text NOT NULL CHECK (winner_type IN ('festival','artist','band','performance','sponsor')),
  winner_id uuid,
  winner_name text NOT NULL,
  festival_result_id uuid REFERENCES public.festival_results(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  citation text NOT NULL DEFAULT '',
  formula_version text NOT NULL DEFAULT 'festival-awards-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_year, category)
);

GRANT SELECT ON public.festival_awards TO anon;
GRANT SELECT ON public.festival_awards TO authenticated;
GRANT ALL ON public.festival_awards TO service_role;
ALTER TABLE public.festival_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival awards are public" ON public.festival_awards FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_world_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE CHECK (category IN ('highest_attendance','fastest_sell_out','largest_profit','biggest_loss','highest_rated_festival','longest_running_festival','most_performances','most_merchandise_sold','largest_single_performance_crowd')),
  holder_name text NOT NULL,
  festival_result_id uuid NOT NULL REFERENCES public.festival_results(id) ON DELETE CASCADE,
  value_text text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('attendance','minor_money','seconds','rating','editions','performances','units')),
  currency_code text CHECK (currency_code ~ '^[A-Z]{3}$'),
  unit text NOT NULL,
  achieved_year integer NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.festival_world_records TO anon;
GRANT SELECT ON public.festival_world_records TO authenticated;
GRANT ALL ON public.festival_world_records TO service_role;
ALTER TABLE public.festival_world_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival world records are public" ON public.festival_world_records FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS festival_results_year_idx ON public.festival_results (edition_year DESC);
CREATE INDEX IF NOT EXISTS festival_results_country_city_idx ON public.festival_results (country, city);

-- Shared public projection of a result row.
CREATE OR REPLACE FUNCTION public.festival_result_public_json(p_result public.festival_results, p_overall numeric)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p_result.id,
    'festivalEditionId', p_result.festival_edition_id,
    'festivalCompanyId', p_result.festival_company_id,
    'festivalName', p_result.festival_name,
    'editionYear', p_result.edition_year,
    'country', p_result.country,
    'city', p_result.city,
    'festivalType', p_result.festival_type,
    'genres', to_jsonb(p_result.genres),
    'attendance', p_result.attendance,
    'peakAttendance', p_result.peak_attendance,
    'siteCapacity', p_result.site_capacity,
    'sellOutPercentage', p_result.sell_out_percentage,
    'fastestSellOutSeconds', p_result.fastest_sell_out_seconds,
    'revenueMinor', p_result.revenue_minor::text,
    'profitLossMinor', p_result.profit_loss_minor::text,
    'currencyCode', p_result.currency_code,
    'soldOut', p_result.sold_out,
    'crowdSatisfaction', p_result.crowd_satisfaction,
    'overallRating', COALESCE(p_overall, p_result.crowd_satisfaction),
    'weatherSummary', p_result.weather_summary,
    'incidentSummary', p_result.incident_summary,
    'performanceCount', p_result.performance_count,
    'largestPerformanceCrowd', p_result.largest_performance_crowd,
    'performanceHighlights', p_result.performance_highlights,
    'sponsorSummary', p_result.sponsor_summary,
    'merchandiseSummary', p_result.merchandise_summary,
    'foodDrinkSummary', p_result.food_drink_summary,
    'headliners', p_result.headliners,
    'posterUrl', p_result.poster_url,
    'publishedAt', to_char(p_result.published_at AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;

CREATE OR REPLACE FUNCTION public.festival_award_public_json(p_award public.festival_awards)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', p_award.id, 'seasonYear', p_award.season_year, 'category', p_award.category,
    'winnerType', p_award.winner_type, 'winnerId', p_award.winner_id, 'winnerName', p_award.winner_name,
    'festivalResultId', p_award.festival_result_id, 'score', p_award.score, 'citation', p_award.citation);
$$;

CREATE OR REPLACE FUNCTION public.festival_record_public_json(p_record public.festival_world_records)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('id', p_record.id, 'category', p_record.category, 'holderName', p_record.holder_name,
    'festivalResultId', p_record.festival_result_id, 'valueText', p_record.value_text, 'valueType', p_record.value_type,
    'currencyCode', p_record.currency_code, 'unit', p_record.unit, 'achievedYear', p_record.achieved_year,
    'evidence', p_record.evidence);
$$;

-- Filtered result page (shared by results and history views).
CREATE OR REPLACE FUNCTION public.get_festival_results(
  p_year integer DEFAULT NULL, p_country text DEFAULT NULL, p_city text DEFAULT NULL,
  p_festival_type text DEFAULT NULL, p_genre text DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bounds AS (SELECT LEAST(GREATEST(COALESCE(p_limit,24),1),100) AS lim, GREATEST(COALESCE(p_offset,0),0) AS off),
  rows AS (
    SELECT public.festival_result_public_json(r, v.overall_rating) AS item
    FROM public.festival_results r
    LEFT JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
    CROSS JOIN bounds b
    WHERE (p_year IS NULL OR r.edition_year = p_year)
      AND (p_country IS NULL OR r.country ILIKE '%'||p_country||'%')
      AND (p_city IS NULL OR r.city ILIKE '%'||p_city||'%')
      AND (p_festival_type IS NULL OR r.festival_type ILIKE '%'||p_festival_type||'%')
      AND (p_genre IS NULL OR EXISTS (SELECT 1 FROM unnest(r.genres) g WHERE g ILIKE '%'||p_genre||'%'))
    ORDER BY r.edition_year DESC, r.published_at DESC
    LIMIT (SELECT lim FROM bounds) OFFSET (SELECT off FROM bounds)
  )
  SELECT jsonb_build_object('items', COALESCE((SELECT jsonb_agg(item) FROM rows), '[]'::jsonb),
    'limit', (SELECT lim FROM bounds), 'offset', (SELECT off FROM bounds));
$$;

CREATE OR REPLACE FUNCTION public.get_festival_history(
  p_year integer DEFAULT NULL, p_country text DEFAULT NULL, p_city text DEFAULT NULL,
  p_festival_type text DEFAULT NULL, p_genre text DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_festival_results(p_year, p_country, p_city, p_festival_type, p_genre, p_limit, p_offset);
$$;

CREATE OR REPLACE FUNCTION public.get_festival_result_detail(p_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.festival_results; v_review public.festival_result_reviews; v_json jsonb;
BEGIN
  SELECT * INTO v_row FROM public.festival_results WHERE id = p_result_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_review FROM public.festival_result_reviews WHERE festival_result_id = v_row.id;
  v_json := public.festival_result_public_json(v_row, v_review.overall_rating);
  RETURN v_json || jsonb_build_object(
    'review', COALESCE(jsonb_build_object('organisation', v_review.organisation, 'lineUp', v_review.line_up,
        'crowdAtmosphere', v_review.crowd_atmosphere, 'stageProduction', v_review.stage_production,
        'valueForMoney', v_review.value_for_money, 'foodDrink', v_review.food_drink,
        'facilities', v_review.facilities, 'overallRating', v_review.overall_rating), '{}'::jsonb),
    'lineUp', v_row.line_up,
    'timetable', v_row.timetable,
    'awards', COALESCE((SELECT jsonb_agg(public.festival_award_public_json(a)) FROM public.festival_awards a WHERE a.festival_result_id = v_row.id), '[]'::jsonb),
    'recordsHeld', COALESCE((SELECT jsonb_agg(public.festival_record_public_json(w)) FROM public.festival_world_records w WHERE w.festival_result_id = v_row.id), '[]'::jsonb),
    'publicationStories', '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_awards(p_year integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(public.festival_award_public_json(a) ORDER BY a.season_year DESC, a.category), '[]'::jsonb)
  FROM public.festival_awards a WHERE p_year IS NULL OR a.season_year = p_year;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_records()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(public.festival_record_public_json(w) ORDER BY w.category), '[]'::jsonb)
  FROM public.festival_world_records w;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_hall_of_fame()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH scored AS (
    SELECT r AS result_row, LEAST(100, ROUND((0.5 * COALESCE(v.overall_rating, r.crowd_satisfaction)
        + 0.3 * r.sell_out_percentage + 0.2 * r.crowd_satisfaction)::numeric, 1)) AS legacy_score,
      COALESCE(v.overall_rating, r.crowd_satisfaction) AS overall
    FROM public.festival_results r LEFT JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
  ), ranked AS (
    SELECT s.result_row, s.legacy_score, s.overall,
      ROW_NUMBER() OVER (ORDER BY s.legacy_score DESC, ((s.result_row).attendance) DESC) AS rank
    FROM scored s ORDER BY s.legacy_score DESC LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(
    public.festival_result_public_json(ranked.result_row, ranked.overall)
      || jsonb_build_object('rank', ranked.rank, 'legacyScore', ranked.legacy_score, 'formulaVersion', 'festival-legacy-v1')
    ORDER BY ranked.rank), '[]'::jsonb)
  FROM ranked;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_statistics(
  p_year integer DEFAULT NULL, p_country text DEFAULT NULL, p_city text DEFAULT NULL,
  p_festival_type text DEFAULT NULL, p_genre text DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_group_by text DEFAULT 'festival')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT r.*, COALESCE(v.overall_rating, r.crowd_satisfaction) AS overall,
      CASE COALESCE(p_group_by,'festival') WHEN 'country' THEN r.country WHEN 'city' THEN r.city
        WHEN 'year' THEN r.edition_year::text ELSE r.festival_name END AS group_label
    FROM public.festival_results r LEFT JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
    WHERE (p_year IS NULL OR r.edition_year = p_year)
      AND (p_country IS NULL OR r.country ILIKE '%'||p_country||'%')
      AND (p_city IS NULL OR r.city ILIKE '%'||p_city||'%')
      AND (p_festival_type IS NULL OR r.festival_type ILIKE '%'||p_festival_type||'%')
      AND (p_genre IS NULL OR EXISTS (SELECT 1 FROM unnest(r.genres) g WHERE g ILIKE '%'||p_genre||'%'))
  ), money_by_currency AS (
    SELECT currency_code, SUM(revenue_minor) AS rev, SUM(profit_loss_minor) AS pl FROM filtered GROUP BY currency_code
  ), group_money AS (
    SELECT group_label, currency_code, SUM(revenue_minor) AS rev, SUM(profit_loss_minor) AS pl
    FROM filtered GROUP BY group_label, currency_code
  ), group_totals AS (
    SELECT group_label, COUNT(*)::int AS editions, COALESCE(SUM(attendance),0)::int AS attendance,
      COALESCE(ROUND(AVG(overall)::numeric,1),0) AS avg_rating
    FROM filtered GROUP BY group_label
  ), totals AS (
    SELECT COUNT(*)::int AS editions, COALESCE(SUM(attendance),0)::int AS attendance,
      COALESCE(ROUND(AVG(overall)::numeric,1),0) AS average_rating,
      COUNT(*) FILTER (WHERE sold_out)::int AS sell_outs FROM filtered
  ), money_all AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('currencyCode', currency_code, 'revenueMinor', rev::text,
      'profitLossMinor', pl::text) ORDER BY currency_code), '[]'::jsonb) AS rows FROM money_by_currency
  ), groups AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('label', t.group_label, 'editions', t.editions,
      'attendance', t.attendance, 'averageRating', t.avg_rating,
      'moneyByCurrency', COALESCE((SELECT jsonb_agg(jsonb_build_object('currencyCode', gm.currency_code,
          'revenueMinor', gm.rev::text, 'profitLossMinor', gm.pl::text) ORDER BY gm.currency_code)
        FROM group_money gm WHERE gm.group_label = t.group_label), '[]'::jsonb))
      ORDER BY t.group_label), '[]'::jsonb) AS rows FROM group_totals t
  )
  SELECT jsonb_build_object('editions', t.editions, 'attendance', t.attendance, 'averageRating', t.average_rating,
    'sellOuts', t.sell_outs, 'moneyByCurrency', m.rows, 'groups', gr.rows)
  FROM totals t CROSS JOIN money_all m CROSS JOIN groups gr;
$$;

-- Publish (or return) the immutable result for a completed edition.
CREATE OR REPLACE FUNCTION public.generate_festival_result(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_edition public.festival_editions_v2; v_company public.festival_companies;
  v_city text; v_result_id uuid; v_fin RECORD; v_capacity integer; v_attendance integer;
  v_sell numeric; v_crowd numeric; v_overall numeric; v_currency text := 'USD';
  v_revenue bigint := 0; v_profit bigint := 0; v_perf integer := 0; v_largest integer := 0;
  v_headliners jsonb := '[]'::jsonb; v_timetable jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_edition FROM public.festival_editions_v2 WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  SELECT * INTO v_company FROM public.festival_companies WHERE id = v_edition.festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_COMPANY_NOT_FOUND'; END IF;
  IF NOT (v_company.owner_profile_id = public.current_profile_id()
          OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FESTIVAL_RESULT_FORBIDDEN';
  END IF;

  SELECT id INTO v_result_id FROM public.festival_results WHERE festival_edition_id = p_edition_id;
  IF v_result_id IS NOT NULL THEN RETURN public.get_festival_result_detail(v_result_id); END IF;

  SELECT c.name INTO v_city FROM public.cities c WHERE c.id = v_edition.city_id;

  SELECT f.currency_code, f.total_ticket_revenue_cents + f.sponsorship_revenue_cents + f.vendor_revenue_cents
           + f.merch_revenue_cents + f.other_revenue_cents AS revenue, f.net_profit_cents, f.calculation_snapshot
    INTO v_fin
  FROM public.festival_edition_financial_results f
  WHERE f.edition_id = p_edition_id ORDER BY f.finalised_at DESC NULLS LAST LIMIT 1;

  IF v_fin IS NOT NULL THEN
    v_currency := COALESCE(v_fin.currency_code, 'USD');
    v_revenue := COALESCE(v_fin.revenue, 0);
    v_profit := COALESCE(v_fin.net_profit_cents, 0);
    v_attendance := NULLIF((v_fin.calculation_snapshot->>'attendance'), '')::integer;
    v_capacity := NULLIF((v_fin.calculation_snapshot->>'capacity'), '')::integer;
  END IF;

  SELECT COALESCE(SUM(GREATEST(sp.capacity, 0)), 0)::int INTO v_capacity
  FROM public.festival_site_plan_stages sp
  JOIN public.festival_site_plans p ON p.id = sp.site_plan_id
  WHERE p.edition_id = p_edition_id AND v_capacity IS NULL;

  v_capacity := GREATEST(COALESCE(NULLIF(v_capacity, 0), 5000), 1);
  v_attendance := GREATEST(COALESCE(v_attendance, ROUND(v_capacity * 0.75)::int), 0);
  v_sell := LEAST(100, ROUND((v_attendance::numeric / v_capacity) * 100, 1));
  v_crowd := LEAST(100, GREATEST(0, ROUND(45 + (v_sell * 0.35) + (CASE WHEN v_profit > 0 THEN 8 ELSE -4 END), 1)));
  v_overall := LEAST(100, GREATEST(0, ROUND((v_crowd * 0.6) + (v_sell * 0.4), 1)));

  INSERT INTO public.festival_results (
    festival_edition_id, festival_company_id, festival_name, edition_year, country, city, festival_type,
    genres, attendance, peak_attendance, site_capacity, sell_out_percentage, revenue_minor, profit_loss_minor,
    currency_code, sold_out, crowd_satisfaction, weather_summary, incident_summary, performance_count,
    largest_performance_crowd, performance_highlights, headliners, sponsor_summary, merchandise_summary,
    food_drink_summary, timetable, line_up)
  VALUES (
    p_edition_id, v_company.id, COALESCE(v_edition.name, v_company.public_name), v_edition.edition_year,
    COALESCE(v_edition.country_code, v_company.country_code, 'GB'), COALESCE(v_city, 'Unknown'),
    COALESCE(v_edition.vibe, v_company.default_vibe, 'music'), ARRAY[]::text[],
    v_attendance, v_attendance, v_capacity, v_sell, v_revenue, v_profit, v_currency,
    v_sell >= 99.5, v_crowd, '{}'::jsonb, '{}'::jsonb, v_perf, v_largest,
    '[]'::jsonb, v_headliners, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, v_timetable, '[]'::jsonb)
  RETURNING id INTO v_result_id;

  INSERT INTO public.festival_result_reviews (festival_result_id, organisation, line_up, crowd_atmosphere,
    stage_production, value_for_money, food_drink, facilities, overall_rating, formula_evidence)
  VALUES (v_result_id, v_overall, v_overall, v_crowd, v_overall, LEAST(100, v_overall + 2), v_overall, v_overall,
    v_overall, jsonb_build_object('sellOutPercentage', v_sell, 'crowdSatisfaction', v_crowd));

  RETURN public.get_festival_result_detail(v_result_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_festival_world_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FESTIVAL_RECORDS_FORBIDDEN'; END IF;
  DELETE FROM public.festival_world_records;
  INSERT INTO public.festival_world_records (category, holder_name, festival_result_id, value_text, value_type, currency_code, unit, achieved_year)
  SELECT 'highest_attendance', r.festival_name, r.id, r.attendance::text, 'attendance', NULL, 'people', r.edition_year
  FROM public.festival_results r ORDER BY r.attendance DESC LIMIT 1;
  INSERT INTO public.festival_world_records (category, holder_name, festival_result_id, value_text, value_type, currency_code, unit, achieved_year)
  SELECT 'largest_profit', r.festival_name, r.id, r.profit_loss_minor::text, 'minor_money', r.currency_code, 'minor units', r.edition_year
  FROM public.festival_results r ORDER BY r.profit_loss_minor DESC LIMIT 1;
  INSERT INTO public.festival_world_records (category, holder_name, festival_result_id, value_text, value_type, currency_code, unit, achieved_year)
  SELECT 'biggest_loss', r.festival_name, r.id, r.profit_loss_minor::text, 'minor_money', r.currency_code, 'minor units', r.edition_year
  FROM public.festival_results r ORDER BY r.profit_loss_minor ASC LIMIT 1;
  INSERT INTO public.festival_world_records (category, holder_name, festival_result_id, value_text, value_type, currency_code, unit, achieved_year)
  SELECT 'highest_rated_festival', r.festival_name, r.id, COALESCE(v.overall_rating, r.crowd_satisfaction)::text, 'rating', NULL, 'points', r.edition_year
  FROM public.festival_results r LEFT JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
  ORDER BY COALESCE(v.overall_rating, r.crowd_satisfaction) DESC LIMIT 1;
  INSERT INTO public.festival_world_records (category, holder_name, festival_result_id, value_text, value_type, currency_code, unit, achieved_year)
  SELECT 'most_performances', r.festival_name, r.id, r.performance_count::text, 'performances', NULL, 'performances', r.edition_year
  FROM public.festival_results r ORDER BY r.performance_count DESC LIMIT 1;
  SELECT COUNT(*) INTO v_count FROM public.festival_world_records;
  RETURN jsonb_build_object('records', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_festival_season_awards(p_year integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'FESTIVAL_AWARDS_FORBIDDEN'; END IF;
  DELETE FROM public.festival_awards WHERE season_year = p_year;
  INSERT INTO public.festival_awards (season_year, category, winner_type, winner_id, winner_name, festival_result_id, score, citation)
  SELECT p_year, 'festival_of_the_year', 'festival', r.festival_company_id, r.festival_name, r.id,
    COALESCE(v.overall_rating, r.crowd_satisfaction),
    'Highest rated Festival of the ' || p_year || ' season.'
  FROM public.festival_results r LEFT JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
  WHERE r.edition_year = p_year ORDER BY COALESCE(v.overall_rating, r.crowd_satisfaction) DESC LIMIT 1;
  INSERT INTO public.festival_awards (season_year, category, winner_type, winner_id, winner_name, festival_result_id, score, citation)
  SELECT p_year, 'best_crowd', 'festival', r.festival_company_id, r.festival_name, r.id, r.crowd_satisfaction,
    'Best crowd atmosphere of the ' || p_year || ' season.'
  FROM public.festival_results r WHERE r.edition_year = p_year ORDER BY r.crowd_satisfaction DESC LIMIT 1;
  INSERT INTO public.festival_awards (season_year, category, winner_type, winner_id, winner_name, festival_result_id, score, citation)
  SELECT p_year, 'best_organised_festival', 'festival', r.festival_company_id, r.festival_name, r.id, v.organisation,
    'Most smoothly organised Festival of the ' || p_year || ' season.'
  FROM public.festival_results r JOIN public.festival_result_reviews v ON v.festival_result_id = r.id
  WHERE r.edition_year = p_year ORDER BY v.organisation DESC LIMIT 1;
  SELECT COUNT(*) INTO v_count FROM public.festival_awards WHERE season_year = p_year;
  RETURN jsonb_build_object('seasonYear', p_year, 'awards', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_festival_result(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_festival_world_records() FROM anon;
REVOKE ALL ON FUNCTION public.generate_festival_season_awards(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_festival_results(integer,text,text,text,text,integer,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_history(integer,text,text,text,text,integer,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_result_detail(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_awards(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_records() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_hall_of_fame() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_statistics(integer,text,text,text,text,integer,integer,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_festival_world_records() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_season_awards(integer) TO authenticated;