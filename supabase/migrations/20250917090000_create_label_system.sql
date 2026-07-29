-- Consolidated owner for the three historical 20250917090000 migrations.
-- Supabase records migrations by their 14-digit version, so all label,
-- promotion, and seasonal leaderboard responsibilities live in this file.

set check_function_bodies = off;
create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.territories (
  code text primary key, name text not null, region text
);
create table if not exists public.label_deal_types (
  id uuid primary key default gen_random_uuid(), name text not null,
  description text, default_artist_royalty numeric(5,2) default 20,
  default_label_royalty numeric(5,2) default 80,
  includes_advance boolean default false, includes_360 boolean default false,
  masters_owned_by_artist boolean default false, default_term_months integer,
  default_release_quota integer, created_at timestamptz default now()
);
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(), name varchar(150) not null,
  description text, headquarters_city text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logo_url text, genre_focus text[], reputation_score integer default 0,
  market_share numeric(5,2) default 0, roster_slot_capacity integer default 5,
  marketing_budget integer default 0, strategy_notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.label_members (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'member', joined_at timestamptz default now(),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (label_id, user_id)
);
create table if not exists public.label_territories (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  territory_code text not null references public.territories(code) on delete cascade,
  priority integer default 1, marketing_focus text,
  unique (label_id, territory_code)
);
create table if not exists public.label_roster_slots (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  slot_number integer not null, focus_genre text, status text default 'open',
  notes text, created_at timestamptz default now(),
  updated_at timestamptz default now(), unique (label_id, slot_number)
);
create table if not exists public.artist_label_contracts (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  deal_type_id uuid references public.label_deal_types(id) on delete set null,
  band_id uuid references public.bands(id) on delete set null,
  artist_profile_id uuid references public.profiles(id) on delete set null,
  roster_slot_id uuid references public.label_roster_slots(id) on delete set null,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text default 'pending', start_date date, end_date date, term_months integer,
  release_quota integer default 0, releases_completed integer default 0,
  royalty_artist_pct numeric(5,2) not null, royalty_label_pct numeric(5,2) not null,
  advance_amount numeric(12,2) default 0, recouped_amount numeric(12,2) default 0,
  masters_owned_by_artist boolean default false, territories jsonb default '[]'::jsonb,
  options jsonb default '{}'::jsonb, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  check (band_id is not null or artist_profile_id is not null),
  check (royalty_artist_pct + royalty_label_pct <= 100)
);
create table if not exists public.label_releases (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.artist_label_contracts(id) on delete cascade,
  title varchar(200) not null, release_type text not null, status text default 'planning',
  scheduled_date date, release_date date, promotion_budget integer default 0,
  masters_cost integer default 0, production_quality numeric(5,2) default 0,
  territory_strategy jsonb default '[]'::jsonb, sales_units integer default 0,
  gross_revenue numeric(12,2) default 0, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.label_promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.label_releases(id) on delete cascade,
  campaign_type text, budget integer default 0, start_date date, end_date date,
  channels text[], effectiveness numeric(5,2) default 0, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.label_royalty_statements (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.artist_label_contracts(id) on delete cascade,
  release_id uuid references public.label_releases(id) on delete set null,
  period_start date not null, period_end date not null,
  artist_share numeric(12,2) default 0, label_share numeric(12,2) default 0,
  recoupment_balance numeric(12,2) default 0, generated_at timestamptz default now(),
  notes text
);
create table if not exists public.label_reputation_events (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.labels(id) on delete cascade,
  release_id uuid references public.label_releases(id) on delete set null,
  delta integer not null, reason text, created_at timestamptz default now()
);

create table if not exists public.promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  platform_id uuid references public.streaming_platforms(id) on delete set null,
  platform_name text, campaign_type text not null, budget integer not null default 0,
  status text not null default 'active', playlist_name text,
  playlists_targeted integer default 0, new_placements integer default 0,
  stream_increase integer default 0, revenue_generated integer default 0,
  listeners_generated integer default 0, message text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists idx_promotion_campaigns_user_id on public.promotion_campaigns(user_id);
create index if not exists idx_promotion_campaigns_song_id on public.promotion_campaigns(song_id);

create table if not exists public.leaderboard_seasons (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, description text,
  status text not null default 'upcoming'
    check (status = any (array['upcoming','active','completed']::text[])),
  start_date date not null, end_date date not null,
  reward_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.leaderboard_season_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.leaderboard_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  division text not null default 'global', region text not null default 'global',
  instrument text not null default 'all', tier text, final_rank integer,
  final_score numeric, total_revenue numeric, total_gigs integer,
  total_achievements integer, fame numeric, experience numeric,
  breakdown jsonb not null default '{}'::jsonb,
  awarded_badges jsonb not null default '[]'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (length(trim(division)) > 0), check (length(trim(region)) > 0),
  check (length(trim(instrument)) > 0),
  unique (season_id, user_id, division, region, instrument)
);
create table if not exists public.leaderboard_badges (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.leaderboard_seasons(id) on delete cascade,
  code text not null unique, name text not null, description text,
  icon text not null default 'trophy',
  rarity text not null default 'rare'
    check (rarity = any (array['common','uncommon','rare','epic','legendary','mythic']::text[])),
  tier text, criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.leaderboard_badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.leaderboard_badges(id) on delete cascade,
  season_id uuid references public.leaderboard_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now(), rank integer,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  check (rank is null or rank >= 1), unique (badge_id, user_id)
);
create index if not exists leaderboard_seasons_status_idx
  on public.leaderboard_seasons(status, start_date desc);
create index if not exists leaderboard_season_snapshots_season_idx
  on public.leaderboard_season_snapshots(season_id, division, region, instrument, final_rank);
create index if not exists leaderboard_season_snapshots_user_idx
  on public.leaderboard_season_snapshots(user_id);
create index if not exists leaderboard_badges_season_idx
  on public.leaderboard_badges(season_id, rarity);
create index if not exists leaderboard_badge_awards_badge_idx
  on public.leaderboard_badge_awards(badge_id);
create index if not exists leaderboard_badge_awards_user_idx
  on public.leaderboard_badge_awards(user_id);
create index if not exists leaderboard_badge_awards_season_idx
  on public.leaderboard_badge_awards(season_id);

create or replace function public.is_label_team_member(p_label_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.label_members
    where label_id = p_label_id and user_id = auth.uid()
      and (p_roles is null or role = any (p_roles))
  );
$$;
revoke all on function public.is_label_team_member(uuid, text[]) from public;
grant execute on function public.is_label_team_member(uuid, text[]) to authenticated;

create or replace function public.can_access_label_contract(p_contract_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.artist_label_contracts contract
    where contract.id = p_contract_id
      and (
        public.is_label_team_member(contract.label_id, null)
        or exists (
          select 1 from public.band_members
          where band_id = contract.band_id and user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles
          where id = contract.artist_profile_id and user_id = auth.uid()
        )
      )
  );
$$;
revoke all on function public.can_access_label_contract(uuid) from public;
grant execute on function public.can_access_label_contract(uuid) to authenticated;

create or replace function public.can_manage_label_contract(
  p_contract_id uuid,
  p_roles text[] default array['owner','manager']::text[]
)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.artist_label_contracts contract
    where contract.id = p_contract_id
      and public.is_label_team_member(contract.label_id, p_roles)
  );
$$;
revoke all on function public.can_manage_label_contract(uuid, text[]) from public;
grant execute on function public.can_manage_label_contract(uuid, text[]) to authenticated;

create or replace function public.handle_label_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare i integer;
begin
  insert into public.label_members(label_id,user_id,role)
  values(new.id,new.created_by,'owner') on conflict(label_id,user_id) do nothing;
  for i in 1..greatest(coalesce(new.roster_slot_capacity,0),0) loop
    insert into public.label_roster_slots(label_id,slot_number,status)
    values(new.id,i,'open') on conflict(label_id,slot_number) do nothing;
  end loop;
  return new;
end;
$$;
create or replace function public.sync_roster_slot_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.roster_slot_id is not null then
    update public.label_roster_slots
    set status = case when new.status in ('pending','offered','active') then 'reserved'
                      when new.status in ('completed','terminated','rejected') then 'open'
                      else status end,
        updated_at = now()
    where id = new.roster_slot_id;
  end if;
  return new;
end;
$$;
create or replace function public.handle_label_reputation_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.labels set reputation_score=coalesce(reputation_score,0)+new.delta,
    updated_at=now() where id=new.label_id; return new;
end;
$$;
create or replace function public.handle_release_status_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare label_identifier uuid; reputation_delta integer;
begin
  if new.status='released' and (tg_op='INSERT' or old.status is distinct from new.status) then
    update public.artist_label_contracts
    set releases_completed=releases_completed+1, updated_at=now()
    where id=new.contract_id;
    if tg_op='UPDATE' then
      select label_id into label_identifier from public.artist_label_contracts where id=new.contract_id;
      reputation_delta:=least(50,greatest(-20,(new.sales_units/1000)+coalesce((new.gross_revenue/1000)::integer,0)));
      insert into public.label_reputation_events(label_id,release_id,delta,reason)
      values(label_identifier,new.id,reputation_delta,'Release performance');
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.handle_royalty_statement_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.artist_label_contracts
  set recouped_amount=least(advance_amount,coalesce(recouped_amount,0)+coalesce(new.artist_share,0)),
      updated_at=now()
  where id=new.contract_id; return new;
end;
$$;

do $triggers$
declare item record;
begin
  for item in select * from (values
    ('labels_set_updated_at','labels','set_updated_at'),
    ('label_members_set_updated_at','label_members','set_updated_at'),
    ('label_roster_slots_set_updated_at','label_roster_slots','set_updated_at'),
    ('artist_label_contracts_set_updated_at','artist_label_contracts','set_updated_at'),
    ('label_releases_set_updated_at','label_releases','set_updated_at'),
    ('label_promotion_campaigns_set_updated_at','label_promotion_campaigns','set_updated_at'),
    ('promotion_campaigns_set_updated_at','promotion_campaigns','set_updated_at'),
    ('leaderboard_seasons_set_updated_at','leaderboard_seasons','set_updated_at'),
    ('leaderboard_season_snapshots_set_updated_at','leaderboard_season_snapshots','set_updated_at'),
    ('leaderboard_badges_set_updated_at','leaderboard_badges','set_updated_at')
  ) as t(trigger_name,table_name,function_name) loop
    execute format('drop trigger if exists %I on public.%I',item.trigger_name,item.table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.%I()',
      item.trigger_name,item.table_name,item.function_name);
  end loop;
end $triggers$;

drop trigger if exists handle_label_created_trigger on public.labels;
create trigger handle_label_created_trigger after insert on public.labels
for each row execute function public.handle_label_created();
drop trigger if exists artist_label_contracts_sync_slots on public.artist_label_contracts;
create trigger artist_label_contracts_sync_slots after insert or update of status,roster_slot_id
on public.artist_label_contracts for each row execute function public.sync_roster_slot_status();
drop trigger if exists label_reputation_events_after_insert on public.label_reputation_events;
create trigger label_reputation_events_after_insert after insert on public.label_reputation_events
for each row execute function public.handle_label_reputation_event();
drop trigger if exists label_releases_status_change on public.label_releases;
create trigger label_releases_status_change after insert or update of status on public.label_releases
for each row execute function public.handle_release_status_change();
drop trigger if exists label_royalty_statements_after_insert on public.label_royalty_statements;
create trigger label_royalty_statements_after_insert after insert on public.label_royalty_statements
for each row execute function public.handle_royalty_statement_insert();

do $rls$
declare table_name text;
begin
  foreach table_name in array array[
    'territories','label_deal_types','labels','label_members','label_territories',
    'label_roster_slots','artist_label_contracts','label_releases',
    'label_promotion_campaigns','label_royalty_statements','label_reputation_events',
    'promotion_campaigns','leaderboard_seasons','leaderboard_season_snapshots',
    'leaderboard_badges','leaderboard_badge_awards'
  ] loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $rls$;

drop policy if exists territories_read_all on public.territories;
create policy territories_read_all on public.territories for select using(true);
drop policy if exists deal_types_read_all on public.label_deal_types;
create policy deal_types_read_all on public.label_deal_types for select using(true);
drop policy if exists deal_types_manage_admin on public.label_deal_types;
create policy deal_types_manage_admin on public.label_deal_types for all
using(public.has_role(auth.uid(),'admin'::public.app_role)) with check(public.has_role(auth.uid(),'admin'::public.app_role));
drop policy if exists labels_read_all on public.labels;
create policy labels_read_all on public.labels for select using(true);
drop policy if exists labels_insert_admin on public.labels;
create policy labels_insert_admin on public.labels for insert
with check(auth.role()='service_role' or public.has_role(auth.uid(),'admin'::public.app_role));
drop policy if exists labels_update_team on public.labels;
create policy labels_update_team on public.labels for update
using(auth.uid()=created_by or public.is_label_team_member(id,array['owner','manager']))
with check(auth.uid()=created_by or public.is_label_team_member(id,array['owner','manager']));
drop policy if exists labels_delete_owner on public.labels;
create policy labels_delete_owner on public.labels for delete
using(auth.uid()=created_by or public.is_label_team_member(id,array['owner']));
drop policy if exists label_members_read_participants on public.label_members;
create policy label_members_read_participants on public.label_members for select
using(auth.uid()=user_id or public.is_label_team_member(label_id,null));
drop policy if exists label_members_manage_team on public.label_members;
create policy label_members_manage_team on public.label_members for all
using(public.is_label_team_member(label_id,array['owner','manager']))
with check(public.is_label_team_member(label_id,array['owner','manager']));
drop policy if exists label_territories_read_all on public.label_territories;
create policy label_territories_read_all on public.label_territories for select using(true);
drop policy if exists label_territories_manage_team on public.label_territories;
create policy label_territories_manage_team on public.label_territories for all
using(public.is_label_team_member(label_id,array['owner','manager']))
with check(public.is_label_team_member(label_id,array['owner','manager']));
drop policy if exists label_roster_slots_read_all on public.label_roster_slots;
create policy label_roster_slots_read_all on public.label_roster_slots for select using(true);
drop policy if exists label_roster_slots_manage_team on public.label_roster_slots;
create policy label_roster_slots_manage_team on public.label_roster_slots for all
using(public.is_label_team_member(label_id,array['owner','manager']))
with check(public.is_label_team_member(label_id,array['owner','manager']));
drop policy if exists contracts_read_participants on public.artist_label_contracts;
create policy contracts_read_participants on public.artist_label_contracts for select using(
  public.is_label_team_member(label_id,null)
  or exists(select 1 from public.band_members where band_id=artist_label_contracts.band_id and user_id=auth.uid())
  or exists(select 1 from public.profiles where id=artist_label_contracts.artist_profile_id and user_id=auth.uid())
);
drop policy if exists contracts_insert_participants on public.artist_label_contracts;
create policy contracts_insert_participants on public.artist_label_contracts for insert
with check(auth.uid()=requested_by or public.is_label_team_member(label_id,array['owner','manager','a&r']));
drop policy if exists contracts_update_label_team on public.artist_label_contracts;
create policy contracts_update_label_team on public.artist_label_contracts for update
using(public.is_label_team_member(label_id,array['owner','manager']))
with check(public.is_label_team_member(label_id,array['owner','manager']));

drop policy if exists releases_read_participants on public.label_releases;
create policy releases_read_participants on public.label_releases for select
using(public.can_access_label_contract(contract_id));
drop policy if exists releases_manage_label_team on public.label_releases;
create policy releases_manage_label_team on public.label_releases for all
using(public.can_manage_label_contract(contract_id))
with check(public.can_manage_label_contract(contract_id));

drop policy if exists label_campaigns_read_participants on public.label_promotion_campaigns;
create policy label_campaigns_read_participants on public.label_promotion_campaigns for select
using(exists(
  select 1 from public.label_releases
  where id=label_promotion_campaigns.release_id
    and public.can_access_label_contract(contract_id)
));
drop policy if exists label_campaigns_manage_team on public.label_promotion_campaigns;
create policy label_campaigns_manage_team on public.label_promotion_campaigns for all
using(exists(
  select 1 from public.label_releases
  where id=label_promotion_campaigns.release_id
    and public.can_manage_label_contract(contract_id)
))
with check(exists(
  select 1 from public.label_releases
  where id=label_promotion_campaigns.release_id
    and public.can_manage_label_contract(contract_id)
));

drop policy if exists royalty_statements_read_participants on public.label_royalty_statements;
create policy royalty_statements_read_participants on public.label_royalty_statements for select
using(public.can_access_label_contract(contract_id));
drop policy if exists royalty_statements_manage_label_team on public.label_royalty_statements;
create policy royalty_statements_manage_label_team on public.label_royalty_statements for insert
with check(public.can_manage_label_contract(
  contract_id,array['owner','manager','finance']::text[]
));

drop policy if exists reputation_events_read_team on public.label_reputation_events;
create policy reputation_events_read_team on public.label_reputation_events for select
using(public.is_label_team_member(label_id,null));
drop policy if exists reputation_events_insert_team on public.label_reputation_events;
create policy reputation_events_insert_team on public.label_reputation_events for insert
with check(public.is_label_team_member(label_id,array['owner','manager']::text[]));

drop policy if exists promotion_campaigns_select_owner on public.promotion_campaigns;
create policy promotion_campaigns_select_owner on public.promotion_campaigns for select using(auth.uid()=user_id);
drop policy if exists promotion_campaigns_insert_owner on public.promotion_campaigns;
create policy promotion_campaigns_insert_owner on public.promotion_campaigns for insert with check(
  auth.uid()=user_id and exists(select 1 from public.songs where id=promotion_campaigns.song_id and artist_id=auth.uid())
);
drop policy if exists promotion_campaigns_update_owner on public.promotion_campaigns;
create policy promotion_campaigns_update_owner on public.promotion_campaigns for update
using(auth.uid()=user_id) with check(
  auth.uid()=user_id and exists(select 1 from public.songs where id=promotion_campaigns.song_id and artist_id=auth.uid())
);
drop policy if exists promotion_campaigns_delete_owner on public.promotion_campaigns;
create policy promotion_campaigns_delete_owner on public.promotion_campaigns for delete using(auth.uid()=user_id);

do $read_policies$
declare item record;
begin
  for item in select * from (values
    ('leaderboard_seasons_read_all','leaderboard_seasons'),
    ('leaderboard_snapshots_read_all','leaderboard_season_snapshots'),
    ('leaderboard_badges_read_all','leaderboard_badges'),
    ('leaderboard_badge_awards_read_all','leaderboard_badge_awards')
  ) as t(policy_name,table_name) loop
    execute format('drop policy if exists %I on public.%I',item.policy_name,item.table_name);
    execute format('create policy %I on public.%I for select using (true)',item.policy_name,item.table_name);
  end loop;
end $read_policies$;

insert into public.label_deal_types(
  name,description,default_artist_royalty,default_label_royalty,
  includes_advance,includes_360,masters_owned_by_artist,
  default_term_months,default_release_quota
)
select * from (values
  ('Traditional'::text,'Standard royalty split with optional advances and label-owned masters.'::text,20::numeric,80::numeric,true,false,false,24,3),
  ('360 Deal'::text,'Label participates in touring and merchandise revenue.'::text,25::numeric,75::numeric,true,true,false,36,4),
  ('Distribution'::text,'Artist retains masters and handles marketing with label support services.'::text,80::numeric,20::numeric,false,false,true,12,1)
) seed(name,description,default_artist_royalty,default_label_royalty,includes_advance,includes_360,masters_owned_by_artist,default_term_months,default_release_quota)
where not exists(select 1 from public.label_deal_types existing where lower(existing.name)=lower(seed.name));

insert into public.territories(code,name,region) values
('US','United States','North America'),('UK','United Kingdom','Europe'),
('BR','Brazil','South America'),('JP','Japan','Asia'),('SE','Sweden','Europe')
on conflict(code) do update set name=excluded.name,region=excluded.region;

grant select on public.leaderboard_seasons to anon,authenticated;
grant select on public.leaderboard_season_snapshots to anon,authenticated;
grant select on public.leaderboard_badges to anon,authenticated;
grant select on public.leaderboard_badge_awards to anon,authenticated;
