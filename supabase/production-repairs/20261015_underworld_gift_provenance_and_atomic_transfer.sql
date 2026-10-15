-- Standalone safe repair during October underworld migration reconciliation.
-- The old gift_underworld_item() inserts paid_with='gift', but the live
-- purchases CHECK allows only ('cash','crypto'); gifts cannot succeed.
-- Also prevent concurrent transfers of the same inventory item, reject
-- inactive/blocked recipient accounts and keep an auditable source pointer.
-- Do not deploy the incomplete original buy/consume/arrest migrations here.
-- This DDL performs no item transfer, arrest, XP credit or payout.
DO $preflight$
BEGIN
 IF to_regclass('public.underworld_purchases') IS NULL
    OR to_regclass('public.underworld_products') IS NULL
    OR to_regclass('public.profiles') IS NULL
    OR to_regprocedure('public.gift_underworld_item(uuid,uuid)') IS NULL
    OR to_regprocedure('public.are_profiles_blocked(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_DEPENDENCY_MISSING'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint c
   WHERE c.conrelid='public.underworld_purchases'::regclass
     AND c.conname='underworld_purchases_paid_with_check'
     AND pg_get_constraintdef(c.oid) ILIKE '%cash%'
     AND pg_get_constraintdef(c.oid) ILIKE '%crypto%'
 ) THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_PAYMENT_CONSTRAINT_DRIFT'; END IF;
 IF has_table_privilege('authenticated','public.underworld_purchases','INSERT')
    OR has_table_privilege('authenticated','public.underworld_purchases','UPDATE')
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_CLIENT_WRITE_LOCK_MISSING'; END IF;
END $preflight$;

ALTER TABLE public.underworld_purchases
  ADD COLUMN IF NOT EXISTS gifted_from_purchase_id uuid
    REFERENCES public.underworld_purchases(id);

ALTER TABLE public.underworld_purchases
  DROP CONSTRAINT underworld_purchases_paid_with_check;
ALTER TABLE public.underworld_purchases
  ADD CONSTRAINT underworld_purchases_paid_with_check
    CHECK (paid_with IN ('cash','crypto','gift'));

CREATE INDEX IF NOT EXISTS underworld_gifts_source_purchase_idx
  ON public.underworld_purchases(gifted_from_purchase_id)
  WHERE gifted_from_purchase_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gift_underworld_item(
 _purchase_id uuid, _recipient_profile_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $gift$
DECLARE
 v_purchase public.underworld_purchases%ROWTYPE;
 v_sender public.profiles%ROWTYPE;
 v_recipient public.profiles%ROWTYPE;
 v_product public.underworld_products%ROWTYPE;
 v_new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR _purchase_id IS NULL
    OR _recipient_profile_id IS NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_AUTH_REQUIRED' USING ERRCODE='42501'; END IF;

 -- Serialise gifts/consumption of the same source purchase. Retries after
 -- its final unit is transferred are rejected rather than re-gifted.
 SELECT * INTO v_purchase FROM public.underworld_purchases
 WHERE id=_purchase_id FOR UPDATE;
 IF NOT FOUND
   OR v_purchase.is_used IS DISTINCT FROM false
   OR coalesce(v_purchase.quantity,0)<1
   OR (v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at<=now())
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_ITEM_NOT_AVAILABLE' USING ERRCODE='55000'; END IF;

 SELECT * INTO v_sender FROM public.profiles
 WHERE id=v_purchase.profile_id AND user_id=auth.uid()
   AND is_active IS TRUE AND deleted_at IS NULL AND died_at IS NULL;
 IF NOT FOUND OR v_purchase.user_id IS DISTINCT FROM v_sender.user_id
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_NOT_OWNED' USING ERRCODE='42501'; END IF;

 SELECT * INTO v_recipient FROM public.profiles
 WHERE id=_recipient_profile_id AND is_active IS TRUE
   AND deleted_at IS NULL AND died_at IS NULL
 FOR KEY SHARE;
 IF NOT FOUND OR v_recipient.user_id IS NULL
    OR v_sender.id=v_recipient.id
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_RECIPIENT_INVALID' USING ERRCODE='22023'; END IF;

 IF public.are_profiles_blocked(v_sender.id,v_recipient.id) THEN
   RAISE EXCEPTION 'UNDERWORLD_GIFT_RECIPIENT_BLOCKED' USING ERRCODE='42501'; END IF;

 SELECT * INTO v_product FROM public.underworld_products
 WHERE id=v_purchase.product_id;
 IF NOT FOUND OR v_product.category NOT IN ('skill_book','consumable')
    OR coalesce(v_product.duration_hours,0)>0
 THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_PRODUCT_NOT_TRANSFERABLE' USING ERRCODE='22023'; END IF;

 UPDATE public.underworld_purchases
 SET quantity=quantity-1, is_used=(quantity-1=0)
 WHERE id=v_purchase.id AND is_used IS FALSE AND quantity>=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNDERWORLD_GIFT_CONCURRENT_TRANSFER'; END IF;

 INSERT INTO public.underworld_purchases
 (profile_id,user_id,product_id,paid_with,cash_amount,token_id,token_amount,
  effects_applied,expires_at,is_used,quantity,gifted_from_purchase_id)
 VALUES
 (v_recipient.id,v_recipient.user_id,v_product.id,'gift',0,NULL,NULL,
  coalesce(v_purchase.effects_applied,v_product.effects,'{}'::jsonb),
  NULL,false,1,v_purchase.id)
 RETURNING id INTO v_new_id;
 RETURN v_new_id;
END
$gift$;

REVOKE ALL ON FUNCTION public.gift_underworld_item(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gift_underworld_item(uuid,uuid)
 TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
