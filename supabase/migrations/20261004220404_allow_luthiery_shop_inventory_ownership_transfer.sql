
ALTER TABLE public.luthiery_shop_listings
  ALTER COLUMN player_equipment_id DROP NOT NULL;

ALTER TABLE public.luthiery_shop_listings
  DROP CONSTRAINT IF EXISTS luthiery_shop_listings_player_equipment_id_fkey;

ALTER TABLE public.luthiery_shop_listings
  ADD CONSTRAINT luthiery_shop_listings_player_equipment_id_fkey
  FOREIGN KEY (player_equipment_id)
  REFERENCES public.player_equipment(id)
  ON DELETE SET NULL;
