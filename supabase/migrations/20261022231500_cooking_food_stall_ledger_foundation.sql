-- Closed-by-default food stall and trade ledger foundation.
-- No public or authenticated role can create, fund, open, settle or cancel listings.
-- A later audited service-only transaction must reserve batch portions and
-- transfer funds atomically before a listing can be opened.
create table if not exists public.cooking_food_stall_listings (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references public.profiles(id) on delete restrict,
  city_id uuid not null references public.cities(id) on delete restrict,
  food_batch_id uuid not null references public.cooking_food_batches(id) on delete restrict,
  portions_reserved integer not null check (portions_reserved between 1 and 1000),
  portions_remaining integer not null check (portions_remaining between 0 and portions_reserved),
  price_per_portion bigint not null check (price_per_portion between 1 and 100000000),
  status text not null default 'draft' check (status in ('draft','open','sold','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  constraint cooking_listing_opened_only_when_active check
    (status <> 'open' or (opened_at is not null and closed_at is null and portions_remaining > 0)),
  constraint cooking_listing_closed_at check
    (status not in ('sold','cancelled','expired') or closed_at is not null)
);
create index if not exists cooking_stall_city_open_idx
 on public.cooking_food_stall_listings(city_id, expires_at) where status='open';
create index if not exists cooking_stall_seller_idx
 on public.cooking_food_stall_listings(seller_profile_id, created_at desc);
create unique index if not exists cooking_stall_one_live_listing_per_batch_idx
 on public.cooking_food_stall_listings(food_batch_id)
 where status in ('draft','open');
create table if not exists public.cooking_food_stall_sales (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null unique,
 listing_id uuid not null references public.cooking_food_stall_listings(id) on delete restrict,
 buyer_profile_id uuid not null references public.profiles(id) on delete restrict,
 seller_profile_id uuid not null references public.profiles(id) on delete restrict,
 city_id uuid not null references public.cities(id) on delete restrict,
 portions integer not null check (portions between 1 and 1000),
 unit_price bigint not null check (unit_price > 0),
 subtotal bigint not null check (subtotal > 0),
 city_fee bigint not null check (city_fee >= 0 and city_fee <= subtotal),
 seller_proceeds bigint not null check (seller_proceeds >= 0),
 destination_batch_id uuid references public.cooking_food_batches(id) on delete restrict,
 purchased_at timestamptz not null default now(),
 constraint cooking_food_stall_no_self_sale check (buyer_profile_id <> seller_profile_id),
 constraint cooking_food_stall_amounts_balance check (subtotal=portions*unit_price and seller_proceeds=subtotal-city_fee)
);
create index if not exists cooking_stall_sales_buyer_idx on public.cooking_food_stall_sales(buyer_profile_id,purchased_at desc);
create index if not exists cooking_stall_sales_seller_idx on public.cooking_food_stall_sales(seller_profile_id,purchased_at desc);
alter table public.cooking_food_stall_listings enable row level security;
alter table public.cooking_food_stall_sales enable row level security;
revoke all on public.cooking_food_stall_listings from public,anon,authenticated;
revoke all on public.cooking_food_stall_sales from public,anon,authenticated;
grant select on public.cooking_food_stall_listings to authenticated;
grant select on public.cooking_food_stall_sales to authenticated;
create policy "Players see own food stall listings" on public.cooking_food_stall_listings
 for select to authenticated using
 (exists (select 1 from public.profiles p where p.id=seller_profile_id and p.user_id=(select auth.uid())));
create policy "Players see own food stall sales" on public.cooking_food_stall_sales
 for select to authenticated using
 (exists (select 1 from public.profiles p where p.id=buyer_profile_id and p.user_id=(select auth.uid()))
  or exists (select 1 from public.profiles p where p.id=seller_profile_id and p.user_id=(select auth.uid())));
-- All new entries must remain draft until a trusted escrow validator is deployed.
-- Service role cannot accidentally mark a listing open in this schema-only phase.
create or replace function public.reject_unsecured_cooking_stall_open()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.status = 'open' then
  raise exception 'Player food trading is disabled until escrow settlement is deployed';
 end if;
 return new;
end;
$$;
drop trigger if exists cooking_stall_release_gate on public.cooking_food_stall_listings;
create trigger cooking_stall_release_gate before insert or update
on public.cooking_food_stall_listings for each row
execute function public.reject_unsecured_cooking_stall_open();
revoke all on function public.reject_unsecured_cooking_stall_open() from public,anon,authenticated;
