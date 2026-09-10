-- Per-owned-item clothing customisation and authoritative slot-aware equip.

ALTER TABLE public.player_owned_skins
  ADD COLUMN IF NOT EXISTS selected_variant_key text,
  ADD COLUMN IF NOT EXISTS customization_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.player_owned_skins.selected_variant_key IS
  'Stable variant id/key/name or color-N key selected for an owned clothing item. Null uses the item default.';
COMMENT ON COLUMN public.player_owned_skins.customization_config IS
  'Player-selected colours for admin-authorised customization zones, stored as {zone_id: "#RRGGBB"}.';

-- Older Skin Store purchases stored the clothing category (shirt/jacket/etc.) as
-- item_type. Normalise those rows so clothing bonuses/equip/customisation all use
-- one canonical item_type.
UPDATE public.player_owned_skins canonical
SET is_equipped = canonical.is_equipped OR legacy.is_equipped
FROM public.player_owned_skins legacy
WHERE canonical.profile_id = legacy.profile_id
  AND canonical.item_id = legacy.item_id
  AND canonical.item_type = 'clothing'
  AND legacy.item_type <> 'clothing'
  AND EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = legacy.item_id);

DELETE FROM public.player_owned_skins legacy
USING public.player_owned_skins canonical
WHERE legacy.profile_id = canonical.profile_id
  AND legacy.item_id = canonical.item_id
  AND legacy.item_type <> 'clothing'
  AND canonical.item_type = 'clothing'
  AND EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = legacy.item_id);

UPDATE public.player_owned_skins pos
SET item_type = 'clothing'
WHERE pos.item_type <> 'clothing'
  AND EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = pos.item_id);

CREATE OR REPLACE FUNCTION public.clothing_equip_slot(p_wearable_slot text, p_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(lower(trim(COALESCE(p_wearable_slot, ''))), '') IS NOT NULL
      THEN lower(trim(p_wearable_slot))
    WHEN lower(COALESCE(p_category, '')) IN ('shirt','t-shirt','tank-top','hoodie','sweater','top') THEN 'top'
    WHEN lower(COALESCE(p_category, '')) IN ('jacket','coat','vest','outerwear') THEN 'outerwear'
    WHEN lower(COALESCE(p_category, '')) IN ('pants','jeans','shorts','skirt','bottom') THEN 'bottom'
    WHEN lower(COALESCE(p_category, '')) = 'dress' THEN 'dress'
    WHEN lower(COALESCE(p_category, '')) IN ('shoes','boots','trainers','footwear') THEN 'footwear'
    WHEN lower(COALESCE(p_category, '')) IN ('hat','headwear') THEN 'headwear'
    WHEN lower(COALESCE(p_category, '')) IN ('glasses','eyewear') THEN 'eyewear'
    ELSE 'accessory'
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_owned_clothing_customization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_variants jsonb;
  v_colours jsonb;
  v_zones jsonb;
  v_key text;
  v_color text;
  v_colour_index integer;
  v_variant_valid boolean := false;
BEGIN
  IF NEW.item_type <> 'clothing' THEN
    IF NEW.selected_variant_key IS NOT NULL OR COALESCE(NEW.customization_config, '{}'::jsonb) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Clothing customization can only be stored on clothing ownership rows';
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(variant_matrix, '[]'::jsonb), COALESCE(color_variants, '[]'::jsonb), COALESCE(customization_zones, '[]'::jsonb)
  INTO v_variants, v_colours, v_zones
  FROM public.avatar_clothing_items
  WHERE id = NEW.item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned clothing item does not exist';
  END IF;

  IF NEW.selected_variant_key IS NOT NULL THEN
    v_variant_valid := EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_variants) variant
      WHERE COALESCE(NULLIF(variant->>'id',''), NULLIF(variant->>'key',''), NULLIF(variant->>'name','')) = NEW.selected_variant_key
    );

    IF NOT v_variant_valid AND NEW.selected_variant_key ~ '^color-[0-9]+$' THEN
      v_colour_index := substring(NEW.selected_variant_key from 'color-([0-9]+)')::integer;
      v_variant_valid := v_colour_index >= 0 AND v_colour_index < jsonb_array_length(v_colours);
    END IF;

    IF NOT v_variant_valid THEN
      RAISE EXCEPTION 'Selected clothing variant is not available for this item';
    END IF;
  END IF;

  NEW.customization_config := COALESCE(NEW.customization_config, '{}'::jsonb);
  IF jsonb_typeof(NEW.customization_config) <> 'object' THEN
    RAISE EXCEPTION 'Clothing customization must be a JSON object';
  END IF;

  FOR v_key, v_color IN SELECT key, value FROM jsonb_each_text(NEW.customization_config)
  LOOP
    IF v_color !~* '^#[0-9a-f]{6}$' THEN
      RAISE EXCEPTION 'Custom clothing colour for zone % must be #RRGGBB', v_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_zones) zone
      WHERE zone->>'id' = v_key
        AND COALESCE((zone->>'playerEditable')::boolean, (zone->>'player_editable')::boolean, false)
    ) THEN
      RAISE EXCEPTION 'Clothing zone % is not player editable', v_key;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_owned_clothing_customization ON public.player_owned_skins;
CREATE TRIGGER trg_validate_owned_clothing_customization
BEFORE INSERT OR UPDATE OF item_type, item_id, selected_variant_key, customization_config
ON public.player_owned_skins
FOR EACH ROW EXECUTE FUNCTION public.validate_owned_clothing_customization();

CREATE OR REPLACE FUNCTION public.set_owned_clothing_customization(
  p_profile_id uuid,
  p_item_id uuid,
  p_variant_key text DEFAULT NULL,
  p_zone_colors jsonb DEFAULT '{}'::jsonb,
  p_equip boolean DEFAULT false
)
RETURNS TABLE(
  ownership_id uuid,
  selected_variant_key text,
  customization_config jsonb,
  is_equipped boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ownership_id uuid;
  v_slot text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You cannot customize clothing for this character';
  END IF;

  SELECT pos.id
  INTO v_ownership_id
  FROM public.player_owned_skins pos
  WHERE pos.profile_id = p_profile_id
    AND pos.item_id = p_item_id
    AND pos.item_type = 'clothing'
  FOR UPDATE;

  IF v_ownership_id IS NULL THEN
    RAISE EXCEPTION 'You do not own this clothing item';
  END IF;

  IF p_equip THEN
    SELECT public.clothing_equip_slot(aci.wearable_slot, aci.category)
    INTO v_slot
    FROM public.avatar_clothing_items aci
    WHERE aci.id = p_item_id;

    UPDATE public.player_owned_skins other
    SET is_equipped = false
    FROM public.avatar_clothing_items other_item
    WHERE other.profile_id = p_profile_id
      AND other.item_type = 'clothing'
      AND other.is_equipped = true
      AND other.item_id <> p_item_id
      AND other_item.id = other.item_id
      AND public.clothing_equip_slot(other_item.wearable_slot, other_item.category) = v_slot;
  END IF;

  UPDATE public.player_owned_skins pos
  SET selected_variant_key = NULLIF(trim(p_variant_key), ''),
      customization_config = COALESCE(p_zone_colors, '{}'::jsonb),
      is_equipped = CASE WHEN p_equip THEN true ELSE pos.is_equipped END
  WHERE pos.id = v_ownership_id;

  RETURN QUERY
  SELECT pos.id, pos.selected_variant_key, pos.customization_config, pos.is_equipped
  FROM public.player_owned_skins pos
  WHERE pos.id = v_ownership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_owned_clothing_customization(uuid,uuid,text,jsonb,boolean) TO authenticated;

COMMENT ON FUNCTION public.set_owned_clothing_customization(uuid,uuid,text,jsonb,boolean) IS
  'Validates and saves an owned clothing variant/zone colours. When p_equip=true, unequips other clothing in the same wearable slot.';
