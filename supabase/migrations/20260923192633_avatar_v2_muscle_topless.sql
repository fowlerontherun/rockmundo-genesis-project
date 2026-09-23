-- Avatar V2 body expansion: optional muscle definition and a free topless starter state.
-- Existing version-1 appearances remain valid when body.muscle is absent.
-- Avatar fitting-room polish: more hair choices and independent earrings.
-- Backward compatible with existing version-1 appearances.
-- Optional lens controls and cowboy hat; all existing saved appearances remain valid.
-- Phase 3 avatar detail: extend version-1 head cosmetics without rewriting legacy appearances.
-- These fields are optional so every existing saved avatar remains valid.

-- Join free avatar accessories and owned tattoo visuals into the shared stage model.
-- Existing version-1 appearances remain valid: accessories are optional for old rows.

create or replace function public.is_valid_player_stage_appearance(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  slot text;
  item text;
  obj jsonb;
begin
  if jsonb_typeof(value) <> 'object'
     or value->>'version' <> '1'
     or exists (
       select 1 from jsonb_object_keys(value) as keys(key)
       where key not in ('version','body','head','equipment','accessories')
     )
     or not (value ?& array['version','body','head','equipment'])
  then return false; end if;

  obj := value->'body';
  if jsonb_typeof(obj) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(obj) as keys(key)
       where key not in ('frame','height','build','muscle','skin')
     )
     or not (obj ?& array['frame','height','build','skin'])
     or obj->>'frame' not in ('masculine','feminine')
     or jsonb_typeof(obj->'height') <> 'number'
     or (obj->>'height')::numeric not between 0.9 and 1.1
     or jsonb_typeof(obj->'build') <> 'number'
     or (obj->>'build')::numeric not between 0.85 and 1.15
     or not coalesce(obj->>'skin' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'muscle'
     and not coalesce(obj->>'muscle' = any(array['natural','toned','athletic','muscular','bodybuilder']), false)
  then return false; end if;

  obj := value->'head';
  if jsonb_typeof(obj) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(obj) as keys(key)
       where key not in ('style','hair','hairStyle','facialHair','facialHairColor','faceShape','eyeColor','eyebrowStyle','eyebrowColor','skinDetail')
     )
     or not (obj ?& array['style','hair'])
     or obj->>'style' not in ('casual','punk','suit')
     or not coalesce(obj->>'hair' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'hairStyle'
     and not coalesce(obj->>'hairStyle' = any(array['original','bald','buzz','quiff','mohawk','faux_hawk','undercut','slick_back','side_part','curtain','pixie','bob','shoulder','shag','mullet','layered_long','long_waves','long','ponytail','high_ponytail','side_braid','box_braids','cornrows','locs_short','locs_long','twin_ponytails','bun','messy_bun','space_buns','curls','afro','afro_puffs']), false)
  then return false; end if;
  if obj ? 'facialHair'
     and not coalesce(obj->>'facialHair' = any(array['none','stubble','moustache','goatee','short_beard','full_beard','long_beard','sideburns']), false)
  then return false; end if;
  if obj ? 'facialHairColor'
     and not coalesce(obj->>'facialHairColor' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'faceShape'
     and not coalesce(obj->>'faceShape' = any(array['classic','oval','angular','soft','wide']), false)
  then return false; end if;
  if obj ? 'eyeColor'
     and not coalesce(obj->>'eyeColor' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'eyebrowStyle'
     and not coalesce(obj->>'eyebrowStyle' = any(array['natural','straight','arched','bold','soft']), false)
  then return false; end if;
  if obj ? 'eyebrowColor'
     and not coalesce(obj->>'eyebrowColor' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'skinDetail'
     and not coalesce(obj->>'skinDetail' = any(array['smooth','freckles','beauty_marks','weathered']), false)
  then return false; end if;

  obj := value->'equipment';
  if jsonb_typeof(obj) <> 'object'
     or (select count(*) from jsonb_object_keys(obj)) <> 4
     or not (obj ?& array['top','bottom','footwear','instrument'])
  then return false; end if;
  foreach slot in array array['top','bottom','footwear','instrument'] loop
    obj := value->'equipment'->slot;
    item := obj->>'itemId';
    if jsonb_typeof(obj) <> 'object'
       or (select count(*) from jsonb_object_keys(obj)) <> 2
       or not (obj ?& array['itemId','color'])
       or not coalesce(obj->>'color' ~ '^#[0-9a-fA-F]{6}$', false)
    then return false; end if;
    if slot = 'instrument' then
      if item is distinct from 'starter.instrument.standard' then return false; end if;
    elsif item is null or not (item = any(case slot
      when 'top' then array['starter.top.casual','starter.top.topless','starter.top.punk','starter.top.suit','starter.top.stripe','starter.top.plaid','starter.top.pinstripe']
      when 'bottom' then array['starter.bottom.casual','starter.bottom.punk','starter.bottom.suit','starter.bottom.denim','starter.bottom.plaid','starter.bottom.pinstripe']
      when 'footwear' then array['starter.footwear.casual','starter.footwear.punk','starter.footwear.suit','starter.footwear.canvas','starter.footwear.two-tone','starter.footwear.patent']
      else array[]::text[] end))
    then return false; end if;
  end loop;

  if value ? 'accessories' then
    obj := value->'accessories';
    if jsonb_typeof(obj) <> 'object'
       or exists (
         select 1 from jsonb_object_keys(obj) as keys(key)
         where key not in ('hat','hatColor','glasses','glassesColor','earrings','leftEarring','rightEarring','earringColor','lensTint','lensColor')
       )
       or not (obj ?& array['hat','hatColor','glasses','glassesColor'])
       or not coalesce(obj->>'hat' = any(array['none','beanie','baseball_cap','bucket_hat','fedora','cowboy']), false)
       or not coalesce(obj->>'glasses' = any(array['none','round','square','aviator','sunglasses']), false)
       or not coalesce(obj->>'hatColor' ~ '^#[0-9a-fA-F]{6}$', false)
       or not coalesce(obj->>'glassesColor' ~ '^#[0-9a-fA-F]{6}$', false)
    then return false; end if;
    if obj ? 'lensTint' and not coalesce(obj->>'lensTint' in ('clear','tinted'), false) then return false; end if;
    if obj ? 'lensColor' and not coalesce(obj->>'lensColor' ~ '^#[0-9a-fA-F]{6}$', false) then return false; end if;
    if obj ? 'earrings'
       and not coalesce(obj->>'earrings' = any(array['none','studs','hoops','drops']), false)
    then return false; end if;
    if obj ? 'leftEarring'
       and not coalesce(obj->>'leftEarring' = any(array['none','studs','hoops','drops']), false)
    then return false; end if;
    if obj ? 'rightEarring'
       and not coalesce(obj->>'rightEarring' = any(array['none','studs','hoops','drops']), false)
    then return false; end if;
    if obj ? 'earringColor'
       and not coalesce(obj->>'earringColor' ~ '^#[0-9a-fA-F]{6}$', false)
    then return false; end if;
  end if;

  return jsonb_typeof(value->'version') = 'number'
    and jsonb_typeof(value->'body'->'frame') = 'string'
    and jsonb_typeof(value->'body'->'height') = 'number'
    and jsonb_typeof(value->'body'->'build') = 'number'
    and jsonb_typeof(value->'head'->'style') = 'string';
exception when others then
  return false;
end;
$$;

NOTIFY pgrst, 'reload schema';
