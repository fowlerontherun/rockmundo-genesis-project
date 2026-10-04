
CREATE OR REPLACE FUNCTION public.purchase_luthiery_shop_listing(
  p_profile_id uuid,
  p_listing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_buyer public.profiles%ROWTYPE;
  v_listing public.luthiery_shop_listings%ROWTYPE;
  v_shop public.luthiery_shops%ROWTYPE;
  v_owned public.player_equipment%ROWTYPE;
  v_existing_sale public.luthiery_shop_sales%ROWTYPE;
  v_commission bigint := 0;
  v_seller_received bigint;
  v_buyer_equipment_id uuid;
  v_sale_id uuid;
  v_value_score integer;
  v_reliability_score integer;
  v_reputation numeric;
  v_completed integer;
  v_cancelled integer;
  v_quality_total bigint;
  v_value_total bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_buyer FROM public.profiles
  WHERE id=p_profile_id AND user_id=v_user_id AND is_active IS TRUE
    AND died_at IS NULL AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_shop_active_profile_required' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_listing_id::text,0));

  SELECT * INTO v_listing FROM public.luthiery_shop_listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_listing_not_found' USING ERRCODE='P0001'; END IF;

  IF v_listing.status='sold' THEN
    SELECT * INTO v_existing_sale FROM public.luthiery_shop_sales WHERE listing_id=v_listing.id;
    IF FOUND AND v_existing_sale.buyer_profile_id=p_profile_id THEN
      RETURN jsonb_build_object(
        'status','already_completed','saleId',v_existing_sale.id,'listingId',v_listing.id,
        'equipmentId',v_listing.equipment_id,'playerEquipmentId',v_existing_sale.buyer_player_equipment_id,
        'instrumentName',v_listing.instrument_name,'salePrice',v_existing_sale.sale_price,
        'makerCommission',v_existing_sale.maker_commission,'sellerReceived',v_existing_sale.seller_received,
        'reputation',v_existing_sale.reputation_after,'provenance',v_existing_sale.provenance_snapshot
      );
    END IF;
    RAISE EXCEPTION 'luthiery_shop_listing_not_active' USING ERRCODE='P0001';
  END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'luthiery_shop_listing_not_active' USING ERRCODE='P0001'; END IF;
  IF v_listing.seller_user_id=v_user_id THEN RAISE EXCEPTION 'luthiery_shop_cannot_buy_own_listing' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_shop FROM public.luthiery_shops WHERE id=v_listing.shop_id FOR UPDATE;
  IF NOT FOUND OR v_shop.is_open IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'luthiery_shop_closed' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_owned FROM public.player_equipment
  WHERE id=v_listing.player_equipment_id
    AND profile_id=v_listing.seller_profile_id
    AND user_id=v_listing.seller_user_id
    AND equipment_id=v_listing.equipment_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_instrument_unavailable' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_owned.is_equipped,false) OR COALESCE(v_owned.equipped,false) THEN
    RAISE EXCEPTION 'luthiery_shop_instrument_equipped' USING ERRCODE='P0001';
  END IF;

  IF v_listing.maker_profile_id <> v_listing.seller_profile_id THEN
    v_commission := floor(v_listing.asking_price * (v_shop.commission_rate / 100.0))::bigint;
  END IF;
  v_seller_received := v_listing.asking_price-v_commission;

  UPDATE public.luthiery_shop_listings SET status='processing',updated_at=now() WHERE id=v_listing.id;

  BEGIN
    PERFORM public.finance_transfer(
      'player'::public.financial_owner_type,
      p_profile_id,
      'player'::public.financial_owner_type,
      v_listing.seller_profile_id,
      v_seller_received * 100,
      'equipment_purchase'::public.financial_transaction_category,
      'Player-crafted instrument purchase: ' || v_listing.instrument_name,
      'luthiery-shop:' || v_listing.id::text || ':seller',
      'luthiery_shop_listing',
      v_listing.id,
      p_profile_id,
      jsonb_build_object(
        'source','luthiery_shop',
        'instrument_name',v_listing.instrument_name,
        'seller_profile_id',v_listing.seller_profile_id,
        'maker_profile_id',v_listing.maker_profile_id,
        'component','seller_proceeds'
      )
    );

    IF v_commission > 0 THEN
      PERFORM public.finance_transfer(
        'player'::public.financial_owner_type,
        p_profile_id,
        'player'::public.financial_owner_type,
        v_listing.maker_profile_id,
        v_commission * 100,
        'equipment_sale'::public.financial_transaction_category,
        'Luthier resale commission: ' || v_listing.instrument_name,
        'luthiery-shop:' || v_listing.id::text || ':maker',
        'luthiery_shop_listing',
        v_listing.id,
        p_profile_id,
        jsonb_build_object(
          'source','luthiery_shop',
          'instrument_name',v_listing.instrument_name,
          'seller_profile_id',v_listing.seller_profile_id,
          'maker_profile_id',v_listing.maker_profile_id,
          'component','maker_commission'
        )
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'insufficient funds' THEN
        RAISE EXCEPTION 'luthiery_shop_insufficient_funds' USING ERRCODE='P0001';
      END IF;
      RAISE;
  END;

  DELETE FROM public.player_equipment WHERE id=v_owned.id;

  INSERT INTO public.player_equipment(user_id,profile_id,equipment_id,is_equipped,equipped,condition)
  VALUES(v_user_id,p_profile_id,v_listing.equipment_id,false,false,v_listing.condition_at_listing)
  RETURNING id INTO v_buyer_equipment_id;

  v_value_score := CASE
    WHEN v_listing.asking_price <= v_listing.suggested_value THEN 100
    ELSE greatest(0,least(100,
      round(100 - (((v_listing.asking_price-v_listing.suggested_value)::numeric / v_listing.suggested_value)*100))::integer
    ))
  END;

  v_completed := v_shop.completed_sales+1;
  v_cancelled := v_shop.cancelled_listings;
  v_quality_total := v_shop.quality_score_total+v_listing.final_quality;
  v_value_total := v_shop.value_score_total+v_value_score;
  v_reliability_score := round((v_completed::numeric/(v_completed+v_cancelled))*100)::integer;

  v_reputation := round(
    ((v_quality_total::numeric/v_completed)*0.5)
    + ((v_value_total::numeric/v_completed)*0.3)
    + (v_reliability_score*0.2),2
  );
  v_reputation := least(100,greatest(0,v_reputation));

  UPDATE public.luthiery_shops
  SET completed_sales=v_completed,
      quality_score_total=v_quality_total,
      value_score_total=v_value_total,
      gross_sales=gross_sales+v_listing.asking_price,
      reputation=v_reputation,
      updated_at=now()
  WHERE id=v_shop.id;

  UPDATE public.luthiery_shop_listings
  SET status='sold',buyer_profile_id=p_profile_id,buyer_user_id=v_user_id,
      final_sale_price=asking_price,sold_at=now(),updated_at=now()
  WHERE id=v_listing.id;

  INSERT INTO public.luthiery_shop_sales(
    listing_id,shop_id,equipment_id,seller_profile_id,seller_user_id,buyer_profile_id,buyer_user_id,
    maker_profile_id,maker_name,sale_price,commission_rate,maker_commission,seller_received,
    quality_score,value_score,reliability_score,reputation_after,provenance_snapshot,stat_snapshot,
    buyer_player_equipment_id
  )
  VALUES(
    v_listing.id,v_shop.id,v_listing.equipment_id,v_listing.seller_profile_id,v_listing.seller_user_id,
    p_profile_id,v_user_id,v_listing.maker_profile_id,v_listing.maker_name,v_listing.asking_price,
    v_shop.commission_rate,v_commission,v_seller_received,v_listing.final_quality,v_value_score,
    v_reliability_score,v_reputation,v_listing.provenance_snapshot,v_listing.stat_snapshot,v_buyer_equipment_id
  )
  RETURNING id INTO v_sale_id;

  RETURN jsonb_build_object(
    'status','completed','saleId',v_sale_id,'listingId',v_listing.id,
    'equipmentId',v_listing.equipment_id,'playerEquipmentId',v_buyer_equipment_id,
    'instrumentName',v_listing.instrument_name,'salePrice',v_listing.asking_price,
    'makerCommission',v_commission,'sellerReceived',v_seller_received,
    'reputation',v_reputation,'provenance',v_listing.provenance_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
