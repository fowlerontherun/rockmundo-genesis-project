-- Rollback-only regression checks: no player appearance, cash or inventory persists.
begin;
do $$
declare
  base jsonb := '{"version":1,"body":{"frame":"masculine","height":1,"build":1,"skin":"#c58c63"},"head":{"style":"casual","hair":"#54372a"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#20232b"},"bottom":{"itemId":"starter.bottom.casual","color":"#20232b"},"footwear":{"itemId":"starter.footwear.casual","color":"#20232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#20232b"}}}';
  value jsonb; hat text; glasses text; tint text; invalid jsonb;
begin
  if public.is_valid_player_stage_appearance(base) is not true then raise exception 'Legacy appearance rejected'; end if;
  foreach hat in array array['none','beanie','baseball_cap','bucket_hat','fedora','cowboy'] loop
    foreach glasses in array array['none','round','square','aviator','sunglasses'] loop
      foreach tint in array array['clear','tinted'] loop
        value := base || jsonb_build_object('accessories',jsonb_build_object('hat',hat,'hatColor','#338b8d','glasses',glasses,'glassesColor','#d8ad49','lensTint',tint,'lensColor','#40566d'));
        if public.is_valid_player_stage_appearance(value) is not true then raise exception 'Accessory combination rejected: %/%/%',hat,glasses,tint; end if;
        if public.is_valid_player_stage_appearance(jsonb_set(value,'{body,frame}','"feminine"')) is not true then raise exception 'Feminine appearance rejected'; end if;
      end loop;
    end loop;
  end loop;
  foreach invalid in array array['{"lensTint":"opaque"}'::jsonb,'{"lensColor":null}'::jsonb,'{"lensColor":"red"}'::jsonb,'{"hat":"paid-item-id"}'::jsonb,'{"extra":true}'::jsonb] loop
    if public.is_valid_player_stage_appearance(jsonb_set(value,'{accessories}',value->'accessories' || invalid)) is not false then raise exception 'Invalid accessory accepted: %',invalid; end if;
  end loop;
  if (select count(*) from public.player_stage_appearances where public.is_valid_player_stage_appearance(appearance) is not true) <> 0 then raise exception 'Existing saved appearances rejected'; end if;
end;
$$;

-- Reuse existing profiles only as ownership identities. Everything written below
-- is a synthetic test item inside this transaction and is rolled back.
do $$
declare owner_profile uuid; owner_user uuid; other_profile uuid; item uuid := gen_random_uuid(); other_item uuid := gen_random_uuid();
begin
  select id,user_id into owner_profile,owner_user from public.profiles where user_id is not null order by id limit 1;
  select id into other_profile from public.profiles where user_id <> owner_user order by id limit 1;
  if owner_profile is null or other_profile is null then raise exception 'Two profile owners are required for inventory checks'; end if;
  insert into public.avatar_clothing_items(id,name,category,wearable_slot) values(item,'Accessory test fixture','accessory','headwear'),(other_item,'Second accessory test fixture','accessory','headwear');
  insert into public.player_owned_skins(profile_id,item_type,item_id,is_equipped) values(owner_profile,'clothing',item,false),(owner_profile,'clothing',other_item,true);
  perform set_config('request.jwt.claim.sub',owner_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_user,'role','authenticated')::text,true);
  set local role authenticated;
  perform public.set_owned_clothing_customization(owner_profile,item,null,'{}',true);
  if not exists(select 1 from public.get_equipped_stage_clothing(array[owner_profile]) r where r.item_id=item) then raise exception 'Owned accessory did not equip'; end if;
  if exists(select 1 from public.get_equipped_stage_clothing(array[owner_profile]) r where r.item_id=other_item) then raise exception 'Slot conflict was not cleared'; end if;
  begin
    perform public.set_owned_clothing_customization(other_profile,item,null,'{}',true);
    raise exception 'Cross-owner equip accepted';
  exception when others then
    if sqlerrm <> 'You cannot customize clothing for this character' then raise; end if;
  end;
  perform public.set_owned_clothing_customization(owner_profile,item,null,'{}',false);
  if exists(select 1 from public.get_equipped_stage_clothing(array[owner_profile]) r where r.item_id=item) then raise exception 'Accessory did not unequip'; end if;
  reset role;
end;
$$;
rollback;
