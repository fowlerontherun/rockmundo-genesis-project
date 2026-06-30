
-- Phase 1: Company world-impact foundation

-- 1) Catalogue of company types (data-driven, lets us add new types without code enum changes)
CREATE TABLE IF NOT EXISTS public.company_type_definitions (
  type_key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'core',
  description text,
  icon text,
  color text,
  creation_cost numeric NOT NULL DEFAULT 250000,
  starting_balance numeric NOT NULL DEFAULT 500000,
  weekly_operating_costs numeric NOT NULL DEFAULT 2500,
  base_tax_rate numeric NOT NULL DEFAULT 0.20,
  serves_public boolean NOT NULL DEFAULT true,
  supports_shifts boolean NOT NULL DEFAULT true,
  demand_weight numeric NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_type_definitions TO anon, authenticated;
GRANT ALL ON public.company_type_definitions TO service_role;
ALTER TABLE public.company_type_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read company type definitions" ON public.company_type_definitions FOR SELECT USING (true);

INSERT INTO public.company_type_definitions (type_key, label, category, description, icon, color, creation_cost, starting_balance, weekly_operating_costs, base_tax_rate)
VALUES
 ('holding','Holding Company','core','Parent company that owns and manages subsidiaries','Building2','text-primary',500000,1000000,2500,0.25),
 ('label','Record Label','core','Sign artists, release music, manage royalties','Disc','text-purple-500',1000000,1000000,8000,0.22),
 ('security','Security Firm','core','Security services for concerts and events','Shield','text-blue-500',250000,500000,3500,0.20),
 ('factory','Merchandise Factory','core','Manufacture merchandise for bands','Factory','text-orange-500',500000,750000,6000,0.18),
 ('logistics','Logistics Company','core','Transport equipment and merchandise','Truck','text-cyan-500',300000,500000,4500,0.20),
 ('venue','Venue','core','Own and operate performance venues','Building','text-green-500',750000,1000000,7000,0.22),
 ('rehearsal','Rehearsal Studio','core','Rent practice space to bands','Music','text-amber-500',200000,300000,2000,0.15),
 ('recording_studio','Recording Studio','core','Professional recording facilities','Mic2','text-rose-500',400000,600000,5000,0.18)
ON CONFLICT (type_key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

-- 2) Public storefront registry — every company surfaces with quality/price/rating
CREATE TABLE IF NOT EXISTS public.company_storefront (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT true,
  tagline text,
  price_tier smallint NOT NULL DEFAULT 3 CHECK (price_tier BETWEEN 1 AND 5),
  quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  capacity integer NOT NULL DEFAULT 100,
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  market_share numeric NOT NULL DEFAULT 0,
  total_customers_week integer NOT NULL DEFAULT 0,
  total_revenue_week numeric NOT NULL DEFAULT 0,
  now_hiring boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_storefront TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_storefront TO authenticated;
GRANT ALL ON public.company_storefront TO service_role;
ALTER TABLE public.company_storefront ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view storefronts" ON public.company_storefront FOR SELECT USING (true);
CREATE POLICY "Owners manage storefront" ON public.company_storefront FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_storefront.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_storefront.company_id AND c.owner_id = auth.uid()));

-- 3) Player reviews of public companies
CREATE TABLE IF NOT EXISTS public.company_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reviewer_profile_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, reviewer_profile_id)
);
GRANT SELECT ON public.company_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;
ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON public.company_reviews FOR SELECT USING (true);
CREATE POLICY "Players write own reviews" ON public.company_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reviewer_profile_id AND p.user_id = auth.uid())
);
CREATE POLICY "Players update own reviews" ON public.company_reviews FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reviewer_profile_id AND p.user_id = auth.uid())
);
CREATE POLICY "Players delete own reviews" ON public.company_reviews FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reviewer_profile_id AND p.user_id = auth.uid())
);

-- 4) Shift work: owners post shifts, players clock in for cash + XP
CREATE TABLE IF NOT EXISTS public.company_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  description text,
  wage_per_hour numeric NOT NULL DEFAULT 25,
  duration_hours integer NOT NULL DEFAULT 4 CHECK (duration_hours BETWEEN 1 AND 12),
  required_skill text,
  min_skill_level integer NOT NULL DEFAULT 0,
  slots_total integer NOT NULL DEFAULT 1,
  slots_filled integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_shifts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_shifts TO authenticated;
GRANT ALL ON public.company_shifts TO service_role;
ALTER TABLE public.company_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can browse shifts" ON public.company_shifts FOR SELECT USING (true);
CREATE POLICY "Owners manage shifts" ON public.company_shifts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_shifts.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_shifts.company_id AND c.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.company_shift_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.company_shifts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  paid_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'claimed',
  UNIQUE (shift_id, profile_id)
);
GRANT SELECT ON public.company_shift_claims TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_shift_claims TO authenticated;
GRANT ALL ON public.company_shift_claims TO service_role;
ALTER TABLE public.company_shift_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers and owners view claims" ON public.company_shift_claims FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_shifts s JOIN public.companies c ON c.id = s.company_id WHERE s.id = shift_id AND c.owner_id = auth.uid())
);
CREATE POLICY "Players claim shifts" ON public.company_shift_claims FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
);
CREATE POLICY "Players or owners update claim" ON public.company_shift_claims FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_shifts s JOIN public.companies c ON c.id = s.company_id WHERE s.id = shift_id AND c.owner_id = auth.uid())
);

-- 5) City tax payment log (companies feed city treasury)
CREATE TABLE IF NOT EXISTS public.company_city_tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  tax_rate numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_city_tax_payments TO authenticated;
GRANT ALL ON public.company_city_tax_payments TO service_role;
ALTER TABLE public.company_city_tax_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read company tax payments" ON public.company_city_tax_payments FOR SELECT USING (true);

-- 6) Daily demand allocation (Popmundo-style: rep * quality / price * city pop)
CREATE TABLE IF NOT EXISTS public.company_demand_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  resolved_for date NOT NULL,
  customers integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  demand_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, resolved_for)
);
GRANT SELECT ON public.company_demand_log TO authenticated;
GRANT ALL ON public.company_demand_log TO service_role;
ALTER TABLE public.company_demand_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read demand log" ON public.company_demand_log FOR SELECT USING (true);

-- 7) Updated_at trigger reuse
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_storefront_updated_at ON public.company_storefront;
CREATE TRIGGER trg_storefront_updated_at BEFORE UPDATE ON public.company_storefront FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.company_shifts;
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.company_shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_company_type_def_updated_at ON public.company_type_definitions;
CREATE TRIGGER trg_company_type_def_updated_at BEFORE UPDATE ON public.company_type_definitions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8) Auto-create storefront row when a new company is created
CREATE OR REPLACE FUNCTION public.bootstrap_company_storefront() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_storefront (company_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_bootstrap_storefront ON public.companies;
CREATE TRIGGER trg_bootstrap_storefront AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.bootstrap_company_storefront();

-- Backfill existing companies
INSERT INTO public.company_storefront (company_id)
SELECT id FROM public.companies ON CONFLICT DO NOTHING;

-- 9) Aggregate review trigger
CREATE OR REPLACE FUNCTION public.refresh_company_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  cid := COALESCE(NEW.company_id, OLD.company_id);
  UPDATE public.company_storefront s SET
    rating_avg = COALESCE((SELECT AVG(rating)::numeric(5,2) FROM public.company_reviews WHERE company_id = cid), 0),
    rating_count = (SELECT COUNT(*) FROM public.company_reviews WHERE company_id = cid)
  WHERE s.company_id = cid;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_review_rating ON public.company_reviews;
CREATE TRIGGER trg_review_rating AFTER INSERT OR UPDATE OR DELETE ON public.company_reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_company_rating();

-- 10) Demand resolver — call daily via cron (separate insert)
CREATE OR REPLACE FUNCTION public.resolve_company_demand(target_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  processed integer := 0;
  r record;
  city_pop integer;
  base_customers integer;
  price_mult numeric;
  rev numeric;
  tax_rate numeric;
  tax_amount numeric;
BEGIN
  FOR r IN
    SELECT c.id, c.headquarters_city_id, c.company_type, c.reputation_score, s.quality_score, s.price_tier, s.capacity
    FROM public.companies c
    JOIN public.company_storefront s ON s.company_id = c.id
    WHERE c.is_bankrupt = false AND c.status = 'active' AND s.is_public = true
  LOOP
    SELECT COALESCE(population, 50000) INTO city_pop FROM public.cities WHERE id = r.headquarters_city_id;
    IF city_pop IS NULL THEN city_pop := 50000; END IF;
    price_mult := CASE r.price_tier WHEN 1 THEN 1.6 WHEN 2 THEN 1.3 WHEN 3 THEN 1.0 WHEN 4 THEN 0.75 WHEN 5 THEN 0.5 ELSE 1.0 END;
    base_customers := GREATEST(0, FLOOR((city_pop / 10000.0) * ((COALESCE(r.reputation_score,50) + COALESCE(r.quality_score,50)) / 100.0) * price_mult))::int;
    base_customers := LEAST(base_customers, COALESCE(r.capacity, 100) * 10);
    rev := base_customers * (CASE r.price_tier WHEN 1 THEN 18 WHEN 2 THEN 12 WHEN 3 THEN 8 WHEN 4 THEN 5 WHEN 5 THEN 3 ELSE 8 END);

    INSERT INTO public.company_demand_log (company_id, resolved_for, customers, revenue, demand_score)
    VALUES (r.id, target_date, base_customers, rev, (COALESCE(r.reputation_score,50) + COALESCE(r.quality_score,50)) * price_mult)
    ON CONFLICT (company_id, resolved_for) DO UPDATE SET customers = EXCLUDED.customers, revenue = EXCLUDED.revenue, demand_score = EXCLUDED.demand_score;

    UPDATE public.companies SET balance = balance + rev WHERE id = r.id;

    -- City tax 5% of daily revenue
    IF r.headquarters_city_id IS NOT NULL AND rev > 0 THEN
      SELECT COALESCE(base_tax_rate, 0.20) INTO tax_rate FROM public.company_type_definitions WHERE type_key = r.company_type;
      tax_amount := ROUND(rev * 0.05, 2);
      INSERT INTO public.company_city_tax_payments (company_id, city_id, amount, tax_rate, period_start, period_end)
      VALUES (r.id, r.headquarters_city_id, tax_amount, COALESCE(tax_rate,0.20), target_date, target_date);
      UPDATE public.city_treasury SET balance = COALESCE(balance,0) + tax_amount, updated_at = now() WHERE city_id = r.headquarters_city_id;
      INSERT INTO public.city_treasury_ledger (city_id, amount, transaction_type, description)
      VALUES (r.headquarters_city_id, tax_amount, 'tax_income', 'Corporate tax: ' || r.company_type)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Roll weekly counters on storefront
    UPDATE public.company_storefront SET
      total_customers_week = total_customers_week + base_customers,
      total_revenue_week = total_revenue_week + rev,
      updated_at = now()
    WHERE company_id = r.id;

    processed := processed + 1;
  END LOOP;
  RETURN processed;
END; $$;

GRANT EXECUTE ON FUNCTION public.resolve_company_demand(date) TO authenticated, service_role;
