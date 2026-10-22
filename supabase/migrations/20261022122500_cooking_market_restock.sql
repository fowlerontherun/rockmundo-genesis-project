-- Incremental stock recovery after launch. Never activates or creates offers,
-- mints player inventory, debits a wallet or changes quality/prices.
create or replace function public.restock_cooking_city_markets(
  p_max_rows integer default 5000
) returns integer
language plpgsql security invoker set search_path=''
as $restock$
declare v_count integer;
begin
 if p_max_rows is null or p_max_rows < 1 or p_max_rows > 10000 then
   raise exception 'COOKING_MARKET_RESTOCK_INVALID_LIMIT';
 end if;
 with candidates as (
  select o.id from public.cooking_city_market_offers o
  where o.is_active is true and o.stock < o.max_stock
  order by o.updated_at,o.id
  for update skip locked
  limit p_max_rows
 )
 update public.cooking_city_market_offers o
 set stock=least(o.max_stock,
   o.stock+greatest(5,ceil(o.max_stock*0.25)::integer)),
   updated_at=clock_timestamp()
 from candidates c where o.id=c.id;
 get diagnostics v_count=row_count;
 return v_count;
end;
$restock$;
revoke all on function public.restock_cooking_city_markets(integer)
 from public,anon,authenticated;
grant execute on function public.restock_cooking_city_markets(integer)
 to service_role;

-- Daily server scheduler at 04:15 UTC. The function is a no-op while all
-- cooking offers remain closed; each run is a capped, auditable batch.
do $cron$
begin
 if not exists(select 1 from cron.job
   where jobname='rockmundo_cooking_market_daily_restock') then
   perform cron.schedule('rockmundo_cooking_market_daily_restock',
     '15 4 * * *','select public.restock_cooking_city_markets(5000);');
 end if;
end
$cron$;
