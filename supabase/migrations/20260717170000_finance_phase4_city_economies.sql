-- Finance Phase 4: city economies, regional costs, local demand and municipal treasuries.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'city_business_licence_fee';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'city_venue_permit_fee';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'city_grant_payment';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'city_budget_spend';
ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'city_treasury_adjustment';

DO $$ BEGIN CREATE TYPE public.city_scale AS ENUM ('town','small_city','regional_city','major_city','global_city'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.city_economic_trend AS ENUM ('strong_growth','growth','stable','slowing','decline','severe_decline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.city_budget_status AS ENUM ('draft','active','closed','adjusted','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.city_effect_status AS ENUM ('scheduled','active','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.city_grant_status AS ENUM ('draft','open','closed','applied','approved','rejected','paid','cancelled','exhausted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS primary_currency_code char(3) NOT NULL DEFAULT 'USD';
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS city_scale public.city_scale NOT NULL DEFAULT 'regional_city';

CREATE TABLE IF NOT EXISTS public.city_economic_profiles (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  primary_currency_code char(3) NOT NULL DEFAULT 'USD',
  population bigint NOT NULL DEFAULT 100000 CHECK (population >= 0),
  active_player_population integer NOT NULL DEFAULT 0 CHECK (active_player_population >= 0),
  city_scale public.city_scale NOT NULL DEFAULT 'regional_city',
  prosperity_index integer NOT NULL DEFAULT 100,
  cost_of_living_index integer NOT NULL DEFAULT 100,
  commercial_rent_index integer NOT NULL DEFAULT 100,
  residential_rent_index integer NOT NULL DEFAULT 100,
  wage_index integer NOT NULL DEFAULT 100,
  utility_cost_index integer NOT NULL DEFAULT 100,
  fuel_cost_index integer NOT NULL DEFAULT 100,
  accommodation_cost_index integer NOT NULL DEFAULT 100,
  transport_cost_index integer NOT NULL DEFAULT 100,
  consumer_spending_index integer NOT NULL DEFAULT 100,
  tourism_index integer NOT NULL DEFAULT 100,
  music_market_size integer NOT NULL DEFAULT 100,
  local_audience_demand integer NOT NULL DEFAULT 100,
  business_confidence_index integer NOT NULL DEFAULT 100,
  employment_index integer NOT NULL DEFAULT 100,
  infrastructure_quality_index integer NOT NULL DEFAULT 100,
  safety_risk_index integer NOT NULL DEFAULT 100,
  inflation_pressure_index integer NOT NULL DEFAULT 100,
  economic_trend public.city_economic_trend NOT NULL DEFAULT 'stable',
  last_calculated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  configuration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT city_profile_currency_format CHECK (primary_currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT city_profile_indices_bounded CHECK (
    prosperity_index BETWEEN 1 AND 250 AND cost_of_living_index BETWEEN 1 AND 250 AND commercial_rent_index BETWEEN 1 AND 300 AND
    residential_rent_index BETWEEN 1 AND 300 AND wage_index BETWEEN 1 AND 250 AND utility_cost_index BETWEEN 1 AND 250 AND
    fuel_cost_index BETWEEN 1 AND 250 AND accommodation_cost_index BETWEEN 1 AND 300 AND transport_cost_index BETWEEN 1 AND 250 AND
    consumer_spending_index BETWEEN 1 AND 250 AND tourism_index BETWEEN 1 AND 250 AND music_market_size BETWEEN 1 AND 250 AND
    local_audience_demand BETWEEN 1 AND 250 AND business_confidence_index BETWEEN 1 AND 250 AND employment_index BETWEEN 1 AND 250 AND
    infrastructure_quality_index BETWEEN 1 AND 250 AND safety_risk_index BETWEEN 1 AND 250 AND inflation_pressure_index BETWEEN 1 AND 250)
);

CREATE TABLE IF NOT EXISTS public.city_treasury_profiles (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id) ON DELETE CASCADE,
  treasury_account_id uuid NOT NULL UNIQUE REFERENCES public.financial_accounts(id),
  financial_status text NOT NULL DEFAULT 'stable',
  upcoming_obligations_minor bigint NOT NULL DEFAULT 0 CHECK (upcoming_obligations_minor >= 0),
  budget_allocations_minor bigint NOT NULL DEFAULT 0 CHECK (budget_allocations_minor >= 0),
  funding_commitments_minor bigint NOT NULL DEFAULT 0 CHECK (funding_commitments_minor >= 0),
  public_summary_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.city_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL,
  opening_treasury_balance_minor bigint NOT NULL DEFAULT 0, forecast_revenue_minor bigint NOT NULL DEFAULT 0, forecast_expenses_minor bigint NOT NULL DEFAULT 0,
  actual_revenue_minor bigint NOT NULL DEFAULT 0, actual_expenses_minor bigint NOT NULL DEFAULT 0, reserved_commitments_minor bigint NOT NULL DEFAULT 0, closing_balance_minor bigint NOT NULL DEFAULT 0,
  spending_allocations jsonb NOT NULL DEFAULT '{}'::jsonb, status public.city_budget_status NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), approved_at timestamptz, closed_at timestamptz,
  CONSTRAINT city_budget_period CHECK (period_end >= period_start), UNIQUE(city_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.city_genre_demands (
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, genre_id uuid, genre_name text NOT NULL,
  popularity_index integer NOT NULL DEFAULT 100 CHECK (popularity_index BETWEEN 1 AND 250), trend public.city_economic_trend NOT NULL DEFAULT 'stable', audience_size integer NOT NULL DEFAULT 0 CHECK (audience_size >= 0), competition_index integer NOT NULL DEFAULT 100 CHECK (competition_index BETWEEN 1 AND 250), last_calculated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY(city_id, genre_name)
);

CREATE TABLE IF NOT EXISTS public.city_temporary_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, event_name text NOT NULL, source_type text NOT NULL DEFAULT 'admin', source_id uuid,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, strength_basis_points integer NOT NULL DEFAULT 1000 CHECK (strength_basis_points BETWEEN 0 AND 5000), affected_categories text[] NOT NULL DEFAULT '{}', status public.city_effect_status NOT NULL DEFAULT 'scheduled', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT city_effect_period CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS public.city_economic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL,
  population bigint NOT NULL DEFAULT 0, active_players integer NOT NULL DEFAULT 0, prosperity_index integer NOT NULL DEFAULT 100, cost_of_living_index integer NOT NULL DEFAULT 100,
  commercial_rent_index integer NOT NULL DEFAULT 100, residential_rent_index integer NOT NULL DEFAULT 100, wage_index integer NOT NULL DEFAULT 100, utility_cost_index integer NOT NULL DEFAULT 100,
  fuel_cost_index integer NOT NULL DEFAULT 100, accommodation_cost_index integer NOT NULL DEFAULT 100, consumer_spending_index integer NOT NULL DEFAULT 100, tourism_index integer NOT NULL DEFAULT 100,
  music_demand_index integer NOT NULL DEFAULT 100, company_count integer NOT NULL DEFAULT 0, active_employee_count integer NOT NULL DEFAULT 0, vacancies integer NOT NULL DEFAULT 0,
  company_revenue_minor bigint NOT NULL DEFAULT 0, company_payroll_minor bigint NOT NULL DEFAULT 0, gig_activity integer NOT NULL DEFAULT 0, ticket_sales_minor bigint NOT NULL DEFAULT 0,
  accommodation_usage integer NOT NULL DEFAULT 0, treasury_income_minor bigint NOT NULL DEFAULT 0, treasury_expenses_minor bigint NOT NULL DEFAULT 0, treasury_balance_minor bigint NOT NULL DEFAULT 0,
  economic_trend public.city_economic_trend NOT NULL DEFAULT 'stable', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), UNIQUE(city_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.city_grant_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, name text NOT NULL, grant_type text NOT NULL,
  eligibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb, available_budget_minor bigint NOT NULL CHECK (available_budget_minor >= 0), award_amount_minor bigint NOT NULL CHECK (award_amount_minor > 0), recipient_type public.financial_owner_type NOT NULL CHECK (recipient_type IN ('player','band','company','venue')),
  status public.city_grant_status NOT NULL DEFAULT 'draft', approved_by_profile_id uuid REFERENCES public.profiles(id), linked_budget_id uuid REFERENCES public.city_budgets(id), created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), paid_out_minor bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.city_grant_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), programme_id uuid NOT NULL REFERENCES public.city_grant_programmes(id) ON DELETE CASCADE, applicant_profile_id uuid REFERENCES public.profiles(id), recipient_type public.financial_owner_type NOT NULL, recipient_id uuid NOT NULL, status public.city_grant_status NOT NULL DEFAULT 'applied', application_note text, reviewed_by_profile_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), reviewed_at timestamptz, UNIQUE(programme_id, recipient_type, recipient_id));
CREATE TABLE IF NOT EXISTS public.city_grant_awards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid UNIQUE REFERENCES public.city_grant_applications(id) ON DELETE CASCADE, programme_id uuid NOT NULL REFERENCES public.city_grant_programmes(id) ON DELETE CASCADE, city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, recipient_type public.financial_owner_type NOT NULL, recipient_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), status public.city_grant_status NOT NULL DEFAULT 'approved', approved_by_profile_id uuid REFERENCES public.profiles(id), transaction_id uuid UNIQUE REFERENCES public.financial_transactions(id), idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), paid_at timestamptz);

CREATE TABLE IF NOT EXISTS public.city_licence_schedules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, licence_type text NOT NULL, company_type text, operating_tier public.company_operating_tier, base_amount_minor bigint NOT NULL CHECK (base_amount_minor >= 0), frequency public.recurring_obligation_frequency NOT NULL DEFAULT 'monthly', grace_period_days integer NOT NULL DEFAULT 14, is_active boolean NOT NULL DEFAULT true, effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS city_licence_schedules_unique_idx ON public.city_licence_schedules(city_id, licence_type, COALESCE(company_type,'*'), COALESCE(operating_tier::text,'*'), effective_from);
CREATE TABLE IF NOT EXISTS public.city_spending_initiatives (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE, spending_category text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, target_metric text NOT NULL, effect_strength_basis_points integer NOT NULL CHECK (effect_strength_basis_points BETWEEN 0 AND 5000), decay_basis_points integer NOT NULL DEFAULT 10000 CHECK (decay_basis_points BETWEEN 0 AND 10000), source_budget_id uuid REFERENCES public.city_budgets(id), linked_transaction_id uuid UNIQUE REFERENCES public.financial_transactions(id), status public.city_effect_status NOT NULL DEFAULT 'scheduled', created_at timestamptz NOT NULL DEFAULT timezone('utc', now()));
CREATE TABLE IF NOT EXISTS public.city_economic_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), action text NOT NULL, city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE, related_entity_type text, related_entity_id uuid, previous_value jsonb, new_value jsonb, reason text, created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), metadata jsonb NOT NULL DEFAULT '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.city_index_label(p_index integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_index < 70 THEN 'Very low' WHEN p_index < 85 THEN 'Low' WHEN p_index < 95 THEN 'Below average' WHEN p_index <= 105 THEN 'Average' WHEN p_index <= 120 THEN 'Above average' WHEN p_index <= 140 THEN 'High' ELSE 'Very high' END $$;

CREATE OR REPLACE FUNCTION public.city_price_quote(p_city_id uuid, p_base_amount_minor bigint, p_cost_category text, p_existing_modifier_basis_points integer DEFAULT 10000, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE p public.city_economic_profiles; idx integer := 100; event_bp integer := 10000; city_bp integer; final_amount bigint; applied text[] := ARRAY[]::text[];
BEGIN
  IF p_base_amount_minor < 0 THEN RAISE EXCEPTION 'base amount cannot be negative'; END IF;
  SELECT * INTO p FROM public.city_economic_profiles WHERE city_id=p_city_id;
  IF p.city_id IS NULL THEN idx := 100; ELSE
    idx := CASE p_cost_category WHEN 'cost_of_living' THEN p.cost_of_living_index WHEN 'commercial_rent' THEN p.commercial_rent_index WHEN 'residential_rent' THEN p.residential_rent_index WHEN 'wage' THEN p.wage_index WHEN 'utilities' THEN p.utility_cost_index WHEN 'fuel' THEN p.fuel_cost_index WHEN 'accommodation' THEN p.accommodation_cost_index WHEN 'transport' THEN p.transport_cost_index ELSE 100 END;
  END IF;
  city_bp := GREATEST(5000, LEAST(20000, idx * 100));
  SELECT COALESCE(10000 + SUM(strength_basis_points),10000) INTO event_bp FROM public.city_temporary_effects WHERE city_id=p_city_id AND status='active' AND now() BETWEEN starts_at AND ends_at AND p_cost_category = ANY(affected_categories);
  event_bp := GREATEST(7500, LEAST(15000, event_bp));
  final_amount := GREATEST(0, (p_base_amount_minor * city_bp * event_bp * GREATEST(1000, LEAST(30000, p_existing_modifier_basis_points)) + 500000000000) / 1000000000000);
  IF idx <> 100 THEN applied := applied || format('%s city index %s (%s)', p_cost_category, idx, public.city_index_label(idx)); END IF;
  IF event_bp <> 10000 THEN applied := applied || format('temporary event pressure %s bp', event_bp); END IF;
  RETURN jsonb_build_object('baseAmountMinor',p_base_amount_minor,'cityId',p_city_id,'costCategory',p_cost_category,'cityMultiplierBasisPoints',city_bp,'eventMultiplierBasisPoints',event_bp,'existingModifierBasisPoints',p_existing_modifier_basis_points,'finalAmountMinor',final_amount,'rounding','nearest minor unit after bounded basis-point stacking','explanation',applied);
END; $$;

CREATE OR REPLACE FUNCTION public.city_wage_guidance(p_city_id uuid, p_role_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE base bigint; quote jsonb; amount bigint;
BEGIN
  SELECT COALESCE(salary_guidance_minor,50000) INTO base FROM public.employment_role_definitions WHERE role_key=p_role_key;
  quote := public.city_price_quote(p_city_id, COALESCE(base,50000), 'wage'); amount := (quote->>'finalAmountMinor')::bigint;
  RETURN quote || jsonb_build_object('roleKey',p_role_key,'recommendedWageMinor',amount,'minimumMarketMinor',(amount*85)/100,'maximumMarketMinor',(amount*120)/100);
END; $$;

CREATE OR REPLACE FUNCTION public.city_local_audience_demand(p_city_id uuid, p_genre_name text, p_band_fame integer DEFAULT 50, p_ticket_price_minor bigint DEFAULT 2500, p_venue_capacity integer DEFAULT 100, p_competition_index integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE p public.city_economic_profiles; g public.city_genre_demands; demand_bp integer; price_bp integer; audience integer; positives text[] := ARRAY[]::text[]; negatives text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO p FROM public.city_economic_profiles WHERE city_id=p_city_id; IF p.city_id IS NULL THEN p.local_audience_demand := 100; p.consumer_spending_index := 100; p.tourism_index := 100; p.music_market_size := 100; END IF;
  SELECT * INTO g FROM public.city_genre_demands WHERE city_id=p_city_id AND lower(genre_name)=lower(p_genre_name) LIMIT 1; IF g.city_id IS NULL THEN g.popularity_index := 100; g.competition_index := 100; END IF;
  demand_bp := GREATEST(3000, LEAST(25000, (p.local_audience_demand*35 + p.music_market_size*25 + p.consumer_spending_index*15 + p.tourism_index*10 + g.popularity_index*15)));
  price_bp := GREATEST(6000, LEAST(14000, 11000 - ((GREATEST(0,p_ticket_price_minor-2500)/100))::integer));
  audience := LEAST(GREATEST(0,p_venue_capacity), GREATEST(0, (p_venue_capacity * demand_bp * price_bp * GREATEST(1000, LEAST(20000, 5000 + p_band_fame*100)))/(10000*10000*10000)));
  IF p.consumer_spending_index > 110 THEN positives := positives || 'high local consumer spending'; END IF; IF p.tourism_index > 110 THEN positives := positives || 'tourism expands reachable audience'; END IF; IF g.popularity_index > 110 THEN positives := positives || 'genre is locally popular'; END IF;
  IF p_ticket_price_minor > 5000 THEN negatives := negatives || 'ticket price increases sensitivity'; END IF; IF p_competition_index > 120 OR g.competition_index > 120 THEN negatives := negatives || 'local competition is elevated'; END IF;
  RETURN jsonb_build_object('estimatedPotentialAudience',audience,'priceSensitivityBasisPoints',price_bp,'demandConfidenceRange',jsonb_build_object('low',GREATEST(0,(audience*85)/100),'high',LEAST(p_venue_capacity,(audience*115)/100)),'demandMultiplierBasisPoints',demand_bp,'keyPositiveModifiers',positives,'keyNegativeModifiers',negatives);
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_city_economy_foundations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; acct public.financial_accounts; n integer := 0; pop bigint; scale public.city_scale;
BEGIN
  FOR r IN SELECT * FROM public.cities LOOP
    pop := COALESCE(r.population,100000); scale := CASE WHEN pop >= 8000000 THEN 'global_city'::public.city_scale WHEN pop >= 2500000 THEN 'major_city'::public.city_scale WHEN pop >= 750000 THEN 'regional_city'::public.city_scale WHEN pop >= 150000 THEN 'small_city'::public.city_scale ELSE 'town'::public.city_scale END;
    INSERT INTO public.city_economic_profiles(city_id,country_code,primary_currency_code,population,city_scale,prosperity_index,cost_of_living_index,commercial_rent_index,residential_rent_index,wage_index,utility_cost_index,fuel_cost_index,accommodation_cost_index,transport_cost_index,consumer_spending_index,tourism_index,music_market_size,local_audience_demand,business_confidence_index,employment_index,infrastructure_quality_index,configuration_metadata)
    VALUES(r.id, COALESCE(r.country,'Unknown'), COALESCE(r.primary_currency_code,'USD'), pop, scale, LEAST(160,90 + (pop/1000000)::int*4), LEAST(170,85 + (pop/1000000)::int*5), LEAST(190,80 + (pop/1000000)::int*7), LEAST(180,82 + (pop/1000000)::int*6), LEAST(170,88 + (pop/1000000)::int*4), 100, 100, LEAST(180,85 + (pop/1000000)::int*5), 100, LEAST(165,90 + (pop/1000000)::int*3), LEAST(170,85 + (pop/1000000)::int*4), LEAST(180,80 + (pop/1000000)::int*5), LEAST(175,85 + (pop/1000000)::int*4), 100, 100, 100, jsonb_build_object('baseline','gameplay-balanced seed from city population and existing metadata'))
    ON CONFLICT (city_id) DO NOTHING;
    acct := public.get_or_create_primary_financial_account('city', r.id, r.name || ' city treasury', COALESCE(r.primary_currency_code,'USD'));
    INSERT INTO public.city_treasury_profiles(city_id,treasury_account_id) VALUES(r.id,acct.id) ON CONFLICT (city_id) DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.city_collect_business_licence_fee(p_company_id uuid, p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; sched record; quote jsonb; amount bigint; tx uuid;
BEGIN
  SELECT id, company_type, operating_tier, headquarters_city_id INTO c FROM public.companies WHERE id=p_company_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'company not found'; END IF; IF c.headquarters_city_id IS NULL THEN RAISE EXCEPTION 'company city is required'; END IF;
  SELECT * INTO sched FROM public.city_licence_schedules WHERE city_id=c.headquarters_city_id AND is_active AND licence_type='business' AND (company_type IS NULL OR company_type=c.company_type) AND (operating_tier IS NULL OR operating_tier=c.operating_tier) ORDER BY company_type NULLS LAST, operating_tier NULLS LAST LIMIT 1;
  IF sched.id IS NULL THEN amount := 2500; ELSE amount := sched.base_amount_minor; END IF;
  quote := public.city_price_quote(c.headquarters_city_id, amount, 'commercial_rent'); amount := (quote->>'finalAmountMinor')::bigint;
  SELECT public.finance_transfer('company',p_company_id,'city',c.headquarters_city_id,amount,'city_business_licence_fee','City business licence fee',p_idempotency_key,'city_licence_schedule',sched.id,NULL,quote) INTO tx;
  INSERT INTO public.city_economic_audit_events(action,city_id,related_entity_type,related_entity_id,new_value,reason) VALUES('business_licence_fee_collected',c.headquarters_city_id,'company',p_company_id,jsonb_build_object('amountMinor',amount,'transactionId',tx),'server-side licence collection');
  RETURN tx;
END; $$;

CREATE OR REPLACE FUNCTION public.city_pay_grant_award(p_award_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; tx uuid;
BEGIN
  SELECT * INTO a FROM public.city_grant_awards WHERE id=p_award_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'award not found'; END IF; IF a.status='paid' AND a.transaction_id IS NOT NULL THEN RETURN a.transaction_id; END IF; IF a.status <> 'approved' THEN RAISE EXCEPTION 'award is not approved'; END IF;
  SELECT public.finance_transfer('city',a.city_id,a.recipient_type,a.recipient_id,a.amount_minor,'city_grant_payment','City grant award',a.idempotency_key,'city_grant_award',a.id,NULL,'{}'::jsonb) INTO tx;
  UPDATE public.city_grant_awards SET status='paid', transaction_id=tx, paid_at=timezone('utc',now()) WHERE id=a.id;
  UPDATE public.city_grant_programmes SET paid_out_minor=paid_out_minor+a.amount_minor WHERE id=a.programme_id;
  RETURN tx;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_city_economic_snapshot(p_city_id uuid, p_period_start date, p_period_end date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.city_economic_profiles; acct public.financial_accounts; snap uuid;
BEGIN
  SELECT * INTO p FROM public.city_economic_profiles WHERE city_id=p_city_id; IF p.city_id IS NULL THEN PERFORM public.ensure_city_economy_foundations(); SELECT * INTO p FROM public.city_economic_profiles WHERE city_id=p_city_id; END IF;
  SELECT * INTO acct FROM public.financial_accounts WHERE owner_type='city' AND owner_id=p_city_id AND is_primary LIMIT 1;
  INSERT INTO public.city_economic_snapshots(city_id,period_start,period_end,population,active_players,prosperity_index,cost_of_living_index,commercial_rent_index,residential_rent_index,wage_index,utility_cost_index,fuel_cost_index,accommodation_cost_index,consumer_spending_index,tourism_index,music_demand_index,company_count,active_employee_count,vacancies,company_revenue_minor,company_payroll_minor,gig_activity,ticket_sales_minor,treasury_balance_minor,economic_trend)
  SELECT p_city_id,p_period_start,p_period_end,p.population,p.active_player_population,p.prosperity_index,p.cost_of_living_index,p.commercial_rent_index,p.residential_rent_index,p.wage_index,p.utility_cost_index,p.fuel_cost_index,p.accommodation_cost_index,p.consumer_spending_index,p.tourism_index,p.local_audience_demand,
    (SELECT count(*) FROM public.companies c WHERE c.headquarters_city_id=p_city_id), (SELECT count(*) FROM public.company_employees e JOIN public.companies c ON c.id=e.company_id WHERE c.headquarters_city_id=p_city_id AND e.status='active'), (SELECT count(*) FROM public.company_job_advertisements j JOIN public.companies c ON c.id=j.company_id WHERE c.headquarters_city_id=p_city_id AND j.status='published'),
    0, (SELECT COALESCE(sum(net_pay_minor),0) FROM public.company_payroll_lines l JOIN public.company_payroll_batches b ON b.id=l.batch_id JOIN public.companies c ON c.id=b.company_id WHERE c.headquarters_city_id=p_city_id), (SELECT count(*) FROM public.gigs g JOIN public.venues v ON v.id=g.venue_id WHERE v.city_id=p_city_id), 0, COALESCE(acct.current_balance_minor,0), p.economic_trend
  ON CONFLICT(city_id,period_start,period_end) DO UPDATE SET treasury_balance_minor=EXCLUDED.treasury_balance_minor, created_at=timezone('utc',now()) RETURNING id INTO snap;
  RETURN snap;
END; $$;

CREATE OR REPLACE VIEW public.city_economy_public_view AS SELECT c.id city_id, c.name city_name, c.country country_code, p.primary_currency_code, p.population, p.city_scale, p.prosperity_index, public.city_index_label(p.prosperity_index) prosperity_label, p.cost_of_living_index, public.city_index_label(p.cost_of_living_index) cost_of_living_label, p.commercial_rent_index, p.residential_rent_index, p.wage_index, p.utility_cost_index, p.fuel_cost_index, p.accommodation_cost_index, p.transport_cost_index, p.consumer_spending_index, p.tourism_index, p.music_market_size, p.local_audience_demand, p.business_confidence_index, p.employment_index, p.infrastructure_quality_index, p.economic_trend, fa.current_balance_minor treasury_balance_minor FROM public.cities c JOIN public.city_economic_profiles p ON p.city_id=c.id LEFT JOIN public.city_treasury_profiles tp ON tp.city_id=c.id LEFT JOIN public.financial_accounts fa ON fa.id=tp.treasury_account_id AND tp.public_summary_enabled;
CREATE OR REPLACE VIEW public.city_economy_integrity_issues AS SELECT 'missing_economic_profile' issue_type, c.id::text subject_id FROM public.cities c LEFT JOIN public.city_economic_profiles p ON p.city_id=c.id WHERE p.city_id IS NULL UNION ALL SELECT 'missing_treasury_account', c.id::text FROM public.cities c LEFT JOIN public.city_treasury_profiles tp ON tp.city_id=c.id WHERE tp.city_id IS NULL UNION ALL SELECT 'invalid_index_values', city_id::text FROM public.city_economic_profiles WHERE NOT (prosperity_index BETWEEN 1 AND 250 AND cost_of_living_index BETWEEN 1 AND 250) UNION ALL SELECT 'expired_effect_still_active', id::text FROM public.city_temporary_effects WHERE status='active' AND ends_at < now() UNION ALL SELECT 'grant_payment_without_transaction', id::text FROM public.city_grant_awards WHERE status='paid' AND transaction_id IS NULL;

ALTER TABLE public.city_economic_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_treasury_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_budgets ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_genre_demands ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_temporary_effects ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_economic_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_grant_programmes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_grant_applications ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_grant_awards ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_licence_schedules ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_spending_initiatives ENABLE ROW LEVEL SECURITY; ALTER TABLE public.city_economic_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS city_economic_profiles_public_select ON public.city_economic_profiles;
DROP POLICY IF EXISTS city_treasury_profiles_public_select ON public.city_treasury_profiles;
DROP POLICY IF EXISTS city_budgets_public_select ON public.city_budgets;
DROP POLICY IF EXISTS city_genre_demands_public_select ON public.city_genre_demands;
DROP POLICY IF EXISTS city_temporary_effects_public_select ON public.city_temporary_effects;
DROP POLICY IF EXISTS city_economic_snapshots_public_select ON public.city_economic_snapshots;
DROP POLICY IF EXISTS city_grant_programmes_public_select ON public.city_grant_programmes;
CREATE POLICY city_economic_profiles_public_select ON public.city_economic_profiles FOR SELECT USING (true);
CREATE POLICY city_treasury_profiles_public_select ON public.city_treasury_profiles FOR SELECT USING (public_summary_enabled);
CREATE POLICY city_budgets_public_select ON public.city_budgets FOR SELECT USING (status IN ('active','closed','adjusted'));
CREATE POLICY city_genre_demands_public_select ON public.city_genre_demands FOR SELECT USING (true);
CREATE POLICY city_temporary_effects_public_select ON public.city_temporary_effects FOR SELECT USING (status IN ('active','scheduled'));
CREATE POLICY city_economic_snapshots_public_select ON public.city_economic_snapshots FOR SELECT USING (true);
CREATE POLICY city_grant_programmes_public_select ON public.city_grant_programmes FOR SELECT USING (status IN ('open','closed','exhausted'));

SELECT public.ensure_city_economy_foundations();
INSERT INTO public.city_licence_schedules(city_id, licence_type, company_type, operating_tier, base_amount_minor)
SELECT id, 'business', NULL, NULL, 2500 FROM public.cities ON CONFLICT DO NOTHING;
INSERT INTO public.city_genre_demands(city_id, genre_name, popularity_index, audience_size, competition_index)
SELECT c.id, g.genre, 85 + ((abs(hashtext(c.name || g.genre)) % 50)), GREATEST(1000, COALESCE(c.population,100000)/100), 80 + ((abs(hashtext(g.genre || c.name)) % 60))
FROM public.cities c CROSS JOIN (VALUES ('Rock'),('Pop'),('Metal'),('Electronic'),('Hip Hop'),('Indie')) AS g(genre) ON CONFLICT DO NOTHING;
