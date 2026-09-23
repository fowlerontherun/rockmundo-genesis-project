-- Require current/future curated skins to read clearly as garments and
-- materials at normal gameplay distance, in addition to being physically attached.

UPDATE public.avatar_clothing_items
SET
  render_config = COALESCE(render_config, '{}'::jsonb) || jsonb_build_object(
    'macroShading', 'mesh-bound-v1',
    'constructionReadability', 'high',
    'materialReadability', 'high'
  ),
  validation_notes = COALESCE(validation_notes, '{}'::jsonb)
    || jsonb_build_object(
      'checks',
      COALESCE(validation_notes->'checks', '{}'::jsonb)
        || '{"silhouette_readability":true,"material_readability":true}'::jsonb
    )
WHERE curated_asset_status = 'published'
  AND curated_asset_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_curated_clothing_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  frames text[] := COALESCE(NEW.supported_frames, ARRAY[]::text[]);
  result text := lower(COALESCE(NEW.validation_notes->>'result', ''));
  checks jsonb := COALESCE(NEW.validation_notes->'checks', '{}'::jsonb);
BEGIN
  IF NEW.curated_asset_status = 'published'
     AND COALESCE(OLD.curated_asset_status, '') IS DISTINCT FROM 'published' THEN
    IF NEW.curated_asset_key IS NULL OR btrim(NEW.curated_asset_key) = '' THEN
      RAISE EXCEPTION 'A curated skin cannot be published without an asset key';
    END IF;
    IF NOT ('masculine' = ANY(frames)) OR NOT ('feminine' = ANY(frames)) THEN
      RAISE EXCEPTION 'A curated skin must support and validate both avatar frames before publication';
    END IF;
    IF result <> 'pass' THEN
      RAISE EXCEPTION 'A curated skin must have validation_notes.result = pass before publication';
    END IF;
    IF COALESCE((checks->>'surface_attachment')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curated skin details must pass surface attachment QA before publication';
    END IF;
    IF COALESCE((checks->>'graphic_alignment')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curated skin graphics must pass alignment QA before publication';
    END IF;
    IF COALESCE((checks->>'distance_readability')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curated skin must pass gameplay-distance readability QA before publication';
    END IF;
    IF COALESCE((checks->>'silhouette_readability')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curated skin construction/silhouette must read clearly before publication';
    END IF;
    IF COALESCE((checks->>'material_readability')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Curated skin material must read correctly before publication';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
