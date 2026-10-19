-- P0 #4229 compatibility with independent guarded-legacy implementation.
-- Until #4230 reserves funds, only authenticated buy-now and auction buyout
-- are safe. Seller acceptance of winning bids is deliberately suspended.
CREATE OR REPLACE FUNCTION public.settle_song_marketplace_sale_atomic(p_listing_id uuid, p_actor_profile_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account uuid:=auth.uid();
  v_actor public.profiles%rowtype;
  v_listing public.marketplace_listings%rowtype;
  v_song public.songs%rowtype;
  v_bid public.marketplace_bids%rowtype;
  v_buyer_profile_id uuid;
  v_buyer_account_id uuid;
  v_seller_profile_id uuid;
  v_price integer;
  v_fee integer;
  v_payout integer;
  v_transaction_id uuid;
  v_balance bigint;
begin
  if v_account is null or p_listing_id is null or p_actor_profile_id is null
     or p_action not in ('buy','accept_bid') or p_action is null
  then raise exception 'song_sale_auth_required' using errcode='42501'; end if;
  -- #4230: bidder cash is not yet reserved/escrowed. Do not let a seller
  -- force a debit through accepting an unescrowed winning bid.
  if p_action='accept_bid' then
    raise exception 'song_sale_bid_escrow_required' using errcode='42501';
  end if;

  -- Serialise all contenders to the same listing before checking winner,
  -- song ownership, transaction existence, and transferring any funds.
  select * into v_listing from public.marketplace_listings
   where id=p_listing_id for update;
  if not found or v_listing.listing_status<>'active' then
    raise exception 'song_sale_listing_unavailable'; end if;
  if exists (select 1 from public.marketplace_transactions
             where listing_id=p_listing_id and transaction_status='completed') then
    raise exception 'song_sale_already_settled'; end if;

  select * into v_actor from public.profiles
   where id=p_actor_profile_id and user_id=v_account
     and is_active is true and died_at is null and deleted_at is null
   for update;
  if not found then raise exception 'song_sale_actor_not_owned' using errcode='42501'; end if;

  select * into v_song from public.songs where id=v_listing.song_id for update;
  if not found or v_song.user_id<>v_listing.seller_user_id
     or v_song.is_purchased is true
     or coalesce(v_song.archived,false)
     or v_song.band_id is not null
     or v_song.status<>'draft'
  then raise exception 'song_sale_seller_does_not_own_draft'; end if;
  -- Private songwriter listings cannot sell a band's repertoire.
  -- Match any explicit selling character to the song's recorded owner.
  if v_listing.profile_id is not null and v_song.profile_id is not null
     and v_listing.profile_id<>v_song.profile_id then
    raise exception 'song_sale_seller_profile_mismatch'; end if;
  if v_listing.profile_id is not null and not exists(
     select 1 from public.profiles
     where id=v_listing.profile_id and user_id=v_listing.seller_user_id
  ) then raise exception 'song_sale_listing_profile_not_owned'; end if;
  if v_listing.expires_at is not null and v_listing.expires_at<=now()
     and p_action='buy' then
    raise exception 'song_sale_listing_expired'; end if;

  if p_action='buy' then
    if v_account=v_listing.seller_user_id then
      raise exception 'song_sale_self_purchase'; end if;
    if v_listing.listing_type='fixed_price' then
      v_price:=v_listing.asking_price;
    elsif v_listing.listing_type='auction' then
      v_price:=v_listing.buyout_price;
    else raise exception 'song_sale_invalid_listing_type'; end if;
    v_buyer_profile_id:=p_actor_profile_id;
    v_buyer_account_id:=v_account;
  else
    if v_account<>v_listing.seller_user_id
       or v_listing.listing_type<>'auction' then
      raise exception 'song_sale_only_seller_accepts_bid' using errcode='42501';
    end if;
    select * into v_bid from public.marketplace_bids
     where listing_id=p_listing_id and bid_status='active'
       and bidder_user_id=v_listing.current_bidder_user_id
       and bid_amount=v_listing.current_bid
     for update;
    if not found or v_bid.bidder_profile_id is null then
      raise exception 'song_sale_missing_authorized_bid'; end if;
    v_price:=v_bid.bid_amount;
    v_buyer_profile_id:=v_bid.bidder_profile_id;
    v_buyer_account_id:=v_bid.bidder_user_id;
  end if;

  if v_price is null or v_price<=0 then
    raise exception 'song_sale_invalid_canonical_price'; end if;
  if v_buyer_account_id=v_listing.seller_user_id then
    raise exception 'song_sale_self_purchase'; end if;

  -- The seller receives payment on precisely one active character, selected
  -- deterministically, preferring the original listing's owner character.
  select id into v_seller_profile_id from public.profiles
   where user_id=v_listing.seller_user_id and is_active is true
     and died_at is null and deleted_at is null
   order by case when id=coalesce(v_listing.profile_id,v_song.profile_id)
            then 0 else 1 end, updated_at desc nulls last, id limit 1;
  if v_seller_profile_id is null then raise exception 'song_sale_seller_profile_missing'; end if;

  -- Lock and check the recorded buyer character. No account-wide UPDATE!
  select cash into v_balance from public.profiles
   where id=v_buyer_profile_id and user_id=v_buyer_account_id
     and is_active is true and died_at is null and deleted_at is null
   for update;
  if not found then
    raise exception 'song_sale_buyer_profile_unavailable'; end if;
  if v_balance < v_price then
    raise exception 'song_sale_insufficient_cash'; end if;

  v_fee:=round(v_price*0.10)::integer;
  v_payout:=v_price-v_fee;

  update public.profiles set cash=cash-v_price
   where id=v_buyer_profile_id and cash>=v_price;
  if not found then raise exception 'song_sale_insufficient_cash'; end if;
  update public.profiles set cash=cash+v_payout
   where id=v_seller_profile_id;
  if not found then raise exception 'song_sale_seller_profile_missing'; end if;

  update public.songs set user_id=v_buyer_account_id,profile_id=v_buyer_profile_id,
    band_id=null,ownership_type='purchased',is_purchased=true,
    purchased_from_user_id=v_listing.seller_user_id,purchased_at=now(),
    original_writer_id=coalesce(original_writer_id,v_listing.seller_user_id),
    market_listing_id=p_listing_id
   where id=v_song.id;
  update public.marketplace_listings set listing_status='sold',updated_at=now()
   where id=p_listing_id;

  insert into public.marketplace_transactions
    (listing_id,song_id,buyer_user_id,seller_user_id,sale_price,
     royalty_percentage,transaction_status,completed_at)
  values (p_listing_id,v_song.id,v_buyer_account_id,v_listing.seller_user_id,
          v_price,v_listing.royalty_percentage,'completed',now())
  returning id into v_transaction_id;

  update public.marketplace_bids set
    bid_status=case when p_action='accept_bid' and id=v_bid.id
                    then 'won' else 'lost' end
   where listing_id=p_listing_id and bid_status in ('active','outbid');

  return jsonb_build_object('success',true,'transaction_id',v_transaction_id,
    'sale_price',v_price,'marketplace_fee',v_fee,'seller_payout',v_payout);
end
$function$
;
revoke all on function public.settle_song_marketplace_sale_atomic(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.settle_song_marketplace_sale_atomic(uuid,uuid,text) to authenticated,service_role;
