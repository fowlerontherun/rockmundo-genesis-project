-- Public stage cosmetics: expose only the currently equipped clothing selection needed
-- to render other authenticated players on stage. Purchase history and unequipped
-- inventory remain private under player_owned_skins RLS.

CREATE OR REPLACE FUNCTION public.get_equipped_stage_clothing(p_profile_ids uuid[])
RETURNS TABLE(
  profile_id uuid,
  item_id uuid,
  selected_variant_key text,
  customization_config jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF COALESCE(cardinality(p_profile_ids), 0) = 0 THEN
    RETURN;
  END IF;

  IF cardinality(p_profile_ids) > 50 THEN
    RAISE EXCEPTION 'too_many_profiles';
  END IF;

  RETURN QUERY
  SELECT
    pos.profile_id,
    pos.item_id,
    pos.selected_variant_key,
    COALESCE(pos.customization_config, '{}'::jsonb)
  FROM public.player_owned_skins pos
  JOIN public.avatar_clothing_items aci ON aci.id = pos.item_id
  WHERE pos.profile_id = ANY(p_profile_ids)
    AND pos.item_type = 'clothing'
    AND pos.is_equipped = true
  ORDER BY pos.profile_id, public.clothing_equip_slot(aci.wearable_slot, aci.category), pos.item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_equipped_stage_clothing(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_equipped_stage_clothing(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_equipped_stage_clothing(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_equipped_stage_clothing(uuid[]) IS
  'Returns only public stage-rendering data for currently equipped rich clothing. Inventory, prices and purchase history are not exposed.';

NOTIFY pgrst, 'reload schema';
