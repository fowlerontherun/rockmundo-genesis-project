-- Extracted unchanged from historical July gear-pool schema migration.
-- Run ONLY on a disposable, fully migrated test DB with an account fixture
-- compatible with the latest profile triggers. Do not run on production.
-- This is a separate integration smoke test, not part of schema bootstrapping.
-- A broken legacy profile fixture must never block fresh schema migration.
BEGIN;
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
ROLLBACK;
