-- Atomic Skin Store clothing purchase. The server owns price, cash deduction,
-- ownership identity and validation of the player's chosen look.

CREATE TABLE IF NOT EXISTS public.clothing_skin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clothing_item_id uuid NOT NULL REFERENCES public.avatar_clothing_items(id),
  ownership_id uuid NOT NULL REFERENCES public.player_owned_skins(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount >= 0),
  idempotency_key text NOT NULL UNIQUE,
  selected_variant_key text,
  customization_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clothing_skin_purchases_profile
  ON public.clothing_skin_purchases(profile_id, created_at DESC);

ALTER TABLE public.clothing_skin_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their clothing purchases" ON public.clothing_skin_purchases;
CREATE POLICY "Players can view their clothing purchases"
ON public.clothing_skin_purchases FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.purchase_clothing_item_atomic(
  p_profile_id uuid,
  p_item_id uuid,
  p_idempotency_key text,
  p_variant_key text DEFAULT NULL,
  p_zone_colors jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_item public.avatar_clothing_items;
  v_existing public.clothing_skin_purchases;
  v_ownership_id uuid;
  v_purchase_id uuid;
  v_price numeric;
  v_remaining_cash numeric;
  v_collection_active boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_profile_id IS NULL THEN RAISE EXCEPTION 'profile_required'; END IF;
  IF p_item_id IS NULL THEN RAISE EXCEPTION 'clothing_item_required'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_invalid';
  END IF;

  SELECT * INTO v_existing
  FROM public.clothing_skin_purchases
  WHERE idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.profile_id <> p_profile_id OR v_existing.clothing_item_id <> p_item_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'purchaseId', v_existing.id,
      'ownershipId', v_existing.ownership_id,
      'itemId', v_existing.clothing_item_id,
      'amount', v_existing.amount
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'profile_not_owned_by_user'; END IF;

  SELECT * INTO v_item
  FROM public.avatar_clothing_items
  WHERE id = p_item_id
  FOR SHARE;

  IF v_item.id IS NULL THEN RAISE EXCEPTION 'clothing_item_not_found'; END IF;
  IF v_item.release_date IS NOT NULL AND v_item.release_date > current_date THEN RAISE EXCEPTION 'clothing_item_not_released'; END IF;
  IF v_item.expiry_date IS NOT NULL AND v_item.expiry_date < current_date THEN RAISE EXCEPTION 'clothing_item_expired'; END IF;

  IF v_item.collection_id IS NOT NULL THEN
    SELECT is_active INTO v_collection_active
    FROM public.skin_collections
    WHERE id = v_item.collection_id;
    IF COALESCE(v_collection_active, false) = false THEN RAISE EXCEPTION 'skin_collection_inactive'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_owned_skins
    WHERE profile_id = p_profile_id AND item_id = p_item_id
  ) THEN
    RAISE EXCEPTION 'clothing_item_already_owned';
  END IF;

  v_price := GREATEST(0, COALESCE(v_item.price, 0));
  IF COALESCE(v_profile.cash, 0) < v_price THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

  UPDATE public.profiles
  SET cash = COALESCE(cash, 0) - v_price
  WHERE id = p_profile_id
  RETURNING cash INTO v_remaining_cash;

  INSERT INTO public.player_owned_skins(
    profile_id,
    item_type,
    item_id,
    selected_variant_key,
    customization_config
  ) VALUES (
    p_profile_id,
    'clothing',
    p_item_id,
    NULLIF(trim(p_variant_key), ''),
    COALESCE(p_zone_colors, '{}'::jsonb)
  )
  RETURNING id INTO v_ownership_id;

  INSERT INTO public.clothing_skin_purchases(
    profile_id,
    user_id,
    clothing_item_id,
    ownership_id,
    amount,
    idempotency_key,
    selected_variant_key,
    customization_config
  ) VALUES (
    p_profile_id,
    v_user_id,
    p_item_id,
    v_ownership_id,
    v_price,
    p_idempotency_key,
    NULLIF(trim(p_variant_key), ''),
    COALESCE(p_zone_colors, '{}'::jsonb)
  ) RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'status', 'completed',
    'purchaseId', v_purchase_id,
    'ownershipId', v_ownership_id,
    'itemId', p_item_id,
    'amount', v_price,
    'remainingCash', v_remaining_cash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_clothing_item_atomic(uuid,uuid,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_clothing_item_atomic(uuid,uuid,text,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_clothing_item_atomic(uuid,uuid,text,text,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
