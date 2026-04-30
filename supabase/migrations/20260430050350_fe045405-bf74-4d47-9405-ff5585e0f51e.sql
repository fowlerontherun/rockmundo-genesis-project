-- Helpful index for ownership lookups
CREATE INDEX IF NOT EXISTS idx_player_children_controller ON public.player_children(controller_user_id);

CREATE OR REPLACE FUNCTION public.convert_child_to_playable(
  p_child_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_child public.player_children%ROWTYPE;
  v_parent_profile public.profiles%ROWTYPE;
  v_extra_slots INT;
  v_max_slots INT;
  v_used_slots INT;
  v_next_slot INT;
  v_username TEXT;
  v_new_profile_id UUID;
  v_potential_bonus INT := 0;
  v_bond_bonus INT := 0;
  v_starter_sxp INT := 500;
  v_starter_ap INT := 10;
  v_total_sxp INT;
  v_total_ap INT;
  v_parent_generation INT := 1;
  v_avg_potential NUMERIC;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_child FROM public.player_children WHERE id = p_child_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child not found';
  END IF;

  -- Ownership check
  SELECT * INTO v_parent_profile
  FROM public.profiles
  WHERE id IN (v_child.parent_a_id, v_child.parent_b_id)
    AND user_id = v_user
  LIMIT 1;

  IF NOT FOUND AND COALESCE(v_child.controller_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_user THEN
    RAISE EXCEPTION 'Not a parent of this child';
  END IF;

  -- Age gate
  IF COALESCE(v_child.current_age, 0) < 18 THEN
    RAISE EXCEPTION 'Child must be at least 18 to come of age (current age %)', COALESCE(v_child.current_age, 0);
  END IF;

  -- Already converted?
  IF v_child.child_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'This child has already been converted to a playable character';
  END IF;

  -- Slot availability
  SELECT COALESCE(extra_slots_purchased, 0) INTO v_extra_slots
  FROM public.character_slots
  WHERE user_id = v_user;
  v_extra_slots := COALESCE(v_extra_slots, 0);
  v_max_slots := LEAST(2 + v_extra_slots, 5);

  SELECT COUNT(*) INTO v_used_slots
  FROM public.profiles
  WHERE user_id = v_user AND died_at IS NULL;

  IF v_used_slots >= v_max_slots THEN
    RAISE EXCEPTION 'No character slots available (% of % used). Purchase more slots or retire a character first.', v_used_slots, v_max_slots;
  END IF;

  -- Determine next slot number (max ever used + 1)
  SELECT COALESCE(MAX(slot_number), 0) + 1 INTO v_next_slot
  FROM public.profiles
  WHERE user_id = v_user;

  v_username := 'heir-' || substring(v_user::text, 1, 8) || '-' || v_next_slot::text || '-' || to_char(extract(epoch FROM now())::bigint, 'FM999999999999');

  -- Compute legacy bonuses from inherited potentials (avg) and bonds
  IF v_child.inherited_potentials IS NOT NULL AND jsonb_typeof(v_child.inherited_potentials) = 'object' THEN
    SELECT AVG((value)::numeric)
      INTO v_avg_potential
      FROM jsonb_each_text(v_child.inherited_potentials)
      WHERE value ~ '^-?[0-9]+(\.[0-9]+)?$';
    v_potential_bonus := COALESCE(ROUND(v_avg_potential * 25), 0);  -- ~0..500 SXP
  END IF;

  v_bond_bonus := GREATEST(0, ((COALESCE(v_child.bond_parent_a, 50) + COALESCE(v_child.bond_parent_b, 50)) / 2) - 50);
  -- bond_bonus contributes up to 50 to AP via /5; and ~250 to SXP via *5

  -- Parent generation
  SELECT COALESCE(generation_number, 1) INTO v_parent_generation
  FROM public.profiles
  WHERE id = v_child.parent_a_id;

  v_total_sxp := v_starter_sxp + v_potential_bonus + (v_bond_bonus * 5);
  v_total_ap := v_starter_ap + LEAST(10, v_bond_bonus / 5);

  -- Create new playable profile
  INSERT INTO public.profiles (
    user_id, username, display_name, avatar_url, bio,
    cash, fame, level, health, energy, experience,
    age, is_active, slot_number, generation_number
  )
  VALUES (
    v_user, v_username, v_child.name || ' ' || v_child.surname, NULL, NULL,
    10000, 0, 1, 100, 100, 0,
    18, FALSE, v_next_slot, COALESCE(v_parent_generation, 1) + 1
  )
  RETURNING id INTO v_new_profile_id;

  -- Seed XP wallet with starter + legacy bonuses
  INSERT INTO public.player_xp_wallet (
    profile_id,
    xp_balance, lifetime_xp,
    skill_xp_balance, skill_xp_lifetime,
    attribute_points_balance, attribute_points_lifetime
  )
  VALUES (
    v_new_profile_id,
    v_total_sxp, v_total_sxp,
    v_total_sxp, v_total_sxp,
    v_total_ap, v_total_ap
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    xp_balance = EXCLUDED.xp_balance,
    lifetime_xp = EXCLUDED.lifetime_xp,
    skill_xp_balance = EXCLUDED.skill_xp_balance,
    skill_xp_lifetime = EXCLUDED.skill_xp_lifetime,
    attribute_points_balance = EXCLUDED.attribute_points_balance,
    attribute_points_lifetime = EXCLUDED.attribute_points_lifetime;

  -- Link child record back to new profile and mark as playable
  UPDATE public.player_children
  SET child_profile_id = v_new_profile_id,
      playability_state = 'playable',
      updated_at = now()
  WHERE id = p_child_id;

  RETURN v_new_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_child_to_playable(UUID) TO authenticated;