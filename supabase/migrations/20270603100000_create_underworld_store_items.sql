-- Create enums for store item rarity and availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'underworld_item_rarity'
  ) THEN
    CREATE TYPE public.underworld_item_rarity AS ENUM (
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'underworld_item_availability'
  ) THEN
    CREATE TYPE public.underworld_item_availability AS ENUM (
      'in_stock',
      'limited',
      'restocking',
      'special_order'
    );
  END IF;
END;
$$;

-- Create table to manage Underworld store items
CREATE TABLE IF NOT EXISTS public.underworld_store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  rarity public.underworld_item_rarity NOT NULL DEFAULT 'common',
  price_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
  price_currency text NOT NULL DEFAULT 'SCL',
  availability public.underworld_item_availability NOT NULL DEFAULT 'special_order',
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS underworld_store_items_sort_order_idx
  ON public.underworld_store_items (sort_order, name);

CREATE INDEX IF NOT EXISTS underworld_store_items_active_idx
  ON public.underworld_store_items (is_active) WHERE is_active = true;

ALTER TABLE public.underworld_store_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Underworld store items are viewable by everyone" ON public.underworld_store_items;
CREATE POLICY "Underworld store items are viewable by everyone"
  ON public.underworld_store_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage underworld store" ON public.underworld_store_items;
CREATE POLICY "Privileged roles manage underworld store"
  ON public.underworld_store_items
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER set_underworld_store_items_updated_at
  BEFORE UPDATE ON public.underworld_store_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
