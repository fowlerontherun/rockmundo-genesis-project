-- A real Avatar V1 headwear item. It is owned and equipped through the same
-- wardrobe tables used by archived and live 3D stage player visuals.
-- Give one to every existing player character and all new characters through
-- the end of the 2026 event. Never auto-equip or remove it after Halloween.

INSERT INTO public.avatar_clothing_items (
  name, description, category, wearable_slot, price, is_premium, rarity,
  color_variants, collection_id, release_date, is_limited_edition, featured,
  curated_asset_key, curated_asset_status, supported_frames, validation_notes,
  material_config, pattern_config, fit_config, wear_config, customization_zones,
  render_config, variant_matrix, preview_status, schema_version, external_key
) VALUES (
  'Haunted Pumpkin Hat 2026',
  'A free limited-edition jack-o''-lantern hat for The Haunted Stage. Wear it on stage to join the Halloween celebration. Yours to keep.',
  'hat', 'headwear', 0, false, 'rare',
  '["#ee781c"]'::jsonb, NULL, DATE '2026-10-24', true, true,
  'clothing.halloween.2026.pumpkin-hat', 'published', ARRAY['masculine','feminine'],
  '{"renderer":"avatar-v1-head-bone","frames":["masculine","feminine"],"poses":["idle","singing","guitar","bass","drums"]}'::jsonb,
  '{"fabric":"costume","primaryColor":"#ee781c"}'::jsonb,
  '{"type":"solid"}'::jsonb,
  '{"fit":"regular"}'::jsonb,
  '{"condition":"new"}'::jsonb,
  '[]'::jsonb,
  '{"headwearStyle":"pumpkin","renderFamily":"avatar-v1-accessory"}'::jsonb,
  '[]'::jsonb, 'ready', 1, 'rockmundo.halloween.2026.pumpkin-hat'
)
ON CONFLICT (curated_asset_key) WHERE curated_asset_key IS NOT NULL DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    wearable_slot = EXCLUDED.wearable_slot,
    price = EXCLUDED.price,
    is_premium = EXCLUDED.is_premium,
    rarity = EXCLUDED.rarity,
    color_variants = EXCLUDED.color_variants,
    release_date = EXCLUDED.release_date,
    is_limited_edition = EXCLUDED.is_limited_edition,
    featured = EXCLUDED.featured,
    curated_asset_status = EXCLUDED.curated_asset_status,
    supported_frames = EXCLUDED.supported_frames,
    validation_notes = EXCLUDED.validation_notes,
    material_config = EXCLUDED.material_config,
    pattern_config = EXCLUDED.pattern_config,
    fit_config = EXCLUDED.fit_config,
    wear_config = EXCLUDED.wear_config,
    render_config = EXCLUDED.render_config,
    preview_status = EXCLUDED.preview_status;

-- Idempotent backfill for accounts already present at migration time.
INSERT INTO public.player_owned_skins (profile_id, item_type, item_id, is_equipped)
SELECT p.id, 'clothing', hat.id, false
FROM public.profiles p
JOIN public.avatar_clothing_items hat
  ON hat.curated_asset_key = 'clothing.halloween.2026.pumpkin-hat'
WHERE p.user_id IS NOT NULL
ON CONFLICT (profile_id, item_type, item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_halloween_2026_pumpkin_hat()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hat_id uuid;
BEGIN
  -- Only new playable characters created before the event ends. The hat
  -- remains owned afterwards; this trigger never alters existing equipment.
  IF NEW.user_id IS NULL
     OR current_timestamp >= ('2026-11-02 00:00 Europe/London')::timestamptz THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_hat_id
  FROM public.avatar_clothing_items
  WHERE curated_asset_key = 'clothing.halloween.2026.pumpkin-hat';

  IF v_hat_id IS NOT NULL THEN
    INSERT INTO public.player_owned_skins (profile_id, item_type, item_id, is_equipped)
    VALUES (NEW.id, 'clothing', v_hat_id, false)
    ON CONFLICT (profile_id, item_type, item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_halloween_2026_pumpkin_hat_on_profile ON public.profiles;
CREATE TRIGGER grant_halloween_2026_pumpkin_hat_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_halloween_2026_pumpkin_hat();

REVOKE ALL ON FUNCTION public.grant_halloween_2026_pumpkin_hat() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
