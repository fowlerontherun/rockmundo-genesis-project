BEGIN;

DO $contract$
BEGIN
  IF to_regclass('public.luthiery_shops') IS NULL
     OR to_regclass('public.luthiery_shop_listings') IS NULL
     OR to_regclass('public.luthiery_shop_sales') IS NULL THEN
    RAISE EXCEPTION 'Luthiery Phase 5 tables are missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.luthiery_shops'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.luthiery_shop_listings'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.luthiery_shop_sales'::regclass) THEN
    RAISE EXCEPTION 'Luthiery Phase 5 RLS is not enabled';
  END IF;

  IF has_table_privilege('authenticated','public.luthiery_shops','INSERT')
     OR has_table_privilege('authenticated','public.luthiery_shop_listings','INSERT')
     OR has_table_privilege('authenticated','public.luthiery_shop_sales','INSERT') THEN
    RAISE EXCEPTION 'Luthiery shop tables must not be directly client-mutable';
  END IF;

  IF has_table_privilege('anon','public.luthiery_shops','SELECT')
     OR has_table_privilege('anon','public.luthiery_shop_listings','SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not browse player shop identity data';
  END IF;

  IF to_regprocedure('public.browse_luthiery_shop_listings()') IS NULL THEN
    RAISE EXCEPTION 'Sanitized Luthiery storefront RPC is missing';
  END IF;

  IF NOT has_function_privilege('authenticated','public.browse_luthiery_shop_listings()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.open_luthiery_shop(uuid,text,text,text,text,numeric)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.create_luthiery_shop_listing(uuid,uuid,bigint,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.purchase_luthiery_shop_listing(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated Luthiery shop RPC permissions are missing';
  END IF;

  IF has_function_privilege('anon','public.browse_luthiery_shop_listings()','EXECUTE')
     OR has_function_privilege('anon','public.open_luthiery_shop(uuid,text,text,text,text,numeric)','EXECUTE')
     OR has_function_privilege('anon','public.create_luthiery_shop_listing(uuid,uuid,bigint,text)','EXECUTE')
     OR has_function_privilege('anon','public.purchase_luthiery_shop_listing(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users must not execute Luthiery shop mutations';
  END IF;
END
$contract$;

SET LOCAL session_replication_role=replica;

INSERT INTO auth.users(id,email,role) VALUES
('c5000000-0000-4000-8000-000000000001','phase5-maker@example.test','authenticated'),
('c5000000-0000-4000-8000-000000000002','phase5-reseller@example.test','authenticated'),
('c5000000-0000-4000-8000-000000000003','phase5-buyer@example.test','authenticated');

INSERT INTO public.cities(id,name,country)
VALUES('c5100000-0000-4000-8000-000000000001','Phase 5 Test City','Testland');

INSERT INTO public.profiles(id,user_id,username,display_name,is_active,current_city_id,cash) VALUES
('c5200000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','phase5_maker','Phase 5 Maker',true,'c5100000-0000-4000-8000-000000000001',10000),
('c5200000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000002','phase5_reseller','Phase 5 Reseller',true,'c5100000-0000-4000-8000-000000000001',1000000),
('c5200000-0000-4000-8000-000000000003','c5000000-0000-4000-8000-000000000003','phase5_buyer','Phase 5 Buyer',true,'c5100000-0000-4000-8000-000000000001',1000000);

INSERT INTO public.financial_accounts(
  owner_type,owner_id,account_name,account_status,current_balance_minor,reserved_balance_minor,
  default_currency_code,is_primary,metadata
) VALUES
('player','c5200000-0000-4000-8000-000000000001','Personal cash','active',1000000,0,'USD',true,'{}'),
('player','c5200000-0000-4000-8000-000000000002','Personal cash','active',100000000,0,'USD',true,'{}'),
('player','c5200000-0000-4000-8000-000000000003','Personal cash','active',100000000,0,'USD',true,'{}');

INSERT INTO public.skill_progress(profile_id,skill_slug,current_level) VALUES
('c5200000-0000-4000-8000-000000000001','luthiery_basic_technical',20),
('c5200000-0000-4000-8000-000000000002','luthiery_basic_technical',20);

INSERT INTO public.equipment_items(
  id,name,category,subcategory,price,rarity,stat_boosts,is_crafted,crafted_by_profile_id,custom_name
) VALUES (
  'c5300000-0000-4000-8000-000000000001','Custom Guitar','guitar','custom_luthiery',
  50000,'epic','{"tone":80}',true,'c5200000-0000-4000-8000-000000000001','Phase 5 Guitar'
);

INSERT INTO public.player_equipment(
  id,user_id,profile_id,equipment_id,is_equipped,equipped,condition
) VALUES (
  'c5400000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'c5200000-0000-4000-8000-000000000001',
  'c5300000-0000-4000-8000-000000000001',
  false,false,97
);

INSERT INTO public.luthiery_crafts(
  id,profile_id,user_id,idempotency_key,request_hash,equipment_id,player_equipment_id,
  instrument_name,instrument_kind,shape_id,colour,finish_id,decal,parts,material_snapshot,
  skill_snapshot,quality_roll,final_quality,final_stats,result
)
SELECT
  'c5500000-0000-4000-8000-000000000001',
  'c5200000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  'phase5-fixture','fixture-hash',
  'c5300000-0000-4000-8000-000000000001',
  'c5400000-0000-4000-8000-000000000001',
  'Phase 5 Guitar','electric_guitar','double-cut','#141821','finish-satin','{}','{}',
  jsonb_build_array(jsonb_build_object('materialId',material.id::text,'materialName',material.name)),
  '{"basic":20}',0,88,'{"tone":80}',
  jsonb_build_object(
    'buildSpec',
    jsonb_build_object(
      'shapeId','double-cut',
      'shapeName','Classic Double Cut',
      'materialSnapshot',
      jsonb_build_array(jsonb_build_object('materialId',material.id::text,'materialName',material.name))
    )
  )
FROM public.crafting_materials material
ORDER BY material.base_cost DESC
LIMIT 1;

SET LOCAL session_replication_role=origin;

SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

SELECT public.open_luthiery_shop(
  'c5200000-0000-4000-8000-000000000001',
  'Maker Shop',NULL,'#b8892f',NULL,5
);

SELECT public.create_luthiery_shop_listing(
  'c5200000-0000-4000-8000-000000000001',
  'c5400000-0000-4000-8000-000000000001',
  100000,
  'First sale'
);

DO $first_party_terms$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_shop_listings
    WHERE seller_profile_id='c5200000-0000-4000-8000-000000000001'
      AND status='active'
      AND commission_rate_at_listing=0
  ) THEN
    RAISE EXCEPTION 'First-party listing should not charge an original-maker royalty';
  END IF;
END
$first_party_terms$;

DO $listed_lock$
DECLARE v_player_equipment_id uuid;
BEGIN
  SELECT player_equipment_id INTO v_player_equipment_id
  FROM public.luthiery_shop_listings
  WHERE seller_profile_id='c5200000-0000-4000-8000-000000000001'
    AND status='active';

  BEGIN
    UPDATE public.player_equipment
    SET condition=90
    WHERE id=v_player_equipment_id;
    RAISE EXCEPTION 'Active shop inventory was mutable';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_shop_listed_instrument_locked' THEN
        RAISE;
      END IF;
  END;
END
$listed_lock$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;

DO $safe_storefront$
DECLARE
  v_storefront jsonb;
  v_listing jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.luthiery_shops
    WHERE owner_profile_id='c5200000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Customer can read another player''s raw shop row';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.luthiery_shop_listings
    WHERE seller_profile_id='c5200000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Customer can read another player''s raw listing row';
  END IF;

  v_storefront := public.browse_luthiery_shop_listings();
  SELECT value INTO v_listing
  FROM jsonb_array_elements(v_storefront)
  WHERE value->>'seller_profile_id'='c5200000-0000-4000-8000-000000000001'
  LIMIT 1;

  IF v_listing IS NULL THEN
    RAISE EXCEPTION 'Sanitized storefront did not return the active listing';
  END IF;
  IF v_listing ? 'seller_user_id'
     OR v_listing ? 'player_equipment_id'
     OR COALESCE(v_listing->'shop','{}'::jsonb) ? 'owner_user_id' THEN
    RAISE EXCEPTION 'Sanitized storefront exposed internal auth/inventory identifiers';
  END IF;
END
$safe_storefront$;

SELECT public.purchase_luthiery_shop_listing(
  'c5200000-0000-4000-8000-000000000002',
  (
    SELECT (value->>'id')::uuid
    FROM jsonb_array_elements(public.browse_luthiery_shop_listings())
    WHERE value->>'seller_profile_id'='c5200000-0000-4000-8000-000000000001'
    LIMIT 1
  )
);

SELECT public.open_luthiery_shop(
  'c5200000-0000-4000-8000-000000000002',
  'Resale Shop',NULL,'#235f9f',NULL,10
);

SELECT public.create_luthiery_shop_listing(
  'c5200000-0000-4000-8000-000000000002',
  (
    SELECT id
    FROM public.player_equipment
    WHERE profile_id='c5200000-0000-4000-8000-000000000002'
      AND equipment_id='c5300000-0000-4000-8000-000000000001'
  ),
  200000,
  'Verified resale'
);

DO $resale_terms$
DECLARE
  v_listing_id uuid;
BEGIN
  SELECT id INTO v_listing_id
  FROM public.luthiery_shop_listings
  WHERE seller_profile_id='c5200000-0000-4000-8000-000000000002'
    AND status='active';

  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_shop_listings
    WHERE id=v_listing_id
      AND commission_rate_at_listing=10
  ) THEN
    RAISE EXCEPTION 'Resale did not snapshot the shop''s 10%% maker royalty';
  END IF;

  PERFORM set_config('app.phase5_resale_listing_id',v_listing_id::text,true);

  BEGIN
    PERFORM public.update_luthiery_shop(
      'c5200000-0000-4000-8000-000000000002',
      'Resale Shop',NULL,'#235f9f','http://insecure.example/logo.png',10,true,false
    );
    RAISE EXCEPTION 'Insecure shop logo URL was accepted';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_shop_logo_invalid' THEN
        RAISE;
      END IF;
  END;

  PERFORM public.update_luthiery_shop(
    'c5200000-0000-4000-8000-000000000002',
    'Resale Shop',NULL,'#235f9f',NULL,0,false,false
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_shop_listings
    WHERE id=v_listing_id
      AND commission_rate_at_listing=10
  ) THEN
    RAISE EXCEPTION 'Changing shop settings rewrote an existing listing royalty';
  END IF;
END
$resale_terms$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;

DO $closed_shop$
DECLARE
  v_listing_id uuid := current_setting('app.phase5_resale_listing_id')::uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.browse_luthiery_shop_listings())
    WHERE (value->>'id')::uuid=v_listing_id
  ) THEN
    RAISE EXCEPTION 'Closed-shop listing remained visible in the storefront';
  END IF;

  BEGIN
    PERFORM public.purchase_luthiery_shop_listing(
      'c5200000-0000-4000-8000-000000000003',
      v_listing_id
    );
    RAISE EXCEPTION 'Purchase succeeded while shop was closed';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_shop_closed' THEN
        RAISE;
      END IF;
  END;
END
$closed_shop$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;

SELECT public.update_luthiery_shop(
  'c5200000-0000-4000-8000-000000000002',
  'Resale Shop',NULL,'#235f9f',NULL,0,true,false
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;

DO $reopened_storefront$
DECLARE
  v_listing_id uuid := current_setting('app.phase5_resale_listing_id')::uuid;
  v_listing jsonb;
BEGIN
  SELECT value INTO v_listing
  FROM jsonb_array_elements(public.browse_luthiery_shop_listings())
  WHERE (value->>'id')::uuid=v_listing_id
  LIMIT 1;

  IF v_listing IS NULL
     OR (v_listing->>'commission_rate_at_listing')::numeric <> 10 THEN
    RAISE EXCEPTION 'Reopened storefront lost the fixed resale royalty';
  END IF;
END
$reopened_storefront$;

SELECT public.purchase_luthiery_shop_listing(
  'c5200000-0000-4000-8000-000000000003',
  current_setting('app.phase5_resale_listing_id')::uuid
);

DO $verify$
DECLARE
  v_listing_id uuid;
  v_retry jsonb;
BEGIN
  SELECT id INTO v_listing_id
  FROM public.luthiery_shop_listings
  WHERE seller_profile_id='c5200000-0000-4000-8000-000000000002'
    AND status='sold';

  IF (SELECT cash FROM public.profiles WHERE id='c5200000-0000-4000-8000-000000000001') <> 130000
     OR (SELECT cash FROM public.profiles WHERE id='c5200000-0000-4000-8000-000000000002') <> 1080000
     OR (SELECT cash FROM public.profiles WHERE id='c5200000-0000-4000-8000-000000000003') <> 800000 THEN
    RAISE EXCEPTION 'Luthiery Phase 5 cash settlement mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_shop_sales
    WHERE listing_id=v_listing_id
      AND maker_commission=20000
      AND commission_rate=10
      AND maker_profile_id='c5200000-0000-4000-8000-000000000001'
      AND provenance_snapshot->>'shapeId'='double-cut'
  ) THEN
    RAISE EXCEPTION 'Maker commission or provenance was not preserved on resale';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_equipment owned
    JOIN public.equipment_items item ON item.id=owned.equipment_id
    WHERE owned.profile_id='c5200000-0000-4000-8000-000000000003'
      AND item.id='c5300000-0000-4000-8000-000000000001'
      AND item.crafted_by_profile_id='c5200000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Crafted equipment identity did not survive resale';
  END IF;

  IF (SELECT count(*)
      FROM public.financial_transactions
      WHERE related_entity_type='luthiery_shop_listing'
        AND related_entity_id=v_listing_id) <> 2 THEN
    RAISE EXCEPTION 'Resale did not create seller and maker ledger transfers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.luthiery_shops
    WHERE owner_profile_id='c5200000-0000-4000-8000-000000000002'
      AND completed_sales=1
      AND gross_sales=200000
      AND reputation BETWEEN 0 AND 100
  ) THEN
    RAISE EXCEPTION 'Shop sales/reputation aggregation failed';
  END IF;

  v_retry := public.purchase_luthiery_shop_listing(
    'c5200000-0000-4000-8000-000000000003',
    v_listing_id
  );

  IF v_retry->>'status' <> 'already_completed' THEN
    RAISE EXCEPTION 'Purchase retry was not idempotent';
  END IF;

  IF (SELECT cash FROM public.profiles WHERE id='c5200000-0000-4000-8000-000000000003') <> 800000 THEN
    RAISE EXCEPTION 'Purchase retry charged the buyer twice';
  END IF;
END
$verify$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','c5000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;

DO $maker_history$
DECLARE
  v_listing_id uuid := current_setting('app.phase5_resale_listing_id')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.luthiery_shop_sales
    WHERE listing_id=v_listing_id
      AND maker_profile_id='c5200000-0000-4000-8000-000000000001'
      AND maker_commission=20000
  ) THEN
    RAISE EXCEPTION 'Original maker cannot view their resale commission history';
  END IF;
END
$maker_history$;

RESET ROLE;
ROLLBACK;
