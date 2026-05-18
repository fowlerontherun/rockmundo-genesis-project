CREATE OR REPLACE FUNCTION public.sell_personal_gear(p_gear_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_gear record;
  v_profile_id uuid;
  v_refund integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_gear FROM public.player_personal_gear
    WHERE id = p_gear_id AND user_id = v_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gear not found');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles
    WHERE user_id = v_user AND is_active = true AND died_at IS NULL
    LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active character');
  END IF;

  v_refund := GREATEST(0, COALESCE(v_gear.purchase_cost, 0) / 2);

  UPDATE public.profiles SET cash = COALESCE(cash, 0) + v_refund
    WHERE id = v_profile_id;

  UPDATE public.blind_box_openings SET instrument_id = NULL WHERE instrument_id = p_gear_id;

  DELETE FROM public.player_equipment
    WHERE user_id = v_profile_id
      AND equipment_id IN (
        SELECT id FROM public.equipment_items WHERE name = v_gear.gear_name AND subcategory = 'blind_box'
      );

  DELETE FROM public.player_personal_gear WHERE id = p_gear_id;

  RETURN jsonb_build_object('success', true, 'refund', v_refund);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_personal_gear(uuid) TO authenticated;