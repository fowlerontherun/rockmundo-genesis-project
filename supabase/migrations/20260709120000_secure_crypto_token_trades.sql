-- Secure crypto token trading behind an atomic server-side RPC.
-- Clients may read their portfolio, but cannot mint cash/tokens by directly
-- updating holdings or by supplying arbitrary trade prices.

DROP POLICY IF EXISTS "Users can manage their own holdings" ON public.player_token_holdings;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.token_transactions;

CREATE POLICY "Admins can manage token holdings"
  ON public.player_token_holdings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create token transactions"
  ON public.token_transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.trade_crypto_token(
  p_profile_id uuid,
  p_token_id uuid,
  p_transaction_type text,
  p_quantity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price numeric(12, 2);
  v_total numeric(15, 2);
  v_cash numeric;
  v_holding public.player_token_holdings%ROWTYPE;
  v_new_quantity numeric(18, 8);
  v_new_avg_price numeric(12, 2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_transaction_type NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 100000000 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  -- Keep quantity precision bounded so clients cannot exploit rounding dust.
  IF p_quantity != round(p_quantity, 8) THEN
    RAISE EXCEPTION 'Quantity supports up to 8 decimal places';
  END IF;

  SELECT current_price
    INTO v_price
  FROM public.crypto_tokens
  WHERE id = p_token_id
    AND is_active = true
    AND is_rugged = false
  FOR UPDATE;

  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'Token is not tradable';
  END IF;

  v_total := round(p_quantity * v_price, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Trade amount is too small';
  END IF;

  SELECT cash
    INTO v_cash
  FROM public.profiles
  WHERE id = p_profile_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF v_cash IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT *
    INTO v_holding
  FROM public.player_token_holdings
  WHERE user_id = v_user_id
    AND token_id = p_token_id
  FOR UPDATE;

  IF p_transaction_type = 'buy' THEN
    IF v_cash < v_total THEN
      RAISE EXCEPTION 'Insufficient funds';
    END IF;

    UPDATE public.profiles
    SET cash = cash - v_total
    WHERE id = p_profile_id
      AND user_id = v_user_id;

    IF v_holding.id IS NULL THEN
      INSERT INTO public.player_token_holdings (user_id, token_id, quantity, average_buy_price)
      VALUES (v_user_id, p_token_id, p_quantity, v_price);
      v_new_quantity := p_quantity;
      v_new_avg_price := v_price;
    ELSE
      v_new_quantity := v_holding.quantity + p_quantity;
      v_new_avg_price := round(
        ((coalesce(v_holding.average_buy_price, 0) * v_holding.quantity) + (v_price * p_quantity)) / v_new_quantity,
        2
      );

      UPDATE public.player_token_holdings
      SET quantity = v_new_quantity,
          average_buy_price = v_new_avg_price
      WHERE id = v_holding.id;
    END IF;
  ELSE
    IF v_holding.id IS NULL OR v_holding.quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient token balance';
    END IF;

    UPDATE public.profiles
    SET cash = cash + v_total
    WHERE id = p_profile_id
      AND user_id = v_user_id;

    v_new_quantity := v_holding.quantity - p_quantity;
    v_new_avg_price := v_holding.average_buy_price;

    IF v_new_quantity > 0 THEN
      UPDATE public.player_token_holdings
      SET quantity = v_new_quantity
      WHERE id = v_holding.id;
    ELSE
      DELETE FROM public.player_token_holdings
      WHERE id = v_holding.id;
      v_new_quantity := 0;
    END IF;
  END IF;

  INSERT INTO public.token_transactions (
    user_id,
    token_id,
    transaction_type,
    quantity,
    price_per_token,
    total_amount
  ) VALUES (
    v_user_id,
    p_token_id,
    p_transaction_type,
    p_quantity,
    v_price,
    v_total
  );

  RETURN jsonb_build_object(
    'transaction_type', p_transaction_type,
    'token_id', p_token_id,
    'quantity', p_quantity,
    'price_per_token', v_price,
    'total_amount', v_total,
    'holding_quantity', v_new_quantity,
    'average_buy_price', v_new_avg_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trade_crypto_token(uuid, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trade_crypto_token(uuid, uuid, text, numeric) TO authenticated;
