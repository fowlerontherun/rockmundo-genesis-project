-- Server-side publication guard for curated clothing. Client UI has a richer
-- checklist, but the database also prevents accidental publication of an asset
-- that has not recorded both supported avatar frames and a passing validation.

CREATE OR REPLACE FUNCTION public.guard_curated_clothing_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  frames text[] := COALESCE(NEW.supported_frames, ARRAY[]::text[]);
  result text := lower(COALESCE(NEW.validation_notes->>'result', ''));
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_curated_clothing_publication_trigger
  ON public.avatar_clothing_items;
CREATE TRIGGER guard_curated_clothing_publication_trigger
BEFORE INSERT OR UPDATE OF curated_asset_status, curated_asset_key, supported_frames, validation_notes
ON public.avatar_clothing_items
FOR EACH ROW
EXECUTE FUNCTION public.guard_curated_clothing_publication();
