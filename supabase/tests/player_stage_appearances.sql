-- Non-destructive authorization and validation checks. All appearance writes roll back.
begin;
do $$
declare owner_id uuid; first_profile uuid; second_profile uuid; other_profile uuid;
begin
  select p.user_id, min(p.id::text)::uuid into owner_id, first_profile
  from public.profiles p where p.user_id is not null and not exists (select 1 from public.player_stage_appearances a where a.profile_id = p.id)
  group by p.user_id order by count(*) desc limit 1;
  select p.id into second_profile from public.profiles p where p.user_id = owner_id and p.id <> first_profile and not exists (select 1 from public.player_stage_appearances a where a.profile_id = p.id) limit 1;
  select p.id into other_profile from public.profiles p where p.user_id <> owner_id and not exists (select 1 from public.player_stage_appearances a where a.profile_id = p.id) limit 1;
  if owner_id is null or second_profile is null or other_profile is null then raise exception 'Harness requires two characters for one user and a character owned by another user'; end if;
  perform set_config('test.stage_own', first_profile::text, true);
  perform set_config('test.stage_second', second_profile::text, true);
  perform set_config('test.stage_other', other_profile::text, true);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  perform set_config('test.stage_appearance', '{"version":1,"body":{"frame":"feminine","height":1,"build":1,"skin":"#a96f46"},"head":{"style":"punk","hair":"#282027"},"equipment":{"top":{"itemId":"starter.top.suit","color":"#436477"},"bottom":{"itemId":"starter.bottom.punk","color":"#272e39"},"footwear":{"itemId":"starter.footwear.casual","color":"#25232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#b97536"}}}', true);
  insert into public.player_stage_appearances(profile_id,appearance) values (other_profile,current_setting('test.stage_appearance')::jsonb);
end $$;
set local role authenticated;
do $$
declare a jsonb := current_setting('test.stage_appearance')::jsonb; n integer; r integer; bad jsonb;
begin
  insert into public.player_stage_appearances(profile_id,appearance,revision) values (current_setting('test.stage_own')::uuid,a,123), (current_setting('test.stage_second')::uuid,jsonb_set(a,'{body,skin}','"#593a2d"'),123);
  select count(*) into n from public.player_stage_appearances where profile_id in (current_setting('test.stage_own')::uuid,current_setting('test.stage_second')::uuid,current_setting('test.stage_other')::uuid);
  if n <> 3 then raise exception 'Public cosmetic reads or owner character writes failed'; end if;
  select revision into r from public.player_stage_appearances where profile_id = current_setting('test.stage_own')::uuid;
  if r <> 1 then raise exception 'Client controlled initial revision'; end if;
  update public.player_stage_appearances set appearance = jsonb_set(a,'{head,hair}','"#ffffff"'), revision = 999 where profile_id = current_setting('test.stage_own')::uuid and revision = 1;
  select revision into r from public.player_stage_appearances where profile_id = current_setting('test.stage_own')::uuid;
  if r <> 2 then raise exception 'Server revision did not advance exactly once'; end if;
  update public.player_stage_appearances set appearance = a where profile_id = current_setting('test.stage_own')::uuid and revision = 1;
  get diagnostics n = row_count; if n <> 0 then raise exception 'Stale save overwrote a newer model'; end if;
  update public.player_stage_appearances set appearance = a where profile_id = current_setting('test.stage_other')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'Another player model was writable'; end if;
  begin
    insert into public.player_stage_appearances(profile_id,appearance) values(current_setting('test.stage_other')::uuid,a);
    raise exception 'Another player model insert was accepted';
  exception when insufficient_privilege then null; end;
  foreach bad in array array[
    jsonb_set(a,'{equipment,top,itemId}','"paid.exclusive"'),
    jsonb_set(a,'{equipment,top,itemId}','"https://example.com/model.glb"'),
    jsonb_set(a,'{body,height}','100'), jsonb_set(a,'{body,height}','null'),
    jsonb_set(a,'{head,style}','null'), jsonb_set(a,'{body,frame}','null'),
    jsonb_set(a,'{body,skin}','"red"'), jsonb_set(a,'{version}','2'), a || '{"bonus":100}', 'null'::jsonb
  ] loop
    if public.is_valid_player_stage_appearance(bad) is distinct from false then raise exception 'Invalid appearance validation was not false'; end if;
    begin
      update public.player_stage_appearances set appearance = bad where profile_id = current_setting('test.stage_own')::uuid;
      raise exception 'Invalid appearance passed the table constraint';
    exception when check_violation then null; end;
  end loop;
  if (select appearance->'body'->>'skin' from public.player_stage_appearances where profile_id = current_setting('test.stage_second')::uuid) <> '#593a2d' then raise exception 'Second character appearance changed'; end if;
  begin
    delete from public.player_stage_appearances where profile_id = current_setting('test.stage_own')::uuid;
    raise exception 'Client delete was accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from public.player_stage_appearances;
    raise exception 'Anonymous appearance access was accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: owner and second-character saves; public authenticated cosmetic reads; denied cross-owner writes and anonymous reads; server revisions; stale-save protection; invalid item/color/body/schema rejection. All writes rolled back.' as stage_appearance_gate;
