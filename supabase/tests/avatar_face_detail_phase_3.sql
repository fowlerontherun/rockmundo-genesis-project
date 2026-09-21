-- Read-only regression for optional Phase 3 face detail fields.
begin;

do $$
declare
  base jsonb := '{"version":1,"body":{"frame":"feminine","height":1,"build":1,"skin":"#c58c63"},"head":{"style":"casual","hair":"#54372a"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#426baa"},"bottom":{"itemId":"starter.bottom.denim","color":"#283954"},"footwear":{"itemId":"starter.footwear.canvas","color":"#20232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#b97536"}}}';
  detailed jsonb := '{"head":{"style":"casual","hair":"#54372a","faceShape":"angular","eyeColor":"#4f755a","eyebrowStyle":"arched","eyebrowColor":"#854b32","skinDetail":"freckles"}}';
begin
  if public.is_valid_player_stage_appearance(base) is distinct from true then
    raise exception 'Legacy v1 appearance rejected after face-detail migration';
  end if;
  if public.is_valid_player_stage_appearance(base || detailed) is distinct from true then
    raise exception 'Valid Phase 3 face detail rejected';
  end if;
  if public.is_valid_player_stage_appearance(jsonb_set(base || detailed, '{head,faceShape}', '"triangle"'::jsonb)) is distinct from false then
    raise exception 'Unknown face shape accepted';
  end if;
  if public.is_valid_player_stage_appearance(jsonb_set(base || detailed, '{head,eyeColor}', '"green"'::jsonb)) is distinct from false then
    raise exception 'Invalid eye colour accepted';
  end if;
  if public.is_valid_player_stage_appearance(jsonb_set(base || detailed, '{head,eyebrowStyle}', '"zigzag"'::jsonb)) is distinct from false then
    raise exception 'Unknown eyebrow style accepted';
  end if;
  if public.is_valid_player_stage_appearance(jsonb_set(base || detailed, '{head,skinDetail}', '"glitter"'::jsonb)) is distinct from false then
    raise exception 'Unknown skin detail accepted';
  end if;
  if public.is_valid_player_stage_appearance(
    jsonb_set(base || detailed, '{head}', (base || detailed)->'head' || '{"photoUrl":"https://example.com/face.png"}'::jsonb)
  ) is distinct from false then
    raise exception 'Unexpected head property accepted';
  end if;
end $$;

rollback;
select 'PASS: legacy compatibility and strict Phase 3 face-detail validation' as avatar_face_detail_gate;
