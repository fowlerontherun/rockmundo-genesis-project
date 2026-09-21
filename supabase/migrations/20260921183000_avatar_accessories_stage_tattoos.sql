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
     or (select count(*) from jsonb_object_keys(obj)) <> 4
     or not (obj ?& array['frame','height','build','skin'])
     or obj->>'frame' not in ('masculine','feminine')
     or jsonb_typeof(obj->'height') <> 'number'
     or (obj->>'height')::numeric not between 0.9 and 1.1
     or jsonb_typeof(obj->'build') <> 'number'
     or (obj->>'build')::numeric not between 0.85 and 1.15
     or not coalesce(obj->>'skin' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;

  obj := value->'head';
  if jsonb_typeof(obj) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(obj) as keys(key)
       where key not in ('style','hair','hairStyle','facialHair','facialHairColor')
     )
     or not (obj ?& array['style','hair'])
     or obj->>'style' not in ('casual','punk','suit')
     or not coalesce(obj->>'hair' ~ '^#[0-9a-fA-F]{6}$', false)
  then return false; end if;
  if obj ? 'hairStyle'
     and not coalesce(obj->>'hairStyle' = any(array['original','bald','buzz','quiff','mohawk','bob','shoulder','layered_long','long_waves','ponytail','high_ponytail','side_braid','twin_ponytails','bun','curls','long']), false)
  then return false; end if;
  if obj ? 'facialHair'
     and not coalesce(obj->>'facialHair' = any(array['none','stubble','moustache','goatee','short_beard','full_beard','long_beard','sideburns']), false)
  then return false; end if;
  if obj ? 'facialHairColor'
     and not coalesce(obj->>'facialHairColor' ~ '^#[0-9a-fA-F]{6}$', false)
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
      when 'top' then array['starter.top.casual','starter.top.punk','starter.top.suit','starter.top.stripe','starter.top.plaid','starter.top.pinstripe']
      when 'bottom' then array['starter.bottom.casual','starter.bottom.punk','starter.bottom.suit','starter.bottom.denim','starter.bottom.plaid','starter.bottom.pinstripe']
      when 'footwear' then array['starter.footwear.casual','starter.footwear.punk','starter.footwear.suit','starter.footwear.canvas','starter.footwear.two-tone','starter.footwear.patent']
      else array[]::text[] end))
    then return false; end if;
  end loop;

  if value ? 'accessories' then
    obj := value->'accessories';
    if jsonb_typeof(obj) <> 'object'
       or (select count(*) from jsonb_object_keys(obj)) <> 4
       or not (obj ?& array['hat','hatColor','glasses','glassesColor'])
       or not coalesce(obj->>'hat' = any(array['none','beanie','baseball_cap','bucket_hat','fedora']), false)
       or not coalesce(obj->>'glasses' = any(array['none','round','square','aviator','sunglasses']), false)
       or not coalesce(obj->>'hatColor' ~ '^#[0-9a-fA-F]{6}$', false)
       or not coalesce(obj->>'glassesColor' ~ '^#[0-9a-fA-F]{6}$', false)
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

create or replace function public.get_stage_tattoo_visuals(p_profile_ids uuid[])
returns table (
  profile_id uuid,
  id uuid,
  body_slot text,
  ink_color text,
  quality_score integer,
  is_infected boolean,
  category text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     and coalesce((select auth.jwt()->>'role'), '') <> 'service_role'
  then
    raise exception 'Authentication required';
  end if;

  if coalesce(cardinality(p_profile_ids), 0) = 0 then
    return;
  end if;
  if cardinality(p_profile_ids) > 64 then
    raise exception 'Too many profiles requested';
  end if;

  return query
    select
      pt.profile_id,
      pt.id,
      pt.body_slot,
      pt.ink_color,
      greatest(0, least(100, pt.quality_score)),
      pt.is_infected,
      coalesce(td.category, 'custom')
    from public.player_tattoos as pt
    left join public.tattoo_designs as td on td.id = pt.tattoo_design_id
    where pt.profile_id is not null
      and pt.profile_id = any(p_profile_ids)
    order by pt.profile_id, pt.applied_at, pt.id;
end;
$$;

revoke all on function public.get_stage_tattoo_visuals(uuid[]) from public, anon;
grant execute on function public.get_stage_tattoo_visuals(uuid[]) to authenticated, service_role;

comment on function public.get_stage_tattoo_visuals(uuid[]) is
  'Returns only public stage-render tattoo cosmetics for requested profiles. Purchase, artist, price, text and minigame data are intentionally omitted.';


-- Future Top of the Pops archives freeze tattoo visuals alongside appearance/clothing.
-- Older replay snapshots remain readable because the client treats this field as optional.
create or replace function public.totp_lock_performer_visual_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member jsonb;
  v_members jsonb := '[]'::jsonb;
  v_profile_id uuid;
  v_appearance jsonb;
  v_legacy jsonb;
  v_clothing jsonb;
  v_tattoos jsonb;
begin
  for v_member in
    select value
    from jsonb_array_elements(coalesce(new.payload #> '{band,members}', '[]'::jsonb))
  loop
    v_profile_id := null;
    begin
      v_profile_id := nullif(v_member->>'profile_id','')::uuid;
    exception when invalid_text_representation then
      v_profile_id := null;
    end;

    v_appearance := null;
    v_legacy := null;
    v_clothing := '[]'::jsonb;
    v_tattoos := '[]'::jsonb;

    if v_profile_id is not null then
      select psa.appearance
      into v_appearance
      from public.player_stage_appearances psa
      where psa.profile_id = v_profile_id
      limit 1;

      if v_appearance is null then
        select jsonb_build_object(
          'gender', pac.gender,
          'skin_tone', pac.skin_tone,
          'hair_color', pac.hair_color,
          'height', pac.height,
          'shirt_color', pac.shirt_color,
          'pants_color', pac.pants_color,
          'shoes_color', pac.shoes_color
        )
        into v_legacy
        from public.player_avatar_config pac
        where pac.profile_id = v_profile_id
        limit 1;
      end if;

      select coalesce(jsonb_agg(jsonb_build_object(
        'item', to_jsonb(aci),
        'selectedVariantKey', pos.selected_variant_key,
        'customizationConfig', coalesce(pos.customization_config, '{}'::jsonb)
      ) order by public.clothing_equip_slot(aci.wearable_slot, aci.category), pos.item_id), '[]'::jsonb)
      into v_clothing
      from public.player_owned_skins pos
      join public.avatar_clothing_items aci on aci.id = pos.item_id
      where pos.profile_id = v_profile_id
        and pos.item_type = 'clothing'
        and pos.is_equipped = true;

      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pt.id,
        'profile_id', pt.profile_id,
        'body_slot', pt.body_slot,
        'ink_color', pt.ink_color,
        'quality_score', greatest(0, least(100, pt.quality_score)),
        'is_infected', pt.is_infected,
        'category', coalesce(td.category, 'custom')
      ) order by pt.applied_at, pt.id), '[]'::jsonb)
      into v_tattoos
      from public.player_tattoos pt
      left join public.tattoo_designs td on td.id = pt.tattoo_design_id
      where pt.profile_id = v_profile_id;
    end if;

    v_members := v_members || jsonb_build_array(
      v_member || jsonb_build_object(
        'visual_snapshot', jsonb_build_object(
          'appearance', v_appearance,
          'legacyAvatar', v_legacy,
          'richClothing', v_clothing,
          'tattoos', v_tattoos
        )
      )
    );
  end loop;

  new.payload := jsonb_set(new.payload, '{band,members}', v_members, true);
  new.payload := new.payload || jsonb_build_object(
    'visualSnapshotVersion', 2,
    'visualSnapshotLockedAt', now()
  );
  new.replay_version := greatest(4, new.replay_version);
  new.checksum := md5(new.payload::text);
  return new;
end;
$$;

revoke all on function public.totp_lock_performer_visual_snapshot() from public, anon, authenticated;

comment on function public.totp_lock_performer_visual_snapshot() is
  'Freezes render-only performer appearance, equipped clothing and tattoo visuals into canonical TOTP replay v4. Purchase, artist and private tattoo metadata are excluded.';
