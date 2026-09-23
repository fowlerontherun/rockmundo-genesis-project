-- Retire legacy procedural clothing from sale while preserving existing ownership.
-- The Skin Store only surfaces published curated items, and this trigger enforces
-- the same rule server-side so legacy catalogue IDs cannot still be purchased.

CREATE OR REPLACE FUNCTION public.guard_clothing_skin_purchase_catalogue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_key text;
BEGIN
  SELECT curated_asset_status, curated_asset_key
    INTO v_status, v_key
  FROM public.avatar_clothing_items
  WHERE id = NEW.clothing_item_id;

  IF v_status IS DISTINCT FROM 'published'
     OR v_key IS NULL
     OR btrim(v_key) = '' THEN
    RAISE EXCEPTION 'clothing_item_not_for_sale';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_clothing_skin_purchase_catalogue_trigger
  ON public.clothing_skin_purchases;

CREATE TRIGGER guard_clothing_skin_purchase_catalogue_trigger
BEFORE INSERT ON public.clothing_skin_purchases
FOR EACH ROW
EXECUTE FUNCTION public.guard_clothing_skin_purchase_catalogue();
