-- Scoped replacement of broken 20261012232200 and unsafe 20261013170000.
-- Initial release: cash-priced consumables with ONLY integer-valued health,
-- energy or fame changes, no timers, XP, skill points or multipliers.
-- All other catalog items are rejected BEFORE the first debit.
-- Every purchase has a required UUID idempotency key and server price.
-- Paid purchase can trigger arrest; gifts and historical rows never can.
DO $preflight$
BEGIN
 IF to_regclass('public.underworld_purchases') IS NULL
    OR to_regclass('public.underworld_products') IS NULL
    OR to_regclass('public.player_imprisonments') IS NULL
    OR to_regclass('public.prisons') IS NULL
    OR to_regclass('public.player_addictions') IS NULL
    OR to_regprocedure('public.record_addiction_exposure(uuid,text,integer,text,text)') IS NULL
    OR to_regprocedure('public.buy_underworld_product_atomic(uuid,uuid,text,uuid)') IS NOT NULL
    OR to_regprocedure('public.consume_underworld_item_atomic(uuid,uuid)') IS NOT NULL
    OR to_regprocedure('public.underworld_purchase_arrest_trigger()') IS NOT NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_SAFE_CUTOVER_DEPENDENCY_OR_EXISTING_RPC'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_indexes
   WHERE schemaname='public' AND tablename='underworld_purchases'
     AND indexname='underworld_purchase_profile_request_once')
    OR NOT EXISTS (SELECT 1 FROM pg_indexes
   WHERE schemaname='public' AND tablename='underworld_purchases'
     AND indexname='underworld_gifts_source_purchase_idx')
    OR NOT EXISTS (SELECT 1 FROM pg_class c
      WHERE c.oid='public.underworld_purchases'::regclass AND c.relrowsecurity)
    OR has_table_privilege('authenticated','public.underworld_purchases','INSERT')
    OR has_table_privilege('authenticated','public.underworld_purchases','UPDATE')
    OR has_table_privilege('authenticated','public.player_imprisonments','INSERT')
 THEN RAISE EXCEPTION 'UNDERWORLD_PROVENANCE_OR_CLIENT_WRITE_LOCK_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.prisons)
 THEN RAISE EXCEPTION 'UNDERWORLD_NO_PRISON_CONFIGURATION'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.underworld_safe_instant_effects(p_effects jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $validate$
DECLARE v_key text;v_value jsonb;v_num numeric;v_count integer:=0;
BEGIN
 IF jsonb_typeof(p_effects) IS DISTINCT FROM 'object'
 THEN RETURN false; END IF;
 FOR v_key,v_value IN SELECT key,value FROM jsonb_each(p_effects) LOOP
  v_count:=v_count+1;
  IF v_key NOT IN ('health','energy','fame')
     OR jsonb_typeof(v_value) IS DISTINCT FROM 'number'
  THEN RETURN false; END IF;
  v_num:=(v_value #>> '{}')::numeric;
  IF v_num<>trunc(v_num) OR abs(v_num)>1000 THEN RETURN false; END IF;
 END LOOP;
 RETURN v_count BETWEEN 1 AND 3;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
 RETURN false;
END
$validate$;

CREATE OR REPLACE FUNCTION public.underworld_purchase_arrest_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $arrest$
DECLARE v_profile public.profiles%ROWTYPE;v_prison uuid;
 v_chance numeric;v_sentence integer;v_bail bigint;
BEGIN
 -- Do not arrest gifts, migration/backfill rows, or old purchases without
 -- the new trustworthy paid RPC request key.
 IF NEW.paid_with NOT IN ('cash','crypto')
    OR NEW.client_request_id IS NULL
    OR NEW.gifted_from_purchase_id IS NOT NULL
 THEN RETURN NEW; END IF;
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=NEW.profile_id FOR UPDATE;
 IF NOT FOUND OR v_profile.user_id IS DISTINCT FROM NEW.user_id
 THEN RAISE EXCEPTION 'UNDERWORLD_ARREST_PROFILE_MISMATCH'; END IF;
 IF coalesce(v_profile.is_imprisoned,false) OR EXISTS (
  SELECT 1 FROM public.player_imprisonments i
  WHERE i.profile_id=NEW.profile_id AND i.status='imprisoned'
 ) THEN RAISE EXCEPTION 'UNDERWORLD_ALREADY_IMPRISONED'; END IF;
 v_chance:=0.08*(1+least(0.2,greatest(0,v_profile.fame)::numeric/25000));
 IF random() >= v_chance THEN RETURN NEW; END IF;
 SELECT id INTO v_prison FROM public.prisons
 WHERE city_id=v_profile.current_city_id ORDER BY id LIMIT 1;
 IF v_prison IS NULL THEN
  SELECT id INTO v_prison FROM public.prisons ORDER BY id LIMIT 1;
 END IF;
 IF v_prison IS NULL THEN RAISE EXCEPTION 'UNDERWORLD_ARREST_PRISON_MISSING'; END IF;
 v_sentence:=1+floor(random()*3)::int;
 v_bail:=200+floor(random()*601)::bigint;
 INSERT INTO public.player_imprisonments(
 user_id,profile_id,prison_id,original_sentence_days,
 remaining_sentence_days,release_date,reason,status,bail_amount)
 VALUES(NEW.user_id,NEW.profile_id,v_prison,v_sentence,v_sentence,
 now()+make_interval(days=>v_sentence),'underworld_purchase',
 'imprisoned',v_bail);
 UPDATE public.profiles SET is_imprisoned=true,
   fame=greatest(0,fame-50) WHERE id=NEW.profile_id;
 RETURN NEW;
END
$arrest$;

DROP TRIGGER IF EXISTS underworld_purchase_arrest ON public.underworld_purchases;
CREATE TRIGGER underworld_purchase_arrest AFTER INSERT
ON public.underworld_purchases FOR EACH ROW
EXECUTE FUNCTION public.underworld_purchase_arrest_trigger();

CREATE OR REPLACE FUNCTION public.buy_underworld_product_atomic(
 p_profile_id uuid,p_product_id uuid,p_payment_method text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $buy$
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
 IF v_product.category IS DISTINCT FROM 'consumable'
    OR coalesce(v_product.duration_hours,0)<>0
    OR NOT public.underworld_safe_instant_effects(v_effects)
 THEN RAISE EXCEPTION 'UNDERWORLD_EFFECTS_REQUIRE_FUTURE_CUTOVER'
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
 UPDATE public.profiles SET cash=cash-v_product.price_cash
 WHERE id=v_profile.id AND cash>=v_product.price_cash;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_INSUFFICIENT_FUNDS'
   USING ERRCODE='22023'; END IF;
 v_new_id:=gen_random_uuid();
 INSERT INTO public.underworld_purchases(
 id,user_id,profile_id,product_id,paid_with,cash_amount,
 effects_applied,expires_at,is_used,quantity,client_request_id,
 purchased_addiction_type)
 VALUES(v_new_id,v_profile.user_id,v_profile.id,v_product.id,'cash',
  v_product.price_cash,v_effects,NULL,false,1,p_request_id,
  v_product.addiction_type);
 -- AFTER INSERT arrest trigger executes in this SAME transaction. Any
 -- failure rolls back both stock/payment and the purchase.
 RETURN jsonb_build_object('success',true,'purchaseId',v_new_id,
  'storedInInventory',true,'expiresAt',NULL,'replayed',false);
END
$buy$;

CREATE OR REPLACE FUNCTION public.consume_underworld_item_atomic(
 p_profile_id uuid,p_purchase_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $consume$
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
 IF NOT FOUND OR v_product.category IS DISTINCT FROM 'consumable'
 THEN RAISE EXCEPTION 'UNDERWORLD_ITEM_TYPE_NOT_SUPPORTED'
   USING ERRCODE='0A000'; END IF;
 v_effects:=coalesce(v_purchase.effects_applied,'{}'::jsonb);
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
$consume$;

REVOKE ALL ON FUNCTION public.underworld_safe_instant_effects(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.underworld_safe_instant_effects(jsonb)
 TO service_role;
REVOKE ALL ON FUNCTION public.underworld_purchase_arrest_trigger()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.underworld_purchase_arrest_trigger()
 TO service_role;
REVOKE ALL ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid)
 TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid)
 TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
