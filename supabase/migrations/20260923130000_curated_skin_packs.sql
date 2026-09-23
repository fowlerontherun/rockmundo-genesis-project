-- Curated clothing asset metadata and first permanent packs.
-- Existing procedural/legacy items remain valid; new curated items can be tracked
-- independently of the old browser geometry authoring controls.

ALTER TABLE public.avatar_clothing_items
  ADD COLUMN IF NOT EXISTS curated_asset_key text,
  ADD COLUMN IF NOT EXISTS curated_asset_status text NOT NULL DEFAULT 'legacy'
    CHECK (curated_asset_status IN ('legacy','planned','asset_ready','validated','published','blocked')),
  ADD COLUMN IF NOT EXISTS supported_frames text[] NOT NULL DEFAULT ARRAY['masculine','feminine']::text[],
  ADD COLUMN IF NOT EXISTS validation_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_avatar_clothing_curated_asset_key
  ON public.avatar_clothing_items(curated_asset_key)
  WHERE curated_asset_key IS NOT NULL;

COMMENT ON COLUMN public.avatar_clothing_items.curated_asset_key IS
  'Stable identifier for a pre-built curated garment asset. Null means legacy/non-curated content.';
COMMENT ON COLUMN public.avatar_clothing_items.curated_asset_status IS
  'Lifecycle for curated assets: planned, asset_ready, validated, published or blocked. Legacy preserves existing items.';
COMMENT ON COLUMN public.avatar_clothing_items.supported_frames IS
  'Avatar frames the curated asset has been authored and validated against.';
COMMENT ON COLUMN public.avatar_clothing_items.validation_notes IS
  'Structured fit/clip validation results for curated clothing.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.skin_collections WHERE lower(name) = 'starter wardrobe') THEN
    INSERT INTO public.skin_collections
      (name, description, theme, starts_at, ends_at, is_active, sort_order)
    VALUES
      ('Starter Wardrobe',
       'Core Rockmundo clothing: reliable everyday pieces that define the base visual style.',
       'monthly', now(), NULL, true, 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skin_collections WHERE lower(name) = 'punk essentials') THEN
    INSERT INTO public.skin_collections
      (name, description, theme, starts_at, ends_at, is_active, sort_order)
    VALUES
      ('Punk Essentials',
       'Ripped tees, tartan, denim, leather and boots built for punk stages and small clubs.',
       'monthly', now(), NULL, true, 6);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
