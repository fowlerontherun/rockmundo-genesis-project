-- Read-only compatibility and allow-list verification; no player records change.
do $$
declare a jsonb := '{"version":1,"body":{"frame":"masculine","height":1,"build":1,"skin":"#a96f46"},"head":{"style":"casual","hair":"#54372a"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#436477"},"bottom":{"itemId":"starter.bottom.casual","color":"#272e39"},"footwear":{"itemId":"starter.footwear.casual","color":"#25232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#b97536"}}}';
frame text; hair text; beard text; candidate jsonb; n integer := 0; field text;
begin
  if public.is_valid_player_stage_appearance(a) is distinct from true then raise exception 'Legacy appearance rejected'; end if;
  foreach frame in array array['masculine','feminine'] loop
    foreach hair in array array['original','bald','buzz','quiff','mohawk','bob','shoulder','layered_long','long_waves','ponytail','high_ponytail','side_braid','twin_ponytails','bun','curls','long'] loop
      foreach beard in array array['none','stubble','moustache','goatee','short_beard','full_beard','long_beard','sideburns'] loop
        candidate := jsonb_set(jsonb_set(a,'{body,frame}',to_jsonb(frame)),'{head}',a->'head' || jsonb_build_object('hairStyle',hair,'facialHair',beard,'facialHairColor','#b75e32'));
        if public.is_valid_player_stage_appearance(candidate) is distinct from true then raise exception 'Valid hair rejected: % % %',frame,hair,beard; end if;
        candidate := candidate #- '{head,facialHairColor}';
        if public.is_valid_player_stage_appearance(candidate) is distinct from true then raise exception 'Matching hair colour rejected'; end if;
        n := n+1;
      end loop;
    end loop;
  end loop;
  foreach field in array array['hairStyle','facialHair','facialHairColor'] loop
    candidate := jsonb_set(a,array['head',field],'null');
    if public.is_valid_player_stage_appearance(candidate) is distinct from false then raise exception 'JSON null accepted for %',field; end if;
    candidate := jsonb_set(a,array['head',field],'"https://example.com/model.glb"');
    if public.is_valid_player_stage_appearance(candidate) is distinct from false then raise exception 'Invalid value accepted for %',field; end if;
  end loop;
  candidate := jsonb_set(a,'{head,unlocked}','true');
  if public.is_valid_player_stage_appearance(candidate) is distinct from false then raise exception 'Extra head property accepted'; end if;
  if n <> 256 then raise exception 'Incomplete style coverage'; end if;
end $$;
select 'PASS: 256 hair/beard/frame combinations, matching colour, legacy data and invalid-input rejection' as result;
