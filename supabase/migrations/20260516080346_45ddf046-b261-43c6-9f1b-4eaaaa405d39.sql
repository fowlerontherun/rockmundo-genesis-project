
-- Helper: check if current user has access to a band (member of band)
CREATE OR REPLACE FUNCTION public.user_has_band_access(_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = _band_id AND p.user_id = auth.uid()
  )
$$;

-- merch_variants ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchandise_id uuid NOT NULL REFERENCES public.player_merchandise(id) ON DELETE CASCADE,
  sku text,
  size text,
  color text,
  stock_quantity integer NOT NULL DEFAULT 0,
  cost_to_produce_override integer,
  selling_price_override integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merch_variants_merch ON public.merch_variants(merchandise_id);
ALTER TABLE public.merch_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage variants" ON public.merch_variants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_merchandise pm
      WHERE pm.id = merch_variants.merchandise_id
        AND public.user_has_band_access(pm.band_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_merchandise pm
      WHERE pm.id = merch_variants.merchandise_id
        AND public.user_has_band_access(pm.band_id)
    )
  );

CREATE POLICY "Admins view variants" ON public.merch_variants
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- merch_warehouses ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  city_id uuid,
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 1000,
  storage_cost_daily numeric NOT NULL DEFAULT 5,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merch_warehouses_band ON public.merch_warehouses(band_id);
ALTER TABLE public.merch_warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage warehouses" ON public.merch_warehouses
  FOR ALL TO authenticated
  USING (public.user_has_band_access(band_id))
  WITH CHECK (public.user_has_band_access(band_id));

CREATE POLICY "Admins view warehouses" ON public.merch_warehouses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- merch_warehouse_stock ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.merch_warehouses(id) ON DELETE CASCADE,
  merchandise_id uuid NOT NULL REFERENCES public.player_merchandise(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.merch_variants(id) ON DELETE CASCADE,
  stock integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, merchandise_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_wh ON public.merch_warehouse_stock(warehouse_id);
ALTER TABLE public.merch_warehouse_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage warehouse stock" ON public.merch_warehouse_stock
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merch_warehouses w
      WHERE w.id = merch_warehouse_stock.warehouse_id
        AND public.user_has_band_access(w.band_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merch_warehouses w
      WHERE w.id = merch_warehouse_stock.warehouse_id
        AND public.user_has_band_access(w.band_id)
    )
  );

-- merch_price_rules --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  merchandise_id uuid REFERENCES public.player_merchandise(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('qty_break','fan_tier','country','sale_window','promo_code')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_pct numeric NOT NULL DEFAULT 0,
  promo_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_rules_band ON public.merch_price_rules(band_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_merch ON public.merch_price_rules(merchandise_id);
ALTER TABLE public.merch_price_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage price rules" ON public.merch_price_rules
  FOR ALL TO authenticated
  USING (public.user_has_band_access(band_id))
  WITH CHECK (public.user_has_band_access(band_id));

-- merch_bundles ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  bundle_price integer NOT NULL,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundles_band ON public.merch_bundles(band_id);
ALTER TABLE public.merch_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage bundles" ON public.merch_bundles
  FOR ALL TO authenticated
  USING (public.user_has_band_access(band_id))
  WITH CHECK (public.user_has_band_access(band_id));

-- merch_wholesale_orders ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_wholesale_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  merchandise_id uuid REFERENCES public.player_merchandise(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.merch_variants(id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  country text,
  total_quantity integer NOT NULL,
  unit_price integer NOT NULL,
  total_price integer NOT NULL,
  discount_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','cancelled')),
  lead_time_days integer NOT NULL DEFAULT 7,
  fulfill_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wholesale_band ON public.merch_wholesale_orders(band_id);
ALTER TABLE public.merch_wholesale_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage wholesale" ON public.merch_wholesale_orders
  FOR ALL TO authenticated
  USING (public.user_has_band_access(band_id))
  WITH CHECK (public.user_has_band_access(band_id));

CREATE POLICY "Admins view wholesale" ON public.merch_wholesale_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- merch_stock_transfers ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.merch_warehouses(id) ON DELETE CASCADE,
  to_warehouse_id uuid NOT NULL REFERENCES public.merch_warehouses(id) ON DELETE CASCADE,
  merchandise_id uuid NOT NULL REFERENCES public.player_merchandise(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.merch_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  cost integer NOT NULL DEFAULT 0,
  eta timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfers_band ON public.merch_stock_transfers(band_id);
ALTER TABLE public.merch_stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members manage transfers" ON public.merch_stock_transfers
  FOR ALL TO authenticated
  USING (public.user_has_band_access(band_id))
  WITH CHECK (public.user_has_band_access(band_id));

-- merch_stockout_events ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merch_stockout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL,
  merchandise_id uuid REFERENCES public.player_merchandise(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.merch_variants(id) ON DELETE SET NULL,
  channel text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stockout_band_time ON public.merch_stockout_events(band_id, occurred_at DESC);
ALTER TABLE public.merch_stockout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members view stockouts" ON public.merch_stockout_events
  FOR SELECT TO authenticated
  USING (public.user_has_band_access(band_id));

CREATE POLICY "Service inserts stockouts" ON public.merch_stockout_events
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_band_access(band_id));

-- player_merchandise extensions --------------------------------------------
ALTER TABLE public.player_merchandise
  ADD COLUMN IF NOT EXISTS drop_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS superfan_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_id uuid,
  ADD COLUMN IF NOT EXISTS channel_split jsonb NOT NULL DEFAULT '{"online":50,"gig":40,"wholesale":10}'::jsonb;

-- merch_orders extensions --------------------------------------------------
ALTER TABLE public.merch_orders
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.merch_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.merch_bundles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS city_id uuid;

-- updated_at trigger for merch_variants ------------------------------------
CREATE TRIGGER trg_merch_variants_updated_at
  BEFORE UPDATE ON public.merch_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
