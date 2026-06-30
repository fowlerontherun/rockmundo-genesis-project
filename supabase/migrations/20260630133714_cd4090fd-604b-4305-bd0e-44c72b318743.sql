
-- Advertising columns on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS advertised_until timestamptz,
  ADD COLUMN IF NOT EXISTS advertise_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advertise_total_spent numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_jobs_company_active ON public.jobs(company_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_advertised ON public.jobs(advertised_until) WHERE advertised_until IS NOT NULL;

-- NPC staff slot count on companies (owners can buy NPCs to fill empty roles)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS npc_staff_count integer NOT NULL DEFAULT 0;

-- Player vs NPC staff bonus helper
CREATE OR REPLACE FUNCTION public.apply_player_staff_bonus(p_company_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  player_count integer;
  npc_count integer;
  bonus numeric;
BEGIN
  SELECT COUNT(*) INTO player_count FROM public.company_employees
   WHERE company_id = p_company_id AND status = 'active';
  SELECT COALESCE(npc_staff_count, 0) INTO npc_count FROM public.companies WHERE id = p_company_id;

  -- +4% per active player employee, capped at +40%
  bonus := 1.0 + LEAST(player_count, 10) * 0.04;
  -- penalty when the company has no players and is running on NPC staff only
  IF player_count = 0 AND npc_count > 0 THEN
    bonus := bonus * 0.90;
  END IF;
  RETURN bonus;
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_player_staff_bonus(uuid) TO authenticated, service_role;

-- Trigger: keep storefront.now_hiring in sync with active jobs
CREATE OR REPLACE FUNCTION public.sync_storefront_hiring() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  cid := COALESCE(NEW.company_id, OLD.company_id);
  IF cid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.company_storefront
     SET now_hiring = EXISTS (
       SELECT 1 FROM public.jobs j
        WHERE j.company_id = cid AND j.is_active = true
          AND (j.max_employees IS NULL OR COALESCE(j.current_employees,0) < j.max_employees)
     ),
     updated_at = now()
   WHERE company_id = cid;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_sync_storefront_hiring ON public.jobs;
CREATE TRIGGER trg_sync_storefront_hiring
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_storefront_hiring();

-- Backfill now_hiring flags once
UPDATE public.company_storefront s SET now_hiring = EXISTS (
  SELECT 1 FROM public.jobs j WHERE j.company_id = s.company_id AND j.is_active = true
);

-- Replace demand resolver to apply player staff bonus
CREATE OR REPLACE FUNCTION public.resolve_company_demand(target_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  processed integer := 0;
  r record;
  city_pop integer;
  base_customers integer;
  price_mult numeric;
  staff_mult numeric;
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

    price_mult := CASE r.price_tier WHEN 1 THEN 1.6 WHEN 2 THEN 1.3 WHEN 3 THEN 1.0 WHEN 4 THEN 0.75 WHEN 5 THEN 0.5 ELSE 1.0 END;
    staff_mult := public.apply_player_staff_bonus(r.id);

    base_customers := GREATEST(0, FLOOR(
      (city_pop / 10000.0)
      * ((COALESCE(r.reputation_score, 50) + COALESCE(r.quality_score, 50)) / 100.0)
      * price_mult * staff_mult
    ))::int;
    base_customers := LEAST(base_customers, COALESCE(r.capacity, 100) * 10);

    rev := base_customers * (CASE r.price_tier WHEN 1 THEN 18 WHEN 2 THEN 12 WHEN 3 THEN 8 WHEN 4 THEN 5 WHEN 5 THEN 3 ELSE 8 END);

    INSERT INTO public.company_demand_log (company_id, resolved_for, customers, revenue, demand_score)
    VALUES (r.id, target_date, base_customers, rev,
            (COALESCE(r.reputation_score,50) + COALESCE(r.quality_score,50)) * price_mult * staff_mult)
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

-- RPC to advertise/boost a job for N days ($500/day from company balance)
CREATE OR REPLACE FUNCTION public.advertise_job(p_job_id uuid, p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j record;
  c record;
  cost numeric;
  new_until timestamptz;
BEGIN
  SELECT id, company_id, advertised_until INTO j FROM public.jobs WHERE id = p_job_id;
  IF j.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF j.company_id IS NULL THEN RAISE EXCEPTION 'Only company-owned jobs can be advertised'; END IF;

  SELECT id, owner_id, balance INTO c FROM public.companies WHERE id = j.company_id;
  IF c.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Only the owner can advertise this job'; END IF;
  IF p_days < 1 OR p_days > 30 THEN RAISE EXCEPTION 'Days must be 1-30'; END IF;

  cost := p_days * 500;
  IF c.balance < cost THEN RAISE EXCEPTION 'Insufficient company balance ($% required)', cost; END IF;

  new_until := GREATEST(COALESCE(j.advertised_until, now()), now()) + (p_days || ' days')::interval;

  UPDATE public.companies SET balance = balance - cost WHERE id = c.id;
  UPDATE public.jobs SET
    advertised_until = new_until,
    advertise_priority = advertise_priority + p_days,
    advertise_total_spent = advertise_total_spent + cost,
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.company_transactions (company_id, transaction_type, amount, description, category)
  VALUES (c.id, 'expense', cost, 'Job advertisement ('||p_days||' days)', 'operations');

  RETURN jsonb_build_object('cost', cost, 'advertised_until', new_until);
END; $$;
GRANT EXECUTE ON FUNCTION public.advertise_job(uuid, integer) TO authenticated;
