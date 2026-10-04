
CREATE INDEX IF NOT EXISTS idx_luthiery_shops_owner_user
  ON public.luthiery_shops(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_seller_profile
  ON public.luthiery_shop_listings(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_seller_user
  ON public.luthiery_shop_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_equipment
  ON public.luthiery_shop_listings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_craft
  ON public.luthiery_shop_listings(craft_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_buyer_profile
  ON public.luthiery_shop_listings(buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_listings_buyer_user
  ON public.luthiery_shop_listings(buyer_user_id);

CREATE INDEX IF NOT EXISTS idx_luthiery_shop_sales_equipment
  ON public.luthiery_shop_sales(equipment_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_sales_seller_user
  ON public.luthiery_shop_sales(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_sales_buyer_user
  ON public.luthiery_shop_sales(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_sales_maker_profile
  ON public.luthiery_shop_sales(maker_profile_id);
CREATE INDEX IF NOT EXISTS idx_luthiery_shop_sales_buyer_player_equipment
  ON public.luthiery_shop_sales(buyer_player_equipment_id);
