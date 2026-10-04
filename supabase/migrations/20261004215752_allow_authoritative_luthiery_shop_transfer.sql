
CREATE OR REPLACE FUNCTION private.prevent_active_luthiery_listing_equipment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.luthiery_shop_listings
    WHERE player_equipment_id=OLD.id
      AND status='active'
  ) THEN
    RAISE EXCEPTION 'luthiery_shop_listed_instrument_locked' USING ERRCODE='P0001';
  END IF;

  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
