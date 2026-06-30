
-- ============================================================
-- PHASE 2 + 3: Catalogue 20 new company types (data-driven)
-- ============================================================
INSERT INTO public.company_type_definitions
  (type_key, label, category, description, icon, color, creation_cost, starting_balance, weekly_operating_costs, base_tax_rate, demand_weight)
VALUES
  ('bar',                'Bar / Pub',            'nightlife', 'Sells drinks; can host open-mic nights', 'Beer',          'text-amber-500',  150000, 250000, 2500, 0.18, 1.2),
  ('restaurant',         'Restaurant',           'nightlife', 'Meals restore wellness energy',          'UtensilsCrossed','text-orange-500',300000, 400000, 4000, 0.18, 1.1),
  ('clothing_store',     'Clothing Store',       'retail',    'Retails player-designed fashion',        'Shirt',         'text-pink-500',   200000, 300000, 2500, 0.20, 1.0),
  ('hotel',              'Hotel',                'lifestyle', 'Books rooms for touring bands',          'BedDouble',     'text-indigo-500', 800000, 1000000,8500, 0.22, 1.0),
  ('hair_salon',         'Hair Salon',           'services',  'Modifies avatar look + charisma buff',   'Scissors',      'text-rose-500',   100000, 150000, 1500, 0.15, 0.8),
  ('tattoo_parlour',     'Tattoo Parlour',       'services',  'Custom tattoo designs and ink work',     'Stamp',         'text-purple-600', 150000, 200000, 2000, 0.15, 0.9),
  ('gym',                'Gym',                  'services',  'Wellness fitness gains',                 'Dumbbell',      'text-emerald-500',200000, 300000, 2500, 0.17, 1.0),
  ('clinic',             'Clinic',               'services',  'Treats ailments faster than public hospitals','Stethoscope','text-red-500',  400000, 500000, 5000, 0.18, 1.0),
  ('newspaper',          'Newspaper',            'media',     'Publish articles, run ads, sway elections','Newspaper',   'text-slate-500',  500000, 600000, 5500, 0.20, 1.1),
  ('radio_station',      'Radio Station',        'media',     'Airplay influences charts',              'Radio',         'text-blue-600',   600000, 700000, 6000, 0.20, 1.2),
  ('magazine_publisher', 'Magazine',             'media',     'Print + digital music coverage',         'BookOpen',      'text-violet-500', 400000, 500000, 4500, 0.20, 1.0),
  ('podcast_network',    'Podcast Network',      'media',     'Streams interviews and music shows',     'Mic',           'text-fuchsia-500',300000, 400000, 3500, 0.18, 1.0),
  ('instrument_shop',    'Instrument Shop',      'retail',    'Retails gear from the equipment catalog','Guitar',        'text-amber-600',  300000, 400000, 3000, 0.18, 1.1),
  ('taxi',               'Taxi Company',         'logistics', 'Short-haul travel inside cities',        'CarTaxiFront',  'text-yellow-500', 150000, 200000, 2000, 0.18, 0.9),
  ('real_estate',        'Real Estate Agency',   'services',  'Brokers properties and housing',         'Home',          'text-teal-500',   400000, 500000, 4000, 0.20, 0.9),
  ('modelling_agency',   'Modelling Agency',     'media',     'Books models for gigs and shoots',       'Sparkles',      'text-pink-400',   300000, 400000, 3500, 0.20, 1.0),
  ('music_school',       'Music School',         'services',  'Paid lessons that grant skill XP',       'GraduationCap', 'text-sky-500',    250000, 350000, 3000, 0.15, 1.0),
  ('casino',             'Casino',               'nightlife', 'Gambling tables and slot machines',      'Dices',         'text-yellow-600', 1500000,2000000,15000,0.25, 1.4),
  ('crypto_exchange',    'Crypto Exchange',      'finance',   'Fees on every token trade',              'CircleDollarSign','text-emerald-600',800000,1000000,7500, 0.22, 1.1),
  ('pr_agency',          'PR Agency',            'services',  'Sells PR campaigns to bands',            'Megaphone',     'text-orange-600', 250000, 350000, 3000, 0.20, 1.0),
  ('talent_agency',      'Talent Agency',        'services',  'Books gigs/film/tv for a commission cut','Briefcase',     'text-cyan-600',   350000, 450000, 4000, 0.20, 1.0)
ON CONFLICT (type_key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description,
  icon = EXCLUDED.icon, color = EXCLUDED.color, demand_weight = EXCLUDED.demand_weight;

-- ============================================================
-- PHASE 3: Generic inventory + service menu for all company types
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  description text,
  category text,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  restock_level integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_inventory TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_inventory TO authenticated;
GRANT ALL ON public.company_inventory TO service_role;
ALTER TABLE public.company_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads inventory" ON public.company_inventory FOR SELECT USING (true);
CREATE POLICY "Owners manage inventory" ON public.company_inventory FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_inventory.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_inventory.company_id AND c.owner_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_inv_updated ON public.company_inventory;
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.company_inventory FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.company_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  price numeric NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30,
  quality_tier smallint NOT NULL DEFAULT 3 CHECK (quality_tier BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_services TO authenticated;
GRANT ALL ON public.company_services TO service_role;
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads services" ON public.company_services FOR SELECT USING (true);
CREATE POLICY "Owners manage services" ON public.company_services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_services.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_services.company_id AND c.owner_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_svc_updated ON public.company_services;
CREATE TRIGGER trg_svc_updated BEFORE UPDATE ON public.company_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- PHASE 4: Shareholders + dividends
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS shares_outstanding integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS share_price numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_publicly_traded boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.company_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  holder_profile_id uuid NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  avg_buy_price numeric NOT NULL DEFAULT 0,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, holder_profile_id)
);
GRANT SELECT ON public.company_shares TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_shares TO authenticated;
GRANT ALL ON public.company_shares TO service_role;
ALTER TABLE public.company_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads shareholders" ON public.company_shares FOR SELECT USING (true);
CREATE POLICY "Holder or owner manages shares" ON public.company_shares FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = holder_profile_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = holder_profile_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  );
DROP TRIGGER IF EXISTS trg_shares_updated ON public.company_shares;
CREATE TRIGGER trg_shares_updated BEFORE UPDATE ON public.company_shares FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.company_dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  per_share numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT ON public.company_dividends TO anon, authenticated;
GRANT ALL ON public.company_dividends TO service_role;
ALTER TABLE public.company_dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read dividends" ON public.company_dividends FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.pay_company_dividends(p_company_id uuid, p_total numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  total_shares integer;
  per_share numeric;
  s record;
  payout numeric;
BEGIN
  SELECT id, owner_id, balance, shares_outstanding INTO c FROM public.companies WHERE id = p_company_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;
  IF c.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Only the owner can declare dividends'; END IF;
  IF c.balance < p_total THEN RAISE EXCEPTION 'Insufficient company balance'; END IF;

  SELECT COALESCE(SUM(shares), 0) INTO total_shares FROM public.company_shares WHERE company_id = p_company_id;
  IF total_shares = 0 THEN RAISE EXCEPTION 'No outstanding shareholders'; END IF;

  per_share := ROUND(p_total / total_shares, 4);
  UPDATE public.companies SET balance = balance - p_total WHERE id = p_company_id;

  INSERT INTO public.company_dividends (company_id, total_amount, per_share)
  VALUES (p_company_id, p_total, per_share);

  FOR s IN SELECT cs.holder_profile_id, cs.shares, p.user_id
             FROM public.company_shares cs JOIN public.profiles p ON p.id = cs.holder_profile_id
            WHERE cs.company_id = p_company_id
  LOOP
    payout := ROUND(per_share * s.shares, 2);
    -- credit profile cash if column exists
    BEGIN
      UPDATE public.profiles SET cash = COALESCE(cash, 0) + payout WHERE id = s.holder_profile_id;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('total', p_total, 'per_share', per_share, 'shares', total_shares);
END; $$;
GRANT EXECUTE ON FUNCTION public.pay_company_dividends(uuid, numeric) TO authenticated;

-- ============================================================
-- PHASE 4: Company news / milestone log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  headline text NOT NULL,
  body text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_news_events TO anon, authenticated;
GRANT ALL ON public.company_news_events TO service_role;
ALTER TABLE public.company_news_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads company news" ON public.company_news_events FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.log_company_bankruptcy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_bankrupt = true AND COALESCE(OLD.is_bankrupt, false) = false THEN
    INSERT INTO public.company_news_events (company_id, event_type, headline, body)
    VALUES (NEW.id, 'bankruptcy', NEW.name || ' files for bankruptcy', 'Operations suspended pending restructuring.');
  ELSIF NEW.is_bankrupt = false AND COALESCE(OLD.is_bankrupt, false) = true THEN
    INSERT INTO public.company_news_events (company_id, event_type, headline, body)
    VALUES (NEW.id, 'recovery', NEW.name || ' emerges from bankruptcy', 'Trading resumes.');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_log_bankruptcy ON public.companies;
CREATE TRIGGER trg_log_bankruptcy AFTER UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_company_bankruptcy();

-- ============================================================
-- PHASE 4: Mayor law modifier + wire into demand resolver
-- ============================================================
CREATE OR REPLACE FUNCTION public.mayor_company_modifier(p_city_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  law record;
  modifier numeric := 1.0;
BEGIN
  IF p_city_id IS NULL THEN RETURN 1.0; END IF;
  SELECT sales_tax_rate, community_events_funding INTO law FROM public.city_laws
    WHERE city_id = p_city_id
      AND (effective_until IS NULL OR effective_until > now())
    ORDER BY effective_from DESC NULLS LAST LIMIT 1;
  IF law IS NULL THEN RETURN 1.0; END IF;
  -- Higher sales tax dampens consumer spending; community funding lifts it
  modifier := modifier * (1 - COALESCE(law.sales_tax_rate, 0) * 0.5);
  modifier := modifier * (1 + LEAST(COALESCE(law.community_events_funding, 0) / 1000000.0, 0.15));
  RETURN GREATEST(0.4, LEAST(modifier, 1.4));
END; $$;
GRANT EXECUTE ON FUNCTION public.mayor_company_modifier(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_company_demand(target_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  processed integer := 0;
  r record;
  city_pop integer;
  base_customers integer;
  price_mult numeric;
  staff_mult numeric;
  law_mult numeric;
  type_weight numeric;
  rev numeric;
  tax_rate numeric;
  tax_amount numeric;
BEGIN
  FOR r IN
    SELECT c.id, c.headquarters_city_id, c.company_type, c.reputation_score,
           s.quality_score, s.price_tier, s.capacity
      FROM public.companies c
      JOIN public.company_storefront s ON s.company_id = c.id
     WHERE c.is_bankrupt = false AND c.status = 'active' AND s.is_public = true
  LOOP
    SELECT COALESCE(population, 50000) INTO city_pop FROM public.cities WHERE id = r.headquarters_city_id;
    IF city_pop IS NULL THEN city_pop := 50000; END IF;

    SELECT COALESCE(demand_weight, 1.0) INTO type_weight FROM public.company_type_definitions WHERE type_key = r.company_type;
    IF type_weight IS NULL THEN type_weight := 1.0; END IF;

    price_mult := CASE r.price_tier WHEN 1 THEN 1.6 WHEN 2 THEN 1.3 WHEN 3 THEN 1.0 WHEN 4 THEN 0.75 WHEN 5 THEN 0.5 ELSE 1.0 END;
    staff_mult := public.apply_player_staff_bonus(r.id);
    law_mult   := public.mayor_company_modifier(r.headquarters_city_id);

    base_customers := GREATEST(0, FLOOR(
      (city_pop / 10000.0)
      * ((COALESCE(r.reputation_score, 50) + COALESCE(r.quality_score, 50)) / 100.0)
      * price_mult * staff_mult * law_mult * type_weight
    ))::int;
    base_customers := LEAST(base_customers, COALESCE(r.capacity, 100) * 10);

    rev := base_customers * (CASE r.price_tier WHEN 1 THEN 18 WHEN 2 THEN 12 WHEN 3 THEN 8 WHEN 4 THEN 5 WHEN 5 THEN 3 ELSE 8 END);

    INSERT INTO public.company_demand_log (company_id, resolved_for, customers, revenue, demand_score)
    VALUES (r.id, target_date, base_customers, rev,
            (COALESCE(r.reputation_score,50) + COALESCE(r.quality_score,50)) * price_mult * staff_mult * law_mult * type_weight)
    ON CONFLICT (company_id, resolved_for) DO UPDATE
      SET customers = EXCLUDED.customers, revenue = EXCLUDED.revenue, demand_score = EXCLUDED.demand_score;

    UPDATE public.companies SET balance = balance + rev WHERE id = r.id;

    IF r.headquarters_city_id IS NOT NULL AND rev > 0 THEN
      SELECT COALESCE(base_tax_rate, 0.20) INTO tax_rate FROM public.company_type_definitions WHERE type_key = r.company_type;
      tax_amount := ROUND(rev * 0.05, 2);
      INSERT INTO public.company_city_tax_payments (company_id, city_id, amount, tax_rate, period_start, period_end)
      VALUES (r.id, r.headquarters_city_id, tax_amount, COALESCE(tax_rate, 0.20), target_date, target_date);
      UPDATE public.city_treasury
         SET balance = COALESCE(balance, 0) + tax_amount, updated_at = now()
       WHERE city_id = r.headquarters_city_id;
      INSERT INTO public.city_treasury_ledger (city_id, amount, transaction_type, description)
      VALUES (r.headquarters_city_id, tax_amount, 'tax_income', 'Corporate tax: ' || r.company_type)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.company_storefront
       SET total_customers_week = total_customers_week + base_customers,
           total_revenue_week = total_revenue_week + rev,
           updated_at = now()
     WHERE company_id = r.id;

    processed := processed + 1;
  END LOOP;
  RETURN processed;
END; $$;
