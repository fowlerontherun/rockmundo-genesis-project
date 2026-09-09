-- Public cosmetic identity, separate from private avatar/provider metadata.
-- Starter equipment is free. Future unlocks require server ownership validation.
create or replace function public.is_valid_player_stage_appearance(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare slot text; item text; obj jsonb;
begin
  if jsonb_typeof(value) <> 'object' or value->>'version' <> '1'
     or (select count(*) from jsonb_object_keys(value)) <> 4
     or not (value ?& array['version','body','head','equipment']) then return false; end if;
  obj := value->'body';
  if jsonb_typeof(obj) <> 'object' or (select count(*) from jsonb_object_keys(obj)) <> 4
     or not (obj ?& array['frame','height','build','skin'])
     or obj->>'frame' not in ('masculine','feminine')
     or jsonb_typeof(obj->'height') <> 'number' or (obj->>'height')::numeric not between 0.9 and 1.1
     or jsonb_typeof(obj->'build') <> 'number' or (obj->>'build')::numeric not between 0.85 and 1.15
     or not coalesce(obj->>'skin' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
  obj := value->'head';
  if jsonb_typeof(obj) <> 'object' or (select count(*) from jsonb_object_keys(obj)) <> 2
     or not (obj ?& array['style','hair']) or obj->>'style' not in ('casual','punk','suit')
     or not coalesce(obj->>'hair' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
  obj := value->'equipment';
  if jsonb_typeof(obj) <> 'object' or (select count(*) from jsonb_object_keys(obj)) <> 4
     or not (obj ?& array['top','bottom','footwear','instrument']) then return false; end if;
  foreach slot in array array['top','bottom','footwear','instrument'] loop
    obj := value->'equipment'->slot; item := obj->>'itemId';
    if jsonb_typeof(obj) <> 'object' or (select count(*) from jsonb_object_keys(obj)) <> 2
       or not (obj ?& array['itemId','color'])
       or not coalesce(obj->>'color' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
    if slot = 'instrument' then
      if item is distinct from 'starter.instrument.standard' then return false; end if;
    elsif item is null or item not in ('starter.' || slot || '.casual', 'starter.' || slot || '.punk', 'starter.' || slot || '.suit') then return false;
    end if;
  end loop;
  -- JSON nulls are not valid selections or numeric body parameters.
  return jsonb_typeof(value->'version') = 'number'
    and jsonb_typeof(value->'body'->'frame') = 'string'
    and jsonb_typeof(value->'body'->'height') = 'number'
    and jsonb_typeof(value->'body'->'build') = 'number'
    and jsonb_typeof(value->'head'->'style') = 'string';
exception when others then return false;
end;
$$;

create table public.player_stage_appearances (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  appearance jsonb not null check (public.is_valid_player_stage_appearance(appearance)),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_stage_appearances enable row level security;
revoke all on public.player_stage_appearances from public, anon, authenticated;
grant select, insert, update on public.player_stage_appearances to authenticated;
grant all on public.player_stage_appearances to service_role;
create policy "Signed in players can see stage appearances" on public.player_stage_appearances
  for select to authenticated using (true);
create policy "Players create their own stage appearance" on public.player_stage_appearances
  for insert to authenticated with check (profile_id in (select id from public.profiles where user_id = (select auth.uid())));
create policy "Players update their own stage appearance" on public.player_stage_appearances
  for update to authenticated using (profile_id in (select id from public.profiles where user_id = (select auth.uid())))
  with check (profile_id in (select id from public.profiles where user_id = (select auth.uid())));

create or replace function public.stamp_player_stage_appearance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.profile_id := old.profile_id; new.created_at := old.created_at; new.revision := old.revision + 1;
  else new.revision := 1; new.created_at := now(); end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger stamp_player_stage_appearance before insert or update on public.player_stage_appearances
  for each row execute function public.stamp_player_stage_appearance();
revoke all on function public.stamp_player_stage_appearance() from public, anon, authenticated;
comment on table public.player_stage_appearances is 'Versioned public cosmetic model per character. No provider URLs, photos, financial data or gameplay bonuses. Equipment IDs currently permit free starter items only.';
