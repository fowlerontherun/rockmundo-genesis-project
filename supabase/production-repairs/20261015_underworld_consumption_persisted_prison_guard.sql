-- Correct inconsistent prison state authorization after initial
-- 7-consumable shop release 20261015211043. This is a no-data DDL.
DO $preflight$
BEGIN
 IF to_regprocedure('public.consume_underworld_item_atomic(uuid,uuid)') IS NULL
    OR to_regclass('public.player_imprisonments') IS NULL
    OR to_regprocedure('public.buy_underworld_product_atomic(uuid,uuid,text,uuid)') IS NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_CONSUMPTION_PRISON_GUARD_DEPENDENCY_MISSING'; END IF;
 IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='consume_underworld_item_atomic'
      AND pg_get_functiondef(p.oid) LIKE '%UNDERWORLD_CONSUME_IMPRISONED%'
 ) THEN RAISE EXCEPTION 'UNDERWORLD_CONSUMPTION_PRISON_GUARD_ALREADY_INSTALLED'; END IF;
END $preflight$;

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

REVOKE ALL ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid)
 TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
