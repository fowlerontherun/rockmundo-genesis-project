
-- Fix the place_song_bid RPC to handle the UUID/text type mismatch
-- seller_user_id is UUID, current_bidder_user_id is TEXT
-- Remove ::text casts and use proper type comparisons

CREATE OR REPLACE FUNCTION public.place_song_bid(
  p_listing_id uuid,
  p_bidder_user_id uuid,
  p_bid_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing record;
  v_bidder_cash numeric;
  v_min_bid numeric;
BEGIN
  -- Lock and read listing
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

  IF v_listing.listing_type != 'auction' THEN
    RETURN json_build_object('success', false, 'error', 'This listing is not an auction');
  END IF;

  -- Compare UUID to UUID (seller_user_id is UUID)
  IF v_listing.seller_user_id = p_bidder_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot bid on your own listing');
  END IF;

  -- Check auction hasn't expired
  IF v_listing.expires_at IS NOT NULL AND v_listing.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Auction has ended');
  END IF;

  -- Calculate minimum bid (5% above current or $100, whichever is greater)
  v_min_bid := COALESCE(v_listing.current_bid, v_listing.asking_price) + 
    GREATEST(100, ROUND(COALESCE(v_listing.current_bid, v_listing.asking_price) * 0.05));

  IF p_bid_amount < v_min_bid THEN
    RETURN json_build_object('success', false, 'error', 'Bid must be at least $' || v_min_bid);
  END IF;

  -- Check bidder has enough cash
  SELECT cash INTO v_bidder_cash
  FROM profiles
  WHERE user_id = p_bidder_user_id;

  IF v_bidder_cash IS NULL OR v_bidder_cash < p_bid_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;

  -- Mark previous bids as outbid
  UPDATE marketplace_bids
  SET bid_status = 'outbid'
  WHERE listing_id = p_listing_id
    AND bid_status = 'active';

  -- Insert new bid (bidder_user_id is UUID column)
  INSERT INTO marketplace_bids (
    listing_id, bidder_user_id, bid_amount, bid_status
  ) VALUES (
    p_listing_id, p_bidder_user_id, p_bid_amount, 'active'
  );

  -- Update listing with current bid info
  -- current_bidder_user_id is TEXT column, so cast UUID to text
  UPDATE marketplace_listings
  SET 
    current_bid = p_bid_amount,
    current_bidder_user_id = p_bidder_user_id::text,
    updated_at = now()
  WHERE id = p_listing_id;

  -- If auction is ending within 5 minutes, extend by 5 minutes (anti-sniping)
  IF v_listing.expires_at IS NOT NULL 
     AND v_listing.expires_at - interval '5 minutes' < now() THEN
    UPDATE marketplace_listings
    SET expires_at = v_listing.expires_at + interval '5 minutes'
    WHERE id = p_listing_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'bid_amount', p_bid_amount,
    'message', 'Bid placed successfully'
  );
END;
$$;
