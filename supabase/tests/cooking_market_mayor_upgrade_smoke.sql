-- Rollback-only mayor / treasury / restock integration smoke test.
-- Runs as a database administrator with seeded real profile & city rows.
-- The fixture simulates mayor authority, an open market and city budget ONLY
-- inside a subtransaction; the deliberate test exception removes all changes.
do $verify$
declare
  p public.profiles%rowtype;
  c uuid;
  mayor_id uuid;
  request_id uuid := gen_random_uuid();
  second_id uuid := gen_random_uuid();
  offer_id uuid;
  original_offers integer;
  current_offers integer;
  initial_stock integer;
  increased_stock integer;
  old_treasury bigint;
  result jsonb;
  replayed jsonb;
  restocked integer;
  generated jsonb;
begin
  select * into p from public.profiles
  where is_active is true and died_at is null and deleted_at is null limit 1;
  select city.id into c from public.cities city
  where not exists(select 1 from public.city_mayors mayor
    where mayor.city_id=city.id and mayor.is_current is true)
    and exists(select 1 from public.cooking_city_market_offers o
      where o.city_id=city.id)
  limit 1;
  if p.id is null or c is null then
    raise notice 'SKIPPED: no available character/city fixture';
    return;
  end if;
  begin
    perform set_config('request.jwt.claim.sub',p.user_id::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    if auth.uid() is distinct from p.user_id then
      raise exception 'Cannot emulate authenticated caller in test';
    end if;
    update public.cooking_city_market_offers
      set is_active=true where id=(
        select id from public.cooking_city_market_offers
        where city_id=c order by id limit 1
      ) returning id into offer_id;
    select count(*) into original_offers
      from public.cooking_city_market_offers where city_id=c;
    insert into public.city_mayors(city_id,profile_id,is_current,term_start)
      values(c,p.id,true,clock_timestamp()-interval '1 day')
      returning id into mayor_id;
    insert into public.city_treasury(city_id,balance,pending_commitments)
      values(c,1000000,0) on conflict(city_id) do update
      set balance=1000000,pending_commitments=0;
    select balance into old_treasury from public.city_treasury where city_id=c;

    result := public.upgrade_cooking_city_market(c,p.id,request_id);
    if result->>'status'<>'completed' or (result->>'newLevel')::integer<>2
      or (result->>'cost')::bigint<>20000 then
      raise exception 'Market upgrade returned incorrect result: %',result;
    end if;
    replayed := public.upgrade_cooking_city_market(c,p.id,request_id);
    if replayed->>'status'<>'already_completed' then
      raise exception 'Duplicate mayor investment was charged again';
    end if;
    if (select balance from public.city_treasury where city_id=c)<>old_treasury-20000
      then raise exception 'City treasury was charged incorrectly'; end if;
    if (select level from public.cooking_city_market_levels where city_id=c)<>2
      then raise exception 'Market did not increase to level 2'; end if;
    select count(*) into current_offers
      from public.cooking_city_market_offers where city_id=c;
    if current_offers<>original_offers+2 then
      raise exception 'Mayor upgrade did not add 2 new varieties'; end if;
    if (select count(*) from public.cooking_city_market_investments where request_id=request_id)<>1
      then raise exception 'Investment ledger missing'; end if;
    if (select count(*) from public.city_treasury_ledger
      where reference_id=(result->>'investmentId')::uuid
       and type='cooking_market_upgrade')<>1
      then raise exception 'City treasury ledger missing'; end if;
    begin
      perform public.upgrade_cooking_city_market(c,p.id,second_id);
      raise exception 'Cooldown allowed a second paid upgrade';
    exception when others then
      if sqlerrm<>'COOKING_MARKET_UPGRADE_COOLDOWN' then raise; end if;
    end;
    select stock into initial_stock from public.cooking_city_market_offers
      where id=offer_id;
    update public.cooking_city_market_offers
      set stock=greatest(0,stock-25) where id=offer_id;
    select stock into initial_stock from public.cooking_city_market_offers where id=offer_id;
    restocked := public.restock_cooking_city_markets(100);
    select stock into increased_stock from public.cooking_city_market_offers
      where id=offer_id;
    if restocked<1 or increased_stock<=initial_stock then
      raise exception 'Restock did not replenish an open market';
    end if;
    if exists(select 1 from public.cooking_city_market_offers where stock>max_stock)
      then raise exception 'Restock exceeded market capacity'; end if;

    raise exception using errcode='PZ001',message='ROLLBACK_MARKET_FIXTURE';
  exception when sqlstate 'PZ001' then
    raise notice 'PASS: mayor authority, treasury, idempotency, cooldown, new varieties and restock; rolled back';
  end;
end $verify$;
