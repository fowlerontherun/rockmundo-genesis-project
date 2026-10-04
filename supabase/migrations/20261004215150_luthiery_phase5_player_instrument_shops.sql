CREATE TABLE public.luthiery_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 50),
  brand_tagline text CHECK (brand_tagline IS NULL OR char_length(brand_tagline) <= 120),
  brand_colour text NOT NULL DEFAULT '#b8892f' CHECK (brand_colour ~ '^#[0-9A-Fa-f]{6}$'),
  brand_logo_url text CHECK (brand_logo_url IS NULL OR char_length(brand_logo_url) <= 500),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  commission_rate numeric(5,2) NOT NULL DEFAULT 5 CHECK (commission_rate BETWEEN 0 AND 15),
  reputation numeric(5,2) NOT NULL DEFAULT 50 CHECK (reputation BETWEEN 0 AND 100),
  completed_sales integer NOT NULL DEFAULT 0 CHECK (completed_sales >= 0),
  cancelled_listings integer NOT NULL DEFAULT 0 CHECK (cancelled_listings >= 0),
  quality_score_total bigint NOT NULL DEFAULT 0 CHECK (quality_score_total >= 0),
  value_score_total bigint NOT NULL DEFAULT 0 CHECK (value_score_total >= 0),
  gross_sales bigint NOT NULL DEFAULT 0 CHECK (gross_sales >= 0),
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.luthiery_shop_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.luthiery_shops(id) ON DELETE RESTRICT,
  seller_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  player_equipment_id uuid NOT NULL REFERENCES public.player_equipment(id) ON DELETE RESTRICT,
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE RESTRICT,
  craft_id uuid NOT NULL REFERENCES public.luthiery_crafts(id) ON DELETE RESTRICT,
  maker_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  maker_name text NOT NULL,
  instrument_name text NOT NULL,
  instrument_kind text NOT NULL CHECK (instrument_kind IN ('electric_guitar','electric_bass')),
  rarity text NOT NULL,
  final_quality integer NOT NULL CHECK (final_quality BETWEEN 0 AND 100),
  condition_at_listing integer NOT NULL CHECK (condition_at_listing BETWEEN 0 AND 100),
  asking_price bigint NOT NULL CHECK (asking_price BETWEEN 1 AND 1000000000),
  material_cost_basis bigint NOT NULL DEFAULT 0 CHECK (material_cost_basis >= 0),
  suggested_value bigint NOT NULL CHECK (suggested_value > 0),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  provenance_snapshot jsonb NOT NULL,
  stat_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','processing','sold','cancelled')),
  buyer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  final_sale_price bigint CHECK (final_sale_price IS NULL OR final_sale_price > 0),
  listed_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.luthiery_shop_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.luthiery_shop_listings(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.luthiery_shops(id) ON DELETE RESTRICT,
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE RESTRICT,
  seller_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  buyer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  maker_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  maker_name text NOT NULL,
  sale_price bigint NOT NULL CHECK (sale_price > 0),
  commission_rate numeric(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 15),
  maker_commission bigint NOT NULL DEFAULT 0 CHECK (maker_commission >= 0),
  seller_received bigint NOT NULL CHECK (seller_received >= 0),
  quality_score integer NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  value_score integer NOT NULL CHECK (value_score BETWEEN 0 AND 100),
  reliability_score integer NOT NULL CHECK (reliability_score BETWEEN 0 AND 100),
  reputation_after numeric(5,2) NOT NULL CHECK (reputation_after BETWEEN 0 AND 100),
  provenance_snapshot jsonb NOT NULL,
  stat_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_player_equipment_id uuid REFERENCES public.player_equipment(id) ON DELETE SET NULL,
  sold_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_luthiery_shop_listings_active_equipment
  ON public.luthiery_shop_listings(player_equipment_id)
  WHERE status IN ('active','processing');
CREATE INDEX idx_luthiery_shops_city_open ON public.luthiery_shops(city_id,is_open);
CREATE INDEX idx_luthiery_shops_reputation ON public.luthiery_shops(reputation DESC);
CREATE INDEX idx_luthiery_shop_listings_shop_status ON public.luthiery_shop_listings(shop_id,status,listed_at DESC);
CREATE INDEX idx_luthiery_shop_listings_status_price ON public.luthiery_shop_listings(status,asking_price);
CREATE INDEX idx_luthiery_shop_listings_maker ON public.luthiery_shop_listings(maker_profile_id);
CREATE INDEX idx_luthiery_shop_sales_shop ON public.luthiery_shop_sales(shop_id,sold_at DESC);
CREATE INDEX idx_luthiery_shop_sales_buyer ON public.luthiery_shop_sales(buyer_profile_id,sold_at DESC);
CREATE INDEX idx_luthiery_shop_sales_seller ON public.luthiery_shop_sales(seller_profile_id,sold_at DESC);

ALTER TABLE public.luthiery_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luthiery_shop_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luthiery_shop_sales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.luthiery_shops FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.luthiery_shop_listings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.luthiery_shop_sales FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.luthiery_shops TO anon, authenticated;
GRANT SELECT ON public.luthiery_shop_listings TO anon, authenticated;
GRANT SELECT ON public.luthiery_shop_sales TO authenticated;

CREATE POLICY "Browse open Luthiery shops"
ON public.luthiery_shops FOR SELECT
TO anon, authenticated
USING (is_open IS TRUE OR owner_user_id = (SELECT auth.uid()));

CREATE POLICY "Browse active Luthiery listings"
ON public.luthiery_shop_listings FOR SELECT
TO anon, authenticated
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

CREATE POLICY "Participants can view Luthiery shop sales"
ON public.luthiery_shop_sales FOR SELECT
TO authenticated
USING (
  seller_user_id = (SELECT auth.uid())
  OR buyer_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.luthiery_shops s
    WHERE s.id = luthiery_shop_sales.shop_id
      AND s.owner_user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.open_luthiery_shop(
  p_profile_id uuid,
  p_name text,
  p_brand_tagline text DEFAULT NULL,
  p_brand_colour text DEFAULT '#b8892f',
  p_brand_logo_url text DEFAULT NULL,
  p_commission_rate numeric DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  IF char_length(COALESCE(p_brand_logo_url,'')) > 500 THEN
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
$$;

CREATE OR REPLACE FUNCTION public.update_luthiery_shop(
  p_profile_id uuid,
  p_name text,
  p_brand_tagline text DEFAULT NULL,
  p_brand_colour text DEFAULT '#b8892f',
  p_brand_logo_url text DEFAULT NULL,
  p_commission_rate numeric DEFAULT 5,
  p_is_open boolean DEFAULT true,
  p_move_to_current_city boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  IF char_length(COALESCE(p_brand_logo_url,'')) > 500 THEN
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
$$;

CREATE OR REPLACE FUNCTION public.create_luthiery_shop_listing(
  p_profile_id uuid,
  p_player_equipment_id uuid,
  p_asking_price bigint,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    condition_at_listing,asking_price,material_cost_basis,suggested_value,description,
    provenance_snapshot,stat_snapshot
  )
  VALUES (
    v_shop.id,p_profile_id,v_user_id,v_owned.id,v_item.id,v_craft.id,
    v_item.crafted_by_profile_id,COALESCE(v_maker_name,'Unknown maker'),
    v_craft.instrument_name,v_craft.instrument_kind,COALESCE(v_item.rarity,'common'),
    v_craft.final_quality,COALESCE(v_owned.condition,100),p_asking_price,
    v_material_cost,v_suggested_value,nullif(btrim(COALESCE(p_description,'')),''),
    v_provenance,COALESCE(v_craft.final_stats,'{}'::jsonb)
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'listingId',v_listing_id,'shopId',v_shop.id,'instrumentName',v_craft.instrument_name,
    'askingPrice',p_asking_price,'suggestedValue',v_suggested_value
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'luthiery_shop_instrument_already_listed' USING ERRCODE='P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_luthiery_shop_listing(
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
  v_listing public.luthiery_shop_listings%ROWTYPE;
  v_shop public.luthiery_shops%ROWTYPE;
  v_reliability numeric;
  v_reputation numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'luthiery_shop_authentication_required' USING ERRCODE='P0001'; END IF;
  IF public.current_profile_id() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'luthiery_shop_active_profile_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_listing FROM public.luthiery_shop_listings
  WHERE id=p_listing_id AND seller_profile_id=p_profile_id AND seller_user_id=v_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_listing.status <> 'active' THEN
    RAISE EXCEPTION 'luthiery_shop_listing_not_active' USING ERRCODE='P0001';
  END IF;

  UPDATE public.luthiery_shop_listings
  SET status='cancelled',cancelled_at=now(),updated_at=now()
  WHERE id=v_listing.id;

  SELECT * INTO v_shop FROM public.luthiery_shops WHERE id=v_listing.shop_id FOR UPDATE;
  UPDATE public.luthiery_shops
  SET cancelled_listings=cancelled_listings+1,updated_at=now()
  WHERE id=v_shop.id
  RETURNING * INTO v_shop;

  v_reliability := CASE
    WHEN (v_shop.completed_sales+v_shop.cancelled_listings)=0 THEN 100
    ELSE (v_shop.completed_sales::numeric/(v_shop.completed_sales+v_shop.cancelled_listings))*100
  END;
  v_reputation := CASE
    WHEN v_shop.completed_sales=0 THEN greatest(20,50-(v_shop.cancelled_listings*2))
    ELSE round(
      ((v_shop.quality_score_total::numeric/v_shop.completed_sales)*0.5)
      + ((v_shop.value_score_total::numeric/v_shop.completed_sales)*0.3)
      + (v_reliability*0.2),2
    )
  END;

  UPDATE public.luthiery_shops SET reputation=least(100,greatest(0,v_reputation)) WHERE id=v_shop.id;

  RETURN jsonb_build_object('listingId',v_listing.id,'status','cancelled','reputation',v_reputation);
END;
$$;

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

  PERFORM 1 FROM public.profiles
  WHERE id IN (v_listing.seller_profile_id,v_listing.maker_profile_id)
  ORDER BY id
  FOR UPDATE;

  IF v_buyer.cash < v_listing.asking_price THEN
    RAISE EXCEPTION 'luthiery_shop_insufficient_funds' USING ERRCODE='P0001';
  END IF;

  UPDATE public.luthiery_shop_listings SET status='processing',updated_at=now() WHERE id=v_listing.id;

  IF v_listing.maker_profile_id <> v_listing.seller_profile_id THEN
    v_commission := floor(v_listing.asking_price * (v_shop.commission_rate / 100.0))::bigint;
  END IF;
  v_seller_received := v_listing.asking_price-v_commission;

  UPDATE public.profiles SET cash=cash-v_listing.asking_price,updated_at=now() WHERE id=p_profile_id;
  UPDATE public.profiles SET cash=cash+v_seller_received,updated_at=now() WHERE id=v_listing.seller_profile_id;
  IF v_commission > 0 THEN
    UPDATE public.profiles SET cash=cash+v_commission,updated_at=now() WHERE id=v_listing.maker_profile_id;
  END IF;

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

CREATE OR REPLACE FUNCTION private.prevent_active_luthiery_listing_equipment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.luthiery_shop_listings
    WHERE player_equipment_id=OLD.id AND status IN ('active','processing')
  ) THEN
    RAISE EXCEPTION 'luthiery_shop_listed_instrument_locked' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER luthiery_shop_lock_listed_equipment
BEFORE UPDATE OR DELETE ON public.player_equipment
FOR EACH ROW EXECUTE FUNCTION private.prevent_active_luthiery_listing_equipment_mutation();

REVOKE ALL ON FUNCTION public.open_luthiery_shop(uuid,text,text,text,text,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_luthiery_shop(uuid,text,text,text,text,numeric,boolean,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_luthiery_shop_listing(uuid,uuid,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_luthiery_shop_listing(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_luthiery_shop(uuid,text,text,text,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_luthiery_shop(uuid,text,text,text,text,numeric,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_luthiery_shop_listing(uuid,uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_luthiery_shop_listing(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_luthiery_shop_listing(uuid,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
