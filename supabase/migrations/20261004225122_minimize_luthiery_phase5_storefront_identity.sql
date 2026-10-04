
CREATE OR REPLACE FUNCTION public.browse_luthiery_shop_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY listed_at DESC),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      listing.listed_at,
      jsonb_build_object(
        'id',listing.id,
        'shop_id',listing.shop_id,
        'is_own_listing',(listing.seller_user_id=v_user_id),
        'maker_name',listing.maker_name,
        'instrument_name',listing.instrument_name,
        'instrument_kind',listing.instrument_kind,
        'rarity',listing.rarity,
        'final_quality',listing.final_quality,
        'condition_at_listing',listing.condition_at_listing,
        'asking_price',listing.asking_price,
        'suggested_value',listing.suggested_value,
        'description',listing.description,
        'provenance_snapshot',listing.provenance_snapshot,
        'stat_snapshot',listing.stat_snapshot,
        'commission_rate_at_listing',listing.commission_rate_at_listing,
        'status',listing.status,
        'listed_at',listing.listed_at,
        'shop',jsonb_build_object(
          'id',shop.id,
          'name',shop.name,
          'brand_tagline',shop.brand_tagline,
          'brand_colour',shop.brand_colour,
          'brand_logo_url',shop.brand_logo_url,
          'city_id',shop.city_id,
          'reputation',shop.reputation,
          'completed_sales',shop.completed_sales,
          'is_open',shop.is_open,
          'city',jsonb_build_object(
            'id',city.id,
            'name',city.name,
            'country',city.country
          )
        )
      ) AS row_data
    FROM public.luthiery_shop_listings listing
    JOIN public.luthiery_shops shop ON shop.id=listing.shop_id
    JOIN public.cities city ON city.id=shop.city_id
    WHERE listing.status='active'
      AND shop.is_open IS TRUE
  ) storefront;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.browse_luthiery_shop_listings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_luthiery_shop_listings() TO authenticated;
NOTIFY pgrst,'reload schema';
