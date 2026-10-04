
DROP POLICY IF EXISTS "Browse active Luthiery listings" ON public.luthiery_shop_listings;

CREATE POLICY "Browse active Luthiery listings"
ON public.luthiery_shop_listings
FOR SELECT
TO authenticated
USING (
  (
    status='active'
    AND EXISTS (
      SELECT 1
      FROM public.luthiery_shops shop
      WHERE shop.id=luthiery_shop_listings.shop_id
        AND shop.is_open IS TRUE
    )
  )
  OR seller_user_id=(SELECT auth.uid())
  OR buyer_user_id=(SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.luthiery_shops shop
    WHERE shop.id=luthiery_shop_listings.shop_id
      AND shop.owner_user_id=(SELECT auth.uid())
  )
);

NOTIFY pgrst,'reload schema';
