
-- Fix: Add XP wallet seeding to create_character_profile RPC
CREATE OR REPLACE FUNCTION public.create_character_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  extra_slots integer := 0;
  base_slots integer := 2;
  max_slots integer := 2;
  used_slots integer := 0;
  next_slot integer := 1;
  generated_username text;
  new_profile public.profiles%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(extra_slots_purchased, 0)
  INTO extra_slots
  FROM public.character_slots
  WHERE user_id = current_user_id;

  max_slots := LEAST(base_slots + COALESCE(extra_slots, 0), 5);

  SELECT COUNT(*)
  INTO used_slots
  FROM public.profiles
  WHERE user_id = current_user_id
    AND died_at IS NULL;

  IF used_slots >= max_slots THEN
    RAISE EXCEPTION 'No character slots available';
  END IF;

  SELECT COALESCE(MAX(slot_number), 0) + 1
  INTO next_slot
  FROM public.profiles
  WHERE user_id = current_user_id;

  generated_username := CONCAT('player-', LEFT(current_user_id::text, 8), '-', next_slot::text);

  UPDATE public.profiles
  SET is_active = false
  WHERE user_id = current_user_id
    AND is_active = true;

  INSERT INTO public.profiles (
    user_id, username, display_name, avatar_url, bio,
    cash, fame, level, health, energy, experience, age,
    is_active, slot_number, generation_number, unlock_cost
  )
  VALUES (
    current_user_id, generated_username, NULL, NULL, NULL,
    10000, 0, 1, 100, 100, 0, 16,
    true, next_slot, 1, 0
  )
  RETURNING * INTO new_profile;

  -- Seed starter XP wallet (500 SXP + 10 AP)
  INSERT INTO public.player_xp_wallet (
    profile_id, xp_balance, lifetime_xp,
    skill_xp_balance, skill_xp_lifetime,
    attribute_points_balance, attribute_points_lifetime
  )
  VALUES (
    new_profile.id, 500, 500, 500, 500, 10, 10
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    skill_xp_balance = player_xp_wallet.skill_xp_balance + 500,
    skill_xp_lifetime = player_xp_wallet.skill_xp_lifetime + 500,
    attribute_points_balance = player_xp_wallet.attribute_points_balance + 10,
    attribute_points_lifetime = player_xp_wallet.attribute_points_lifetime + 10,
    xp_balance = player_xp_wallet.xp_balance + 500,
    lifetime_xp = player_xp_wallet.lifetime_xp + 500;

  RETURN NEXT new_profile;
END;
$$;

-- Seed death system config values into game_balance_config
INSERT INTO public.game_balance_config (key, value, category, description)
VALUES
  ('death_health_drain_per_day', 5, 'death_system', 'Health points drained per day of inactivity'),
  ('death_days_until_death', 10, 'death_system', 'Days offline at 0 health before character dies'),
  ('death_resurrection_lives_default', 3, 'death_system', 'Default resurrection lives for new characters'),
  ('death_resurrect_health', 50, 'death_system', 'Health restored on resurrection'),
  ('death_resurrect_energy', 50, 'death_system', 'Energy restored on resurrection'),
  ('death_relative_skill_inherit_pct', 10, 'death_system', 'Percent of skills inherited by relative'),
  ('death_relative_cash_inherit_pct', 50, 'death_system', 'Percent of cash inherited by relative'),
  ('death_stale_threshold_hours', 24, 'death_system', 'Hours since last login before health drain starts')
ON CONFLICT (key) DO NOTHING;
