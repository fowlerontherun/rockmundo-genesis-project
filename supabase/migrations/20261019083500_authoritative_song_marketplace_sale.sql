-- #4229: authoritative fixed-price / buyout song sale.
-- A bidder's unescrowed auction offer cannot be charged by a seller; the
-- separate #4230 bidding-reservation fix is required before that path can work.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_transactions_one_completed_per_listing
  ON public.marketplace_transactions(listing_id)
  WHERE transaction_status='completed';

CREATE OR REPLACE FUNCTION public.complete_song_sale(
  p_listing_id uuid,
  p_buyer_user_id uuid,
  p_sale_price numeric
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_buyer_profile_id uuid;
  v_seller_profile_id uuid;
  v_listing public.marketplace_listings%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_price integer;
  v_fee integer;
  v_payout integer;
  v_buyer_cash bigint;
  v_tx uuid;
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('success',false,'error','Authentication required');
  END IF;
  -- Preserve the legacy RPC signature for old clients, but never interpret
  -- its supplied user ID as authority for charging another player.
  IF p_buyer_user_id IS DISTINCT FROM v_actor THEN
    RETURN json_build_object('success',false,'error','Buyer identity mismatch');
  END IF;
  IF p_listing_id IS NULL OR p_sale_price IS NULL OR
     p_sale_price <= 0 OR p_sale_price <> trunc(p_sale_price) THEN
    RETURN json_build_object('success',false,'error','Invalid sale price');
  END IF;

  -- Listing row is the single transaction claim / serialization point.
  SELECT * INTO v_listing FROM public.marketplace_listings
  WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','Listing not found');
  END IF;
  IF v_listing.listing_status <> 'active' THEN
    RETURN json_build_object('success',false,'error','Listing is no longer active');
  END IF;
  IF v_listing.expires_at IS NOT NULL AND v_listing.expires_at<=now() THEN
    RETURN json_build_object('success',false,'error','Listing has expired');
  END IF;
  IF v_listing.seller_user_id=v_actor THEN
    RETURN json_build_object('success',false,'error','Cannot buy your own song');
  END IF;

  IF v_listing.listing_type='fixed_price' THEN
    v_price:=v_listing.asking_price;
  ELSIF v_listing.listing_type='auction'
        AND v_listing.buyout_price IS NOT NULL THEN
    -- A voluntary buyout is a purchase by the authenticated buyer.
    -- Do NOT charge a high bidder on seller request: place_song_bid currently
    -- trusts browser-provided bidder ID and does not hold the bid funds (#4230).
    v_price:=v_listing.buyout_price;
  ELSE
    RETURN json_build_object('success',false,'error',
      'Auction winning-bid settlement requires verified bidder escrow');
  END IF;
  IF v_price IS NULL OR v_price<=0 OR p_sale_price<>v_price THEN
    RETURN json_build_object('success',false,'error','Price does not match the listing');
  END IF;

  SELECT * INTO v_song FROM public.songs
  WHERE id=v_listing.song_id FOR UPDATE;
  IF NOT FOUND OR v_song.user_id IS DISTINCT FROM v_listing.seller_user_id
    OR coalesce(v_song.is_purchased,false)
    OR coalesce(v_song.archived,false) OR v_song.status<>'draft' THEN
    RETURN json_build_object('success',false,'error',
      'Seller no longer owns an eligible original song');
  END IF;
  IF v_song.band_id IS NOT NULL THEN
    RETURN json_build_object('success',false,'error','Band-owned songs cannot be sold privately');
  END IF;

  -- Never credit ALL of an account's characters. A listing's explicit
  -- character is preferred; a legacy listing can use song.profile_id, or
  -- unambiguously the seller's only profile. Ambiguity fails closed.
  v_seller_profile_id:=coalesce(v_listing.profile_id,v_song.profile_id);
  IF v_listing.profile_id IS NOT NULL AND v_song.profile_id IS NOT NULL
    AND v_listing.profile_id<>v_song.profile_id THEN
    RETURN json_build_object('success',false,'error','Seller character mismatch');
  END IF;
  IF v_seller_profile_id IS NULL THEN
    SELECT count(*),min(id) INTO v_count,v_seller_profile_id
    FROM public.profiles WHERE user_id=v_listing.seller_user_id
      AND deleted_at IS NULL;
    IF v_count<>1 THEN
      RETURN json_build_object('success',false,'error',
        'Seller character attribution required');
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=v_seller_profile_id AND user_id=v_listing.seller_user_id
      AND deleted_at IS NULL) THEN
    RETURN json_build_object('success',false,'error','Seller profile owner mismatch');
  END IF;

  v_buyer_profile_id:=public.current_active_player_profile_id();
  IF v_buyer_profile_id IS NULL THEN
    RETURN json_build_object('success',false,'error','Active buyer character required');
  END IF;

  -- Deterministic lock order: listing -> song -> buyer -> seller;
  -- other sales of the same profile serialize on these wallet rows.
  SELECT cash INTO v_buyer_cash FROM public.profiles
  WHERE id=v_buyer_profile_id AND user_id=v_actor
    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_buyer_cash<v_price THEN
    RETURN json_build_object('success',false,'error','Insufficient funds');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_seller_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','Seller no longer exists');
  END IF;

  v_fee:=round(v_price*0.10);
  v_payout:=v_price-v_fee;

  -- The prior cancellation-guard trigger forbids modifying a listing once
  -- a completed transaction exists. Move active -> sold BEFORE writing that
  -- transaction; both changes still roll back together on any failure.
  UPDATE public.marketplace_listings SET listing_status='sold',updated_at=now()
  WHERE id=v_listing.id AND listing_status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_LISTING_CHANGED'; END IF;

  -- Unique completed transaction claim and all economy writes commit
  -- together, or the entire SQL call rolls back on any error.
  INSERT INTO public.marketplace_transactions(
    listing_id,song_id,buyer_user_id,seller_user_id,
    sale_price,royalty_percentage,transaction_status,completed_at
  ) VALUES (
    v_listing.id,v_song.id,v_actor,v_listing.seller_user_id,
    v_price,v_listing.royalty_percentage,'completed',now()
  ) RETURNING id INTO v_tx;

  UPDATE public.profiles SET cash=cash-v_price
  WHERE id=v_buyer_profile_id AND user_id=v_actor AND cash>=v_price;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_FUNDS_CHANGED'; END IF;
  UPDATE public.profiles SET cash=cash+v_payout
  WHERE id=v_seller_profile_id AND user_id=v_listing.seller_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_SELLER_CHANGED'; END IF;

  UPDATE public.songs SET
    user_id=v_actor,profile_id=v_buyer_profile_id,band_id=NULL,
    ownership_type='purchased',is_purchased=true,
    purchased_from_user_id=v_listing.seller_user_id,purchased_at=now(),
    original_writer_id=coalesce(original_writer_id,v_listing.seller_user_id),
    market_listing_id=v_listing.id
  WHERE id=v_song.id AND user_id=v_listing.seller_user_id
    AND is_purchased=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKETPLACE_SONG_CHANGED'; END IF;

  UPDATE public.marketplace_bids SET bid_status='lost'
  WHERE listing_id=v_listing.id AND bidder_user_id<>v_actor;
  UPDATE public.marketplace_bids SET bid_status='won'
  WHERE listing_id=v_listing.id AND bidder_user_id=v_actor;

  RETURN json_build_object('success',true,'transaction_id',v_tx,
    'sale_price',v_price,'marketplace_fee',v_fee,
    'seller_payout',v_payout,'buyer_profile_id',v_buyer_profile_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.complete_song_sale(uuid,uuid,numeric)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_song_sale(uuid,uuid,numeric)
  TO authenticated,service_role;
