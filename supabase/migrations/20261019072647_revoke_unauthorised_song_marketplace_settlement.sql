-- P0 issue #4229: immediate containment deployed in production
-- (migration receipt 20261019072647). Existing listings and balances unchanged.
revoke all on function public.complete_song_sale(uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.place_song_bid(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.complete_song_sale(uuid,uuid,numeric) to service_role;
grant execute on function public.place_song_bid(uuid,uuid,numeric) to service_role;
revoke insert on public.marketplace_transactions from public,anon,authenticated;
revoke insert on public.marketplace_bids from public,anon,authenticated;
