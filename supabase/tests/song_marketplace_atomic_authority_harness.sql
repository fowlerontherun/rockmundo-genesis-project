-- Issue #4229 live rollback-only certification. Fixtures are synthetic,
-- account references are read locally; no real account identifiers are output.
-- No production cash, song, bid or transaction modifications survive ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='20s';
DO $test$
declare
 seller_uid uuid;
 buyer_uid uuid;
 seller_profile uuid:=gen_random_uuid();
 buyer_profile uuid:=gen_random_uuid();
 other_buyer_profile uuid:=gen_random_uuid();
 song_one uuid:=gen_random_uuid();
 song_two uuid:=gen_random_uuid();
 listing_one uuid:=gen_random_uuid();
 listing_two uuid:=gen_random_uuid();
 result jsonb;
 v_id uuid;
begin
 select user_id into seller_uid from public.profiles where deleted_at is null limit 1;
 select user_id into buyer_uid from public.profiles
  where deleted_at is null and user_id is distinct from seller_uid limit 1;
 if seller_uid is null or buyer_uid is null then
   raise exception 'marketplace_fixture_requires_two_accounts'; end if;
 -- The game enforces only one active character per account. Deactivate
 -- the existing selected accounts only inside this rollback-only transaction;
 -- the subsequent test fixtures become their sole active characters.
 update public.profiles set is_active=false
   where user_id in (seller_uid,buyer_uid) and is_active is true;
 insert into public.profiles(id,user_id,username,cash,is_active)
 values (seller_profile,seller_uid,'test4229s'||left(replace(seller_profile::text,'-',''),20),100,true),
        (buyer_profile,buyer_uid,'test4229b'||left(replace(buyer_profile::text,'-',''),20),1000,true),
        (other_buyer_profile,buyer_uid,'test4229x'||left(replace(other_buyer_profile::text,'-',''),20),555,false);
 insert into public.songs (id,user_id,profile_id,title,genre,status)
 values (song_one,seller_uid,seller_profile,'Test 4229 fixed','Rock','draft'),
        (song_two,seller_uid,seller_profile,'Test 4229 auction','Rock','draft');
 insert into public.marketplace_listings
   (id,song_id,seller_user_id,profile_id,listing_type,asking_price,expires_at,listing_status)
 values
   (listing_one,song_one,seller_uid,seller_profile,'fixed_price',200,now()+interval '1 day','active'),
   (listing_two,song_two,seller_uid,seller_profile,'auction',100,now()+interval '1 day','active');

 perform set_config('request.jwt.claim.sub',seller_uid::text,true);
 begin
   perform public.settle_song_marketplace_sale_atomic(listing_one,seller_profile,'buy');
   raise exception 'own_listing_was_purchased';
 exception when others then
   if sqlerrm<>'song_sale_self_purchase' then raise; end if;
 end;

 perform set_config('request.jwt.claim.sub',buyer_uid::text,true);
 begin
   perform public.settle_song_marketplace_sale_atomic(listing_one,seller_profile,'buy');
   raise exception 'borrowed_other_profile';
 exception when others then
   if sqlerrm<>'song_sale_actor_not_owned' then raise; end if;
 end;
 begin
   perform public.settle_song_marketplace_sale_atomic(listing_two,buyer_profile,'accept_bid');
   raise exception 'non_seller_accepted_bid';
 exception when others then
   if sqlerrm<>'song_sale_only_seller_accepts_bid' then raise; end if;
 end;

 -- Another October migration independently hardened the legacy sale RPC
 -- and may leave authenticated EXECUTE enabled. When enabled, its legacy
 -- caller ID and price must nevertheless be checked against this JWT and
 -- the locked canonical listing price.
 if has_function_privilege('authenticated',
   'public.complete_song_sale(uuid,uuid,numeric)','execute') then
   result:=public.complete_song_sale(listing_one,seller_uid,200)::jsonb;
   if result->>'success'<>'false' then
     raise exception 'legacy_sale_accepted_spoofed_buyer'; end if;
   result:=public.complete_song_sale(listing_one,buyer_uid,1)::jsonb;
   if result->>'success'<>'false' then
     raise exception 'legacy_sale_accepted_tampered_price'; end if;
 end if;

 result:=public.settle_song_marketplace_sale_atomic(listing_one,buyer_profile,'buy');
 if result->>'success'<>'true' or (result->>'sale_price')::int<>200
   or (select cash from public.profiles where id=buyer_profile)<>800
   or (select cash from public.profiles where id=other_buyer_profile)<>555
   or (select cash from public.profiles where id=seller_profile)<>280
   or (select profile_id from public.songs where id=song_one)<>buyer_profile
   or (select user_id from public.songs where id=song_one)<>buyer_uid
   or (select count(*) from public.marketplace_transactions where listing_id=listing_one)<>1
 then raise exception 'fixed_price_settlement_incorrect'; end if;
 begin
   perform public.settle_song_marketplace_sale_atomic(listing_one,buyer_profile,'buy');
   raise exception 'fixed_price_settled_twice';
 exception when others then
   if sqlerrm<>'song_sale_listing_unavailable' then raise; end if;
 end;

 -- Draft-only eligibility cannot be bypassed via a valid listing.
 update public.songs set archived=true where id=song_two;
 perform set_config('request.jwt.claim.sub',buyer_uid::text,true);
 begin
   perform public.place_song_bid_authorized(listing_two,buyer_profile,120);
   raise exception 'archived_song_bid_accepted';
 exception when others then
   if sqlerrm<>'song_bid_owner_mismatch' then raise; end if;
 end;
 update public.songs set archived=false where id=song_two;
 -- A listed band song must not be bought as one songwriter's property.
 update public.songs set band_id=(select id from public.bands limit 1) where id=song_two;
 if (select band_id from public.songs where id=song_two) is not null then
   begin
     perform public.place_song_bid_authorized(listing_two,buyer_profile,120);
     raise exception 'band_owned_song_bid_accepted';
   exception when others then
     if sqlerrm<>'song_bid_owner_mismatch' then raise; end if;
   end;
 end if;
 update public.songs set band_id=null where id=song_two;

 -- An auction cannot be accepted before a real authorised bid exists.
 perform set_config('request.jwt.claim.sub',seller_uid::text,true);
 begin
   perform public.settle_song_marketplace_sale_atomic(listing_two,seller_profile,'accept_bid');
   raise exception 'auction_accepted_without_bid';
 exception when others then
   if sqlerrm<>'song_sale_missing_authorized_bid' then raise; end if;
 end;

 perform set_config('request.jwt.claim.sub',buyer_uid::text,true);
 begin
   perform public.place_song_bid_authorized(listing_two,seller_profile,120);
   raise exception 'bid_profile_impersonation';
 exception when others then
   if sqlerrm<>'song_bid_profile_not_owned' then raise; end if;
 end;
 begin
   perform public.place_song_bid_authorized(listing_two,buyer_profile,1);
   raise exception 'underpriced_bid_accepted';
 exception when others then
   if sqlerrm<>'song_bid_below_minimum' then raise; end if;
 end;
 result:=public.place_song_bid_authorized(listing_two,buyer_profile,120);
 if result->>'success'<>'true' then raise exception 'valid_bid_failed'; end if;
 perform set_config('request.jwt.claim.sub',seller_uid::text,true);
 result:=public.settle_song_marketplace_sale_atomic(listing_two,seller_profile,'accept_bid');
 if result->>'success'<>'true' or (result->>'sale_price')::integer<>120
   or (select cash from public.profiles where id=buyer_profile)<>680
   or (select cash from public.profiles where id=other_buyer_profile)<>555
   or (select cash from public.profiles where id=seller_profile)<>388
   or (select count(*) from public.marketplace_transactions where listing_id=listing_two)<>1
   or (select count(*) from public.marketplace_bids where listing_id=listing_two and bid_status='won')<>1
 then raise exception 'accepted_bid_settlement_incorrect'; end if;

 if has_function_privilege('anon','public.complete_song_sale(uuid,uuid,numeric)','execute')
    or has_function_privilege('authenticated','public.place_song_bid(uuid,uuid,numeric)','execute')
    or has_table_privilege('authenticated','public.marketplace_bids','insert')
    or has_table_privilege('authenticated','public.marketplace_transactions','insert')
 then raise exception 'marketplace_old_authority_still_exposed'; end if;
end
$test$;
ROLLBACK;
SELECT 'song_marketplace_atomic_authority_harness_passed' AS result;
