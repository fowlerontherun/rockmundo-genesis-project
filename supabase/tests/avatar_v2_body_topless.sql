-- Rollback-only regression checks for Avatar V2 body options.
begin;
do $$
declare
  legacy jsonb := '{"version":1,"body":{"frame":"masculine","height":1,"build":1,"skin":"#c58c63"},"head":{"style":"casual","hair":"#54372a"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#20232b"},"bottom":{"itemId":"starter.bottom.casual","color":"#20232b"},"footwear":{"itemId":"starter.footwear.casual","color":"#20232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#20232b"}}}';
  value jsonb;
  muscle text;
begin
  if public.is_valid_player_stage_appearance(legacy) is not true then
    raise exception 'Legacy appearance without muscle field was rejected';
  end if;

  foreach muscle in array array['natural','toned','athletic','muscular','bodybuilder'] loop
    value := jsonb_set(legacy, '{body}', legacy->'body' || jsonb_build_object('muscle', muscle));
    value := jsonb_set(value, '{equipment,top,itemId}', '"starter.top.topless"');
    if public.is_valid_player_stage_appearance(value) is not true then
      raise exception 'Valid muscle/topless appearance rejected: %', muscle;
    end if;
  end loop;

  value := jsonb_set(legacy, '{body}', legacy->'body' || '{"muscle":"impossible"}'::jsonb);
  if public.is_valid_player_stage_appearance(value) is not false then
    raise exception 'Unknown muscle definition accepted';
  end if;

  value := jsonb_set(legacy, '{body}', legacy->'body' || '{"extraBodyField":true}'::jsonb);
  if public.is_valid_player_stage_appearance(value) is not false then
    raise exception 'Unexpected body field accepted';
  end if;

  value := jsonb_set(legacy, '{equipment,top,itemId}', '"starter.top.topless"');
  if public.is_valid_player_stage_appearance(value) is not true then
    raise exception 'Topless starter state rejected without muscle field';
  end if;

  if (select count(*) from public.player_stage_appearances where public.is_valid_player_stage_appearance(appearance) is not true) <> 0 then
    raise exception 'Existing saved appearances rejected after body-option validator change';
  end if;
end;
$$;
rollback;
