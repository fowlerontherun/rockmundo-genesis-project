-- Read-only validation gate: all 18 starter IDs on either frame; no player writes.
do $$
declare a jsonb := '{"version":1,"body":{"frame":"masculine","height":1,"build":1,"skin":"#a96f46"},"head":{"style":"casual","hair":"#282027"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#436477"},"bottom":{"itemId":"starter.bottom.casual","color":"#272e39"},"footwear":{"itemId":"starter.footwear.casual","color":"#25232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#b97536"}}}';
slot text; item text; frame text; candidate jsonb; n integer := 0;
begin
  foreach frame in array array['masculine','feminine'] loop
    a := jsonb_set(a, '{body,frame}', to_jsonb(frame));
    foreach item in array array[
      'starter.top.casual','starter.top.punk','starter.top.suit','starter.top.stripe','starter.top.plaid','starter.top.pinstripe',
      'starter.bottom.casual','starter.bottom.punk','starter.bottom.suit','starter.bottom.denim','starter.bottom.plaid','starter.bottom.pinstripe',
      'starter.footwear.casual','starter.footwear.punk','starter.footwear.suit','starter.footwear.canvas','starter.footwear.two-tone','starter.footwear.patent'] loop
      slot := split_part(item,'.',2);
      candidate := jsonb_set(a,array['equipment',slot,'itemId'],to_jsonb(item));
      if public.is_valid_player_stage_appearance(candidate) is distinct from true then raise exception 'Valid starter item rejected: %', item; end if;
      n := n + 1;
    end loop;
  end loop;
  foreach slot in array array['top','bottom','footwear'] loop
    foreach item in array array['paid.exclusive','starter.top.canvas','starter.bottom.stripe','starter.footwear.plaid','https://example.com/model.glb',''] loop
      candidate := jsonb_set(a,array['equipment',slot,'itemId'],to_jsonb(item));
      if public.is_valid_player_stage_appearance(candidate) is distinct from false then raise exception 'Invalid starter item accepted: %', item; end if;
    end loop;
    candidate := jsonb_set(a,array['equipment',slot,'color'],'"invalid"');
    if public.is_valid_player_stage_appearance(candidate) is distinct from false then raise exception 'Invalid colour accepted'; end if;
  end loop;
  if n <> 36 then raise exception 'Incomplete wardrobe coverage'; end if;
end $$;
select 'PASS: 18 starter items on both frames; invalid item and colour rejection' as result;
