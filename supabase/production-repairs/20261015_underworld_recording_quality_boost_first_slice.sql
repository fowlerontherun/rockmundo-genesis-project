-- #4072: MANUAL ONLY, guarded first Underworld timed-booster repair.
-- Preserves live cash journal, persisted imprisonment checks, deduplication,
-- gifting and safe consumable grants. Do not replay historical October SQL.
DO $preflight$
BEGIN
 IF to_regprocedure('public.buy_underworld_product_atomic(uuid,uuid,text,uuid)') IS NULL
 OR to_regprocedure('public.consume_underworld_item_atomic(uuid,uuid)') IS NULL
 OR to_regclass('public.player_active_boosts') IS NULL
 OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
     AND tablename='player_active_boosts' AND indexname='underworld_boost_effect_once_per_purchase')
 OR has_table_privilege('authenticated','public.player_active_boosts','INSERT')
 OR has_table_privilege('authenticated','public.underworld_purchases','UPDATE')
 OR (SELECT count(*) FROM public.underworld_products WHERE category='booster'
     AND is_available=true AND effects='{"recording_quality_boost":35}'::jsonb
     AND duration_hours=24 AND price_token_id IS NULL)<>1
 THEN RAISE EXCEPTION 'UNDERWORLD_RECORDING_BOOST_PRECHECK_FAILED'; END IF;
 IF md5(pg_get_functiondef('public.buy_underworld_product_atomic(uuid,uuid,text,uuid)'::regprocedure)) <> '1352f19303052885dc7d83baa795b751'
 OR md5(pg_get_functiondef('public.consume_underworld_item_atomic(uuid,uuid)'::regprocedure)) <> '99587b6179ad8038da418fd2c64963e3'
 THEN RAISE EXCEPTION 'UNDERWORLD_RPC_VERSION_DRIFT_REBASE_REQUIRED'; END IF;
END $preflight$;

ALTER TABLE public.underworld_purchases
 ADD COLUMN IF NOT EXISTS purchased_duration_hours integer;
DO $constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid='public.underworld_purchases'::regclass
   AND conname='underworld_purchased_duration_bounded') THEN
  ALTER TABLE public.underworld_purchases
   ADD CONSTRAINT underworld_purchased_duration_bounded
   CHECK (purchased_duration_hours IS NULL OR purchased_duration_hours BETWEEN 1 AND 72);
 END IF;
END $constraint$;

CREATE OR REPLACE FUNCTION public.underworld_safe_recording_boost(p_effects jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $validator$
DECLARE v_value jsonb; v_number numeric;
BEGIN
 IF jsonb_typeof(p_effects) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_each(p_effects))<>1 THEN RETURN false; END IF;
 v_value:=p_effects->'recording_quality_boost';
 IF jsonb_typeof(v_value) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
 v_number:=(v_value #>> '{}')::numeric;
 RETURN v_number=trunc(v_number) AND v_number BETWEEN 1 AND 50;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN RETURN false;
END $validator$;
REVOKE ALL ON FUNCTION public.underworld_safe_recording_boost(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.underworld_safe_recording_boost(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.buy_underworld_product_atomic(p_profile_id uuid, p_product_id uuid, p_payment_method text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_profile public.profiles%ROWTYPE;
 v_product public.underworld_products%ROWTYPE;
 v_purchase public.underworld_purchases%ROWTYPE;
 v_effects jsonb;v_new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_product_id IS NULL
    OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'UNDERWORLD_PURCHASE_AUTH_AND_REQUEST_REQUIRED'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=p_profile_id AND user_id=auth.uid()
   AND is_active IS TRUE AND deleted_at IS NULL AND died_at IS NULL
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_PURCHASE_PROFILE_NOT_OWNED'
   USING ERRCODE='42501'; END IF;
 -- Check replay BEFORE jailed state: a buyer arrested on the previous
 -- committed attempt must be allowed to inspect the same receipt.
 SELECT * INTO v_purchase FROM public.underworld_purchases
 WHERE profile_id=p_profile_id AND client_request_id=p_request_id;
 IF FOUND THEN
   IF v_purchase.product_id IS DISTINCT FROM p_product_id
     OR v_purchase.paid_with IS DISTINCT FROM p_payment_method
   THEN RAISE EXCEPTION 'UNDERWORLD_PURCHASE_REQUEST_KEY_MISMATCH'
     USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('success',true,'purchaseId',v_purchase.id,
     'storedInInventory',true,'expiresAt',v_purchase.expires_at,
     'replayed',true);
 END IF;
 IF p_payment_method IS DISTINCT FROM 'cash' THEN
  RAISE EXCEPTION 'UNDERWORLD_PAYMENT_METHOD_NOT_YET_SUPPORTED'
    USING ERRCODE='0A000'; END IF;
 IF coalesce(v_profile.is_imprisoned,false) OR EXISTS (
  SELECT 1 FROM public.player_imprisonments i
  WHERE i.profile_id=p_profile_id AND i.status='imprisoned'
 ) THEN RAISE EXCEPTION 'UNDERWORLD_IMPRISONED_BUYER'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_product FROM public.underworld_products
 WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND OR v_product.is_available IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'UNDERWORLD_PRODUCT_NOT_AVAILABLE'
   USING ERRCODE='22023'; END IF;
 v_effects:=coalesce(v_product.effects,'{}'::jsonb);
 IF NOT (
   (v_product.category='consumable'
      AND coalesce(v_product.duration_hours,0)=0
      AND public.underworld_safe_instant_effects(v_effects))
   OR (v_product.category='booster'
      AND v_product.duration_hours BETWEEN 1 AND 72
      AND v_product.price_token_id IS NULL
      AND public.underworld_safe_recording_boost(v_effects))
 ) THEN RAISE EXCEPTION 'UNDERWORLD_EFFECTS_REQUIRE_FUTURE_CUTOVER'
   USING ERRCODE='0A000'; END IF;
 IF v_product.price_cash IS NULL
    OR v_product.price_cash NOT BETWEEN 1 AND 1000000
 THEN RAISE EXCEPTION 'UNDERWORLD_PRICE_INVALID'
   USING ERRCODE='22023'; END IF;
 IF v_product.stock_limit IS NOT NULL
    AND (v_product.current_stock IS NULL OR v_product.current_stock<1)
 THEN RAISE EXCEPTION 'UNDERWORLD_OUT_OF_STOCK' USING ERRCODE='22023'; END IF;
 IF v_product.stock_limit IS NOT NULL THEN
  UPDATE public.underworld_products SET current_stock=current_stock-1
  WHERE id=v_product.id AND current_stock>=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_OUT_OF_STOCK'; END IF;
 END IF;
 PERFORM set_config('app.player_cash_context',
   jsonb_build_object(
     'classification','underworld_purchase',
     'display_category','underworld',
     'description','Underworld cash purchase',
     'idempotency_key','underworld:'||p_request_id::text,
     'underworld_product_id',v_product.id::text,
     'underworld_purchase_request_id',p_request_id::text,
     'underworld_unit_price',v_product.price_cash
   )::text,true);
 UPDATE public.profiles SET cash=cash-v_product.price_cash
 WHERE id=v_profile.id AND cash>=v_product.price_cash;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_INSUFFICIENT_FUNDS'
   USING ERRCODE='22023'; END IF;
 v_new_id:=gen_random_uuid();
 INSERT INTO public.underworld_purchases(
 id,user_id,profile_id,product_id,paid_with,cash_amount,
 effects_applied,expires_at,is_used,quantity,client_request_id,
 purchased_addiction_type,purchased_duration_hours)
 VALUES(v_new_id,v_profile.user_id,v_profile.id,v_product.id,'cash',
  v_product.price_cash,v_effects,NULL,false,1,p_request_id,
  v_product.addiction_type,CASE WHEN v_product.category='booster' THEN v_product.duration_hours ELSE NULL END);
 -- AFTER INSERT arrest trigger executes in this SAME transaction. Any
 -- failure rolls back both stock/payment and the purchase.
 RETURN jsonb_build_object('success',true,'purchaseId',v_new_id,
  'storedInInventory',true,'expiresAt',NULL,'replayed',false);
END
$function$;

CREATE OR REPLACE FUNCTION public.consume_underworld_item_atomic(p_profile_id uuid, p_purchase_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_profile public.profiles%ROWTYPE;
 v_purchase public.underworld_purchases%ROWTYPE;
 v_product public.underworld_products%ROWTYPE;
 v_effects jsonb;v_exposure jsonb:=NULL;
 v_addiction text;v_source_key uuid;
BEGIN
 IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_purchase_id IS NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_AUTH_REQUIRED'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=p_profile_id AND user_id=auth.uid()
   AND is_active IS TRUE AND deleted_at IS NULL AND died_at IS NULL
   AND is_imprisoned IS FALSE
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_PROFILE_UNAVAILABLE'
   USING ERRCODE='42501'; END IF;
 -- The purchase flow and arrest trigger both check persisted sentences.
 -- Do the same here: a stale profiles.is_imprisoned=false must never permit
 -- item effects while an actual sentence remains open.
 IF EXISTS (
   SELECT 1 FROM public.player_imprisonments i
   WHERE i.profile_id=p_profile_id AND i.status='imprisoned'
 ) THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_IMPRISONED'
   USING ERRCODE='42501'; END IF;
 SELECT * INTO v_purchase FROM public.underworld_purchases
 WHERE id=p_purchase_id AND profile_id=p_profile_id
   AND user_id=v_profile.user_id FOR UPDATE;
 IF NOT FOUND OR v_purchase.is_used IS DISTINCT FROM false
    OR coalesce(v_purchase.quantity,0)<1
    OR (v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at<=now())
 THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_INVENTORY_UNAVAILABLE'
   USING ERRCODE='22023'; END IF;
 -- Old rows were populated outside today's controlled purchase protocol:
 -- do not retroactively award unknown rewards or provenance.
 IF v_purchase.client_request_id IS NULL THEN
   IF v_purchase.paid_with IS DISTINCT FROM 'gift'
      OR v_purchase.gifted_from_purchase_id IS NULL THEN
    RAISE EXCEPTION 'UNDERWORLD_LEGACY_ITEM_REQUIRES_REVIEW'
      USING ERRCODE='0A000'; END IF;
   SELECT u.client_request_id,u.purchased_addiction_type
    INTO v_source_key,v_addiction
   FROM public.underworld_purchases u
   WHERE u.id=v_purchase.gifted_from_purchase_id AND u.paid_with='cash';
   IF v_source_key IS NULL THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_PROVENANCE_UNVERIFIED'
      USING ERRCODE='42501'; END IF;
 ELSE
   v_addiction:=v_purchase.purchased_addiction_type;
 END IF;
 SELECT * INTO v_product FROM public.underworld_products
 WHERE id=v_purchase.product_id;
 IF NOT FOUND OR v_product.category NOT IN ('consumable','booster')
 THEN RAISE EXCEPTION 'UNDERWORLD_ITEM_TYPE_NOT_SUPPORTED'
   USING ERRCODE='0A000'; END IF;
 v_effects:=coalesce(v_purchase.effects_applied,'{}'::jsonb);
 IF v_product.category='booster' THEN
   IF v_purchase.client_request_id IS NULL
      OR v_purchase.paid_with IS DISTINCT FROM 'cash'
      OR v_purchase.gifted_from_purchase_id IS NOT NULL
      OR v_purchase.purchased_duration_hours NOT BETWEEN 1 AND 72
      OR NOT public.underworld_safe_recording_boost(v_effects)
   THEN RAISE EXCEPTION 'UNDERWORLD_TIMED_BOOST_PROVENANCE_INVALID' USING ERRCODE='0A000'; END IF;
   -- Activation begins at consumption, never purchase. Source/effect is unique.
   INSERT INTO public.player_active_boosts(
     user_id,profile_id,product_id,boost_type,boost_value,
     started_at,expires_at,is_active,source_purchase_id)
   VALUES(v_profile.user_id,v_profile.id,v_purchase.product_id,
     'recording_quality_boost',(v_effects->>'recording_quality_boost')::numeric,
     now(),now()+make_interval(hours=>v_purchase.purchased_duration_hours),
     true,v_purchase.id);
   UPDATE public.underworld_purchases SET
     quantity=0,is_used=true,applied_at=now(),
     expires_at=now()+make_interval(hours=>v_purchase.purchased_duration_hours)
   WHERE id=v_purchase.id AND quantity=1 AND is_used IS FALSE;
   IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_CONCURRENT_USE'; END IF;
   RETURN jsonb_build_object('success',true,'productName',v_product.name,
     'productId',v_product.id,'boostType','recording_quality_boost',
     'expiresAt',now()+make_interval(hours=>v_purchase.purchased_duration_hours),
     'exposure',NULL);
 END IF;
 IF NOT public.underworld_safe_instant_effects(v_effects)
 THEN RAISE EXCEPTION 'UNDERWORLD_FROZEN_EFFECTS_INVALID'
   USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET
  health=least(100,greatest(0,health+coalesce((v_effects->>'health')::integer,0))),
  energy=least(100,greatest(0,energy+coalesce((v_effects->>'energy')::integer,0))),
  fame=greatest(0,fame+coalesce((v_effects->>'fame')::integer,0))
 WHERE id=v_profile.id;
 IF v_addiction IS NOT NULL THEN
  v_exposure:=public.record_addiction_exposure(v_profile.id,v_addiction,
    18,'underworld_item',v_purchase.id::text);
  IF coalesce((v_exposure->>'ok')::boolean,false) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'UNDERWORLD_ADDICTION_EXPOSURE_FAILED'; END IF;
 END IF;
 UPDATE public.underworld_purchases SET
  quantity=quantity-1,is_used=(quantity-1=0),applied_at=now()
 WHERE id=v_purchase.id AND quantity>0 AND is_used IS FALSE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_CONSUME_CONCURRENT_USE'; END IF;
 RETURN jsonb_build_object('success',true,'productName',v_product.name,
  'productId',v_product.id,'exposure',v_exposure);
END
$function$;

REVOKE ALL ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
