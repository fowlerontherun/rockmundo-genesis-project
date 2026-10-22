-- Regional ingredient-market foundation. All offers start CLOSED until the
-- purchase contract and player wallet journal have been verified end-to-end.
create table if not exists public.cooking_market_ingredients (
  slug text primary key check (length(slug) between 1 and 100),
  display_name text not null,
  category text not null check (category in ('produce','pantry','dairy','herbs','drink')),
  base_price bigint not null check (base_price between 1 and 10000),
  shelf_life_hours integer not null check (shelf_life_hours between 12 and 336),
  created_at timestamptz not null default now()
);

create table if not exists public.cooking_city_market_offers (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  ingredient_slug text not null references public.cooking_market_ingredients(slug),
  unit_price bigint not null check (unit_price between 1 and 100000),
  quality integer not null check (quality between 1 and 100),
  stock integer not null check (stock between 0 and 100000),
  max_stock integer not null check (max_stock between 1 and 100000),
  is_active boolean not null default false,
  local_speciality boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(city_id,ingredient_slug),
  constraint cooking_market_stock_bounded check (stock <= max_stock)
);
create index if not exists cooking_market_offers_city_idx
  on public.cooking_city_market_offers(city_id,is_active,ingredient_slug);

create table if not exists public.cooking_market_purchases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id),
  profile_id uuid not null references public.profiles(id),
  city_id uuid not null references public.cities(id),
  offer_id uuid not null references public.cooking_city_market_offers(id),
  ingredient_lot_id uuid not null references public.cooking_ingredient_lots(id),
  quantity integer not null check (quantity between 1 and 20),
  unit_price bigint not null check (unit_price between 1 and 100000),
  total_price bigint not null check (total_price between 1 and 2000000),
  purchased_at timestamptz not null default clock_timestamp()
);
create index if not exists cooking_market_purchases_player_idx
  on public.cooking_market_purchases(profile_id,purchased_at desc);

alter table public.cooking_market_ingredients enable row level security;
alter table public.cooking_city_market_offers enable row level security;
alter table public.cooking_market_purchases enable row level security;
do $policy$
begin
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_market_ingredients' and policyname='Read cooking ingredient catalogue') then
   create policy "Read cooking ingredient catalogue" on public.cooking_market_ingredients
     for select to authenticated using (true);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_city_market_offers' and policyname='Read cooking city market offers') then
   create policy "Read cooking city market offers" on public.cooking_city_market_offers
     for select to authenticated using (true);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_market_purchases' and policyname='Read own cooking market purchases') then
   create policy "Read own cooking market purchases" on public.cooking_market_purchases
     for select to authenticated using ((select auth.uid())=user_id
       and exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=(select auth.uid())));
 end if;
end $policy$;
revoke all on public.cooking_market_ingredients,
  public.cooking_city_market_offers,public.cooking_market_purchases
  from anon,authenticated;
grant select on public.cooking_market_ingredients,
  public.cooking_city_market_offers,public.cooking_market_purchases
  to authenticated;

-- The 26 identifiers are sourced from the authoritative recipe ingredients.
insert into public.cooking_market_ingredients (slug,display_name,category,base_price,shelf_life_hours)
select distinct r.ingredient_slug,
  initcap(replace(r.ingredient_slug,'-',' ')),
  case when r.ingredient_slug in ('milk','butter','eggs') then 'dairy'
       when r.ingredient_slug in ('tea','water') then 'drink'
       when r.ingredient_slug in ('basil','spices','soy-seasoning') then 'herbs'
       when r.ingredient_slug in ('flour','rice','rice-flour','sugar','vegetable-stock','beans','lentils','maize') then 'pantry'
       else 'produce' end,
  case when r.ingredient_slug in ('water','onion','sugar','potato') then 2
       when r.ingredient_slug in ('flour','carrot','tomato','maize','vegetable-stock') then 3
       when r.ingredient_slug in ('milk','eggs','beans','rice','lentils','peppers') then 4
       when r.ingredient_slug in ('butter','tea','spices','basil','mushrooms','apples') then 5
       else 7 end,
  case when r.ingredient_slug in ('milk','mushrooms','tropical-fruit','basil') then 48
       when r.ingredient_slug in ('butter','eggs','tomato','peppers','orchard-fruit','citrus','apples') then 96
       when r.ingredient_slug in ('carrot','potato','onion') then 168
       else 240 end
from public.cooking_recipe_ingredients r
on conflict (slug) do nothing;

-- 11 universal basics plus city/country specialities; no cash/treasury
-- transfers at seed time. Stock and price vary by local production.
with global_staples(slug) as (
 values ('water'),('onion'),('carrot'),('potato'),('tomato'),('flour'),
        ('sugar'),('butter'),('eggs'),('milk'),('vegetable-stock')
),
local_specialities(country,slug) as (
 values
 ('United Kingdom','apples'),('United Kingdom','orchard-fruit'),
 ('France','orchard-fruit'),('France','basil'),('France','citrus'),
 ('Italy','tomato'),('Italy','basil'),('Italy','citrus'),
 ('India','lentils'),('India','spices'),('India','tea'),('India','rice'),
 ('Japan','rice'),('Japan','mushrooms'),('Japan','rice-flour'),
 ('Japan','soy-seasoning'),('Japan','tea'),
 ('Mexico','beans'),('Mexico','peppers'),('Mexico','maize'),
 ('Brazil','tropical-fruit'),('Brazil','citrus'),('Brazil','beans'),
 ('China','rice'),('China','tea'),('China','soy-seasoning'),
 ('Thailand','rice'),('Thailand','spices'),('Thailand','tropical-fruit'),
 ('Vietnam','rice'),('Vietnam','tea'),('Vietnam','soy-seasoning'),
 ('USA','maize'),('USA','beans'),('USA','orchard-fruit'),
 ('Canada','apples'),('Canada','beans'),
 ('Australia','citrus'),('Australia','tropical-fruit'),
 ('Spain','citrus'),('Spain','peppers'),
 ('South Korea','rice'),('South Korea','soy-seasoning'),
 ('Indonesia','rice'),('Indonesia','tropical-fruit'),
 ('Nigeria','beans'),('Nigeria','peppers'),
 ('South Africa','maize'),('South Africa','tropical-fruit')
),
supplies as (
 select c.id city_id,g.slug,false local_speciality from public.cities c cross join global_staples g
 union
 select c.id,s.slug,true from public.cities c join local_specialities s on s.country=c.country
),
normalized as (
 select city_id,slug,bool_or(local_speciality) local_speciality
 from supplies group by city_id,slug
)
insert into public.cooking_city_market_offers
 (city_id,ingredient_slug,unit_price,quality,stock,max_stock,is_active,local_speciality)
select n.city_id,n.slug,
 greatest(1,round(i.base_price*(case when n.local_speciality then 0.8 else 1.15 end))::bigint),
 case when n.local_speciality then 85 else 65 end,
 case when n.local_speciality then 200 else 100 end,
 case when n.local_speciality then 200 else 100 end,
 false,n.local_speciality
from normalized n join public.cooking_market_ingredients i on i.slug=n.slug
on conflict (city_id,ingredient_slug) do nothing;
