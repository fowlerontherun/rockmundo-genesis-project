-- Run with psql -X -v ON_ERROR_STOP=1 -f supabase/tests/song_marketplace_cancel_harness.sql
-- Safe for production-shaped databases: all synthetic rows are rolled back.
BEGIN;
DO $test$
DECLARE
  v_song uuid;
  v_seller uuid := '00000000-0000-4000-8000-000000000901';
  v_other uuid := '00000000-0000-4000-8000-000000000902';
  v_ok uuid;
  v_sold uuid;
  v_expired uuid;
  v_bid uuid;
  v_settled uuid;
  v_result jsonb;
  v_blocked boolean;
BEGIN
  SELECT id INTO v_song FROM public.songs LIMIT 1;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'Cancellation harness needs one existing song for the FK fixture';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_listings'
      AND policyname = 'Sellers can update their listings'
  ) THEN
    RAISE EXCEPTION 'Old unrestricted seller UPDATE policy remains enabled';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.cancel_song_marketplace_listing(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.cancel_song_marketplace_listing(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Cancellation RPC execute privileges are unsafe';
  END IF;

  INSERT INTO public.marketplace_listings (song_id, seller_user_id, asking_price, listing_type)
  VALUES (v_song, v_seller, 100, 'fixed_price') RETURNING id INTO v_ok;
  INSERT INTO public.marketplace_listings (song_id, seller_user_id, asking_price, listing_type)
  VALUES (v_song, v_seller, 100, 'fixed_price') RETURNING id INTO v_sold;
  INSERT INTO public.marketplace_listings (song_id, seller_user_id, asking_price, listing_type, expires_at)
  VALUES (v_song, v_seller, 100, 'auction', now() - interval '1 minute')
  RETURNING id INTO v_expired;
  INSERT INTO public.marketplace_listings (song_id, seller_user_id, asking_price, listing_type)
  VALUES (v_song, v_seller, 100, 'auction') RETURNING id INTO v_bid;
  INSERT INTO public.marketplace_listings (song_id, seller_user_id, asking_price, listing_type)
  VALUES (v_song, v_seller, 100, 'fixed_price') RETURNING id INTO v_settled;

  -- No JWT is never authorized, even when SQL is called with privileged credentials.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_result := public.cancel_song_marketplace_listing(v_ok);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Anonymous caller cancelled a listing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  v_result := public.cancel_song_marketplace_listing(v_ok);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Different seller cancelled a listing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  v_result := public.cancel_song_marketplace_listing(gen_random_uuid());
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Missing listing falsely reported success';
  END IF;
  v_result := public.cancel_song_marketplace_listing(v_ok);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true OR
     (SELECT listing_status FROM public.marketplace_listings WHERE id = v_ok) <> 'cancelled' THEN
    RAISE EXCEPTION 'Owner cannot cancel an active listing';
  END IF;
  v_result := public.cancel_song_marketplace_listing(v_ok);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Repeated cancellation falsely reported success';
  END IF;

  UPDATE public.marketplace_listings SET listing_status = 'sold' WHERE id = v_sold;
  v_result := public.cancel_song_marketplace_listing(v_sold);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Sold listing was cancelled';
  END IF;
  v_blocked := false;
  BEGIN
    UPDATE public.marketplace_listings
    SET listing_status = 'cancelled'
    WHERE id = v_sold;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked OR
     (SELECT listing_status FROM public.marketplace_listings WHERE id=v_sold) <> 'sold' THEN
    RAISE EXCEPTION 'Sold-to-cancelled guard failed';
  END IF;

  v_result := public.cancel_song_marketplace_listing(v_expired);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expired auction was cancelled';
  END IF;

  INSERT INTO public.marketplace_bids (listing_id, bidder_user_id, bid_amount, bid_status)
  VALUES (v_bid, v_other, 200, 'active');
  v_result := public.cancel_song_marketplace_listing(v_bid);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false
     OR (SELECT count(*) FROM public.marketplace_bids
         WHERE listing_id = v_bid AND bid_status='active') <> 1 THEN
    RAISE EXCEPTION 'Active bid was discarded';
  END IF;

  INSERT INTO public.marketplace_transactions
    (listing_id, song_id, buyer_user_id, seller_user_id,
     sale_price, royalty_percentage, transaction_status, completed_at)
  VALUES (v_settled, v_song, v_other, v_seller, 100, 0, 'completed', now());
  v_result := public.cancel_song_marketplace_listing(v_settled);
  IF (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Listing with settled transfer was cancelled';
  END IF;
  v_blocked := false;
  BEGIN
    UPDATE public.marketplace_listings
    SET description='tampered after settlement'
    WHERE id=v_settled;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Settlement record did not protect listing from mutation';
  END IF;
END;
$test$;
ROLLBACK;
SELECT 'song_marketplace_cancel_harness: PASSED (fixtures rolled back)' AS result;
