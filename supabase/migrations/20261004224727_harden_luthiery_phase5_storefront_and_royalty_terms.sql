
ALTER TABLE public.luthiery_shop_listings ADD COLUMN IF NOT EXISTS commission_rate_at_listing numeric(5,2);
UPDATE public.luthiery_shop_listings listing
SET commission_rate_at_listing=CASE
 WHEN listing.maker_profile_id=listing.seller_profile_id THEN 0
 ELSE COALESCE(
  (SELECT sale.commission_rate FROM public.luthiery_shop_sales sale WHERE sale.listing_id=listing.id LIMIT 1),
  (SELECT shop.commission_rate FROM public.luthiery_shops shop WHERE shop.id=listing.shop_id),0)
END
WHERE commission_rate_at_listing IS NULL;
ALTER TABLE public.luthiery_shop_listings
  ALTER COLUMN commission_rate_at_listing SET DEFAULT 0,
  ALTER COLUMN commission_rate_at_listing SET NOT NULL;
ALTER TABLE public.luthiery_shop_listings DROP CONSTRAINT IF EXISTS luthiery_shop_listings_commission_rate_at_listing_check;
ALTER TABLE public.luthiery_shop_listings ADD CONSTRAINT luthiery_shop_listings_commission_rate_at_listing_check CHECK (commission_rate_at_listing BETWEEN 0 AND 15);

ALTER TABLE public.luthiery_shops DROP CONSTRAINT IF EXISTS luthiery_shops_brand_logo_https_check;
ALTER TABLE public.luthiery_shops ADD CONSTRAINT luthiery_shops_brand_logo_https_check CHECK (
 brand_logo_url IS NULL OR (left(lower(btrim(brand_logo_url)),8)='https://' AND btrim(brand_logo_url) !~ '[[:space:]]')
);

CREATE OR REPLACE FUNCTION public.open_luthiery_shop(p_profile_id uuid, p_name text, p_brand_tagline text DEFAULT NULL::text, p_brand_colour text DEFAULT '#b8892f'::text, p_brand_logo_url text DEFAULT NULL::text, p_commission_rate numeric DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_shop public.luthiery_shops%ROWTYPE;
  v_basic integer;
  v_professional integer;
  v_mastery integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id=p_profile_id
    AND user_id=v_user_id
    AND is_active IS TRUE
    AND died_at IS NULL
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_shop_active_profile_required' USING ERRCODE='P0001';
  END IF;
  IF v_profile.current_city_id IS NULL THEN
    RAISE EXCEPTION 'luthiery_shop_city_required' USING ERRCODE='P0001';
  END IF;

  v_basic := public.skill_progress_level_for_slug(p_profile_id,'luthiery_basic_technical');
  v_professional := public.skill_progress_level_for_slug(p_profile_id,'luthiery_professional_technical');
  v_mastery := public.skill_progress_level_for_slug(p_profile_id,'luthiery_mastery_technical');
  IF v_basic < 20 AND v_professional < 1 AND v_mastery < 1 THEN
    RAISE EXCEPTION 'luthiery_shop_professional_required' USING ERRCODE='P0001';
  END IF;

  IF char_length(btrim(COALESCE(p_name,''))) NOT BETWEEN 3 AND 50 THEN
    RAISE EXCEPTION 'luthiery_shop_name_invalid' USING ERRCODE='P0001';
  END IF;
  IF char_length(COALESCE(p_brand_tagline,'')) > 120 THEN
    RAISE EXCEPTION 'luthiery_shop_tagline_invalid' USING ERRCODE='P0001';
  END IF;
  IF lower(COALESCE(p_brand_colour,'')) !~ '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'luthiery_shop_colour_invalid' USING ERRCODE='P0001';
  END IF;
  IF char_length(COALESCE(p_brand_logo_url,'')) > 500
     OR (
       nullif(btrim(COALESCE(p_brand_logo_url,'')),'') IS NOT NULL
       AND (
         left(lower(btrim(p_brand_logo_url)),8) <> 'https://'
         OR btrim(p_brand_logo_url) ~ '[[:space:]]'
       )
     ) THEN
    RAISE EXCEPTION 'luthiery_shop_logo_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_commission_rate IS NULL OR p_commission_rate < 0 OR p_commission_rate > 15 THEN
    RAISE EXCEPTION 'luthiery_shop_commission_invalid' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.luthiery_shops(
    owner_profile_id,owner_user_id,name,brand_tagline,brand_colour,brand_logo_url,
    city_id,commission_rate
  )
  VALUES (
    p_profile_id,v_user_id,btrim(p_name),nullif(btrim(COALESCE(p_brand_tagline,'')),''),
    lower(p_brand_colour),nullif(btrim(COALESCE(p_brand_logo_url,'')),''),
    v_profile.current_city_id,p_commission_rate
  )
  ON CONFLICT (owner_profile_id) DO NOTHING
  RETURNING * INTO v_shop;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'luthiery_shop_already_exists' USING ERRCODE='P0001';
  END IF;

  RETURN jsonb_build_object(
    'shopId',v_shop.id,'name',v_shop.name,'cityId',v_shop.city_id,
    'reputation',v_shop.reputation,'commissionRate',v_shop.commission_rate
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_luthiery_shop(p_profile_id uuid, p_name text, p_brand_tagline text DEFAULT NULL::text, p_brand_colour text DEFAULT '#b8892f'::text, p_brand_logo_url text DEFAULT NULL::text, p_commission_rate numeric DEFAULT 5, p_is_open boolean DEFAULT true, p_move_to_current_city boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_shop public.luthiery_shops%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id=p_profile_id AND user_id=v_user_id AND is_active IS TRUE
    AND died_at IS NULL AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_shop_active_profile_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_shop
  FROM public.luthiery_shops
  WHERE owner_profile_id=p_profile_id AND owner_user_id=v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_not_found' USING ERRCODE='P0001'; END IF;

  IF char_length(btrim(COALESCE(p_name,''))) NOT BETWEEN 3 AND 50 THEN
    RAISE EXCEPTION 'luthiery_shop_name_invalid' USING ERRCODE='P0001';
  END IF;
  IF char_length(COALESCE(p_brand_tagline,'')) > 120 THEN
    RAISE EXCEPTION 'luthiery_shop_tagline_invalid' USING ERRCODE='P0001';
  END IF;
  IF lower(COALESCE(p_brand_colour,'')) !~ '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'luthiery_shop_colour_invalid' USING ERRCODE='P0001';
  END IF;
  IF char_length(COALESCE(p_brand_logo_url,'')) > 500
     OR (
       nullif(btrim(COALESCE(p_brand_logo_url,'')),'') IS NOT NULL
       AND (
         left(lower(btrim(p_brand_logo_url)),8) <> 'https://'
         OR btrim(p_brand_logo_url) ~ '[[:space:]]'
       )
     ) THEN
    RAISE EXCEPTION 'luthiery_shop_logo_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_commission_rate IS NULL OR p_commission_rate < 0 OR p_commission_rate > 15 THEN
    RAISE EXCEPTION 'luthiery_shop_commission_invalid' USING ERRCODE='P0001';
  END IF;
  IF p_move_to_current_city AND v_profile.current_city_id IS NULL THEN
    RAISE EXCEPTION 'luthiery_shop_city_required' USING ERRCODE='P0001';
  END IF;

  UPDATE public.luthiery_shops
  SET name=btrim(p_name),
      brand_tagline=nullif(btrim(COALESCE(p_brand_tagline,'')),''),
      brand_colour=lower(p_brand_colour),
      brand_logo_url=nullif(btrim(COALESCE(p_brand_logo_url,'')),''),
      commission_rate=p_commission_rate,
      is_open=COALESCE(p_is_open,true),
      city_id=CASE WHEN p_move_to_current_city THEN v_profile.current_city_id ELSE city_id END,
      updated_at=now()
  WHERE id=v_shop.id
  RETURNING * INTO v_shop;

  RETURN jsonb_build_object(
    'shopId',v_shop.id,'name',v_shop.name,'cityId',v_shop.city_id,
    'reputation',v_shop.reputation,'commissionRate',v_shop.commission_rate,'isOpen',v_shop.is_open
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_luthiery_shop_listing(p_profile_id uuid, p_player_equipment_id uuid, p_asking_price bigint, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_shop public.luthiery_shops%ROWTYPE;
  v_owned public.player_equipment%ROWTYPE;
  v_item public.equipment_items%ROWTYPE;
  v_craft public.luthiery_crafts%ROWTYPE;
  v_listing_id uuid;
  v_maker_name text;
  v_material_cost bigint := 0;
  v_suggested_value bigint;
  v_provenance jsonb;
  v_commission_rate numeric(5,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;
  IF p_asking_price IS NULL OR p_asking_price < 1 OR p_asking_price > 1000000000 THEN
    RAISE EXCEPTION 'luthiery_shop_price_invalid' USING ERRCODE='P0001';
  END IF;
  IF char_length(COALESCE(p_description,'')) > 500 THEN
    RAISE EXCEPTION 'luthiery_shop_description_invalid' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE id=p_profile_id AND user_id=v_user_id AND is_active IS TRUE
    AND died_at IS NULL AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_shop_active_profile_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_shop FROM public.luthiery_shops
  WHERE owner_profile_id=p_profile_id AND owner_user_id=v_user_id AND is_open IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_open_shop_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_owned FROM public.player_equipment
  WHERE id=p_player_equipment_id AND profile_id=p_profile_id AND user_id=v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_instrument_not_owned' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_owned.is_equipped,false) OR COALESCE(v_owned.equipped,false) THEN
    RAISE EXCEPTION 'luthiery_shop_instrument_equipped' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_item FROM public.equipment_items WHERE id=v_owned.equipment_id;
  IF NOT FOUND OR v_item.is_crafted IS DISTINCT FROM true OR v_item.subcategory IS DISTINCT FROM 'custom_luthiery' THEN
    RAISE EXCEPTION 'luthiery_shop_player_crafted_only' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_craft FROM public.luthiery_crafts WHERE equipment_id=v_item.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'luthiery_shop_provenance_required' USING ERRCODE='P0001'; END IF;

  SELECT COALESCE(display_name,username,'Unknown maker') INTO v_maker_name
  FROM public.profiles WHERE id=v_item.crafted_by_profile_id;

  SELECT COALESCE(sum(cm.base_cost),0)::bigint
  INTO v_material_cost
  FROM jsonb_array_elements(v_craft.material_snapshot) AS material_entry
  JOIN public.crafting_materials cm
    ON cm.id=(material_entry->>'materialId')::uuid;

  v_suggested_value := greatest(
    1000::bigint,
    round(v_material_cost * (1.25 + (v_craft.final_quality / 100.0)))::bigint
  );

  IF v_item.crafted_by_profile_id <> p_profile_id THEN
    v_commission_rate := v_shop.commission_rate;
  END IF;

  v_provenance := COALESCE(v_craft.result->'buildSpec', jsonb_build_object(
    'instrumentName',v_craft.instrument_name,
    'instrumentKind',v_craft.instrument_kind,
    'shapeId',v_craft.shape_id,
    'colour',v_craft.colour,
    'finishId',v_craft.finish_id,
    'decal',v_craft.decal,
    'parts',v_craft.parts,
    'materialSnapshot',v_craft.material_snapshot,
    'skillSnapshot',v_craft.skill_snapshot
  ));

  INSERT INTO public.luthiery_shop_listings(
    shop_id,seller_profile_id,seller_user_id,player_equipment_id,equipment_id,craft_id,
    maker_profile_id,maker_name,instrument_name,instrument_kind,rarity,final_quality,
    condition_at_listing,asking_price,material_cost_basis,suggested_value,commission_rate_at_listing,description,
    provenance_snapshot,stat_snapshot
  )
  VALUES (
    v_shop.id,p_profile_id,v_user_id,v_owned.id,v_item.id,v_craft.id,
    v_item.crafted_by_profile_id,COALESCE(v_maker_name,'Unknown maker'),
    v_craft.instrument_name,v_craft.instrument_kind,COALESCE(v_item.rarity,'common'),
    v_craft.final_quality,COALESCE(v_owned.condition,100),p_asking_price,
    v_material_cost,v_suggested_value,v_commission_rate,nullif(btrim(COALESCE(p_description,'')),''),
    v_provenance,COALESCE(v_craft.final_stats,'{}'::jsonb)
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'listingId',v_listing_id,'shopId',v_shop.id,'instrumentName',v_craft.instrument_name,
    'askingPrice',p_asking_price,'suggestedValue',v_suggested_value,
    'commissionRate',v_commission_rate
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'luthiery_shop_instrument_already_listed' USING ERRCODE='P0001';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.purchase_luthiery_shop_listing(p_profile_id uuid, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    v_commission := floor(v_listing.asking_price * (v_listing.commission_rate_at_listing / 100.0))::bigint;
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
    v_listing.commission_rate_at_listing,v_commission,v_seller_received,v_listing.final_quality,v_value_score,
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
$function$
;

DROP POLICY IF EXISTS "Browse open Luthiery shops" ON public.luthiery_shops;
DROP POLICY IF EXISTS "Owners can view their Luthiery shop" ON public.luthiery_shops;
CREATE POLICY "Owners can view their Luthiery shop" ON public.luthiery_shops FOR SELECT TO authenticated
USING (owner_user_id=(SELECT auth.uid()));

DROP POLICY IF EXISTS "Browse active Luthiery listings" ON public.luthiery_shop_listings;
DROP POLICY IF EXISTS "Participants can view Luthiery listings" ON public.luthiery_shop_listings;
CREATE POLICY "Participants can view Luthiery listings" ON public.luthiery_shop_listings FOR SELECT TO authenticated
USING (
 seller_user_id=(SELECT auth.uid()) OR buyer_user_id=(SELECT auth.uid())
 OR EXISTS (SELECT 1 FROM public.luthiery_shops shop WHERE shop.id=luthiery_shop_listings.shop_id AND shop.owner_user_id=(SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Participants can view Luthiery shop sales" ON public.luthiery_shop_sales;
DROP POLICY IF EXISTS "Participants and makers can view Luthiery shop sales" ON public.luthiery_shop_sales;
CREATE POLICY "Participants and makers can view Luthiery shop sales" ON public.luthiery_shop_sales FOR SELECT TO authenticated
USING (
 seller_user_id=(SELECT auth.uid()) OR buyer_user_id=(SELECT auth.uid())
 OR EXISTS (SELECT 1 FROM public.profiles maker WHERE maker.id=luthiery_shop_sales.maker_profile_id AND maker.user_id=(SELECT auth.uid()))
 OR EXISTS (SELECT 1 FROM public.luthiery_shops shop WHERE shop.id=luthiery_shop_sales.shop_id AND shop.owner_user_id=(SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.browse_luthiery_shop_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_user_id uuid:=auth.uid(); v_result jsonb;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;
 SELECT COALESCE(jsonb_agg(row_data ORDER BY listed_at DESC),'[]'::jsonb) INTO v_result
 FROM (
  SELECT listing.listed_at,
   jsonb_build_object(
    'id',listing.id,'shop_id',listing.shop_id,'seller_profile_id',listing.seller_profile_id,
    'maker_profile_id',listing.maker_profile_id,'maker_name',listing.maker_name,
    'instrument_name',listing.instrument_name,'instrument_kind',listing.instrument_kind,
    'rarity',listing.rarity,'final_quality',listing.final_quality,
    'condition_at_listing',listing.condition_at_listing,'asking_price',listing.asking_price,
    'suggested_value',listing.suggested_value,'description',listing.description,
    'provenance_snapshot',listing.provenance_snapshot,'stat_snapshot',listing.stat_snapshot,
    'commission_rate_at_listing',listing.commission_rate_at_listing,'status',listing.status,'listed_at',listing.listed_at,
    'shop',jsonb_build_object(
      'id',shop.id,'name',shop.name,'brand_tagline',shop.brand_tagline,'brand_colour',shop.brand_colour,
      'brand_logo_url',shop.brand_logo_url,'city_id',shop.city_id,'reputation',shop.reputation,
      'completed_sales',shop.completed_sales,'is_open',shop.is_open,
      'city',jsonb_build_object('id',city.id,'name',city.name,'country',city.country)
    )
   ) row_data
  FROM public.luthiery_shop_listings listing
  JOIN public.luthiery_shops shop ON shop.id=listing.shop_id
  JOIN public.cities city ON city.id=shop.city_id
  WHERE listing.status='active' AND shop.is_open IS TRUE
 ) storefront;
 RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.browse_luthiery_shop_listings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_luthiery_shop_listings() TO authenticated;
REVOKE ALL ON FUNCTION public.open_luthiery_shop(uuid,text,text,text,text,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_luthiery_shop(uuid,text,text,text,text,numeric,boolean,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_luthiery_shop_listing(uuid,uuid,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_luthiery_shop(uuid,text,text,text,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_luthiery_shop(uuid,text,text,text,text,numeric,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_luthiery_shop_listing(uuid,uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
