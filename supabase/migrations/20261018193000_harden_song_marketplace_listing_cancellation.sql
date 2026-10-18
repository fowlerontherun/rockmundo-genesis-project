-- #4238: a seller must not rewrite a completed marketplace sale as a cancellation.
-- Sale/bid/cancel operations all lock the same listing row, so concurrent actions serialize.
-- Keep the historical sale RPC unchanged; it already locks marketplace_listings FOR UPDATE.

DROP POLICY IF EXISTS "Sellers can update their listings"
  ON public.marketplace_listings;

CREATE OR REPLACE FUNCTION public.guard_song_marketplace_listing_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $guard$
BEGIN
  -- Completed sales and terminal listings are immutable, including their song/seller links.
  IF OLD.listing_status IN ('sold', 'cancelled', 'expired')
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A terminal marketplace listing cannot be modified'
      USING ERRCODE = '23514';
  END IF;

  IF NEW IS DISTINCT FROM OLD AND EXISTS (
    SELECT 1 FROM public.marketplace_transactions AS t
    WHERE t.listing_id = OLD.id AND t.transaction_status = 'completed'
  ) THEN
    RAISE EXCEPTION 'A settled marketplace listing cannot be modified'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.listing_status IS DISTINCT FROM OLD.listing_status THEN
    IF OLD.listing_status <> 'active'
       OR NEW.listing_status NOT IN ('sold', 'cancelled', 'expired') THEN
      RAISE EXCEPTION 'Invalid marketplace listing status transition'
        USING ERRCODE = '23514';
    END IF;

    -- Only trusted database-owned settlement/cancellation functions may change state.
    -- Admin browsers also use role authenticated and must not bypass this rule.
    IF CURRENT_USER NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'Marketplace listing status requires a server-authoritative action'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS guard_song_marketplace_listing_state
  ON public.marketplace_listings;
CREATE TRIGGER guard_song_marketplace_listing_state
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION public.guard_song_marketplace_listing_state();

REVOKE ALL ON FUNCTION public.guard_song_marketplace_listing_state() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_completed_listing
  ON public.marketplace_transactions (listing_id)
  WHERE transaction_status = 'completed';

CREATE OR REPLACE FUNCTION public.cancel_song_marketplace_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cancel$
DECLARE
  v_listing public.marketplace_listings%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_listing
  FROM public.marketplace_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  -- Do not leak another seller's listing details.
  IF NOT FOUND OR v_listing.seller_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found or not owned by you');
  END IF;

  IF v_listing.listing_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is no longer active');
  END IF;

  IF v_listing.expires_at IS NOT NULL AND v_listing.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing has expired');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.marketplace_transactions AS t
    WHERE t.listing_id = p_listing_id AND t.transaction_status = 'completed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing already has a completed sale');
  END IF;

  -- Bids are not escrowed by the current bidding RPC. Refuse cancellation
  -- while there is an active bidder rather than silently discarding an offer.
  IF v_listing.current_bid IS NOT NULL
     OR v_listing.current_bidder_user_id IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM public.marketplace_bids AS b
       WHERE b.listing_id = p_listing_id AND b.bid_status = 'active'
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing has a bid and cannot be cancelled');
  END IF;

  UPDATE public.marketplace_listings
  SET listing_status = 'cancelled', updated_at = now()
  WHERE id = p_listing_id AND listing_status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing changed before cancellation');
  END IF;

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id);
END;
$cancel$;

REVOKE ALL ON FUNCTION public.cancel_song_marketplace_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_song_marketplace_listing(uuid) TO authenticated;
