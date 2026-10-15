-- Incremental live-compatible fix after 20261015211043.
-- The cash sync trigger already creates a double-entry financial transaction.
-- Tag it with a deterministic request key and catalogue context BEFORE the
-- debit, so an uncertain frontend response can be reconciled/replayed
-- without a second journal line or a second cash deduction.
-- Does not touch historical purchases, player balances, or tokens.
DO $preflight$
BEGIN
  IF to_regprocedure('public.buy_underworld_product_atomic(uuid,uuid,text,uuid)') IS NULL
    OR to_regprocedure('public.consume_underworld_item_atomic(uuid,uuid)') IS NULL
    OR to_regprocedure('public._journal_profile_wallet_delta(uuid,bigint,jsonb)') IS NULL
    OR to_regclass('public.financial_transactions') IS NULL
    OR to_regclass('public.underworld_purchases') IS NULL
  THEN RAISE EXCEPTION 'UNDERWORLD_CASH_JOURNAL_DEPENDENCY_MISSING'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='buy_underworld_product_atomic'
      AND pg_get_functiondef(p.oid) LIKE '%UNDERWORLD_EFFECTS_REQUIRE_FUTURE_CUTOVER%'
  ) THEN RAISE EXCEPTION 'UNDERWORLD_CASH_JOURNAL_ORIGINAL_BUY_DRIFT'; END IF;
END $preflight$;

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

REVOKE ALL ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text,uuid)
 TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
