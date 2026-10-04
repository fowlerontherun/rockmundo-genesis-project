
REVOKE SELECT ON public.luthiery_shops FROM anon;
REVOKE SELECT ON public.luthiery_shop_listings FROM anon;

DROP POLICY IF EXISTS "Browse open Luthiery shops" ON public.luthiery_shops;
CREATE POLICY "Browse open Luthiery shops"
ON public.luthiery_shops FOR SELECT
TO authenticated
USING (is_open IS TRUE OR owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Browse active Luthiery listings" ON public.luthiery_shop_listings;
CREATE POLICY "Browse active Luthiery listings"
ON public.luthiery_shop_listings FOR SELECT
TO authenticated
USING (
  status = 'active'
  OR seller_user_id = (SELECT auth.uid())
  OR buyer_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.luthiery_shops s
    WHERE s.id = luthiery_shop_listings.shop_id
      AND s.owner_user_id = (SELECT auth.uid())
  )
);

NOTIFY pgrst,'reload schema';
