-- City mayors can invest the EXISTING city treasury in market size, quality,
-- and additional varieties. All existing market offers stay closed until
-- independently certified and activated. No player cash changes.
create table if not exists public.cooking_city_market_levels (
  city_id uuid primary key references public.cities(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 5),
  total_invested bigint not null default 0 check (total_invested >= 0),
  last_upgraded_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.cooking_city_market_investments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  city_id uuid not null references public.cities(id),
  mayor_id uuid not null references public.city_mayors(id),
  profile_id uuid not null references public.profiles(id),
  old_level integer not null check (old_level between 1 and 4),
  new_level integer not null check (new_level between 2 and 5),
  cost bigint not null check (cost > 0 and cost <= 1000000),
  invested_at timestamptz not null default now(),
  constraint market_investment_sequential_level check (new_level = old_level + 1)
);
create index if not exists cooking_city_market_investments_city
  on public.cooking_city_market_investments(city_id, invested_at desc);
alter table public.cooking_city_market_levels enable row level security;
alter table public.cooking_city_market_investments enable row level security;
do $$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_city_market_levels'
   and policyname='Browse cooking city market levels') then
   create policy "Browse cooking city market levels" on public.cooking_city_market_levels
     for select to authenticated using (true);
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_city_market_investments'
   and policyname='Browse cooking city market investments') then
   create policy "Browse cooking city market investments" on public.cooking_city_market_investments
     for select to authenticated using (true);
 end if;
end $$;
revoke all on public.cooking_city_market_levels,public.cooking_city_market_investments
  from anon,authenticated;
grant select on public.cooking_city_market_levels,public.cooking_city_market_investments
  to authenticated;

-- Preserve baseline catalog quality and stock to prevent repeated upgrades
-- compounding prices, quality or capacity beyond designed ceilings.
alter table public.cooking_city_market_offers
  add column if not exists baseline_max_stock integer,
  add column if not exists baseline_quality integer;
update public.cooking_city_market_offers
set baseline_max_stock = coalesce(baseline_max_stock,max_stock),
    baseline_quality = coalesce(baseline_quality,quality)
where baseline_max_stock is null or baseline_quality is null;
alter table public.cooking_city_market_offers
  alter column baseline_max_stock set default 100,
  alter column baseline_quality set default 65,
  alter column baseline_max_stock set not null,
  alter column baseline_quality set not null;
insert into public.cooking_city_market_levels(city_id)
select id from public.cities on conflict (city_id) do nothing;

-- Upgrade cost is a quoted server-side tier, never provided by a browser.
create or replace function public.upgrade_cooking_city_market(
  p_city_id uuid, p_profile_id uuid, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $upgrade$
declare
  v_actor uuid := auth.uid();
  v_market public.cooking_city_market_levels%rowtype;
  v_mayor public.city_mayors%rowtype;
  v_existing public.cooking_city_market_investments%rowtype;
  v_treasury public.city_treasury%rowtype;
  v_cost bigint;
  v_new_level integer;
  v_id uuid;
  v_extra integer;
  v_active boolean;
begin
  if v_actor is null or p_city_id is null or p_profile_id is null
    or p_request_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'COOKING_MARKET_MAYOR_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles p where
    p.id=p_profile_id and p.user_id=v_actor and p.is_active is true
    and p.deleted_at is null and p.died_at is null) then
    raise exception 'COOKING_MARKET_MAYOR_CHARACTER_REQUIRED' using errcode='42501';
  end if;
  -- Stable city lock serializes mayor upgrades, preventing two separate
  -- request IDs simultaneously charging for the same level.
  select * into v_market from public.cooking_city_market_levels
    where city_id=p_city_id for update;
  if not found then raise exception 'COOKING_MARKET_CITY_UNAVAILABLE'; end if;

  select * into v_existing from public.cooking_city_market_investments
    where request_id=p_request_id;
  if found then
    if v_existing.profile_id is distinct from p_profile_id
      or v_existing.city_id is distinct from p_city_id then
      raise exception 'COOKING_MARKET_UPGRADE_REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('status','already_completed','investmentId',v_existing.id,
      'newLevel',v_existing.new_level,'cost',v_existing.cost);
  end if;

  select * into v_mayor from public.city_mayors
    where city_id=p_city_id and profile_id=p_profile_id
      and is_current is true
      and term_start<=clock_timestamp()
      and (term_end is null or term_end>clock_timestamp())
    for share;
  if not found then
    raise exception 'COOKING_MARKET_CURRENT_MAYOR_REQUIRED' using errcode='42501';
  end if;

  -- Never charge a city treasury for an unreleased market.
  if not exists(select 1 from public.cooking_city_market_offers o
    where o.city_id=p_city_id and o.is_active is true) then
    raise exception 'COOKING_MARKET_NOT_OPEN';
  end if;
  if v_market.level>=5 then raise exception 'COOKING_MARKET_MAX_LEVEL'; end if;
  if v_market.last_upgraded_at is not null
    and v_market.last_upgraded_at+interval '7 days'>clock_timestamp() then
    raise exception 'COOKING_MARKET_UPGRADE_COOLDOWN';
  end if;

  v_cost := 20000 * (2::bigint ^ (v_market.level-1));
  v_new_level := v_market.level+1;
  select * into v_treasury from public.city_treasury
    where city_id=p_city_id for update;
  if not found or v_treasury.balance-coalesce(v_treasury.pending_commitments,0)<v_cost then
    raise exception 'COOKING_MARKET_INSUFFICIENT_TREASURY';
  end if;

  update public.city_treasury
     set balance=balance-v_cost,
         total_spent=total_spent+v_cost,updated_at=clock_timestamp()
   where id=v_treasury.id and balance-pending_commitments>=v_cost;
  if not found then raise exception 'COOKING_MARKET_INSUFFICIENT_TREASURY'; end if;
  update public.cooking_city_market_levels
     set level=v_new_level,total_invested=total_invested+v_cost,
         last_upgraded_at=clock_timestamp(),updated_at=clock_timestamp()
   where city_id=p_city_id;

  update public.cooking_city_market_offers
     set max_stock=least(100000, baseline_max_stock + (v_new_level-1)*25),
         stock=least(100000, stock+25),
         quality=least(100,baseline_quality+(v_new_level-1)*3),
         updated_at=clock_timestamp()
   where city_id=p_city_id;

  -- Two additional imported varieties per level; only open them immediately
  -- when this city has actually released its ingredient market.
  select exists(select 1 from public.cooking_city_market_offers
    where city_id=p_city_id and is_active is true) into v_active;
  insert into public.cooking_city_market_offers
    (city_id,ingredient_slug,unit_price,quality,stock,max_stock,
     local_speciality,is_active,baseline_quality,baseline_max_stock)
  select p_city_id,i.slug,
    greatest(1,ceil(i.base_price*1.25)::bigint),
    least(100,65+(v_new_level-1)*3),
    50+25*(v_new_level-1),50+25*(v_new_level-1),
    false,v_active,65,50
  from public.cooking_market_ingredients i
  where not exists(select 1 from public.cooking_city_market_offers offer
    where offer.city_id=p_city_id and offer.ingredient_slug=i.slug)
  order by md5(p_city_id::text||i.slug)
  limit 2
  on conflict(city_id,ingredient_slug) do nothing;
  get diagnostics v_extra = row_count;

  insert into public.cooking_city_market_investments
    (request_id,city_id,mayor_id,profile_id,old_level,new_level,cost)
  values(p_request_id,p_city_id,v_mayor.id,p_profile_id,
    v_market.level,v_new_level,v_cost)
  returning id into v_id;

  insert into public.city_treasury_ledger(city_id,amount,type,description,reference_id)
  values (p_city_id,(-v_cost)::integer,'cooking_market_upgrade',
    format('Cooking market upgrade %s to %s',v_market.level,v_new_level),v_id);
  insert into public.mayor_actions_log
    (city_id,mayor_id,action_type,amount,target_id,notes,metadata)
  values (p_city_id,v_mayor.id,'cooking_market_upgraded',v_cost,v_id,
    'Mayor invested in cooking market variety, freshness and stock capacity',
    pg_catalog.jsonb_build_object('old_level',v_market.level,
      'new_level',v_new_level,'new_varieties',v_extra,'cost',v_cost));

  return jsonb_build_object('status','completed','investmentId',v_id,
    'oldLevel',v_market.level,'newLevel',v_new_level,
    'cost',v_cost,'newVarieties',v_extra);
end
$upgrade$;
revoke all on function public.upgrade_cooking_city_market(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.upgrade_cooking_city_market(uuid,uuid,uuid)
  to authenticated;
