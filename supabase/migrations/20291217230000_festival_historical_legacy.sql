-- Phase 9B: immutable Festival results and historical legacy.
-- This layer projects the immutable Phase 8B/9A snapshots; it never re-runs runtime
-- or finance calculations.

CREATE TABLE public.festival_legacy_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_settlement_id uuid NOT NULL REFERENCES public.festival_financial_settlements(id),
  job_type text NOT NULL DEFAULT 'generate_result' CHECK (job_type = 'generate_result'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  result_id uuid,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_settlement_id, job_type)
);

CREATE TABLE public.festival_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_settlement_id uuid NOT NULL UNIQUE REFERENCES public.festival_financial_settlements(id),
  runtime_outcome_snapshot_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_outcome_snapshots(id),
  settlement_snapshot_id uuid NOT NULL UNIQUE REFERENCES public.festival_settlement_snapshots(id),
  festival_launch_id uuid NOT NULL UNIQUE REFERENCES public.festival_launches(id),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_public_editions(id),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_name text NOT NULL,
  edition_year integer NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  festival_type text NOT NULL,
  genres text[] NOT NULL,
  attendance integer NOT NULL CHECK (attendance >= 0),
  peak_attendance integer NOT NULL CHECK (peak_attendance >= 0),
  site_capacity integer NOT NULL CHECK (site_capacity > 0),
  sell_out_percentage numeric NOT NULL CHECK (sell_out_percentage BETWEEN 0 AND 100),
  fastest_sell_out_seconds bigint CHECK (fastest_sell_out_seconds >= 0),
  revenue_minor bigint NOT NULL,
  profit_loss_minor bigint NOT NULL,
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  sold_out boolean NOT NULL,
  crowd_satisfaction numeric NOT NULL CHECK (crowd_satisfaction BETWEEN 0 AND 100),
  weather_summary jsonb NOT NULL,
  incident_summary jsonb NOT NULL,
  performance_count integer NOT NULL CHECK (performance_count >= 0),
  largest_performance_crowd integer NOT NULL CHECK (largest_performance_crowd >= 0),
  performance_highlights jsonb NOT NULL,
  headliners jsonb NOT NULL,
  sponsor_summary jsonb NOT NULL,
  merchandise_summary jsonb NOT NULL,
  food_drink_summary jsonb NOT NULL,
  timetable jsonb NOT NULL,
  poster_url text,
  source_digests jsonb NOT NULL,
  formula_versions jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_legacy_generation_jobs
  ADD CONSTRAINT festival_result_generation_job_result_fk
  FOREIGN KEY (result_id) REFERENCES public.festival_results(id);

CREATE TABLE public.festival_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_result_id uuid NOT NULL UNIQUE REFERENCES public.festival_results(id),
  organisation numeric NOT NULL CHECK (organisation BETWEEN 0 AND 100),
  line_up numeric NOT NULL CHECK (line_up BETWEEN 0 AND 100),
  crowd_atmosphere numeric NOT NULL CHECK (crowd_atmosphere BETWEEN 0 AND 100),
  stage_production numeric NOT NULL CHECK (stage_production BETWEEN 0 AND 100),
  value_for_money numeric NOT NULL CHECK (value_for_money BETWEEN 0 AND 100),
  food_drink numeric NOT NULL CHECK (food_drink BETWEEN 0 AND 100),
  facilities numeric NOT NULL CHECK (facilities BETWEEN 0 AND 100),
  overall_rating numeric NOT NULL CHECK (overall_rating BETWEEN 0 AND 100),
  formula_evidence jsonb NOT NULL,
  formula_version text NOT NULL DEFAULT 'festival-review-v2',
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festival_reputation_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_result_id uuid NOT NULL REFERENCES public.festival_results(id),
  subject_type text NOT NULL CHECK (subject_type IN ('festival_company','festival_brand','artist','band','sponsor','staff','supplier','venue','host_city')),
  subject_key text NOT NULL,
  subject_id uuid,
  change numeric NOT NULL,
  resulting_reputation numeric,
  projection_status text NOT NULL DEFAULT 'pending' CHECK (projection_status IN ('pending','applied','failed','unsupported')),
  canonical_receipt_id uuid,
  factors jsonb NOT NULL,
  formula_version text NOT NULL DEFAULT 'festival-reputation-v2',
  applied_at timestamptz,
  UNIQUE (festival_result_id, subject_type, subject_key)
);

CREATE TABLE public.festival_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year integer NOT NULL,
  category text NOT NULL CHECK (category IN ('festival_of_the_year','best_small_festival','best_major_festival','best_headliner','best_performance','best_new_artist','best_crowd','best_stage_production','best_sponsor_activation','best_organised_festival')),
  festival_result_id uuid NOT NULL REFERENCES public.festival_results(id),
  winner_type text NOT NULL CHECK (winner_type IN ('festival','artist','band','performance','sponsor')),
  winner_id uuid NOT NULL,
  winner_name text NOT NULL,
  score numeric NOT NULL,
  citation text NOT NULL,
  evidence jsonb NOT NULL,
  formula_version text NOT NULL DEFAULT 'festival-awards-v2',
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_year, category)
);

CREATE TABLE public.festival_world_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE CHECK (category IN ('highest_attendance','fastest_sell_out','largest_profit','biggest_loss','highest_rated_festival','longest_running_festival','most_performances','most_merchandise_sold','largest_single_performance_crowd')),
  festival_result_id uuid NOT NULL REFERENCES public.festival_results(id),
  holder_name text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  achieved_year integer NOT NULL,
  achieved_at timestamptz NOT NULL,
  evidence jsonb NOT NULL,
  formula_version text NOT NULL DEFAULT 'festival-records-v2',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festival_legacy_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_result_id uuid NOT NULL REFERENCES public.festival_results(id),
  channel text NOT NULL CHECK (channel IN ('world_pulse','rockmundo_fm','twaater','player_news','band_news','company_news')),
  recipient_id uuid,
  dedupe_key text NOT NULL UNIQUE,
  headline text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','published','failed')),
  canonical_publication_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE FUNCTION public._deny_festival_legacy_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'festival_archive_is_immutable'; END $$;

CREATE FUNCTION public._festival_required_number(p jsonb, key text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v numeric;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' OR NOT p ? key OR jsonb_typeof(p->key) <> 'number' THEN
    RAISE EXCEPTION 'festival_result_snapshot_malformed: required numeric field %', key;
  END IF;
  v := (p->>key)::numeric;
  RETURN v;
END $$;

CREATE FUNCTION public._festival_score(v numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT round(least(100, greatest(0, v)), 1) $$;

CREATE FUNCTION public.generate_festival_result(p_settlement_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.festival_financial_settlements%ROWTYPE;
  o public.festival_runtime_outcome_snapshots%ROWTYPE;
  fs public.festival_settlement_snapshots%ROWTYPE;
  ed public.festival_public_editions%ROWTYPE;
  r public.festival_results%ROWTYPE;
  snap jsonb; attendance integer; peak integer; capacity integer; perf_count integer;
  largest_crowd integer; crowd numeric; organisation numeric; line_up numeric;
  stage_score numeric; value_score numeric; food_score numeric; facilities_score numeric;
  incident_penalty numeric; merch jsonb; food jsonb; sponsors jsonb; weather jsonb;
  incidents jsonb; performances jsonb; runtime_digest text; settlement_digest text;
BEGIN
  SELECT * INTO s FROM public.festival_financial_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'settled' OR s.final_snapshot_id IS NULL OR s.settled_at IS NULL
     OR s.outstanding_payables_minor <> 0 OR s.outstanding_receivables_minor <> 0 THEN
    RAISE EXCEPTION 'festival_result_requires_fully_settled_festival';
  END IF;
  SELECT * INTO r FROM public.festival_results WHERE festival_settlement_id = s.id;
  IF FOUND THEN RETURN r.id; END IF;

  INSERT INTO public.festival_legacy_generation_jobs(festival_settlement_id,dedupe_key,status,attempts)
  VALUES (s.id,'festival-legacy:'||s.id,'processing',1)
  ON CONFLICT (festival_settlement_id) DO UPDATE
    SET status = 'processing', attempts = public.festival_legacy_generation_jobs.attempts + 1
    WHERE public.festival_legacy_generation_jobs.status <> 'completed';

  SELECT * INTO fs FROM public.festival_settlement_snapshots
    WHERE id = s.final_snapshot_id AND settlement_id = s.id AND snapshot_type = 'final';
  SELECT * INTO o FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id = s.runtime_session_id;
  IF fs.id IS NULL OR o.id IS NULL OR fs.runtime_outcome_snapshot_id <> o.id THEN
    RAISE EXCEPTION 'festival_result_snapshot_missing';
  END IF;
  runtime_digest := encode(digest(o.snapshot::text,'sha256'),'hex');
  settlement_digest := encode(digest(fs.snapshot::text,'sha256'),'hex');
  IF runtime_digest <> o.content_digest OR o.content_digest <> s.runtime_outcome_digest
     OR settlement_digest <> fs.content_digest
     OR fs.snapshot->>'runtimeOutcomeDigest' IS DISTINCT FROM o.content_digest THEN
    RAISE EXCEPTION 'festival_result_source_digest_invalid';
  END IF;
  IF jsonb_typeof(o.snapshot) <> 'object'
     OR NOT (o.snapshot ?& ARRAY['attendance','performances','crowds','weather','incidents','staffOutcomes','supplierOutcomes','sponsorActivations','vendorSales'])
     OR jsonb_typeof(o.snapshot->'attendance') <> 'array'
     OR jsonb_typeof(o.snapshot->'performances') <> 'array' THEN
    RAISE EXCEPTION 'festival_result_snapshot_malformed';
  END IF;
  SELECT * INTO ed FROM public.festival_public_editions WHERE festival_launch_id = s.festival_launch_id;
  IF ed.id IS NULL OR ed.name IS NULL OR ed.city_name IS NULL OR ed.country_name IS NULL OR ed.scale IS NULL THEN
    RAISE EXCEPTION 'festival_result_public_edition_missing';
  END IF;
  snap := o.snapshot;
  SELECT coalesce(sum((x->>'admitted_count')::integer),0), coalesce(max((x->>'onsite_count')::integer),0), coalesce(max((x->>'capacity')::integer),0)
    INTO attendance,peak,capacity FROM jsonb_array_elements(snap->'attendance') x;
  IF capacity <= 0 OR attendance < 0 OR peak < 0 THEN RAISE EXCEPTION 'festival_result_attendance_invalid'; END IF;
  SELECT count(*) FILTER (WHERE x->>'status' = 'completed'),
         coalesce(max((x->>'estimated_audience')::integer) FILTER (WHERE x->>'status' = 'completed'),0),
         avg((x->>'performance_score')::numeric) FILTER (WHERE x->>'status' = 'completed'),
         avg((x->>'technical_score')::numeric) FILTER (WHERE x->>'status' = 'completed')
    INTO perf_count,largest_crowd,line_up,stage_score FROM jsonb_array_elements(snap->'performances') x;
  IF perf_count = 0 OR line_up IS NULL OR stage_score IS NULL THEN RAISE EXCEPTION 'festival_result_performance_evidence_missing'; END IF;
  SELECT coalesce(avg((x->>'satisfaction')::numeric), avg((x->>'density')::numeric)) INTO crowd
    FROM jsonb_array_elements(snap->'crowds') x;
  IF crowd IS NULL THEN RAISE EXCEPTION 'festival_result_crowd_evidence_missing'; END IF;
  SELECT coalesce(sum(CASE x->>'severity' WHEN 'minor' THEN 1 WHEN 'moderate' THEN 3 WHEN 'major' THEN 8 WHEN 'critical' THEN 20 END),0)
    INTO incident_penalty FROM jsonb_array_elements(snap->'incidents') x;
  SELECT avg((x->>'role_effectiveness')::numeric) INTO organisation FROM jsonb_array_elements(snap->'staffOutcomes') x;
  SELECT avg((x->>'service_quality')::numeric) INTO facilities_score FROM jsonb_array_elements(snap->'supplierOutcomes') x;
  SELECT jsonb_build_object('units',coalesce(sum((x->>'units_sold')::integer),0),'revenueMinor',coalesce(sum((x->>'gross_revenue_minor')::bigint),0)) INTO merch
    FROM jsonb_array_elements(snap->'vendorSales') x WHERE x->>'category' IN ('festival_merch','artist_merch');
  SELECT jsonb_build_object('units',coalesce(sum((x->>'units_sold')::integer),0),'revenueMinor',coalesce(sum((x->>'gross_revenue_minor')::bigint),0),'wasteUnits',coalesce(sum((x->>'waste_units')::integer),0)) INTO food
    FROM jsonb_array_elements(snap->'vendorSales') x WHERE x->>'category' IN ('food','soft_drinks','alcohol_where_game_rules_allow');
  SELECT avg((x->>'delivery_quality')::numeric), coalesce(jsonb_agg(x),'[]') INTO value_score,sponsors FROM jsonb_array_elements(snap->'sponsorActivations') x;
  SELECT avg(CASE WHEN (x->>'opening_stock')::int > 0 THEN 100.0*(x->>'units_sold')::int/(x->>'opening_stock')::int END) INTO food_score FROM jsonb_array_elements(snap->'vendorSales') x WHERE x->>'category' IN ('food','soft_drinks','alcohol_where_game_rules_allow');
  IF organisation IS NULL OR facilities_score IS NULL OR value_score IS NULL OR food_score IS NULL THEN
    RAISE EXCEPTION 'festival_legacy_required_evidence_missing';
  END IF;
  weather := snap->'weather';
  SELECT coalesce(jsonb_object_agg(severity,n),'{}') INTO incidents FROM (SELECT x->>'severity' severity,count(*) n FROM jsonb_array_elements(snap->'incidents') x GROUP BY 1) q;
  performances := (SELECT jsonb_agg(x ORDER BY (x->>'performance_score')::numeric DESC, x->>'id') FROM jsonb_array_elements(snap->'performances') x WHERE x->>'status'='completed');

  INSERT INTO public.festival_results(
    festival_settlement_id,runtime_outcome_snapshot_id,settlement_snapshot_id,festival_launch_id,festival_edition_id,festival_company_id,
    festival_name,edition_year,country,city,festival_type,genres,attendance,peak_attendance,site_capacity,sell_out_percentage,
    fastest_sell_out_seconds,revenue_minor,profit_loss_minor,currency_code,sold_out,crowd_satisfaction,weather_summary,incident_summary,
    performance_count,largest_performance_crowd,performance_highlights,headliners,sponsor_summary,merchandise_summary,food_drink_summary,
    timetable,poster_url,source_digests,formula_versions)
  VALUES (s.id,o.id,fs.id,s.festival_launch_id,ed.id,s.festival_company_id,ed.name,extract(year from ed.starts_at)::int,ed.country_name,ed.city_name,
    coalesce(ed.festival_type,ed.scale),coalesce(ARRAY(SELECT jsonb_array_elements_text(ed.public_metadata->'genres')),ARRAY[]::text[]),attendance,peak,capacity,
    public._festival_score(100.0*attendance/capacity),CASE WHEN ed.sold_out THEN extract(epoch FROM ((SELECT ticket_sales_closed_at FROM public.festival_launches WHERE id=s.festival_launch_id)-ed.created_at))::bigint END,
    s.total_revenue_minor,s.net_profit_loss_minor,s.currency_code,ed.sold_out,public._festival_score(crowd),weather,incidents,perf_count,largest_crowd,
    coalesce(performances,'[]'),coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(snap->'performances') x WHERE x->>'status'='completed' AND coalesce((x->>'billing_position')::int,999)=1),'[]'),
    sponsors,merch,food,coalesce(ed.public_metadata->'timetable','[]'),ed.hero_image_reference,
    jsonb_build_object('runtime',runtime_digest,'settlement',settlement_digest),jsonb_build_object('result','festival-legacy-v2','runtime',o.formula_versions,'settlement',fs.formula_versions))
  ON CONFLICT (festival_settlement_id) DO NOTHING RETURNING * INTO r;
  IF r.id IS NULL THEN SELECT * INTO r FROM public.festival_results WHERE festival_settlement_id=s.id; END IF;

  organisation := public._festival_score(organisation - incident_penalty);
  line_up := public._festival_score(line_up);
  stage_score := public._festival_score(stage_score);
  value_score := public._festival_score((public._festival_score(crowd)+CASE WHEN s.net_profit_loss_minor >= 0 THEN 70 ELSE 45 END)/2);
  food_score := public._festival_score(food_score);
  facilities_score := public._festival_score(facilities_score - incident_penalty/2);
  INSERT INTO public.festival_reviews(festival_result_id,organisation,line_up,crowd_atmosphere,stage_production,value_for_money,food_drink,facilities,overall_rating,formula_evidence)
  VALUES(r.id,organisation,line_up,public._festival_score(crowd),stage_score,value_score,food_score,facilities_score,
    public._festival_score((organisation*20+line_up*20+crowd*20+stage_score*15+value_score*10+food_score*5+facilities_score*10)/100),
    jsonb_build_object('organisation',jsonb_build_object('staffEffectiveness',organisation,'incidentPenalty',incident_penalty),'lineUp',jsonb_build_object('completedPerformanceScores',true),'crowdAtmosphere',jsonb_build_object('crowdSamples',jsonb_array_length(snap->'crowds')),'stageProduction',jsonb_build_object('technicalScores',true),'valueForMoney',jsonb_build_object('crowdAndFinancialOutcome',true),'foodDrink',food,'facilities',jsonb_build_object('supplierServiceQuality',facilities_score))
  ON CONFLICT DO NOTHING;

  -- Every row is scoped to an actual participant in the immutable snapshot.  Types
  -- without a compatible canonical reputation API remain honest pending projections.
  INSERT INTO public.festival_reputation_changes(festival_result_id,subject_type,subject_key,subject_id,change,projection_status,factors)
  SELECT r.id,q.subject_type,q.subject_key,q.subject_id,public._festival_score(q.score)-50,'pending',q.factors FROM (
    SELECT 'festival_company' subject_type,s.festival_company_id::text subject_key,s.festival_company_id subject_id,organisation score,jsonb_build_object('organisation',organisation,'financialResultMinor',s.net_profit_loss_minor) factors
    UNION ALL SELECT 'festival_brand',ed.id::text,ed.id,public._festival_score((line_up+crowd)/2),jsonb_build_object('attendance',attendance,'sellOut',ed.sold_out)
    UNION ALL SELECT CASE WHEN x->>'band_id' IS NULL THEN 'artist' ELSE 'band' END,coalesce(x->>'band_id',x->>'solo_artist_profile_id',x->>'npc_artist_id'),coalesce(x->>'band_id',x->>'solo_artist_profile_id',x->>'npc_artist_id')::uuid,(x->>'performance_score')::numeric,jsonb_build_object('performanceId',x->>'id','crowdResponse',x->>'crowd_response') FROM jsonb_array_elements(snap->'performances') x WHERE x->>'status'='completed'
    UNION ALL SELECT 'staff',x->>'staff_checkin_id',(x->>'staff_checkin_id')::uuid,(x->>'role_effectiveness')::numeric,jsonb_build_object('effectiveness',x->>'role_effectiveness','completion',x->>'shift_completion') FROM jsonb_array_elements(snap->'staffOutcomes') x
    UNION ALL SELECT 'supplier',x->>'supplier_checkin_id',(x->>'supplier_checkin_id')::uuid,(x->>'contract_compliance')::numeric,jsonb_build_object('compliance',x->>'contract_compliance','quality',x->>'product_quality') FROM jsonb_array_elements(snap->'supplierOutcomes') x
    UNION ALL SELECT 'sponsor',coalesce(x->>'contract_deliverable_id',x->>'source_activation_id'),coalesce(x->>'contract_deliverable_id',x->>'source_activation_id')::uuid,coalesce((x->>'delivery_quality')::numeric,0),jsonb_build_object('status',x->>'status','audienceExposure',x->>'audience_exposure') FROM jsonb_array_elements(snap->'sponsorActivations') x WHERE coalesce(x->>'contract_deliverable_id',x->>'source_activation_id') IS NOT NULL
    UNION ALL SELECT 'host_city',ed.city_id::text,ed.city_id,public._festival_score((crowd+organisation)/2),jsonb_build_object('attendance',attendance,'incidents',incidents)
  ) q WHERE q.subject_key IS NOT NULL ON CONFLICT DO NOTHING;

  IF ed.scale IN ('large','major') THEN
    INSERT INTO public.festival_legacy_publications(festival_result_id,channel,recipient_id,dedupe_key,headline,summary,payload)
    SELECT r.id,c,NULL,'festival-result:'||r.id||':'||c,ed.name||' publishes its final Festival result',attendance||' fans attended; see the verified archive.',jsonb_build_object('route','/festivals/results/'||r.id,'festivalResultId',r.id,'festivalEditionId',ed.id,'public',true)
    FROM unnest(ARRAY['world_pulse','rockmundo_fm','twaater','player_news','band_news','company_news']) c ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.festival_legacy_generation_jobs SET status='completed',result_id=r.id,completed_at=now(),locked_at=NULL,locked_by=NULL,last_error=NULL WHERE festival_settlement_id=s.id;
  RETURN r.id;
END $$;

CREATE FUNCTION public.refresh_festival_world_records(p_result_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_records_forbidden'; END IF;
  WITH candidates AS (
    SELECT r.id,r.festival_name,r.edition_year,r.published_at category_date,c.category,c.value,c.unit,
      row_number() OVER(PARTITION BY c.category ORDER BY
        CASE WHEN c.category='fastest_sell_out' THEN c.value END ASC NULLS LAST,
        CASE WHEN c.category<>'fastest_sell_out' THEN c.value END DESC NULLS LAST,
        r.edition_year ASC,r.published_at ASC,r.id ASC) rank
    FROM public.festival_results r JOIN public.festival_reviews v ON v.festival_result_id=r.id
    CROSS JOIN LATERAL (VALUES
      ('highest_attendance',r.attendance::numeric,'attendees'),
      ('fastest_sell_out',r.fastest_sell_out_seconds::numeric,'seconds'),
      ('largest_profit',greatest(r.profit_loss_minor,0)::numeric,'minor_currency_units'),
      ('biggest_loss',greatest(-r.profit_loss_minor,0)::numeric,'loss_magnitude_minor_currency_units'),
      ('highest_rated_festival',v.overall_rating,'rating_out_of_100'),
      ('longest_running_festival',(SELECT count(*)::numeric FROM public.festival_results z WHERE z.festival_name=r.festival_name AND z.edition_year<=r.edition_year),'editions'),
      ('most_performances',r.performance_count::numeric,'performances'),
      ('most_merchandise_sold',coalesce((r.merchandise_summary->>'units')::numeric,0),'units'),
      ('largest_single_performance_crowd',r.largest_performance_crowd::numeric,'attendees')
    ) c(category,value,unit)
    WHERE (p_result_id IS NULL OR r.id=p_result_id OR p_result_id IS NOT NULL) AND c.value IS NOT NULL
      AND ((c.category='fastest_sell_out' AND r.sold_out) OR (c.category<>'fastest_sell_out' AND c.value>0))
  ), winners AS (SELECT * FROM candidates WHERE rank=1)
  INSERT INTO public.festival_world_records(category,festival_result_id,holder_name,value,unit,achieved_year,achieved_at,evidence)
  SELECT category,id,festival_name,value,unit,edition_year,category_date,jsonb_build_object('resultId',id,'tieBreak','value, achievement year, publication time, result id') FROM winners
  ON CONFLICT(category) DO UPDATE SET festival_result_id=excluded.festival_result_id,holder_name=excluded.holder_name,value=excluded.value,unit=excluded.unit,achieved_year=excluded.achieved_year,achieved_at=excluded.achieved_at,evidence=excluded.evidence,updated_at=now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE FUNCTION public.generate_festival_season_awards(p_year integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF auth.role()<>'service_role' AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_awards_forbidden'; END IF;
  IF p_year >= extract(year FROM now())::integer OR EXISTS(SELECT 1 FROM public.festival_financial_settlements WHERE status<>'settled' AND extract(year FROM created_at)=p_year) THEN RAISE EXCEPTION 'festival_award_season_incomplete'; END IF;
  WITH base AS (SELECT r.*,v.* FROM public.festival_results r JOIN public.festival_reviews v ON v.festival_result_id=r.id WHERE r.edition_year=p_year),
  festival_candidates AS (
    SELECT category,b.id result_id,'festival' winner_type,b.festival_edition_id winner_id,b.festival_name winner_name,score,evidence FROM base b CROSS JOIN LATERAL (VALUES
      ('festival_of_the_year',b.overall_rating,jsonb_build_object('rating',b.overall_rating,'attendance',b.attendance)),
      ('best_small_festival',CASE WHEN b.festival_type IN('local','small') THEN b.overall_rating END,jsonb_build_object('size',b.festival_type)),
      ('best_major_festival',CASE WHEN b.festival_type IN('large','major') THEN b.overall_rating END,jsonb_build_object('size',b.festival_type)),
      ('best_crowd',b.crowd_atmosphere,jsonb_build_object('crowdAtmosphere',b.crowd_atmosphere)),
      ('best_stage_production',b.stage_production,jsonb_build_object('stageProduction',b.stage_production)),
      ('best_organised_festival',b.organisation,jsonb_build_object('organisation',b.organisation))
    ) c(category,score,evidence) WHERE score IS NOT NULL
  ), performance_candidates AS (
    SELECT 'best_headliner' category,b.id,
      CASE WHEN h.band_id IS NOT NULL THEN 'band' ELSE 'artist' END,h.subject_id,h.name,h.score,jsonb_build_object('performanceId',h.performance_id,'score',h.score) evidence
    FROM base b CROSS JOIN LATERAL (SELECT (x->>'id')::uuid performance_id,coalesce((x->>'band_id')::uuid,(x->>'solo_artist_profile_id')::uuid,(x->>'npc_artist_id')::uuid) subject_id,(x->>'band_id')::uuid band_id,x->>'artist_name' name,(x->>'performance_score')::numeric score,coalesce((x->>'billing_position')::int=1,false) headliner FROM jsonb_array_elements(b.performance_highlights) x) h
    WHERE h.headliner
    UNION ALL
    SELECT 'best_performance',b.id,'performance',h.performance_id,h.name,h.score,jsonb_build_object('performanceId',h.performance_id,'subjectId',h.subject_id,'score',h.score)
    FROM base b CROSS JOIN LATERAL (SELECT (x->>'id')::uuid performance_id,coalesce((x->>'band_id')::uuid,(x->>'solo_artist_profile_id')::uuid,(x->>'npc_artist_id')::uuid) subject_id,x->>'artist_name' name,(x->>'performance_score')::numeric score FROM jsonb_array_elements(b.performance_highlights) x) h
    UNION ALL
    SELECT 'best_new_artist',b.id,CASE WHEN h.band_id IS NOT NULL THEN 'band' ELSE 'artist' END,h.subject_id,h.name,h.score,jsonb_build_object('performanceId',h.performance_id,'eligibility','canonical identity created within 365 days of edition')
    FROM base b CROSS JOIN LATERAL (SELECT (x->>'id')::uuid performance_id,(x->>'solo_artist_profile_id')::uuid profile_id,(x->>'band_id')::uuid band_id,coalesce((x->>'band_id')::uuid,(x->>'solo_artist_profile_id')::uuid) subject_id,x->>'artist_name' name,(x->>'performance_score')::numeric score FROM jsonb_array_elements(b.performance_highlights) x) h
    WHERE h.subject_id IS NOT NULL AND ((h.profile_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=h.profile_id AND p.created_at >= make_date(p_year,1,1)-interval '365 days')) OR (h.band_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bands bn WHERE bn.id=h.band_id AND bn.created_at >= make_date(p_year,1,1)-interval '365 days')))
  ), sponsor_candidates AS (
    SELECT 'best_sponsor_activation',b.id,'sponsor',coalesce((x->>'contract_deliverable_id')::uuid,(x->>'source_activation_id')::uuid),coalesce(x->>'sponsor_name','Sponsor'),(x->>'delivery_quality')::numeric,jsonb_build_object('activation',x) FROM base b CROSS JOIN LATERAL jsonb_array_elements(b.sponsor_summary) x WHERE x->>'status'='completed' AND x->>'delivery_quality' IS NOT NULL
  ), all_candidates AS (SELECT * FROM festival_candidates UNION ALL SELECT * FROM performance_candidates UNION ALL SELECT * FROM sponsor_candidates),
  winners AS (SELECT *,row_number() OVER(PARTITION BY category ORDER BY score DESC,result_id,winner_id) rank FROM all_candidates)
  INSERT INTO public.festival_awards(season_year,category,festival_result_id,winner_type,winner_id,winner_name,score,citation,evidence)
  SELECT p_year,category,result_id,winner_type,winner_id,winner_name,score,'Awarded from category-specific immutable evidence.',evidence||jsonb_build_object('tieBreak','score, result id, winner id') FROM winners WHERE rank=1 ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;

CREATE FUNCTION public.process_festival_legacy_publications(p_limit integer DEFAULT 25) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.festival_legacy_publications%ROWTYPE; canonical uuid; n integer:=0;
BEGIN
  IF auth.role()<>'service_role' AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_publication_forbidden'; END IF;
  FOR p IN SELECT * FROM public.festival_legacy_publications WHERE status IN('pending','failed') AND next_attempt_at <= now() ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),100) LOOP
    BEGIN
      UPDATE public.festival_legacy_publications SET status='processing' WHERE id=p.id;
      canonical:=gen_random_uuid();
      IF p.channel IN ('world_pulse','twaater','player_news','band_news') THEN
        INSERT INTO public.festival_launch_events(id,festival_launch_id,event_type,recipient_profile_id,channel,dedupe_key,payload)
        SELECT canonical,r.festival_launch_id,'festival_result_published',p.recipient_id,CASE WHEN p.channel='twaater' THEN 'twaater' ELSE 'world_pulse' END,p.dedupe_key,p.payload||jsonb_build_object('headline',p.headline,'summary',p.summary) FROM public.festival_results r WHERE r.id=p.festival_result_id ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=excluded.dedupe_key RETURNING id INTO canonical;
      ELSIF p.channel='rockmundo_fm' THEN
        INSERT INTO public.radio_content(id,content_type,title,script,category,brand_name,humor_style,play_weight,is_active) VALUES(canonical,'advert',p.headline,p.summary,'festival_result','RockMundo FM','deadpan',1,true);
      ELSIF p.channel='company_news' THEN
        INSERT INTO public.company_news_events(id,company_id,event_type,headline,body,payload)
        SELECT canonical,fc.company_id,'festival_result',p.headline,p.summary,p.payload FROM public.festival_results r JOIN public.festival_companies fc ON fc.id=r.festival_company_id WHERE r.id=p.festival_result_id;
      END IF;
      UPDATE public.festival_legacy_publications SET status='published',canonical_publication_id=canonical,published_at=now(),attempts=attempts+1,last_error=NULL WHERE id=p.id; n:=n+1;
    EXCEPTION WHEN others THEN UPDATE public.festival_legacy_publications SET status='failed',attempts=attempts+1,last_error=left(SQLERRM,500),next_attempt_at=now()+least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6))) WHERE id=p.id; END;
  END LOOP; RETURN n;
END $$;

-- Claims jobs with SKIP LOCKED and handles generation in a subtransaction.  A
-- failed projection is retried independently and can never roll back settlement.
CREATE FUNCTION public.process_festival_legacy_generation_jobs(p_limit integer DEFAULT 25, p_worker_id text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j public.festival_legacy_generation_jobs%ROWTYPE; n integer := 0; generated uuid;
BEGIN
  IF auth.role()<>'service_role' AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'festival_legacy_generation_forbidden';
  END IF;
  FOR j IN SELECT * FROM public.festival_legacy_generation_jobs
    WHERE status IN ('pending','failed') AND next_attempt_at <= now()
    ORDER BY next_attempt_at,created_at,id FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(p_limit,1),100)
  LOOP
    UPDATE public.festival_legacy_generation_jobs SET status='processing',attempts=attempts+1,
      locked_at=now(),locked_by=coalesce(nullif(p_worker_id,''),current_user),last_error=NULL WHERE id=j.id;
    BEGIN
      generated := public.generate_festival_result(j.festival_settlement_id);
      UPDATE public.festival_legacy_generation_jobs SET status='completed',result_id=generated,
        completed_at=now(),locked_at=NULL,locked_by=NULL WHERE id=j.id;
      n := n + 1;
    EXCEPTION WHEN others THEN
      UPDATE public.festival_legacy_generation_jobs SET status='failed',last_error=left(SQLSTATE||':'||SQLERRM,500),
        next_attempt_at=now()+least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6))),locked_at=NULL,locked_by=NULL WHERE id=j.id;
    END;
  END LOOP;
  RETURN n;
END $$;

CREATE FUNCTION public._festival_result_json(r public.festival_results) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
SELECT jsonb_build_object('id',r.id,'festivalEditionId',r.festival_edition_id,'festivalCompanyId',r.festival_company_id,'festivalName',r.festival_name,'editionYear',r.edition_year,'country',r.country,'city',r.city,'festivalType',r.festival_type,'genres',r.genres,'attendance',r.attendance,'peakAttendance',r.peak_attendance,'siteCapacity',r.site_capacity,'sellOutPercentage',r.sell_out_percentage,'fastestSellOutSeconds',r.fastest_sell_out_seconds,'revenueMinor',r.revenue_minor::text,'profitLossMinor',r.profit_loss_minor::text,'currencyCode',r.currency_code,'soldOut',r.sold_out,'crowdSatisfaction',r.crowd_satisfaction,'overallRating',(SELECT overall_rating FROM public.festival_reviews WHERE festival_result_id=r.id),'weatherSummary',r.weather_summary,'incidentSummary',r.incident_summary,'performanceCount',r.performance_count,'largestPerformanceCrowd',r.largest_performance_crowd,'performanceHighlights',r.performance_highlights,'sponsorSummary',r.sponsor_summary,'merchandiseSummary',r.merchandise_summary,'foodDrinkSummary',r.food_drink_summary,'headliners',r.headliners,'posterUrl',r.poster_url,'publishedAt',r.published_at) $$;

CREATE FUNCTION public.get_festival_results(p_year integer DEFAULT NULL,p_country text DEFAULT NULL,p_city text DEFAULT NULL,p_festival_type text DEFAULT NULL,p_genre text DEFAULT NULL,p_limit integer DEFAULT 24,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object('items',coalesce(jsonb_agg(public._festival_result_json(q) ORDER BY q.edition_year DESC,q.festival_name,q.id),'[]'),'limit',least(greatest(p_limit,1),100),'offset',greatest(p_offset,0)) FROM (SELECT r FROM public.festival_results r WHERE (p_year IS NULL OR r.edition_year=p_year) AND (p_country IS NULL OR r.country=p_country) AND (p_city IS NULL OR r.city=p_city) AND (p_festival_type IS NULL OR r.festival_type=p_festival_type) AND (p_genre IS NULL OR p_genre=ANY(r.genres)) ORDER BY r.edition_year DESC,r.festival_name,r.id LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)) x(q) $$;
CREATE FUNCTION public.get_festival_history(p_year integer DEFAULT NULL,p_country text DEFAULT NULL,p_city text DEFAULT NULL,p_festival_type text DEFAULT NULL,p_genre text DEFAULT NULL,p_limit integer DEFAULT 24,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.get_festival_results(p_year,p_country,p_city,p_festival_type,p_genre,p_limit,p_offset) $$;
CREATE FUNCTION public.get_festival_result_detail(p_result_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT public._festival_result_json(r)||jsonb_build_object('review',(SELECT to_jsonb(v)-'id'-'festival_result_id' FROM public.festival_reviews v WHERE v.festival_result_id=r.id),'lineUp',r.performance_highlights,'timetable',r.timetable,'awards',coalesce((SELECT jsonb_agg(to_jsonb(a)-'evidence') FROM public.festival_awards a WHERE a.festival_result_id=r.id),'[]'),'recordsHeld',coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM public.festival_world_records w WHERE w.festival_result_id=r.id),'[]'),'publicationStories',coalesce((SELECT jsonb_agg(jsonb_build_object('channel',p.channel,'headline',p.headline,'summary',p.summary,'status',p.status,'publishedAt',p.published_at)) FROM public.festival_legacy_publications p WHERE p.festival_result_id=r.id AND p.status='published'),'[]')) FROM public.festival_results r WHERE r.id=p_result_id $$;
CREATE FUNCTION public.get_festival_awards(p_year integer DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'seasonYear',season_year,'category',category,'winnerType',winner_type,'winnerId',winner_id,'winnerName',winner_name,'festivalResultId',festival_result_id,'score',score,'citation',citation) ORDER BY season_year DESC,category),'[]') FROM public.festival_awards WHERE p_year IS NULL OR season_year=p_year $$;
CREATE FUNCTION public.get_festival_records() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'holderName',holder_name,'festivalResultId',festival_result_id,'value',value,'unit',unit,'achievedYear',achieved_year,'evidence',evidence) ORDER BY category),'[]') FROM public.festival_world_records $$;
CREATE FUNCTION public.get_festival_statistics(p_year integer DEFAULT NULL,p_country text DEFAULT NULL,p_city text DEFAULT NULL,p_festival_type text DEFAULT NULL,p_genre text DEFAULT NULL,p_group_by text DEFAULT 'festival') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH f AS (SELECT r.*,v.overall_rating FROM public.festival_results r JOIN public.festival_reviews v ON v.festival_result_id=r.id WHERE (p_year IS NULL OR edition_year=p_year) AND (p_country IS NULL OR country=p_country) AND (p_city IS NULL OR city=p_city) AND (p_festival_type IS NULL OR festival_type=p_festival_type) AND (p_genre IS NULL OR p_genre=ANY(genres))), g AS (SELECT CASE p_group_by WHEN 'company' THEN festival_company_id::text WHEN 'city' THEN city WHEN 'country' THEN country WHEN 'year' THEN edition_year::text WHEN 'type' THEN festival_type WHEN 'genre' THEN genre.name ELSE festival_name END label,f.* FROM f CROSS JOIN LATERAL unnest(CASE WHEN p_group_by='genre' THEN f.genres ELSE ARRAY[NULL]::text[] END) genre(name))
SELECT jsonb_build_object(
  'editions',count(*),'attendance',coalesce(sum(attendance),0),
  'averageRating',coalesce(round(avg(overall_rating),1),0),'sellOuts',count(*) FILTER(WHERE sold_out),
  'moneyByCurrency',coalesce((SELECT jsonb_agg(jsonb_build_object('currencyCode',currency_code,'revenueMinor',revenue::text,'profitLossMinor',profit::text) ORDER BY currency_code) FROM (SELECT currency_code,sum(revenue_minor) revenue,sum(profit_loss_minor) profit FROM f GROUP BY currency_code) money),'[]'),
  'groups',coalesce((SELECT jsonb_agg(jsonb_build_object('label',label,'editions',editions,'attendance',attendance,'averageRating',rating,'moneyByCurrency',money) ORDER BY attendance DESC,label) FROM (SELECT label,count(*) editions,sum(attendance) attendance,round(avg(overall_rating),1) rating,jsonb_agg(jsonb_build_object('currencyCode',currency_code,'revenueMinor',revenue::text,'profitLossMinor',profit::text) ORDER BY currency_code) money FROM (SELECT label,currency_code,count(*) editions,sum(attendance) attendance,avg(overall_rating) rating,sum(revenue_minor) revenue,sum(profit_loss_minor) profit FROM g GROUP BY label,currency_code) gc GROUP BY label) z),'[]')) FROM f $$;
CREATE FUNCTION public.get_festival_hall_of_fame() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH ranked AS (SELECT r.*,v.overall_rating,(v.overall_rating*0.45+least(100,r.attendance::numeric/nullif(r.site_capacity,0)*100)*0.20+v.organisation*0.15+least(100,(SELECT count(*)*10 FROM public.festival_awards a WHERE a.festival_result_id=r.id))*0.15+least(100,(SELECT count(*)*20 FROM public.festival_world_records w WHERE w.festival_result_id=r.id))*0.05) legacy_score FROM public.festival_results r JOIN public.festival_reviews v ON v.festival_result_id=r.id)
SELECT coalesce(jsonb_agg(public._festival_result_json(r)||jsonb_build_object('legacyScore',round(legacy_score,2),'formulaVersion','festival-hall-of-fame-v2','rank',rank) ORDER BY rank),'[]') FROM (SELECT ranked.*,row_number() OVER(ORDER BY legacy_score DESC,edition_year ASC,id) rank FROM ranked) r $$;

CREATE FUNCTION public._queue_festival_result_after_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF new.status='settled' AND new.final_snapshot_id IS NOT NULL AND (old.status,new.final_snapshot_id) IS DISTINCT FROM (new.status,old.final_snapshot_id) THEN INSERT INTO public.festival_legacy_generation_jobs(festival_settlement_id,dedupe_key) VALUES(new.id,'festival-legacy:'||new.id) ON CONFLICT DO NOTHING; END IF; RETURN new; END $$;
CREATE TRIGGER queue_festival_result_after_settlement AFTER UPDATE OF status,final_snapshot_id ON public.festival_financial_settlements FOR EACH ROW EXECUTE FUNCTION public._queue_festival_result_after_settlement();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['festival_results','festival_reviews','festival_reputation_changes','festival_awards'] LOOP
    EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._deny_festival_legacy_mutation()',t,t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['festival_legacy_generation_jobs','festival_results','festival_reviews','festival_reputation_changes','festival_awards','festival_world_records','festival_legacy_publications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.generate_festival_result(uuid),public.refresh_festival_world_records(uuid),public.generate_festival_season_awards(integer),public.process_festival_legacy_publications(integer),public.process_festival_legacy_generation_jobs(integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_results(integer,text,text,text,text,integer,integer),public.get_festival_history(integer,text,text,text,text,integer,integer),public.get_festival_result_detail(uuid),public.get_festival_awards(integer),public.get_festival_records(),public.get_festival_statistics(integer,text,text,text,text,text),public.get_festival_hall_of_fame() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_result(uuid),public.refresh_festival_world_records(uuid),public.generate_festival_season_awards(integer),public.process_festival_legacy_publications(integer),public.process_festival_legacy_generation_jobs(integer,text) TO service_role;

COMMENT ON TABLE public.festival_results IS 'Immutable Phase 9B projection of validated runtime and final settlement snapshots.';
COMMENT ON COLUMN public.festival_world_records.value IS 'For biggest_loss this is a positive loss magnitude. All record ties retain the earliest achievement.';
COMMENT ON FUNCTION public.get_festival_hall_of_fame() IS 'Legacy score v2: rating 45%, capacity utilisation 20%, organisation 15%, awards 15%, records 5%; deterministic ties use year then result id.';
