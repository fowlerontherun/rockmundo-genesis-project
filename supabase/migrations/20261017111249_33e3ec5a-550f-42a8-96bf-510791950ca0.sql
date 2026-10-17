REVOKE SELECT ON public.luthiery_shops FROM anon;
REVOKE SELECT ON public.luthiery_shop_listings FROM anon;
GRANT SELECT ON public.luthiery_shops TO authenticated;
GRANT SELECT ON public.luthiery_shop_listings TO authenticated;

DROP POLICY IF EXISTS "Browse open Luthiery shops" ON public.luthiery_shops;
CREATE POLICY "Browse open Luthiery shops"
ON public.luthiery_shops FOR SELECT TO authenticated
USING (is_open IS TRUE OR owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Browse active Luthiery listings" ON public.luthiery_shop_listings;
CREATE POLICY "Browse active Luthiery listings"
ON public.luthiery_shop_listings FOR SELECT TO authenticated
USING (
  (status = 'active' AND EXISTS (
    SELECT 1 FROM public.luthiery_shops shop
    WHERE shop.id = luthiery_shop_listings.shop_id AND shop.is_open IS TRUE))
  OR seller_user_id = (SELECT auth.uid())
  OR buyer_user_id = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.luthiery_shops shop
    WHERE shop.id = luthiery_shop_listings.shop_id AND shop.owner_user_id = (SELECT auth.uid()))
);
NOTIFY pgrst, 'reload schema';