
CREATE OR REPLACE FUNCTION public.gift_underworld_item(
  _purchase_id UUID,
  _recipient_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_profile_id UUID;
  _product_id UUID;
  _new_id UUID;
  _qty INT;
BEGIN
  -- Validate purchase belongs to current user
  SELECT p.profile_id, p.product_id, p.quantity
    INTO _sender_profile_id, _product_id, _qty
  FROM public.underworld_purchases p
  JOIN public.profiles pr ON pr.id = p.profile_id
  WHERE p.id = _purchase_id
    AND pr.user_id = auth.uid()
    AND p.is_used = false
  LIMIT 1;

  IF _sender_profile_id IS NULL THEN
    RAISE EXCEPTION 'Item not found in your inventory';
  END IF;

  IF _sender_profile_id = _recipient_profile_id THEN
    RAISE EXCEPTION 'Cannot gift to yourself';
  END IF;

  -- Decrement / remove sender's stack
  IF COALESCE(_qty, 1) > 1 THEN
    UPDATE public.underworld_purchases
      SET quantity = _qty - 1
      WHERE id = _purchase_id;
  ELSE
    UPDATE public.underworld_purchases
      SET is_used = true
      WHERE id = _purchase_id;
  END IF;

  -- Create recipient's gift inventory row
  INSERT INTO public.underworld_purchases (
    profile_id, user_id, product_id, paid_with, cash_amount,
    is_used, quantity, applied_at, created_at
  )
  SELECT
    _recipient_profile_id,
    (SELECT user_id FROM public.profiles WHERE id = _recipient_profile_id),
    _product_id,
    'gift',
    0,
    false,
    1,
    now(),
    now()
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gift_underworld_item(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gift_underworld_item(UUID, UUID) TO authenticated;
