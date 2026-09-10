-- Keep the previous manifest while an edited garment is pending regeneration so the
-- renderer can remove its old immutable storage objects after a replacement succeeds.
-- The manifest is explicitly marked stale so player-facing helpers will not expose it.

CREATE OR REPLACE FUNCTION public.invalidate_clothing_preview_on_design_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.garment_config, NEW.material_config, NEW.pattern_config, NEW.detail_layers,
    NEW.fit_config, NEW.wear_config, NEW.customization_zones, NEW.render_config,
    NEW.variant_matrix, NEW.color_variants, NEW.rpm_asset_id
  ) IS DISTINCT FROM ROW(
    OLD.garment_config, OLD.material_config, OLD.pattern_config, OLD.detail_layers,
    OLD.fit_config, OLD.wear_config, OLD.customization_zones, OLD.render_config,
    OLD.variant_matrix, OLD.color_variants, OLD.rpm_asset_id
  ) THEN
    NEW.preview_status := 'pending';
    NEW.preview_generated_at := NULL;
    NEW.last_preview_error := NULL;
    NEW.preview_manifest := jsonb_set(
      COALESCE(OLD.preview_manifest, '{}'::jsonb),
      '{stale}',
      'true'::jsonb,
      true
    );
  END IF;
  RETURN NEW;
END;
$$;
