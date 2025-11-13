-- Enhance equipment purchase workflow with gear pool tracking and history logging
CREATE TABLE IF NOT EXISTS public.gear_slot_catalog (
  category text PRIMARY KEY,
  slot_kind text NOT NULL,
  default_capacity integer NOT NULL,
  CONSTRAINT gear_slot_catalog_capacity_positive CHECK (default_capacity > 0)
);

INSERT INTO public.gear_slot_catalog (category, slot_kind, default_capacity)
VALUES
  ('guitar', 'instrument', 4),
  ('microphone', 'vocal_rig', 3),
  ('audio', 'outboard', 6),
  ('clothing', 'utility', 8)
ON CONFLICT (category) DO UPDATE
SET
  slot_kind = EXCLUDED.slot_kind,
  default_capacity = EXCLUDED.default_capacity;

CREATE TABLE IF NOT EXISTS public.player_gear_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  slot_kind text NOT NULL,
  capacity integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_gear_pool_capacity_check CHECK (capacity >= 0),
  CONSTRAINT player_gear_pool_used_check CHECK (used_count >= 0),
  CONSTRAINT player_gear_pool_within_capacity CHECK (used_count <= capacity),
  CONSTRAINT player_gear_pool_category_unique UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS player_gear_pool_user_idx ON public.player_gear_pool (user_id, category);

CREATE TRIGGER player_gear_pool_set_updated_at
  BEFORE UPDATE ON public.player_gear_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.player_gear_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their gear pool"
  ON public.player_gear_pool
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages gear pool"
  ON public.player_gear_pool
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.player_equipment
  ADD COLUMN IF NOT EXISTS available_for_loadout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS loadout_slot_kind text,
  ADD COLUMN IF NOT EXISTS pool_category text;

ALTER TABLE public.player_equipment
  ADD CONSTRAINT player_equipment_slot_kind_check
  CHECK (
    loadout_slot_kind IS NULL
    OR loadout_slot_kind = ANY (
      ARRAY[
        'instrument',
        'amp_head',
        'speaker_cabinet',
        'pedalboard_split',
        'vocal_rig',
        'monitoring',
        'utility',
        'outboard',
        'misc'
      ]::text[]
    )
  );

UPDATE public.player_equipment pe
SET
  available_for_loadout = COALESCE(pe.available_for_loadout, true),
  available_at = COALESCE(pe.available_at, pe.created_at, now()),
  pool_category = COALESCE(pool_category, ei.category, 'uncategorized'),
  loadout_slot_kind = COALESCE(loadout_slot_kind, gsc.slot_kind, 'misc')
FROM public.equipment_items ei
LEFT JOIN public.gear_slot_catalog gsc ON gsc.category = ei.category
WHERE pe.equipment_id = ei.id;

CREATE TABLE IF NOT EXISTS public.player_equipment_ownership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_equipment_id uuid REFERENCES public.player_equipment(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_equipment_history_user_idx
  ON public.player_equipment_ownership_history (user_id, created_at DESC);

ALTER TABLE public.player_equipment_ownership_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their equipment history"
  ON public.player_equipment_ownership_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages equipment history"
  ON public.player_equipment_ownership_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.player_gear_pool (user_id, category, slot_kind, capacity, used_count)
SELECT
  pe.user_id,
  COALESCE(ei.category, 'uncategorized') AS category,
  COALESCE(gsc.slot_kind, 'misc') AS slot_kind,
  GREATEST(COALESCE(gsc.default_capacity, 10), COUNT(*)) AS capacity,
  COUNT(*) AS used_count
FROM public.player_equipment pe
JOIN public.equipment_items ei ON ei.id = pe.equipment_id
LEFT JOIN public.gear_slot_catalog gsc ON gsc.category = ei.category
GROUP BY pe.user_id, ei.category, gsc.slot_kind, gsc.default_capacity
ON CONFLICT (user_id, category) DO UPDATE
SET
  slot_kind = EXCLUDED.slot_kind,
  capacity = GREATEST(public.player_gear_pool.capacity, EXCLUDED.capacity),
  used_count = EXCLUDED.used_count,
  updated_at = now();

CREATE OR REPLACE VIEW public.player_gear_pool_status AS
SELECT
  pgp.user_id,
  pgp.category,
  pgp.slot_kind,
  pgp.capacity,
  pgp.used_count,
  (pgp.capacity - pgp.used_count) AS available_slots,
  gsc.default_capacity,
  gsc.slot_kind AS catalog_slot_kind,
  pgp.updated_at
FROM public.player_gear_pool pgp
LEFT JOIN public.gear_slot_catalog gsc ON gsc.category = pgp.category;

CREATE OR REPLACE FUNCTION public.purchase_equipment_item(
  p_equipment_id uuid,
  p_secondary_currency text DEFAULT NULL,
  p_secondary_cost integer DEFAULT 0,
  p_secondary_credit integer DEFAULT 0
)
RETURNS TABLE (
  player_equipment_id uuid,
  remaining_stock integer,
  new_cash integer,
  new_secondary_balance integer,
  pool_category text,
  slot_kind text,
  remaining_pool_capacity integer
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
  v_category text;
  v_player_equipment_id uuid;
  v_remaining_stock integer;
  v_cash integer;
  v_fame integer;
  v_experience integer;
  v_secondary_balance integer;
  v_slot_kind text;
  v_pool_category text;
  v_pool_capacity integer;
  v_pool_used integer;
  v_pool_id uuid;
  v_default_capacity integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Not authenticated';
  END IF;

  SELECT price, stock, name, category
  INTO v_price, v_stock, v_name, v_category
  FROM public.equipment_items
  WHERE id = p_equipment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Equipment not found';
  END IF;

  IF v_stock <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Out of stock';
  END IF;

  v_pool_category := COALESCE(v_category, 'uncategorized');

  SELECT slot_kind, default_capacity
  INTO v_slot_kind, v_default_capacity
  FROM public.gear_slot_catalog
  WHERE category = v_category;

  IF v_slot_kind IS NULL THEN
    v_slot_kind := 'misc';
  END IF;

  SELECT id, capacity, used_count
  INTO v_pool_id, v_pool_capacity, v_pool_used
  FROM public.player_gear_pool
  WHERE user_id = v_user_id
    AND category = v_pool_category
  FOR UPDATE;

  IF v_pool_id IS NULL THEN
    v_pool_capacity := COALESCE(v_default_capacity, 10);
    INSERT INTO public.player_gear_pool (user_id, category, slot_kind, capacity, used_count)
    VALUES (v_user_id, v_pool_category, v_slot_kind, v_pool_capacity, 0)
    RETURNING id, capacity, used_count INTO v_pool_id, v_pool_capacity, v_pool_used;
  END IF;

  IF v_pool_used >= v_pool_capacity THEN
    RAISE EXCEPTION USING MESSAGE = format('Gear pool is full for %s items. Capacity %s.', v_slot_kind, v_pool_capacity);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_equipment
    WHERE user_id = v_user_id
      AND equipment_id = p_equipment_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'Equipment already owned';
  END IF;

  SELECT cash, fame, experience
  INTO v_cash, v_fame, v_experience
  FROM public.profiles
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'Profile not found';
  END IF;

  IF v_cash < v_price THEN
    RAISE EXCEPTION USING MESSAGE = 'Insufficient funds';
  END IF;

  IF p_secondary_currency IS NOT NULL THEN
    IF p_secondary_currency NOT IN ('fame', 'experience') THEN
      RAISE EXCEPTION USING MESSAGE = 'Unsupported secondary currency';
    END IF;

    IF p_secondary_cost < 0 OR p_secondary_credit < 0 THEN
      RAISE EXCEPTION USING MESSAGE = 'Secondary currency adjustments must be non-negative';
    END IF;

    IF p_secondary_currency = 'fame' THEN
      v_secondary_balance := v_fame;
    ELSE
      v_secondary_balance := v_experience;
    END IF;

    IF p_secondary_cost > 0 AND v_secondary_balance < p_secondary_cost THEN
      RAISE EXCEPTION USING MESSAGE = format('Insufficient %s balance', p_secondary_currency);
    END IF;
  END IF;

  v_cash := v_cash - v_price;

  IF p_secondary_currency = 'fame' THEN
    v_fame := v_fame - COALESCE(p_secondary_cost, 0) + COALESCE(p_secondary_credit, 0);
    v_secondary_balance := v_fame;
  ELSIF p_secondary_currency = 'experience' THEN
    v_experience := v_experience - COALESCE(p_secondary_cost, 0) + COALESCE(p_secondary_credit, 0);
    v_secondary_balance := v_experience;
  ELSE
    v_secondary_balance := NULL;
  END IF;

  UPDATE public.profiles
  SET cash = v_cash,
      fame = v_fame,
      experience = v_experience
  WHERE user_id = v_user_id;

  UPDATE public.equipment_items
  SET stock = stock - 1
  WHERE id = p_equipment_id
  RETURNING stock INTO v_remaining_stock;

  INSERT INTO public.player_equipment (
    user_id,
    equipment_id,
    is_equipped,
    available_for_loadout,
    loadout_slot_kind,
    pool_category,
    available_at
  )
  VALUES (v_user_id, p_equipment_id, false, true, v_slot_kind, v_pool_category, now())
  RETURNING id INTO v_player_equipment_id;

  UPDATE public.player_gear_pool
  SET used_count = used_count + 1
  WHERE id = v_pool_id;

  INSERT INTO public.player_equipment_ownership_history (
    player_equipment_id,
    user_id,
    equipment_id,
    action,
    metadata
  )
  VALUES (
    v_player_equipment_id,
    v_user_id,
    p_equipment_id,
    'purchase',
    jsonb_build_object(
      'price', v_price,
      'slot_kind', v_slot_kind,
      'pool_category', v_pool_category
    )
  );

  INSERT INTO public.activity_feed (user_id, activity_type, message, earnings)
  VALUES (
    v_user_id,
    'purchase',
    'Purchased ' || v_name,
    -v_price
  );

  RETURN QUERY SELECT
    v_player_equipment_id,
    v_remaining_stock,
    v_cash,
    v_secondary_balance,
    v_pool_category,
    v_slot_kind,
    v_pool_capacity - (v_pool_used + 1) AS remaining_pool_capacity;
END;
$$;

COMMENT ON FUNCTION public.purchase_equipment_item IS 'Handles purchasing equipment with stock tracking, gear pool enforcement, currency adjustments, and history logging.';

DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  profile_id uuid := gen_random_uuid();
  equipment_to_buy uuid;
  expensive_equipment uuid;
  purchase_result RECORD;
  duplicate_error text := NULL;
  insufficient_error text := NULL;
BEGIN
  SELECT id
  INTO equipment_to_buy
  FROM public.equipment_items
  ORDER BY price
  LIMIT 1;

  SELECT id
  INTO expensive_equipment
  FROM public.equipment_items
  ORDER BY price DESC
  LIMIT 1;

  IF equipment_to_buy IS NULL OR expensive_equipment IS NULL THEN
    RAISE NOTICE 'Skipping gear pool tests because equipment catalog is empty';
    RETURN;
  END IF;

  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, instance_id, role)
  VALUES (test_user_id, 'gear-pool-test@example.com', 'test-password', now(), '00000000-0000-0000-0000-000000000000', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, user_id, username, display_name, cash, fame, experience)
  VALUES (profile_id, test_user_id, 'gear_pool_tester', 'Gear Pool Tester', 100000, 50, 25)
  ON CONFLICT (user_id) DO UPDATE
  SET cash = EXCLUDED.cash,
      fame = EXCLUDED.fame,
      experience = EXCLUDED.experience;

  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);

  PERFORM * FROM public.purchase_equipment_item(equipment_to_buy);

  BEGIN
    PERFORM * FROM public.purchase_equipment_item(equipment_to_buy);
  EXCEPTION
    WHEN others THEN
      duplicate_error := SQLERRM;
  END;

  IF duplicate_error IS NULL THEN
    RAISE EXCEPTION 'Duplicate purchase did not raise an error';
  END IF;

  UPDATE public.profiles
  SET cash = 0
  WHERE user_id = test_user_id;

  BEGIN
    PERFORM * FROM public.purchase_equipment_item(expensive_equipment, 'fame', 1000, 0);
  EXCEPTION
    WHEN others THEN
      insufficient_error := SQLERRM;
  END;

  IF insufficient_error IS NULL THEN
    RAISE EXCEPTION 'Insufficient currency check did not raise an error';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = test_user_id
      AND cash <> 0
  ) THEN
    RAISE EXCEPTION 'Cash balance changed despite failed purchase';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = test_user_id
      AND fame <> 50
  ) THEN
    RAISE EXCEPTION 'Fame balance changed despite failed purchase';
  END IF;

  DELETE FROM public.player_equipment WHERE user_id = test_user_id;
  DELETE FROM public.player_equipment_ownership_history WHERE user_id = test_user_id;
  DELETE FROM public.player_gear_pool WHERE user_id = test_user_id;
  DELETE FROM public.activity_feed WHERE user_id = test_user_id;
  DELETE FROM public.profiles WHERE user_id = test_user_id;
  DELETE FROM auth.users WHERE id = test_user_id;
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
END;
$$;
