
-- Festival Ownership & Marketplace Expansion

-- 1. Extend festivals table
ALTER TABLE public.festivals
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'system' CHECK (owner_type IN ('system','player','company')),
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid,
  ADD COLUMN IF NOT EXISTS owner_company_id uuid,
  ADD COLUMN IF NOT EXISTS sale_status text NOT NULL DEFAULT 'not_for_sale' CHECK (sale_status IN ('not_for_sale','listed','sold')),
  ADD COLUMN IF NOT EXISTS list_price_cents bigint,
  ADD COLUMN IF NOT EXISTS treasury_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_operating_cost_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prestige_tier integer NOT NULL DEFAULT 1 CHECK (prestige_tier BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS next_edition_start date,
  ADD COLUMN IF NOT EXISTS edition_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_festivals_owner_profile ON public.festivals(owner_profile_id) WHERE owner_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_festivals_sale_status ON public.festivals(sale_status) WHERE sale_status = 'listed';

-- 2. Sale listings
CREATE TABLE IF NOT EXISTS public.festival_sale_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  listed_by_profile_id uuid,
  listed_by_type text NOT NULL DEFAULT 'system' CHECK (listed_by_type IN ('system','player')),
  asking_price_cents bigint NOT NULL,
  reserve_price_cents bigint,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  listed_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_sale_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_sale_listings TO authenticated;
GRANT ALL ON public.festival_sale_listings TO service_role;
ALTER TABLE public.festival_sale_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_listings_public_read" ON public.festival_sale_listings FOR SELECT USING (true);
CREATE POLICY "sale_listings_owner_manage" ON public.festival_sale_listings FOR ALL TO authenticated
  USING (listed_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (listed_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- 3. Purchase offers
CREATE TABLE IF NOT EXISTS public.festival_purchase_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.festival_sale_listings(id) ON DELETE SET NULL,
  buyer_profile_id uuid NOT NULL,
  offer_price_cents bigint NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn','expired')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_purchase_offers TO authenticated;
GRANT ALL ON public.festival_purchase_offers TO service_role;
ALTER TABLE public.festival_purchase_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_offers_visible" ON public.festival_purchase_offers FOR SELECT TO authenticated USING (
  buyer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "purchase_offers_buyer_manage" ON public.festival_purchase_offers FOR ALL TO authenticated
  USING (buyer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (buyer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- 4. Ownership history
CREATE TABLE IF NOT EXISTS public.festival_ownership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  from_owner_type text,
  from_owner_profile_id uuid,
  to_owner_type text NOT NULL,
  to_owner_profile_id uuid,
  price_paid_cents bigint,
  transfer_reason text,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_ownership_history TO anon, authenticated;
GRANT ALL ON public.festival_ownership_history TO service_role;
ALTER TABLE public.festival_ownership_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ownership_history_public_read" ON public.festival_ownership_history FOR SELECT USING (true);

-- 5. Festival staff
CREATE TABLE IF NOT EXISTS public.festival_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('promoter','booker','safety_officer','medic','sound_engineer','stage_manager','marketing_lead')),
  name text NOT NULL,
  skill_level integer NOT NULL DEFAULT 50 CHECK (skill_level BETWEEN 1 AND 100),
  weekly_wage_cents bigint NOT NULL DEFAULT 0,
  morale integer NOT NULL DEFAULT 70 CHECK (morale BETWEEN 0 AND 100),
  hired_at timestamptz NOT NULL DEFAULT now(),
  terminated_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_staff TO authenticated;
GRANT ALL ON public.festival_staff TO service_role;
ALTER TABLE public.festival_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "festival_staff_read" ON public.festival_staff FOR SELECT USING (true);
CREATE POLICY "festival_staff_owner_manage" ON public.festival_staff FOR ALL TO authenticated
  USING (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'));

-- 6. Insurance policies
CREATE TABLE IF NOT EXISTS public.festival_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  coverage_type text NOT NULL CHECK (coverage_type IN ('basic','standard','premium','all_risk')),
  premium_cents bigint NOT NULL,
  payout_ceiling_cents bigint NOT NULL,
  weather_rider boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_insurance_policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_insurance_policies TO authenticated;
GRANT ALL ON public.festival_insurance_policies TO service_role;
ALTER TABLE public.festival_insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_read" ON public.festival_insurance_policies FOR SELECT USING (true);
CREATE POLICY "insurance_owner_manage" ON public.festival_insurance_policies FOR ALL TO authenticated
  USING (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'));

-- 7. Permits
CREATE TABLE IF NOT EXISTS public.festival_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  city_id uuid,
  permit_type text NOT NULL DEFAULT 'event' CHECK (permit_type IN ('event','noise','alcohol','safety')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  permit_fee_cents bigint NOT NULL DEFAULT 0,
  safety_inspection_date date,
  approved_at timestamptz,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_permits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_permits TO authenticated;
GRANT ALL ON public.festival_permits TO service_role;
ALTER TABLE public.festival_permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permits_read" ON public.festival_permits FOR SELECT USING (true);
CREATE POLICY "permits_owner_manage" ON public.festival_permits FOR ALL TO authenticated
  USING (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.has_role(auth.uid(),'admin'));

-- 8. Expense ledger
CREATE TABLE IF NOT EXISTS public.festival_expense_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_number integer NOT NULL DEFAULT 1,
  category text NOT NULL CHECK (category IN ('staff_wages','security','permits','insurance','stage_rental','equipment_rental','marketing','artist_guarantee','artist_bonus','cleanup','tax','refund','sponsor_income','ticket_income','merch_income','fnb_income','other')),
  direction text NOT NULL CHECK (direction IN ('income','expense')),
  amount_cents bigint NOT NULL,
  description text,
  counterparty_type text,
  counterparty_id uuid,
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.festival_expense_ledger TO authenticated;
GRANT ALL ON public.festival_expense_ledger TO service_role;
CREATE INDEX IF NOT EXISTS idx_festival_ledger_festival_edition ON public.festival_expense_ledger(festival_id, edition_number);
ALTER TABLE public.festival_expense_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_visible" ON public.festival_expense_ledger FOR SELECT TO authenticated USING (
  festival_id IN (SELECT id FROM public.festivals WHERE owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin')
);

-- 9. Extend festival_finances with granular columns
ALTER TABLE public.festival_finances
  ADD COLUMN IF NOT EXISTS edition_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS staff_wages_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permit_fees_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_premium_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_rental_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipment_rental_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_spend_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artist_guarantees_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artist_bonuses_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_income_ga_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_income_vip_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merch_cut_income_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fnb_income_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleanup_cost_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_liability_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_paid_cents bigint NOT NULL DEFAULT 0;

-- 10. purchase_festival RPC
CREATE OR REPLACE FUNCTION public.purchase_festival(p_festival_id uuid, p_buyer_profile_id uuid, p_price_cents bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fest record;
  v_buyer_cash bigint;
BEGIN
  SELECT * INTO v_fest FROM public.festivals WHERE id = p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF v_fest.sale_status <> 'listed' THEN RAISE EXCEPTION 'Festival not for sale'; END IF;

  SELECT COALESCE(cash,0)*100 INTO v_buyer_cash FROM public.profiles WHERE id = p_buyer_profile_id;
  IF v_buyer_cash < p_price_cents THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  UPDATE public.profiles SET cash = cash - (p_price_cents/100)::numeric WHERE id = p_buyer_profile_id;

  INSERT INTO public.festival_ownership_history(festival_id, from_owner_type, from_owner_profile_id, to_owner_type, to_owner_profile_id, price_paid_cents, transfer_reason)
  VALUES (p_festival_id, v_fest.owner_type, v_fest.owner_profile_id, 'player', p_buyer_profile_id, p_price_cents, 'purchase');

  UPDATE public.festivals SET
    owner_type = 'player',
    owner_profile_id = p_buyer_profile_id,
    sale_status = 'sold',
    list_price_cents = NULL,
    updated_at = now()
  WHERE id = p_festival_id;

  UPDATE public.festival_sale_listings SET status='sold', closed_at=now(), updated_at=now()
  WHERE festival_id = p_festival_id AND status='active';

  RETURN jsonb_build_object('success', true, 'festival_id', p_festival_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_festival(uuid, uuid, bigint) TO authenticated;

-- 11. list_festival_for_sale RPC
CREATE OR REPLACE FUNCTION public.list_festival_for_sale(p_festival_id uuid, p_price_cents bigint, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fest record;
  v_owner_profile uuid;
  v_listing_id uuid;
BEGIN
  SELECT id INTO v_owner_profile FROM public.profiles WHERE user_id = auth.uid();
  SELECT * INTO v_fest FROM public.festivals WHERE id = p_festival_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival not found'; END IF;
  IF NOT (v_fest.owner_profile_id = v_owner_profile OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not the owner';
  END IF;

  UPDATE public.festivals SET sale_status='listed', list_price_cents=p_price_cents, updated_at=now() WHERE id=p_festival_id;

  INSERT INTO public.festival_sale_listings(festival_id, listed_by_profile_id, listed_by_type, asking_price_cents, notes)
  VALUES (p_festival_id, v_owner_profile, CASE WHEN v_fest.owner_type='system' THEN 'system' ELSE 'player' END, p_price_cents, p_notes)
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_festival_for_sale(uuid, bigint, text) TO authenticated;

-- 12. Trigger update timestamps
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_sale_listings_touch') THEN
    CREATE TRIGGER tg_festival_sale_listings_touch BEFORE UPDATE ON public.festival_sale_listings FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_purchase_offers_touch') THEN
    CREATE TRIGGER tg_festival_purchase_offers_touch BEFORE UPDATE ON public.festival_purchase_offers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_staff_touch') THEN
    CREATE TRIGGER tg_festival_staff_touch BEFORE UPDATE ON public.festival_staff FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_insurance_touch') THEN
    CREATE TRIGGER tg_festival_insurance_touch BEFORE UPDATE ON public.festival_insurance_policies FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tg_festival_permits_touch') THEN
    CREATE TRIGGER tg_festival_permits_touch BEFORE UPDATE ON public.festival_permits FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
  END IF;
END $$;
