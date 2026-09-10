-- Extend the existing version-1 avatar appearance allow-list with the new free hairstyles.
-- This is additive only: existing appearances, ownership checks, equipment IDs and RLS are unchanged.
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
  if jsonb_typeof(obj) <> 'object' or exists (select 1 from jsonb_object_keys(obj) as keys(key) where key not in ('style','hair','hairStyle','facialHair','facialHairColor'))
     or not (obj ?& array['style','hair']) or obj->>'style' not in ('casual','punk','suit')
     or not coalesce(obj->>'hair' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
  if obj ? 'hairStyle' and not coalesce(obj->>'hairStyle' = any(array['original','bald','buzz','quiff','mohawk','bob','shoulder','layered_long','long_waves','ponytail','high_ponytail','side_braid','twin_ponytails','bun','curls','long']), false) then return false; end if;
  if obj ? 'facialHair' and not coalesce(obj->>'facialHair' = any(array['none','stubble','moustache','goatee','short_beard','full_beard','long_beard','sideburns']), false) then return false; end if;
  if obj ? 'facialHairColor' and not coalesce(obj->>'facialHairColor' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
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
    elsif item is null or not (item = any(case slot
      when 'top' then array['starter.top.casual','starter.top.punk','starter.top.suit','starter.top.stripe','starter.top.plaid','starter.top.pinstripe']
      when 'bottom' then array['starter.bottom.casual','starter.bottom.punk','starter.bottom.suit','starter.bottom.denim','starter.bottom.plaid','starter.bottom.pinstripe']
      when 'footwear' then array['starter.footwear.casual','starter.footwear.punk','starter.footwear.suit','starter.footwear.canvas','starter.footwear.two-tone','starter.footwear.patent']
      else array[]::text[] end)) then return false;
    end if;
  end loop;
  return jsonb_typeof(value->'version') = 'number'
    and jsonb_typeof(value->'body'->'frame') = 'string'
    and jsonb_typeof(value->'body'->'height') = 'number'
    and jsonb_typeof(value->'body'->'build') = 'number'
    and jsonb_typeof(value->'head'->'style') = 'string';
exception when others then return false;
end;
$$;
