-- Add stock tracking to equipment items and automation for restocking
ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 5,
  ADD CONSTRAINT equipment_items_stock_nonnegative CHECK (stock >= 0);

-- Ensure existing rows respect the new constraint
UPDATE public.equipment_items
SET stock = GREATEST(stock, 0);

-- Function to handle purchasing equipment atomically
CREATE OR REPLACE FUNCTION public.purchase_equipment_item(p_equipment_id uuid)
RETURNS TABLE (
  player_equipment_id uuid,
  remaining_stock integer,
  new_cash integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price integer;
  v_stock integer;
  v_name text;
  v_player_equipment_id uuid;
  v_remaining_stock integer;
  v_new_cash integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Not authenticated';
  END IF;

  SELECT price, stock, name
  INTO v_price, v_stock, v_name
  FROM public.equipment_items
  WHERE id = p_equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Equipment not found';
  END IF;

  IF v_stock <= 0 THEN
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
  SET cash = cash - v_price
  WHERE user_id = v_user_id
    AND cash >= v_price
  RETURNING cash INTO v_new_cash;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Insufficient funds';
  END IF;

  UPDATE public.equipment_items
  SET stock = stock - 1
  WHERE id = p_equipment_id
  RETURNING stock INTO v_remaining_stock;

  INSERT INTO public.player_equipment (user_id, equipment_id, is_equipped)
  VALUES (v_user_id, p_equipment_id, false)
  RETURNING id INTO v_player_equipment_id;

  INSERT INTO public.activity_feed (user_id, activity_type, message, earnings)
  VALUES (v_user_id, 'purchase', 'Purchased ' || v_name, -v_price);

  RETURN QUERY SELECT v_player_equipment_id, v_remaining_stock, v_new_cash;
END;
$$;

COMMENT ON FUNCTION public.purchase_equipment_item IS 'Handles purchasing equipment with stock tracking and activity logging.';

-- Function to restock equipment items
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
  WHERE stock < restock_amount;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN v_rows_updated;
END;
$$;

COMMENT ON FUNCTION public.restock_equipment_items IS 'Resets equipment stock levels up to the provided amount.';

-- Ensure pg_cron is available for scheduling the restock job
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule daily restocking at 3 AM UTC if not already scheduled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'equipment_items_restock_daily') THEN
    PERFORM cron.schedule(
      'equipment_items_restock_daily',
      '0 3 * * *',
      $$SELECT public.restock_equipment_items();$$
    );
  END IF;
END;
$$;
