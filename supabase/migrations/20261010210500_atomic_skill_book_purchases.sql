-- Atomic, server-priced book purchases; client cannot choose the charge.
CREATE UNIQUE INDEX IF NOT EXISTS player_book_purchases_profile_book_unique
ON public.player_book_purchases(profile_id, book_id)
WHERE profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.purchase_skill_book(p_profile_id uuid, p_book_id uuid)
RETURNS public.player_book_purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price integer;
  v_cash bigint;
  v_purchase public.player_book_purchases;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Character does not belong to this account' USING ERRCODE = '42501';
  END IF;
  SELECT price INTO v_price FROM public.skill_books
  WHERE id = p_book_id AND is_active IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book is unavailable' USING ERRCODE = '22023';
  END IF;
  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Invalid book price' USING ERRCODE = '22023';
  END IF;
  -- Serialize all purchases for the same character.
  SELECT cash INTO v_cash FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.player_book_purchases
             WHERE profile_id = p_profile_id AND book_id = p_book_id) THEN
    RAISE EXCEPTION 'Book already owned' USING ERRCODE = '23505';
  END IF;
  IF v_cash < v_price THEN
    RAISE EXCEPTION 'Insufficient funds' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles SET cash = cash - v_price WHERE id = p_profile_id;
  INSERT INTO public.player_book_purchases(user_id, profile_id, book_id, purchase_price)
  VALUES (v_user_id, p_profile_id, p_book_id, v_price)
  RETURNING * INTO v_purchase;
  RETURN v_purchase;
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_skill_book(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_skill_book(uuid, uuid) TO authenticated;
