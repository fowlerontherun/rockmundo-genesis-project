-- Read-only validation for avatar accessories and the public stage tattoo projection.
begin;

do $$
declare
  a jsonb := '{"version":1,"body":{"frame":"masculine","height":1,"build":1,"skin":"#a96f46"},"head":{"style":"casual","hair":"#54372a"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#436477"},"bottom":{"itemId":"starter.bottom.casual","color":"#272e39"},"footwear":{"itemId":"starter.footwear.casual","color":"#25232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#b97536"}}}';
  valid_accessories jsonb := '{"accessories":{"hat":"bucket_hat","hatColor":"#20232b","glasses":"aviator","glassesColor":"#d8ad49","earrings":"hoops","earringColor":"#d8ad49"}}';
begin
  if public.is_valid_player_stage_appearance(a) is distinct from true then raise exception 'Legacy v1 appearance rejected'; end if;
  if public.is_valid_player_stage_appearance(a || valid_accessories) is distinct from true then raise exception 'Valid accessories rejected'; end if;
  if public.is_valid_player_stage_appearance(a || '{"accessories":{"hat":"crown","hatColor":"#20232b","glasses":"aviator","glassesColor":"#d8ad49"}}') is distinct from false then raise exception 'Unknown hat accepted'; end if;
  if public.is_valid_player_stage_appearance(a || '{"accessories":{"hat":"beanie","hatColor":"red","glasses":"none","glassesColor":"#20232b"}}') is distinct from false then raise exception 'Invalid accessory colour accepted'; end if;
  if public.is_valid_player_stage_appearance(a || '{"accessories":{"hat":"none","hatColor":"#20232b","glasses":"none","glassesColor":"#20232b","earrings":"chains"}}') is distinct from false then raise exception 'Unknown earring style accepted'; end if;
  if public.is_valid_player_stage_appearance(a || '{"accessories":{"hat":"none","hatColor":"#20232b","glasses":"none","glassesColor":"#20232b","url":"https://example.com"}}') is distinct from false then raise exception 'Extra accessory property accepted'; end if;
end $$;

do $$
declare
  v_profile uuid;
  v_user uuid;
  expected integer;
begin
  select pt.profile_id, p.user_id
  into v_profile, v_user
  from public.player_tattoos pt
  join public.profiles p on p.id = pt.profile_id
  where pt.profile_id is not null and p.user_id is not null
  limit 1;

  if v_profile is null then
    select p.id, p.user_id into v_profile, v_user
    from public.profiles p
    where p.user_id is not null
    limit 1;
  end if;

  select count(*) into expected from public.player_tattoos where profile_id = v_profile;
  perform set_config('test.avatar_tattoo_profile', v_profile::text, true);
  perform set_config('test.avatar_tattoo_expected', expected::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n
  from public.get_stage_tattoo_visuals(array[current_setting('test.avatar_tattoo_profile')::uuid]);
  if n <> current_setting('test.avatar_tattoo_expected')::integer then
    raise exception 'Authenticated stage tattoo projection returned the wrong count';
  end if;
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.get_stage_tattoo_visuals(array[current_setting('test.avatar_tattoo_profile')::uuid]);
    raise exception 'Anonymous stage tattoo projection call was accepted';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
select 'PASS: legacy/accessory validation, strict accessory allow-list, authenticated tattoo projection and anonymous denial' as avatar_accessory_tattoo_gate;
