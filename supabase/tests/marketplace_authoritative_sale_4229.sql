-- P0 #4229: rollback-only production DB test. Fixtures create two songs
-- and two listings; no real song, wallet or marketplace data persists.
BEGIN;

CREATE TEMP TABLE sale_test_people ON COMMIT DROP AS
WITH buyer AS (
 SELECT p.id AS buyer_profile,p.user_id AS buyer_user
 FROM public.profiles p
 WHERE p.cash>=1000 AND p.is_active AND p.died_at IS NULL AND p.deleted_at IS NULL
   AND (SELECT count(*) FROM public.profiles q WHERE q.user_id=p.user_id
        AND q.deleted_at IS NULL)>=2
   AND p.id=(SELECT q.id FROM public.profiles q WHERE q.user_id=p.user_id
     AND coalesce(q.is_active,false) AND q.died_at IS NULL
     ORDER BY q.updated_at DESC NULLS LAST,q.created_at DESC NULLS LAST,q.id LIMIT 1)
 LIMIT 1
), seller AS (
 SELECT p.id AS seller_profile,p.user_id AS seller_user
 FROM public.profiles p CROSS JOIN buyer b
 WHERE p.user_id<>b.buyer_user AND p.deleted_at IS NULL
 ORDER BY p.id LIMIT 1
)
SELECT b.*,s.* FROM buyer b CROSS JOIN seller s;

CREATE TEMP TABLE sale_test_wallet_before ON COMMIT DROP AS
SELECT p.id,p.user_id,p.cash
FROM public.profiles p
WHERE p.user_id IN (
 SELECT buyer_user FROM sale_test_people UNION SELECT seller_user FROM sale_test_people
);

CREATE TEMP TABLE sale_test_songs ON COMMIT DROP AS
WITH song_fixed AS (
 INSERT INTO public.songs(user_id,profile_id,title,genre,status,band_id)
 SELECT seller_user,seller_profile,'Rollback sale fixture (fixed)','Rock','draft',NULL
 FROM sale_test_people
 RETURNING id
), song_auction AS (
 INSERT INTO public.songs(user_id,profile_id,title,genre,status,band_id)
 SELECT seller_user,seller_profile,'Rollback sale fixture (auction)','Rock','draft',NULL
 FROM sale_test_people
 RETURNING id
)
SELECT song_fixed.id AS fixed_song,song_auction.id AS auction_song
FROM song_fixed CROSS JOIN song_auction;

CREATE TEMP TABLE sale_test_listings ON COMMIT DROP AS
WITH fixed AS (
 INSERT INTO public.marketplace_listings(song_id,seller_user_id,profile_id,listing_type,
   asking_price,listing_status,expires_at)
 SELECT s.fixed_song,p.seller_user,p.seller_profile,'fixed_price',300,'active',
   now()+interval '2 days' FROM sale_test_songs s CROSS JOIN sale_test_people p
 RETURNING id
), auction AS (
 INSERT INTO public.marketplace_listings(song_id,seller_user_id,profile_id,listing_type,
   asking_price,minimum_bid,current_bid,buyout_price,listing_status,expires_at,
   current_bidder_user_id)
 SELECT s.auction_song,p.seller_user,p.seller_profile,'auction',200,200,400,600,'active',
   now()+interval '2 days',p.buyer_user FROM sale_test_songs s CROSS JOIN sale_test_people p
 RETURNING id
)
SELECT fixed.id AS fixed_id,auction.id AS auction_id FROM fixed CROSS JOIN auction;

SELECT set_config('request.jwt.claim.sub',(SELECT buyer_user::text FROM sale_test_people),true);

CREATE TEMP TABLE sale_test_bad_inputs ON COMMIT DROP AS
SELECT
 (public.complete_song_sale(
   (SELECT fixed_id FROM sale_test_listings),
   (SELECT seller_user FROM sale_test_people),300)::jsonb->>'success')='false'
 AS forged_buyer_rejected,
 (public.complete_song_sale(
   (SELECT fixed_id FROM sale_test_listings),
   (SELECT buyer_user FROM sale_test_people),1)::jsonb->>'success')='false'
 AS underprice_rejected,
 (public.complete_song_sale(
   (SELECT fixed_id FROM sale_test_listings),
   (SELECT buyer_user FROM sale_test_people),-100)::jsonb->>'success')='false'
 AS negative_rejected,
 (public.complete_song_sale(
   (SELECT auction_id FROM sale_test_listings),
   (SELECT buyer_user FROM sale_test_people),400)::jsonb->>'success')='false'
 AS unescrowed_bid_cannot_settle;

CREATE TEMP TABLE sale_test_fixed ON COMMIT DROP AS
SELECT public.complete_song_sale(
 (SELECT fixed_id FROM sale_test_listings),
 (SELECT buyer_user FROM sale_test_people),300)::jsonb AS result;

CREATE TEMP TABLE sale_test_repeat ON COMMIT DROP AS
SELECT public.complete_song_sale(
 (SELECT fixed_id FROM sale_test_listings),
 (SELECT buyer_user FROM sale_test_people),300)::jsonb AS result;

CREATE TEMP TABLE sale_test_buyout ON COMMIT DROP AS
SELECT public.complete_song_sale(
 (SELECT auction_id FROM sale_test_listings),
 (SELECT buyer_user FROM sale_test_people),600)::jsonb AS result;

SELECT
 (SELECT count(*)=1 FROM sale_test_people) AS fixture_accounts_found,
 (SELECT forged_buyer_rejected FROM sale_test_bad_inputs) AS forged_buyer_rejected,
 (SELECT underprice_rejected FROM sale_test_bad_inputs) AS price_tamper_rejected,
 (SELECT negative_rejected FROM sale_test_bad_inputs) AS negative_price_rejected,
 (SELECT unescrowed_bid_cannot_settle FROM sale_test_bad_inputs) AS auction_bid_not_settled,
 (SELECT result->>'success'='true' FROM sale_test_fixed) AS fixed_sale_succeeded,
 (SELECT result->>'success'='false' FROM sale_test_repeat) AS repeat_rejected,
 (SELECT result->>'success'='true' FROM sale_test_buyout) AS auction_buyout_succeeded,
 (SELECT count(*)=2 FROM public.marketplace_transactions t
    WHERE t.listing_id IN (SELECT fixed_id FROM sale_test_listings
       UNION SELECT auction_id FROM sale_test_listings)) AS two_unique_transactions,
 (SELECT count(*)=2 FROM public.marketplace_listings l
    WHERE l.id IN (SELECT fixed_id FROM sale_test_listings
       UNION SELECT auction_id FROM sale_test_listings)
     AND l.listing_status='sold') AS both_listings_finalized,
 (SELECT count(*)=2 FROM public.songs s
    WHERE s.id IN (SELECT fixed_song FROM sale_test_songs
       UNION SELECT auction_song FROM sale_test_songs)
    AND s.user_id=(SELECT buyer_user FROM sale_test_people)
    AND s.profile_id=(SELECT buyer_profile FROM sale_test_people)
    AND s.is_purchased) AS song_owner_is_selected_character,
 (SELECT b.cash=w.cash-900
   FROM public.profiles b JOIN sale_test_wallet_before w ON w.id=b.id
   WHERE b.id=(SELECT buyer_profile FROM sale_test_people)) AS buyer_debited_once,
 (SELECT b.cash=w.cash+810
   FROM public.profiles b JOIN sale_test_wallet_before w ON w.id=b.id
   WHERE b.id=(SELECT seller_profile FROM sale_test_people)) AS seller_credited_once,
 NOT EXISTS(SELECT 1 FROM public.profiles b JOIN sale_test_wallet_before w ON w.id=b.id
   WHERE b.id NOT IN ((SELECT buyer_profile FROM sale_test_people),
      (SELECT seller_profile FROM sale_test_people)) AND b.cash<>w.cash)
 AS all_other_account_characters_unchanged,
 NOT has_function_privilege('anon','public.complete_song_sale(uuid,uuid,numeric)','EXECUTE')
 AS anonymous_denied,
 has_function_privilege('authenticated','public.complete_song_sale(uuid,uuid,numeric)','EXECUTE')
 AS authenticated_allowed;

ROLLBACK;
