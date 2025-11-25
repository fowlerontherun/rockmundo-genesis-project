-- Sponsorship domain schema

create type public.sponsorable_entity_type as enum ('character', 'tour', 'venue', 'festival', 'band');
create type public.sponsorship_offer_status as enum ('draft', 'pending', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.sponsorship_contract_status as enum ('pending', 'active', 'completed', 'terminated', 'cancelled');
create type public.sponsorship_history_event as enum (
  'offer_created',
  'offer_updated',
  'offer_expired',
  'offer_withdrawn',
  'offer_accepted',
  'contract_signed',
  'status_changed',
  'payout_recorded'
);
create type public.brand_size as enum ('indie', 'regional', 'national', 'global');
create type public.brand_category as enum ('fashion', 'tech', 'food_and_beverage', 'automotive', 'finance', 'lifestyle', 'entertainment', 'other');
create type public.brand_region as enum ('local', 'national', 'europe', 'north_america', 'asia_pacific', 'latin_america', 'middle_east_africa', 'global');

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  size public.brand_size not null default 'indie',
  fsm_score smallint not null default 0 check (fsm_score >= 0),
  wealth_rating numeric(12,2) not null default 0,
  minimum_fame_required integer not null default 0 check (minimum_fame_required >= 0),
  requires_clean_record boolean not null default true,
  supports_indies boolean not null default true,
  allows_explicit_imagery boolean not null default false,
  category public.brand_category not null default 'other',
  region public.brand_region not null default 'local',
  is_active boolean not null default true,
  default_contract_terms jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (name, region)
);

create table if not exists public.sponsorship_offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  sponsorable_type public.sponsorable_entity_type not null,
  sponsorable_id uuid not null,
  status public.sponsorship_offer_status not null default 'pending',
  cash_value numeric(12,2) not null default 0,
  in_kind_value numeric(12,2) not null default 0,
  exclusivity boolean not null default false,
  terms jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  check (expires_at > created_at)
);

create table if not exists public.sponsorship_contracts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.sponsorship_offers(id) on delete set null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  sponsorable_type public.sponsorable_entity_type not null,
  sponsorable_id uuid not null,
  status public.sponsorship_contract_status not null default 'pending',
  start_date date not null default current_date,
  end_date date,
  is_exclusive boolean not null default false,
  terms jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.sponsorship_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.sponsorship_contracts(id) on delete cascade,
  event_type public.sponsorship_history_event not null,
  from_status public.sponsorship_contract_status,
  to_status public.sponsorship_contract_status,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sponsorship_offers_brand_idx on public.sponsorship_offers (brand_id);
create index if not exists sponsorship_offers_sponsorable_idx on public.sponsorship_offers (sponsorable_type, sponsorable_id);
create index if not exists sponsorship_contracts_brand_idx on public.sponsorship_contracts (brand_id);
create index if not exists sponsorship_contracts_sponsorable_idx on public.sponsorship_contracts (sponsorable_type, sponsorable_id);
create index if not exists sponsorship_history_contract_idx on public.sponsorship_history (contract_id);

create unique index sponsorship_contracts_offer_unique on public.sponsorship_contracts (offer_id) where offer_id is not null;
create unique index sponsorship_contracts_brand_sponsorable_active_idx on public.sponsorship_contracts (brand_id, sponsorable_type, sponsorable_id)
  where status in ('pending', 'active');
create unique index sponsorship_contracts_exclusive_active_idx on public.sponsorship_contracts (sponsorable_type, sponsorable_id)
  where is_exclusive and status = 'active';

create or replace function public.enforce_character_contract_limit()
returns trigger as $$
begin
  if NEW.sponsorable_type = 'character' and NEW.status in ('pending', 'active') then
    if (
      select count(*)
      from public.sponsorship_contracts sc
      where sc.sponsorable_type = 'character'
        and sc.sponsorable_id = NEW.sponsorable_id
        and sc.status in ('pending', 'active')
        and sc.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 3 then
      raise exception 'Character already has maximum of three active sponsorship contracts';
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger enforce_character_contract_limit_before_write
  before insert or update on public.sponsorship_contracts
  for each row
  execute function public.enforce_character_contract_limit();

create trigger brands_set_updated_at
  before update on public.brands
  for each row
  execute function public.set_updated_at();

create trigger sponsorship_offers_set_updated_at
  before update on public.sponsorship_offers
  for each row
  execute function public.set_updated_at();

create trigger sponsorship_contracts_set_updated_at
  before update on public.sponsorship_contracts
  for each row
  execute function public.set_updated_at();
