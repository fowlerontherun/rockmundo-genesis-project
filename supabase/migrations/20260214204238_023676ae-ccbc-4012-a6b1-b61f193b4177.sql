
CREATE OR REPLACE FUNCTION public.complete_song_sale(
  p_listing_id uuid,
  p_buyer_user_id uuid,
  p_sale_price numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing record;
  v_song record;
  v_buyer_cash numeric;
  v_seller_cash numeric;
  v_marketplace_fee numeric;
  v_seller_payout numeric;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_listing.listing_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Listing is no longer active');
  END IF;

  IF v_listing.seller_user_id = p_buyer_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot buy your own song');
  END IF;

  SELECT * INTO v_song
  FROM songs
  WHERE id = v_listing.song_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Song not found');
  END IF;

  IF v_song.is_purchased THEN
    RETURN json_build_object('success', false, 'error', 'This song was previously purchased and cannot be resold');
  END IF;

  SELECT cash INTO v_buyer_cash
  FROM profiles
  WHERE user_id = p_buyer_user_id
  FOR UPDATE;

  IF v_buyer_cash IS NULL OR v_buyer_cash < p_sale_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;

  v_marketplace_fee := ROUND(p_sale_price * 0.10);
  v_seller_payout := p_sale_price - v_marketplace_fee;

  UPDATE profiles SET cash = cash - p_sale_price WHERE user_id = p_buyer_user_id;
  UPDATE profiles SET cash = cash + v_seller_payout WHERE user_id = v_listing.seller_user_id;

  UPDATE songs
  SET 
    user_id = p_buyer_user_id,
    band_id = NULL,
    ownership_type = 'purchased',
    is_purchased = true,
    purchased_from_user_id = v_listing.seller_user_id,
    purchased_at = now(),
    original_writer_id = COALESCE(original_writer_id, v_listing.seller_user_id),
    market_listing_id = p_listing_id
  WHERE id = v_listing.song_id;

  UPDATE marketplace_listings
  SET listing_status = 'sold', updated_at = now()
  WHERE id = p_listing_id;

  INSERT INTO marketplace_transactions (
    listing_id, song_id, buyer_user_id, seller_user_id,
    sale_price, royalty_percentage, transaction_status, completed_at
  ) VALUES (
    p_listing_id, v_listing.song_id, p_buyer_user_id, v_listing.seller_user_id,
    p_sale_price, v_listing.royalty_percentage, 'completed', now()
  )
  RETURNING id INTO v_transaction_id;

  UPDATE marketplace_bids SET bid_status = 'lost'
  WHERE listing_id = p_listing_id AND bidder_user_id != p_buyer_user_id;

  UPDATE marketplace_bids SET bid_status = 'won'
  WHERE listing_id = p_listing_id AND bidder_user_id = p_buyer_user_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'sale_price', p_sale_price,
    'marketplace_fee', v_marketplace_fee,
    'seller_payout', v_seller_payout
  );
END;
$$;
