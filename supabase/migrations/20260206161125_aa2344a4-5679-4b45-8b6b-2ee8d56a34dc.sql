
-- Add is_purchased flag to songs to prevent resale of purchased songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_purchased boolean NOT NULL DEFAULT false;

-- Add purchased_from_user_id to track who sold the song
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS purchased_from_user_id uuid REFERENCES auth.users(id);

-- Add purchased_at timestamp
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS purchased_at timestamptz;

-- Add current_bidder_user_id to marketplace_listings for easy lookup
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS current_bidder_user_id text;

-- Create index on marketplace_listings for active auctions
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_active 
  ON public.marketplace_listings(listing_status, listing_type) 
  WHERE listing_status = 'active';

-- Create index on marketplace_bids for listing lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_bids_listing 
  ON public.marketplace_bids(listing_id, bid_amount DESC);

-- RPC: Complete an auction sale atomically
-- Transfers money, transfers song ownership, creates transaction record
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
  -- Lock the listing row
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

  IF v_listing.seller_user_id = p_buyer_user_id::text THEN
    RETURN json_build_object('success', false, 'error', 'Cannot buy your own song');
  END IF;

  -- Get the song
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

  -- Check buyer has enough cash
  SELECT cash INTO v_buyer_cash
  FROM profiles
  WHERE user_id = p_buyer_user_id
  FOR UPDATE;

  IF v_buyer_cash IS NULL OR v_buyer_cash < p_sale_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;

  -- Calculate fees (10% marketplace fee)
  v_marketplace_fee := ROUND(p_sale_price * 0.10);
  v_seller_payout := p_sale_price - v_marketplace_fee;

  -- Deduct from buyer
  UPDATE profiles
  SET cash = cash - p_sale_price
  WHERE user_id = p_buyer_user_id;

  -- Pay seller
  UPDATE profiles
  SET cash = cash + v_seller_payout
  WHERE user_id = v_listing.seller_user_id::uuid;

  -- Transfer song ownership
  UPDATE songs
  SET 
    user_id = p_buyer_user_id,
    band_id = NULL,
    ownership_type = 'purchased',
    is_purchased = true,
    purchased_from_user_id = v_listing.seller_user_id::uuid,
    purchased_at = now(),
    original_writer_id = COALESCE(original_writer_id, v_listing.seller_user_id::uuid),
    market_listing_id = p_listing_id
  WHERE id = v_listing.song_id;

  -- Mark listing as sold
  UPDATE marketplace_listings
  SET 
    listing_status = 'sold',
    updated_at = now()
  WHERE id = p_listing_id;

  -- Create transaction record
  INSERT INTO marketplace_transactions (
    listing_id, song_id, buyer_user_id, seller_user_id,
    sale_price, royalty_percentage, transaction_status, completed_at
  ) VALUES (
    p_listing_id, v_listing.song_id, p_buyer_user_id::text, v_listing.seller_user_id,
    p_sale_price, v_listing.royalty_percentage, 'completed', now()
  )
  RETURNING id INTO v_transaction_id;

  -- Outbid all other bidders (mark them as outbid)
  UPDATE marketplace_bids
  SET bid_status = 'lost'
  WHERE listing_id = p_listing_id
    AND bidder_user_id != p_buyer_user_id::text;

  -- Mark winning bid
  UPDATE marketplace_bids
  SET bid_status = 'won'
  WHERE listing_id = p_listing_id
    AND bidder_user_id = p_buyer_user_id::text;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'sale_price', p_sale_price,
    'marketplace_fee', v_marketplace_fee,
    'seller_payout', v_seller_payout
  );
END;
$$;

-- RPC: Place a bid on an auction listing
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

  IF v_listing.seller_user_id = p_bidder_user_id::text THEN
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

  -- Insert new bid
  INSERT INTO marketplace_bids (
    listing_id, bidder_user_id, bid_amount, bid_status
  ) VALUES (
    p_listing_id, p_bidder_user_id::text, p_bid_amount, 'active'
  );

  -- Update listing with current bid info
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
