-- Instrument cosmetics for the Skin Store.
-- Reuses player_owned_skins so ownership, active-character scoping and stage cosmetics
-- stay consistent with rich clothing while keeping the instrument catalogue separate.

CREATE TABLE IF NOT EXISTS public.instrument_skin_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  target_instrument text NOT NULL CHECK (target_instrument IN ('electric_guitar', 'bass_guitar')),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  is_premium boolean NOT NULL DEFAULT false,
  is_limited_edition boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  collection_id uuid REFERENCES public.skin_collections(id) ON DELETE SET NULL,
  release_date date DEFAULT current_date,
  expiry_date date,
  design_key text NOT NULL DEFAULT 'solid' CHECK (design_key IN ('solid','two_tone','sunburst','racing_stripes','checker','flames','lightning')),
  body_color text NOT NULL DEFAULT '#ab713d' CHECK (body_color ~* '^#[0-9a-f]{6}$'),
  secondary_color text NOT NULL DEFAULT '#f1d7a1' CHECK (secondary_color ~* '^#[0-9a-f]{6}$'),
  pickguard_color text NOT NULL DEFAULT '#15171c' CHECK (pickguard_color ~* '^#[0-9a-f]{6}$'),
  hardware_color text NOT NULL DEFAULT '#bdc2cb' CHECK (hardware_color ~* '^#[0-9a-f]{6}$'),
  color_variants jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(color_variants) = 'array'),
  variant_matrix jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variant_matrix) = 'array'),
  customization_zones jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(customization_zones) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instrument_skin_items_target ON public.instrument_skin_items(target_instrument, is_active);
CREATE INDEX IF NOT EXISTS idx_instrument_skin_items_featured ON public.instrument_skin_items(featured) WHERE is_active = true;

ALTER TABLE public.instrument_skin_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated players can browse instrument skins" ON public.instrument_skin_items;
CREATE POLICY "Authenticated players can browse instrument skins"
ON public.instrument_skin_items FOR SELECT TO authenticated
USING (is_active = true);

GRANT SELECT ON public.instrument_skin_items TO authenticated;

CREATE TABLE IF NOT EXISTS public.instrument_skin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_skin_item_id uuid NOT NULL REFERENCES public.instrument_skin_items(id),
  ownership_id uuid NOT NULL REFERENCES public.player_owned_skins(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount >= 0),
  idempotency_key text NOT NULL UNIQUE,
  selected_variant_key text,
  customization_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instrument_skin_purchases_profile
  ON public.instrument_skin_purchases(profile_id, created_at DESC);

ALTER TABLE public.instrument_skin_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can view their instrument skin purchases" ON public.instrument_skin_purchases;
CREATE POLICY "Players can view their instrument skin purchases"
ON public.instrument_skin_purchases FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Instrument skins, like rich clothing, must not be inserted/edited directly in
-- player_owned_skins or a client could mint/equip an unpaid cosmetic.
DROP POLICY IF EXISTS "Players can insert their own skins" ON public.player_owned_skins;
CREATE POLICY "Players can insert their own skins"
ON public.player_owned_skins FOR INSERT TO authenticated
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = item_id)
  AND NOT EXISTS (SELECT 1 FROM public.instrument_skin_items isi WHERE isi.id = item_id)
);

DROP POLICY IF EXISTS "Players can update their own skins" ON public.player_owned_skins;
CREATE POLICY "Players can update their own skins"
ON public.player_owned_skins FOR UPDATE TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = item_id)
  AND NOT EXISTS (SELECT 1 FROM public.instrument_skin_items isi WHERE isi.id = item_id)
)
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.avatar_clothing_items aci WHERE aci.id = item_id)
  AND NOT EXISTS (SELECT 1 FROM public.instrument_skin_items isi WHERE isi.id = item_id)
);

-- Expand the existing ownership validator. The trigger already points at this
-- function, so replacing it upgrades existing deployments without a new trigger.
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
  IF NEW.item_type = 'clothing' THEN
    SELECT COALESCE(variant_matrix, '[]'::jsonb), COALESCE(color_variants, '[]'::jsonb), COALESCE(customization_zones, '[]'::jsonb)
      INTO v_variants, v_colours, v_zones
    FROM public.avatar_clothing_items
    WHERE id = NEW.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned clothing item does not exist'; END IF;
  ELSIF NEW.item_type = 'instrument' THEN
    SELECT COALESCE(variant_matrix, '[]'::jsonb), COALESCE(color_variants, '[]'::jsonb), COALESCE(customization_zones, '[]'::jsonb)
      INTO v_variants, v_colours, v_zones
    FROM public.instrument_skin_items
    WHERE id = NEW.item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned instrument skin does not exist'; END IF;
  ELSE
    IF NEW.selected_variant_key IS NOT NULL OR COALESCE(NEW.customization_config, '{}'::jsonb) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Customisation can only be stored on clothing or instrument ownership rows';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.selected_variant_key IS NOT NULL THEN
    v_variant_valid := EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_variants) variant
      WHERE COALESCE(
        NULLIF(variant->>'id',''),
        NULLIF(variant->>'key',''),
        NULLIF(variant->>'name',''),
        NULLIF(variant->>'label','')
      ) = NEW.selected_variant_key
    );

    IF NOT v_variant_valid AND NEW.selected_variant_key ~ '^color-[0-9]+$' THEN
      v_colour_index := substring(NEW.selected_variant_key from 'color-([0-9]+)')::integer;
      v_variant_valid := v_colour_index >= 0 AND v_colour_index < jsonb_array_length(v_colours);
    END IF;

    IF NOT v_variant_valid THEN
      RAISE EXCEPTION 'Selected cosmetic variant is not available for this item';
    END IF;
  END IF;

  NEW.customization_config := COALESCE(NEW.customization_config, '{}'::jsonb);
  IF jsonb_typeof(NEW.customization_config) <> 'object' THEN
    RAISE EXCEPTION 'Cosmetic customisation must be a JSON object';
  END IF;

  FOR v_key, v_color IN SELECT key, value FROM jsonb_each_text(NEW.customization_config)
  LOOP
    IF v_color !~* '^#[0-9a-f]{6}$' THEN
      RAISE EXCEPTION 'Custom colour for zone % must be #RRGGBB', v_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_zones) zone
      WHERE zone->>'id' = v_key
        AND COALESCE((zone->>'playerEditable')::boolean, (zone->>'player_editable')::boolean, false)
    ) THEN
      RAISE EXCEPTION 'Cosmetic zone % is not player editable', v_key;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_instrument_skin_atomic(
  p_profile_id uuid,
  p_item_id uuid,
  p_idempotency_key text,
  p_variant_key text DEFAULT NULL,
  p_zone_colors jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_item public.instrument_skin_items;
  v_existing public.instrument_skin_purchases;
  v_ownership_id uuid;
  v_purchase_id uuid;
  v_price numeric;
  v_remaining_cash numeric;
  v_collection_active boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_profile_id IS NULL THEN RAISE EXCEPTION 'profile_required'; END IF;
  IF p_item_id IS NULL THEN RAISE EXCEPTION 'instrument_skin_required'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;

  SELECT * INTO v_existing FROM public.instrument_skin_purchases WHERE idempotency_key = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.profile_id <> p_profile_id OR v_existing.instrument_skin_item_id <> p_item_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;
    RETURN jsonb_build_object('status','already_completed','purchaseId',v_existing.id,'ownershipId',v_existing.ownership_id,'itemId',v_existing.instrument_skin_item_id,'amount',v_existing.amount);
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id AND user_id = v_user_id
  FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'profile_not_owned_by_user'; END IF;

  SELECT * INTO v_item
  FROM public.instrument_skin_items
  WHERE id = p_item_id
  FOR SHARE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'instrument_skin_not_found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'instrument_skin_inactive'; END IF;
  IF v_item.release_date IS NOT NULL AND v_item.release_date > current_date THEN RAISE EXCEPTION 'instrument_skin_not_released'; END IF;
  IF v_item.expiry_date IS NOT NULL AND v_item.expiry_date < current_date THEN RAISE EXCEPTION 'instrument_skin_expired'; END IF;

  IF v_item.collection_id IS NOT NULL THEN
    SELECT is_active INTO v_collection_active FROM public.skin_collections WHERE id = v_item.collection_id;
    IF COALESCE(v_collection_active, false) = false THEN RAISE EXCEPTION 'skin_collection_inactive'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_owned_skins
    WHERE profile_id = p_profile_id AND item_id = p_item_id AND item_type = 'instrument'
  ) THEN
    RAISE EXCEPTION 'instrument_skin_already_owned';
  END IF;

  v_price := GREATEST(0, COALESCE(v_item.price, 0));
  IF COALESCE(v_profile.cash, 0) < v_price THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  UPDATE public.profiles
  SET cash = COALESCE(cash, 0) - v_price
  WHERE id = p_profile_id
  RETURNING cash INTO v_remaining_cash;

  INSERT INTO public.player_owned_skins(profile_id,item_type,item_id,selected_variant_key,customization_config)
  VALUES (p_profile_id,'instrument',p_item_id,NULLIF(trim(p_variant_key),''),COALESCE(p_zone_colors,'{}'::jsonb))
  RETURNING id INTO v_ownership_id;

  INSERT INTO public.instrument_skin_purchases(profile_id,user_id,instrument_skin_item_id,ownership_id,amount,idempotency_key,selected_variant_key,customization_config)
  VALUES (p_profile_id,v_user_id,p_item_id,v_ownership_id,v_price,p_idempotency_key,NULLIF(trim(p_variant_key),''),COALESCE(p_zone_colors,'{}'::jsonb))
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object('status','completed','purchaseId',v_purchase_id,'ownershipId',v_ownership_id,'itemId',p_item_id,'amount',v_price,'remainingCash',v_remaining_cash);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_instrument_skin_atomic(uuid,uuid,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_instrument_skin_atomic(uuid,uuid,text,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_instrument_skin_atomic(uuid,uuid,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_owned_instrument_customization(
  p_profile_id uuid,
  p_item_id uuid,
  p_variant_key text DEFAULT NULL,
  p_zone_colors jsonb DEFAULT '{}'::jsonb,
  p_equipped boolean DEFAULT NULL
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
  v_target text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id AND p.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'profile_not_owned_by_user';
  END IF;

  SELECT pos.id, isi.target_instrument
    INTO v_ownership_id, v_target
  FROM public.player_owned_skins pos
  JOIN public.instrument_skin_items isi ON isi.id = pos.item_id
  WHERE pos.profile_id = p_profile_id
    AND pos.item_id = p_item_id
    AND pos.item_type = 'instrument'
  FOR UPDATE OF pos;

  IF v_ownership_id IS NULL THEN RAISE EXCEPTION 'instrument_skin_not_owned'; END IF;

  IF p_equipped IS TRUE THEN
    UPDATE public.player_owned_skins other
    SET is_equipped = false
    FROM public.instrument_skin_items other_item
    WHERE other.profile_id = p_profile_id
      AND other.item_type = 'instrument'
      AND other.is_equipped = true
      AND other.item_id <> p_item_id
      AND other_item.id = other.item_id
      AND other_item.target_instrument = v_target;
  END IF;

  UPDATE public.player_owned_skins pos
  SET selected_variant_key = NULLIF(trim(p_variant_key), ''),
      customization_config = COALESCE(p_zone_colors, '{}'::jsonb),
      is_equipped = COALESCE(p_equipped, pos.is_equipped)
  WHERE pos.id = v_ownership_id;

  RETURN QUERY
  SELECT pos.id, pos.selected_variant_key, pos.customization_config, pos.is_equipped
  FROM public.player_owned_skins pos
  WHERE pos.id = v_ownership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_owned_instrument_customization(uuid,uuid,text,jsonb,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_owned_instrument_customization(uuid,uuid,text,jsonb,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_owned_instrument_customization(uuid,uuid,text,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_equipped_stage_instrument_skins(p_profile_ids uuid[])
RETURNS TABLE(
  profile_id uuid,
  item_id uuid,
  instrument_id text,
  design_key text,
  body_color text,
  secondary_color text,
  pickguard_color text,
  hardware_color text,
  variant_matrix jsonb,
  customization_zones jsonb,
  selected_variant_key text,
  customization_config jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF COALESCE(cardinality(p_profile_ids), 0) = 0 THEN RETURN; END IF;
  IF cardinality(p_profile_ids) > 50 THEN RAISE EXCEPTION 'too_many_profiles'; END IF;

  RETURN QUERY
  SELECT
    pos.profile_id,
    pos.item_id,
    isi.target_instrument,
    isi.design_key,
    isi.body_color,
    isi.secondary_color,
    isi.pickguard_color,
    isi.hardware_color,
    isi.variant_matrix,
    isi.customization_zones,
    pos.selected_variant_key,
    COALESCE(pos.customization_config, '{}'::jsonb)
  FROM public.player_owned_skins pos
  JOIN public.instrument_skin_items isi ON isi.id = pos.item_id
  WHERE pos.profile_id = ANY(p_profile_ids)
    AND pos.item_type = 'instrument'
    AND pos.is_equipped = true
    AND isi.is_active = true
  ORDER BY pos.profile_id, isi.target_instrument, pos.item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_equipped_stage_instrument_skins(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_equipped_stage_instrument_skins(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_equipped_stage_instrument_skins(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_equipped_stage_instrument_skins(uuid[]) IS
  'Returns only equipped public instrument-cosmetic data required by the shared 3D stage renderer.';

-- Starter catalogue: deliberately distinct looks plus editable zones. New target
-- instruments can be added without changing ownership/customisation semantics.
INSERT INTO public.instrument_skin_items(
  external_key,name,description,target_instrument,price,rarity,featured,design_key,
  body_color,secondary_color,pickguard_color,hardware_color,variant_matrix,customization_zones
) VALUES
('midnight-blackout-guitar','Midnight Blackout','A deep gloss-black electric with smoked hardware and a colourable accent.','electric_guitar',650,'uncommon',true,'two_tone','#101217','#7b1f32','#08090b','#59616d',
 '[{"id":"black-red","label":"Black / Crimson","bodyColor":"#101217","secondaryColor":"#7b1f32","pickguardColor":"#08090b"},{"id":"black-teal","label":"Black / Teal","bodyColor":"#101217","secondaryColor":"#138b8f","pickguardColor":"#11151a"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#101217","playerEditable":true},{"id":"secondary","name":"Accent","color":"#7b1f32","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#08090b","playerEditable":true},{"id":"hardware","name":"Hardware","color":"#59616d","playerEditable":true}]'::jsonb),
('cherry-strike-guitar','Cherry Strike','Classic cherry red with twin stage-racing stripes.','electric_guitar',900,'rare',true,'racing_stripes','#a51f2b','#f4d8b1','#16171b','#c5cbd2',
 '[{"id":"cream-stripe","label":"Cherry / Cream","bodyColor":"#a51f2b","secondaryColor":"#f4d8b1"},{"id":"black-stripe","label":"Cherry / Black","bodyColor":"#b1222d","secondaryColor":"#13161a"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#a51f2b","playerEditable":true},{"id":"secondary","name":"Stripes","color":"#f4d8b1","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#16171b","playerEditable":true}]'::jsonb),
('neon-voltage-guitar','Neon Voltage','Electric blue finish with a sharp lightning graphic for high-energy stages.','electric_guitar',1250,'epic',true,'lightning','#1256b8','#65f1ff','#0b1020','#d5dae0',
 '[{"id":"blue-cyan","label":"Blue Voltage","bodyColor":"#1256b8","secondaryColor":"#65f1ff"},{"id":"purple-pink","label":"Purple Voltage","bodyColor":"#6525a8","secondaryColor":"#ff5ad7"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#1256b8","playerEditable":true},{"id":"secondary","name":"Lightning","color":"#65f1ff","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#0b1020","playerEditable":true}]'::jsonb),
('sunset-burst-guitar','Sunset Burst','A warm sunburst-style stage guitar with editable centre and edge tones.','electric_guitar',1050,'rare',false,'sunburst','#6c2418','#ef9f3e','#2a1713','#c4b08f',
 '[{"id":"amber-burst","label":"Amber Burst","bodyColor":"#6c2418","secondaryColor":"#ef9f3e"},{"id":"violet-burst","label":"Violet Burst","bodyColor":"#30194d","secondaryColor":"#bd5bd8"}]'::jsonb,
 '[{"id":"body","name":"Burst Edge","color":"#6c2418","playerEditable":true},{"id":"secondary","name":"Burst Centre","color":"#ef9f3e","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#2a1713","playerEditable":true}]'::jsonb),
('deep-sea-bass','Deep Sea Bass','Dark ocean-blue bass with a contrasting lower-body accent.','bass_guitar',750,'uncommon',true,'two_tone','#123b52','#20a6a8','#0b151b','#aeb8c1',
 '[{"id":"deep-sea","label":"Deep Sea","bodyColor":"#123b52","secondaryColor":"#20a6a8"},{"id":"night-sea","label":"Night Sea","bodyColor":"#102133","secondaryColor":"#416bb7"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#123b52","playerEditable":true},{"id":"secondary","name":"Accent","color":"#20a6a8","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#0b151b","playerEditable":true}]'::jsonb),
('checkerboard-riot-bass','Checkerboard Riot','Black-and-white checkerboard bass made for punk and ska stages.','bass_guitar',1100,'rare',true,'checker','#14161a','#f2efe5','#202226','#bfc4cb',
 '[{"id":"mono","label":"Monochrome","bodyColor":"#14161a","secondaryColor":"#f2efe5"},{"id":"pink-black","label":"Pink Riot","bodyColor":"#17131a","secondaryColor":"#ff4f9a"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#14161a","playerEditable":true},{"id":"secondary","name":"Checks","color":"#f2efe5","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#202226","playerEditable":true}]'::jsonb),
('inferno-bass','Inferno Bass','A dark bass with stylised flame graphics climbing from the bridge.','bass_guitar',1450,'epic',true,'flames','#281316','#ff5b25','#0d0d10','#c2a67d',
 '[{"id":"inferno","label":"Inferno","bodyColor":"#281316","secondaryColor":"#ff5b25"},{"id":"toxic","label":"Toxic Flame","bodyColor":"#101914","secondaryColor":"#8df34d"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#281316","playerEditable":true},{"id":"secondary","name":"Flames","color":"#ff5b25","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#0d0d10","playerEditable":true}]'::jsonb),
('arctic-chrome-bass','Arctic Chrome','Minimal white bass with cool metal hardware; clean enough for any genre.','bass_guitar',850,'rare',false,'solid','#eceff1','#c5d8e6','#d9dde0','#8e9baa',
 '[{"id":"arctic","label":"Arctic","bodyColor":"#eceff1","pickguardColor":"#d9dde0"},{"id":"ice-blue","label":"Ice Blue","bodyColor":"#b9dce8","pickguardColor":"#ecf6fa"}]'::jsonb,
 '[{"id":"body","name":"Body","color":"#eceff1","playerEditable":true},{"id":"pickguard","name":"Pickguard","color":"#d9dde0","playerEditable":true},{"id":"hardware","name":"Hardware","color":"#8e9baa","playerEditable":true}]'::jsonb)
ON CONFLICT (external_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  target_instrument = EXCLUDED.target_instrument,
  price = EXCLUDED.price,
  rarity = EXCLUDED.rarity,
  featured = EXCLUDED.featured,
  design_key = EXCLUDED.design_key,
  body_color = EXCLUDED.body_color,
  secondary_color = EXCLUDED.secondary_color,
  pickguard_color = EXCLUDED.pickguard_color,
  hardware_color = EXCLUDED.hardware_color,
  variant_matrix = EXCLUDED.variant_matrix,
  customization_zones = EXCLUDED.customization_zones,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
