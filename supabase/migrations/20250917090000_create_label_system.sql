-- Record label system core schema
set check_function_bodies = off;

-- Ensure uuid generation support
create extension if not exists "uuid-ossp";

-- Utility function to automatically manage updated_at columns
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Base reference data for territories
create table if not exists public.territories (
  code text primary key,
  name text not null,
  region text
);

-- Deal type templates that labels can use when offering contracts
create table if not exists public.label_deal_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_artist_royalty numeric(5,2) default 20,
  default_label_royalty numeric(5,2) default 80,
  includes_advance boolean default false,
  includes_360 boolean default false,
  masters_owned_by_artist boolean default false,
  default_term_months integer,
  default_release_quota integer,
  created_at timestamptz default now()
);

-- Labels act as record companies in the game
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  description text,
  headquarters_city text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logo_url text,
  genre_focus text[],
  reputation_score integer default 0,
  market_share numeric(5,2) default 0,
  roster_slot_capacity integer default 5,
  marketing_budget integer default 0,
  strategy_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger labels_set_updated_at
before update on public.labels
for each row
execute function public.set_updated_at();

-- Label members manage the roster and deals
create table if not exists public.label_members (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (label_id, user_id)
);

create trigger label_members_set_updated_at
before update on public.label_members
for each row
execute function public.set_updated_at();

-- Each label operates in a set of territories
create table if not exists public.label_territories (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  territory_code text not null references public.territories(code) on delete cascade,
  priority integer default 1,
  marketing_focus text,
  unique (label_id, territory_code)
);

-- Roster slots capture label capacity and focus areas
create table if not exists public.label_roster_slots (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  slot_number integer not null,
  focus_genre text,
  status text default 'open',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (label_id, slot_number)
);

create trigger label_roster_slots_set_updated_at
before update on public.label_roster_slots
for each row
execute function public.set_updated_at();

-- Contract between an artist/band and the label
create table if not exists public.artist_label_contracts (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  deal_type_id uuid references public.label_deal_types(id) on delete set null,
  band_id uuid references public.bands(id) on delete set null,
  artist_profile_id uuid references public.profiles(id) on delete set null,
  roster_slot_id uuid references public.label_roster_slots(id) on delete set null,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text default 'pending',
  start_date date,
  end_date date,
  term_months integer,
  release_quota integer default 0,
  releases_completed integer default 0,
  royalty_artist_pct numeric(5,2) not null,
  royalty_label_pct numeric(5,2) not null,
  advance_amount numeric(12,2) default 0,
  recouped_amount numeric(12,2) default 0,
  masters_owned_by_artist boolean default false,
  territories jsonb default '[]'::jsonb,
  options jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (band_id is not null or artist_profile_id is not null),
  check (royalty_artist_pct + royalty_label_pct <= 100)
);

create trigger artist_label_contracts_set_updated_at
before update on public.artist_label_contracts
for each row
execute function public.set_updated_at();

-- Releases managed under a contract
create table if not exists public.label_releases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.artist_label_contracts(id) on delete cascade,
  title varchar(200) not null,
  release_type text not null,
  status text default 'planning',
  scheduled_date date,
  release_date date,
  promotion_budget integer default 0,
  masters_cost integer default 0,
  production_quality numeric(5,2) default 0,
  territory_strategy jsonb default '[]'::jsonb,
  sales_units integer default 0,
  gross_revenue numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger label_releases_set_updated_at
before update on public.label_releases
for each row
execute function public.set_updated_at();

-- Promotion campaigns that support releases
create table if not exists public.label_promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.label_releases(id) on delete cascade,
  campaign_type text,
  budget integer default 0,
  start_date date,
  end_date date,
  channels text[],
  effectiveness numeric(5,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger label_promotion_campaigns_set_updated_at
before update on public.label_promotion_campaigns
for each row
execute function public.set_updated_at();

-- Royalty statements generated per contract / release period
create table if not exists public.label_royalty_statements (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.artist_label_contracts(id) on delete cascade,
  release_id uuid references public.label_releases(id) on delete set null,
  period_start date not null,
  period_end date not null,
  artist_share numeric(12,2) default 0,
  label_share numeric(12,2) default 0,
  recoupment_balance numeric(12,2) default 0,
  generated_at timestamptz default now(),
  notes text
);

-- Track how releases influence reputation
create table if not exists public.label_reputation_events (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  release_id uuid references public.label_releases(id) on delete set null,
  delta integer not null,
  reason text,
  created_at timestamptz default now()
);

-- Maintain reputation running total when events are added
create or replace function public.handle_label_reputation_event()
returns trigger
language plpgsql
as $$
begin
  update public.labels
     set reputation_score = coalesce(reputation_score, 0) + new.delta,
         updated_at = now()
   where id = new.label_id;
  return new;
end;
$$;

create trigger label_reputation_events_after_insert
after insert on public.label_reputation_events
for each row
execute function public.handle_label_reputation_event();

-- Automatically assign owner membership and roster slots when a label is created
create or replace function public.handle_label_created()
returns trigger
language plpgsql
as $$
declare
  slot_total integer := coalesce(new.roster_slot_capacity, 0);
  slot_index integer;
begin
  insert into public.label_members (label_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (label_id, user_id) do nothing;

  if slot_total > 0 then
    for slot_index in 1..slot_total loop
      insert into public.label_roster_slots (label_id, slot_number, status)
      values (new.id, slot_index, 'open')
      on conflict (label_id, slot_number) do nothing;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists handle_label_created_trigger on public.labels;
create trigger handle_label_created_trigger
after insert on public.labels
for each row
execute function public.handle_label_created();

-- Keep roster slot status in sync with contract lifecycle
create or replace function public.sync_roster_slot_status()
returns trigger
language plpgsql
as $$
begin
  if new.roster_slot_id is null then
    return new;
  end if;

  if new.status in ('pending', 'offered', 'active') then
    update public.label_roster_slots
       set status = 'reserved',
           updated_at = now()
     where id = new.roster_slot_id;
  elsif new.status in ('completed', 'terminated', 'rejected') then
    update public.label_roster_slots
       set status = 'open',
           updated_at = now()
     where id = new.roster_slot_id;
  end if;

  return new;
end;
$$;

drop trigger if exists artist_label_contracts_sync_slots on public.artist_label_contracts;
create trigger artist_label_contracts_sync_slots
after insert or update of status, roster_slot_id on public.artist_label_contracts
for each row
execute function public.sync_roster_slot_status();

-- Increment release counters and reputation when a release goes live
create or replace function public.handle_release_status_change()
returns trigger
language plpgsql
as $$
declare
  label_identifier uuid;
  reputation_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'released' then
      update public.artist_label_contracts
         set releases_completed = releases_completed + 1,
             updated_at = now()
       where id = new.contract_id;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'released' then
    update public.artist_label_contracts
       set releases_completed = releases_completed + 1,
           updated_at = now()
     where id = new.contract_id;

    select label_id into label_identifier
      from public.artist_label_contracts
     where id = new.contract_id;

    reputation_delta := least(50, greatest(-20, (new.sales_units / 1000) + coalesce((new.gross_revenue / 1000)::int, 0)));

    insert into public.label_reputation_events (label_id, release_id, delta, reason)
    values (label_identifier, new.id, reputation_delta, 'Release performance');
  end if;

  return new;
end;
$$;

drop trigger if exists label_releases_status_change on public.label_releases;
create trigger label_releases_status_change
after insert or update of status on public.label_releases
for each row
execute function public.handle_release_status_change();

-- Update contract recoupment when royalty statements are generated
create or replace function public.handle_royalty_statement_insert()
returns trigger
language plpgsql
as $$
begin
  update public.artist_label_contracts
     set recouped_amount = least(advance_amount, coalesce(recouped_amount, 0) + coalesce(new.artist_share, 0)),
         updated_at = now()
   where id = new.contract_id;
  return new;
end;
$$;

create trigger label_royalty_statements_after_insert
after insert on public.label_royalty_statements
for each row
execute function public.handle_royalty_statement_insert();

-- Row level security policies
alter table public.territories enable row level security;
alter table public.label_deal_types enable row level security;
alter table public.labels enable row level security;
alter table public.label_members enable row level security;
alter table public.label_territories enable row level security;
alter table public.label_roster_slots enable row level security;
alter table public.artist_label_contracts enable row level security;
alter table public.label_releases enable row level security;
alter table public.label_promotion_campaigns enable row level security;
alter table public.label_royalty_statements enable row level security;
alter table public.label_reputation_events enable row level security;

-- Territories and deal types are informational for everyone
create policy territories_read_all on public.territories
for select using (true);

create policy deal_types_read_all on public.label_deal_types
for select using (true);

create policy deal_types_insert_authenticated on public.label_deal_types
for insert with check (auth.role() = 'authenticated');

-- Labels policies
create policy labels_read_all on public.labels
for select using (true);

create policy labels_insert_authenticated on public.labels
for insert with check (
  auth.role() = 'service_role'
  or (
    auth.role() = 'authenticated'
    and (
      public.has_role(auth.uid(), 'admin')
      or exists (
        select 1
        from public.profiles p
        where p.user_id = auth.uid()
          and coalesce(p.cash, 0) >= 1000000
      )
    )
  )
);

create policy labels_update_owner_or_manager on public.labels
for update using (
  auth.uid() = created_by
  or exists (
    select 1 from public.label_members lm
    where lm.label_id = labels.id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

create policy labels_delete_owner on public.labels
for delete using (auth.uid() = created_by);

-- Label members policies
create policy label_members_read_members on public.label_members
for select using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_members.label_id
      and lm.user_id = auth.uid()
  )
);

create policy label_members_insert_owner on public.label_members
for insert with check (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_members.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

create policy label_members_update_owner on public.label_members
for update using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_members.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

create policy label_members_delete_owner on public.label_members
for delete using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_members.label_id
      and lm.user_id = auth.uid()
      and lm.role = 'owner'
  )
);

-- Label territories readable and manageable by label teams
create policy label_territories_read_all on public.label_territories
for select using (true);

create policy label_territories_manage_team on public.label_territories
for all using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_territories.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
) with check (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_territories.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Roster slots readable by all, managed by label teams
create policy label_roster_slots_read_all on public.label_roster_slots
for select using (true);

create policy label_roster_slots_manage_team on public.label_roster_slots
for all using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_roster_slots.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
) with check (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_roster_slots.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Contracts policies allow participants visibility
create policy contracts_read_participants on public.artist_label_contracts
for select using (
  auth.role() = 'authenticated' and (
    exists (
      select 1 from public.label_members lm
      where lm.label_id = artist_label_contracts.label_id
        and lm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.band_members bm
      where bm.band_id = artist_label_contracts.band_id
        and bm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = artist_label_contracts.artist_profile_id
        and p.user_id = auth.uid()
    )
  )
);

create policy contracts_insert_participants on public.artist_label_contracts
for insert with check (
  auth.role() = 'authenticated' and (
    auth.uid() = requested_by
    or exists (
      select 1 from public.label_members lm
      where lm.label_id = artist_label_contracts.label_id
        and lm.user_id = auth.uid()
        and lm.role in ('owner', 'manager', 'a&r')
    )
  )
);

create policy contracts_update_label_team on public.artist_label_contracts
for update using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = artist_label_contracts.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
) with check (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = artist_label_contracts.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Releases readable to participants, managed by label teams
create policy releases_read_participants on public.label_releases
for select using (
  auth.role() = 'authenticated' and (
    exists (
      select 1 from public.artist_label_contracts alc
      join public.label_members lm on lm.label_id = alc.label_id
      where alc.id = label_releases.contract_id
        and lm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.artist_label_contracts alc
      join public.band_members bm on bm.band_id = alc.band_id
      where alc.id = label_releases.contract_id
        and bm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.artist_label_contracts alc
      join public.profiles p on p.id = alc.artist_profile_id
      where alc.id = label_releases.contract_id
        and p.user_id = auth.uid()
    )
  )
);

create policy releases_manage_label_team on public.label_releases
for all using (
  exists (
    select 1 from public.artist_label_contracts alc
    join public.label_members lm on lm.label_id = alc.label_id
    where alc.id = label_releases.contract_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
) with check (
  exists (
    select 1 from public.artist_label_contracts alc
    join public.label_members lm on lm.label_id = alc.label_id
    where alc.id = label_releases.contract_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Promotion campaigns follow release policies
create policy promotion_campaigns_read_participants on public.label_promotion_campaigns
for select using (
  auth.role() = 'authenticated' and (
    exists (
      select 1 from public.label_releases lr
      join public.artist_label_contracts alc on alc.id = lr.contract_id
      join public.label_members lm on lm.label_id = alc.label_id
      where lr.id = label_promotion_campaigns.release_id
        and lm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.label_releases lr
      join public.artist_label_contracts alc on alc.id = lr.contract_id
      join public.band_members bm on bm.band_id = alc.band_id
      where lr.id = label_promotion_campaigns.release_id
        and bm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.label_releases lr
      join public.artist_label_contracts alc on alc.id = lr.contract_id
      join public.profiles p on p.id = alc.artist_profile_id
      where lr.id = label_promotion_campaigns.release_id
        and p.user_id = auth.uid()
    )
  )
);

create policy promotion_campaigns_manage_label_team on public.label_promotion_campaigns
for all using (
  exists (
    select 1 from public.label_releases lr
    join public.artist_label_contracts alc on alc.id = lr.contract_id
    join public.label_members lm on lm.label_id = alc.label_id
    where lr.id = label_promotion_campaigns.release_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
) with check (
  exists (
    select 1 from public.label_releases lr
    join public.artist_label_contracts alc on alc.id = lr.contract_id
    join public.label_members lm on lm.label_id = alc.label_id
    where lr.id = label_promotion_campaigns.release_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Royalty statements visible to contract participants
create policy royalty_statements_read_participants on public.label_royalty_statements
for select using (
  auth.role() = 'authenticated' and (
    exists (
      select 1 from public.artist_label_contracts alc
      join public.label_members lm on lm.label_id = alc.label_id
      where alc.id = label_royalty_statements.contract_id
        and lm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.artist_label_contracts alc
      join public.band_members bm on bm.band_id = alc.band_id
      where alc.id = label_royalty_statements.contract_id
        and bm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.artist_label_contracts alc
      join public.profiles p on p.id = alc.artist_profile_id
      where alc.id = label_royalty_statements.contract_id
        and p.user_id = auth.uid()
    )
  )
);

create policy royalty_statements_manage_label_team on public.label_royalty_statements
for insert with check (
  exists (
    select 1 from public.artist_label_contracts alc
    join public.label_members lm on lm.label_id = alc.label_id
    where alc.id = label_royalty_statements.contract_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager', 'finance')
  )
);

-- Reputation events are informational for label teams
create policy reputation_events_read_team on public.label_reputation_events
for select using (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_reputation_events.label_id
      and lm.user_id = auth.uid()
  )
);

create policy reputation_events_insert_team on public.label_reputation_events
for insert with check (
  exists (
    select 1 from public.label_members lm
    where lm.label_id = label_reputation_events.label_id
      and lm.user_id = auth.uid()
      and lm.role in ('owner', 'manager')
  )
);

-- Seed baseline deal types and territories
insert into public.label_deal_types (name, description, default_artist_royalty, default_label_royalty, includes_advance, includes_360, masters_owned_by_artist, default_term_months, default_release_quota)
values
  ('Traditional', 'Standard royalty split with optional advances and label owned masters.', 20, 80, true, false, false, 24, 3),
  ('360 Deal', 'Label participates in touring and merchandise revenue.', 25, 75, true, true, false, 36, 4),
  ('Distribution', 'Artist retains masters and handles marketing with label support services.', 80, 20, false, false, true, 12, 1)
on conflict (name) do nothing;

insert into public.territories (code, name, region) values
  ('US', 'United States', 'North America'),
  ('UK', 'United Kingdom', 'Europe'),
  ('BR', 'Brazil', 'South America'),
  ('JP', 'Japan', 'Asia'),
  ('SE', 'Sweden', 'Europe')
on conflict (code) do nothing;

-- Seed a few launch labels backed by the admin user so players have partners from day one
do $$
declare
  admin_user_id uuid;
  label_id uuid;
begin
  select id into admin_user_id from auth.users where email = 'admin@rockmundo.com';

  if admin_user_id is not null then
    -- Midnight Wave Records (electronic & pop focus)
    select id into label_id from public.labels where name = 'Midnight Wave Records' limit 1;
    if label_id is null then
      insert into public.labels (
        name,
        description,
        headquarters_city,
        created_by,
        genre_focus,
        roster_slot_capacity,
        marketing_budget,
        reputation_score,
        market_share
      )
      values (
        'Midnight Wave Records',
        'Synth-forward indie pop collective known for bold visuals and late-night release drops.',
        'Stockholm',
        admin_user_id,
        array['Synthpop', 'Electronic']::text[],
        6,
        250000,
        55,
        12.5
      )
      returning id into label_id;
    end if;

    if label_id is not null then
      insert into public.label_members (label_id, user_id, role)
      values (label_id, admin_user_id, 'owner')
      on conflict (label_id, user_id) do nothing;

      insert into public.label_territories (label_id, territory_code, priority)
      values
        (label_id, 'SE', 1),
        (label_id, 'UK', 2),
        (label_id, 'US', 3)
      on conflict (label_id, territory_code) do nothing;

      insert into public.label_roster_slots (label_id, slot_number, focus_genre)
      values
        (label_id, 1, 'Synthpop'),
        (label_id, 2, 'Electropop'),
        (label_id, 3, 'Indie Pop'),
        (label_id, 4, 'Electronic'),
        (label_id, 5, 'Alt Pop'),
        (label_id, 6, 'Experimental')
      on conflict (label_id, slot_number) do nothing;
    end if;

    -- Steel & Velvet Entertainment (rock & metal specialists)
    select id into label_id from public.labels where name = 'Steel & Velvet Entertainment' limit 1;
    if label_id is null then
      insert into public.labels (
        name,
        description,
        headquarters_city,
        created_by,
        genre_focus,
        roster_slot_capacity,
        marketing_budget,
        reputation_score,
        market_share
      )
      values (
        'Steel & Velvet Entertainment',
        'Global rock powerhouse balancing gritty metal signings with radio-ready arena acts.',
        'Los Angeles',
        admin_user_id,
        array['Rock', 'Metal', 'Hard Rock']::text[],
        8,
        320000,
        68,
        18.4
      )
      returning id into label_id;
    end if;

    if label_id is not null then
      insert into public.label_members (label_id, user_id, role)
      values (label_id, admin_user_id, 'owner')
      on conflict (label_id, user_id) do nothing;

      insert into public.label_territories (label_id, territory_code, priority)
      values
        (label_id, 'US', 1),
        (label_id, 'UK', 2),
        (label_id, 'BR', 3)
      on conflict (label_id, territory_code) do nothing;

      insert into public.label_roster_slots (label_id, slot_number, focus_genre)
      values
        (label_id, 1, 'Hard Rock'),
        (label_id, 2, 'Metalcore'),
        (label_id, 3, 'Classic Rock'),
        (label_id, 4, 'Symphonic Metal'),
        (label_id, 5, 'Alternative Rock'),
        (label_id, 6, 'Progressive Metal'),
        (label_id, 7, 'Stadium Rock'),
        (label_id, 8, 'Indie Rock')
      on conflict (label_id, slot_number) do nothing;
    end if;

    -- Horizon Line Collective (global fusion and experimental sounds)
    select id into label_id from public.labels where name = 'Horizon Line Collective' limit 1;
    if label_id is null then
      insert into public.labels (
        name,
        description,
        headquarters_city,
        created_by,
        genre_focus,
        roster_slot_capacity,
        marketing_budget,
        reputation_score,
        market_share
      )
      values (
        'Horizon Line Collective',
        'Boutique collective focused on cross-cultural collaborations and future-facing genre blends.',
        'Rio de Janeiro',
        admin_user_id,
        array['World', 'Experimental', 'Downtempo']::text[],
        5,
        180000,
        47,
        9.6
      )
      returning id into label_id;
    end if;

    if label_id is not null then
      insert into public.label_members (label_id, user_id, role)
      values (label_id, admin_user_id, 'owner')
      on conflict (label_id, user_id) do nothing;

      insert into public.label_territories (label_id, territory_code, priority)
      values
        (label_id, 'BR', 1),
        (label_id, 'JP', 2),
        (label_id, 'SE', 3)
      on conflict (label_id, territory_code) do nothing;

      insert into public.label_roster_slots (label_id, slot_number, focus_genre)
      values
        (label_id, 1, 'World Fusion'),
        (label_id, 2, 'Downtempo'),
        (label_id, 3, 'Afrobeat'),
        (label_id, 4, 'Ambient Pop'),
        (label_id, 5, 'Latin Experimental')
      on conflict (label_id, slot_number) do nothing;
    end if;
  end if;
end $$;
