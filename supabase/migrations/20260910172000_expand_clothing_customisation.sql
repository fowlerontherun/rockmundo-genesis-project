-- Rich clothing customisation schema for avatar skin items.
-- Keeps authoring data on avatar_clothing_items while validating a stable rendering contract.

ALTER TABLE public.avatar_clothing_items
  ADD COLUMN IF NOT EXISTS garment_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS material_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pattern_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS detail_layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fit_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS wear_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customization_zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS render_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variant_matrix jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.avatar_clothing_items.garment_config IS
  'Base garment construction: silhouette, cut, length, sleeve, collar, closure, hem and structural options.';
COMMENT ON COLUMN public.avatar_clothing_items.material_config IS
  'Surface/material properties such as fabric, roughness, sheen, metallic, normal strength and texture scale.';
COMMENT ON COLUMN public.avatar_clothing_items.pattern_config IS
  'Repeatable surface pattern configuration including type, scale, rotation, opacity and palette.';
COMMENT ON COLUMN public.avatar_clothing_items.detail_layers IS
  'Ordered decals, graphics, text, patches, embroidery, distressing, studs, zips and trims.';
COMMENT ON COLUMN public.avatar_clothing_items.fit_config IS
  'Garment fit and drape configuration.';
COMMENT ON COLUMN public.avatar_clothing_items.wear_config IS
  'Condition/wear styling such as pristine, faded, distressed, torn, dirty or vintage.';
COMMENT ON COLUMN public.avatar_clothing_items.customization_zones IS
  'Named garment zones that may be independently recoloured or decorated.';
COMMENT ON COLUMN public.avatar_clothing_items.render_config IS
  'Avatar rendering metadata, layering order, offsets, clipping/masking hints and thumbnail settings.';
COMMENT ON COLUMN public.avatar_clothing_items.variant_matrix IS
  'Admin-authored named presets combining colour/material/pattern/detail overrides into sellable variants.';

CREATE OR REPLACE FUNCTION public.validate_avatar_clothing_customisation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  layer jsonb;
  zone jsonb;
  variant jsonb;
  layer_count integer;
BEGIN
  IF jsonb_typeof(COALESCE(NEW.garment_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'garment_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.material_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'material_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.pattern_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'pattern_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.fit_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'fit_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.wear_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'wear_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.render_config, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'render_config must be an object'; END IF;
  IF jsonb_typeof(COALESCE(NEW.detail_layers, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'detail_layers must be an array'; END IF;
  IF jsonb_typeof(COALESCE(NEW.customization_zones, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'customization_zones must be an array'; END IF;
  IF jsonb_typeof(COALESCE(NEW.variant_matrix, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'variant_matrix must be an array'; END IF;

  layer_count := jsonb_array_length(COALESCE(NEW.detail_layers, '[]'::jsonb));
  IF layer_count > 24 THEN RAISE EXCEPTION 'A clothing item may have at most 24 detail layers'; END IF;
  IF jsonb_array_length(COALESCE(NEW.customization_zones, '[]'::jsonb)) > 12 THEN RAISE EXCEPTION 'A clothing item may have at most 12 customization zones'; END IF;
  IF jsonb_array_length(COALESCE(NEW.variant_matrix, '[]'::jsonb)) > 40 THEN RAISE EXCEPTION 'A clothing item may have at most 40 named variants'; END IF;

  FOR layer IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.detail_layers, '[]'::jsonb)) LOOP
    IF COALESCE(layer->>'type', '') NOT IN ('decal','graphic','text','patch','embroidery','trim','studs','zip','buttons','distress','stitching','badge') THEN
      RAISE EXCEPTION 'Unsupported clothing detail layer type: %', layer->>'type';
    END IF;
    IF COALESCE((layer->>'opacity')::numeric, 1) < 0 OR COALESCE((layer->>'opacity')::numeric, 1) > 1 THEN
      RAISE EXCEPTION 'Detail layer opacity must be between 0 and 1';
    END IF;
  END LOOP;

  FOR zone IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.customization_zones, '[]'::jsonb)) LOOP
    IF NULLIF(trim(zone->>'id'), '') IS NULL OR NULLIF(trim(zone->>'name'), '') IS NULL THEN
      RAISE EXCEPTION 'Customization zones require id and name';
    END IF;
  END LOOP;

  FOR variant IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.variant_matrix, '[]'::jsonb)) LOOP
    IF NULLIF(trim(variant->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Named clothing variants require a name'; END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_avatar_clothing_customisation ON public.avatar_clothing_items;
CREATE TRIGGER trg_validate_avatar_clothing_customisation
BEFORE INSERT OR UPDATE OF garment_config, material_config, pattern_config, detail_layers, fit_config, wear_config, customization_zones, render_config, variant_matrix
ON public.avatar_clothing_items
FOR EACH ROW EXECUTE FUNCTION public.validate_avatar_clothing_customisation();

CREATE INDEX IF NOT EXISTS idx_avatar_clothing_material ON public.avatar_clothing_items ((material_config->>'fabric'));
CREATE INDEX IF NOT EXISTS idx_avatar_clothing_pattern ON public.avatar_clothing_items ((pattern_config->>'type'));

NOTIFY pgrst, 'reload schema';
