-- Expand equipment schema with dedicated gear categories, multiple currency costs, and stock policy flags
CREATE TABLE IF NOT EXISTS public.gear_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  icon text,
  sort_order integer,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.gear_categories IS 'Lookup table for in-game equipment and gear categories.';

ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS gear_category_id uuid,
  ADD COLUMN IF NOT EXISTS price_cash integer,
  ADD COLUMN IF NOT EXISTS price_fame integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_stock_tracked boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS auto_restock boolean DEFAULT true NOT NULL;

ALTER TABLE public.equipment_items
  ADD CONSTRAINT equipment_items_gear_category_id_fkey
  FOREIGN KEY (gear_category_id)
  REFERENCES public.gear_categories(id)
  ON DELETE RESTRICT;

-- Seed categories from existing equipment rows and ensure canonical entries exist
WITH distinct_categories AS (
  SELECT DISTINCT category, initcap(replace(category, '_', ' ')) AS label
  FROM public.equipment_items
)
INSERT INTO public.gear_categories (slug, label, description, sort_order)
SELECT dc.category, dc.label, NULL, ROW_NUMBER() OVER (ORDER BY dc.category)
FROM distinct_categories dc
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label;

-- Backfill category references on equipment items
UPDATE public.equipment_items ei
SET gear_category_id = gc.id
FROM public.gear_categories gc
WHERE gc.slug = ei.category
  AND (ei.gear_category_id IS DISTINCT FROM gc.id OR ei.gear_category_id IS NULL);

-- Ensure all items now reference a category
ALTER TABLE public.equipment_items
  ALTER COLUMN gear_category_id SET NOT NULL;

-- Backfill currency columns using legacy price values
UPDATE public.equipment_items
SET price_cash = COALESCE(price_cash, price),
    price_fame = COALESCE(price_fame, 0);

ALTER TABLE public.equipment_items
  ALTER COLUMN price_cash SET NOT NULL;
ALTER TABLE public.equipment_items
  ALTER COLUMN price_fame SET NOT NULL;

-- Refresh purchase function to handle multi-currency costs and stock policy flags
CREATE OR REPLACE FUNCTION public.purchase_equipment_item(p_equipment_id uuid)
RETURNS TABLE (
  player_equipment_id uuid,
  remaining_stock integer,
  new_cash integer,
  new_fame integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price_cash integer;
  v_price_fame integer;
  v_stock integer;
  v_name text;
  v_player_equipment_id uuid;
  v_remaining_stock integer;
  v_new_cash integer;
  v_new_fame integer;
  v_is_stock_tracked boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Not authenticated';
  END IF;

  SELECT price_cash, price_fame, stock, name, is_stock_tracked
  INTO v_price_cash, v_price_fame, v_stock, v_name, v_is_stock_tracked
  FROM public.equipment_items
  WHERE id = p_equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Equipment not found';
  END IF;

  IF v_is_stock_tracked AND (v_stock IS NULL OR v_stock <= 0) THEN
    RAISE EXCEPTION USING MESSAGE = 'Out of stock';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_equipment
    WHERE user_id = v_user_id
      AND equipment_id = p_equipment_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'Equipment already owned';
  END IF;

  UPDATE public.profiles
  SET cash = cash - v_price_cash,
      fame = fame - v_price_fame
  WHERE user_id = v_user_id
    AND cash >= v_price_cash
    AND fame >= v_price_fame
  RETURNING cash, fame INTO v_new_cash, v_new_fame;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = v_user_id AND cash < v_price_cash
    ) THEN
      RAISE EXCEPTION USING MESSAGE = 'Insufficient funds';
    ELSE
      RAISE EXCEPTION USING MESSAGE = 'Insufficient fame';
    END IF;
  END IF;

  IF v_is_stock_tracked THEN
    UPDATE public.equipment_items
    SET stock = stock - 1
    WHERE id = p_equipment_id
    RETURNING stock INTO v_remaining_stock;
  ELSE
    v_remaining_stock := v_stock;
  END IF;

  INSERT INTO public.player_equipment (user_id, equipment_id, is_equipped)
  VALUES (v_user_id, p_equipment_id, false)
  RETURNING id INTO v_player_equipment_id;

  INSERT INTO public.activity_feed (user_id, activity_type, message, earnings, metadata)
  VALUES (
    v_user_id,
    'purchase',
    'Purchased ' || v_name,
    CASE WHEN v_price_cash > 0 THEN -v_price_cash ELSE 0 END,
    jsonb_build_object('price_cash', v_price_cash, 'price_fame', v_price_fame)
  );

  RETURN QUERY SELECT v_player_equipment_id, v_remaining_stock, v_new_cash, v_new_fame;
END;
$$;

COMMENT ON FUNCTION public.purchase_equipment_item IS 'Handles purchasing equipment with stock tracking, multi-currency costs, and activity logging.';

-- Restock function should respect stock policy flags
CREATE OR REPLACE FUNCTION public.restock_equipment_items(restock_amount integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_rows_updated integer := 0;
BEGIN
  IF restock_amount < 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Restock amount must be non-negative';
  END IF;

  UPDATE public.equipment_items
  SET stock = restock_amount
  WHERE is_stock_tracked
    AND auto_restock
    AND stock < restock_amount;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN v_rows_updated;
END;
$$;

COMMENT ON FUNCTION public.restock_equipment_items IS 'Resets equipment stock levels up to the provided amount for trackable, auto-restocking items.';
