
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
  v_user_id uuid;
  v_price numeric;
  v_total numeric;
  v_cash bigint;
  v_holding_qty numeric := 0;
  v_holding_avg numeric := 0;
  v_new_qty numeric;
  v_new_avg numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;
  IF p_transaction_type NOT IN ('buy','sell') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  SELECT user_id, cash INTO v_user_id, v_cash
  FROM public.profiles WHERE id = p_profile_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT current_price INTO v_price FROM public.crypto_tokens
    WHERE id = p_token_id AND is_active = true AND is_rugged = false;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Token unavailable';
  END IF;

  v_total := ROUND(v_price * p_quantity)::numeric;

  SELECT quantity, average_buy_price INTO v_holding_qty, v_holding_avg
  FROM public.player_token_holdings
  WHERE user_id = v_user_id AND token_id = p_token_id
  FOR UPDATE;

  v_holding_qty := COALESCE(v_holding_qty, 0);
  v_holding_avg := COALESCE(v_holding_avg, 0);

  IF p_transaction_type = 'buy' THEN
    IF v_cash < v_total THEN
      RAISE EXCEPTION 'Insufficient cash';
    END IF;
    v_new_qty := v_holding_qty + p_quantity;
    v_new_avg := CASE WHEN v_new_qty > 0
      THEN ((v_holding_qty * v_holding_avg) + (p_quantity * v_price)) / v_new_qty
      ELSE v_price END;

    UPDATE public.profiles SET cash = cash - v_total::bigint, updated_at = now()
    WHERE id = p_profile_id;

    INSERT INTO public.player_token_holdings (user_id, token_id, quantity, average_buy_price)
    VALUES (v_user_id, p_token_id, v_new_qty, v_new_avg)
    ON CONFLICT (user_id, token_id) DO UPDATE
    SET quantity = EXCLUDED.quantity,
        average_buy_price = EXCLUDED.average_buy_price,
        updated_at = now();
  ELSE
    IF v_holding_qty < p_quantity THEN
      RAISE EXCEPTION 'Insufficient tokens';
    END IF;
    v_new_qty := v_holding_qty - p_quantity;

    UPDATE public.profiles SET cash = cash + v_total::bigint, updated_at = now()
    WHERE id = p_profile_id;

    IF v_new_qty <= 0 THEN
      DELETE FROM public.player_token_holdings
      WHERE user_id = v_user_id AND token_id = p_token_id;
    ELSE
      UPDATE public.player_token_holdings
      SET quantity = v_new_qty, updated_at = now()
      WHERE user_id = v_user_id AND token_id = p_token_id;
    END IF;
  END IF;

  INSERT INTO public.token_transactions
    (user_id, token_id, transaction_type, quantity, price_per_token, total_amount)
  VALUES (v_user_id, p_token_id, p_transaction_type, p_quantity, v_price, v_total);

  RETURN jsonb_build_object('success', true, 'price', v_price, 'total', v_total);
END;
$$;

-- Ensure unique index for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS player_token_holdings_user_token_uidx
  ON public.player_token_holdings(user_id, token_id);

GRANT EXECUTE ON FUNCTION public.trade_crypto_token(uuid, uuid, text, numeric) TO authenticated;
