-- Every frontend starter outfit must pass the live Avatar V1 save validator.
-- Read-only regression gate: independent of player accounts or existing saves.
DO $test$
DECLARE
  sample jsonb := jsonb_build_object(
    'version', 1,
    'body', jsonb_build_object('frame','masculine','height',1,'build',1,'skin','#a96f46'),
    'head', jsonb_build_object('style','casual','hair','#362b27'),
    'equipment', jsonb_build_object(
      'top', jsonb_build_object('itemId','starter.top.casual','color','#222222'),
      'bottom', jsonb_build_object('itemId','starter.bottom.casual','color','#222222'),
      'footwear', jsonb_build_object('itemId','starter.footwear.casual','color','#222222'),
      'instrument', jsonb_build_object('itemId','starter.instrument.standard','color','#222222')
    )
  );
  invalid_items text[];
  total_items int;
BEGIN
  IF NOT public.is_valid_player_stage_appearance(sample) THEN
    RAISE EXCEPTION 'Base starter avatar does not pass the stage validator';
  END IF;
  SELECT COUNT(*), array_agg(slot||':'||item_id) FILTER (
    WHERE NOT public.is_valid_player_stage_appearance(
      jsonb_set(sample,ARRAY['equipment',slot,'itemId'],to_jsonb(item_id))
    )
  ) INTO total_items, invalid_items
  FROM (VALUES ('top', 'starter.top.vest'),
    ('top', 'starter.top.striped-vest'),
    ('top', 'starter.top.sundress'),
    ('top', 'starter.top.skater-dress'),
    ('top', 'starter.top.casual'),
    ('top', 'starter.top.topless'),
    ('top', 'starter.top.punk'),
    ('top', 'starter.top.suit'),
    ('top', 'starter.top.stripe'),
    ('top', 'starter.top.plain-black'),
    ('top', 'starter.top.plain-white'),
    ('top', 'starter.top.vintage-charcoal'),
    ('top', 'starter.top.plaid'),
    ('top', 'starter.top.pinstripe'),
    ('top', 'starter.top.v-neck'),
    ('top', 'starter.top.long-sleeve'),
    ('top', 'starter.top.tank'),
    ('top', 'starter.top.hoodie'),
    ('top', 'starter.top.zip-hoodie'),
    ('top', 'starter.top.denim-jacket'),
    ('top', 'starter.top.flannel-shirt'),
    ('bottom', 'starter.bottom.casual'),
    ('bottom', 'starter.bottom.punk'),
    ('bottom', 'starter.bottom.suit'),
    ('bottom', 'starter.bottom.denim'),
    ('bottom', 'starter.bottom.blue-jeans'),
    ('bottom', 'starter.bottom.black-jeans'),
    ('bottom', 'starter.bottom.dark-slim-jeans'),
    ('bottom', 'starter.bottom.black-ripped-skinny-jeans'),
    ('bottom', 'starter.bottom.plaid'),
    ('bottom', 'starter.bottom.pinstripe'),
    ('bottom', 'starter.bottom.denim-shorts'),
    ('bottom', 'starter.bottom.cargo-shorts'),
    ('bottom', 'starter.bottom.athletic-shorts'),
    ('bottom', 'starter.bottom.boxer-briefs'),
    ('bottom', 'starter.bottom.briefs'),
    ('bottom', 'starter.bottom.chinos'),
    ('bottom', 'starter.bottom.wide-leg'),
    ('bottom', 'starter.bottom.pleated-skirt'),
    ('bottom', 'starter.bottom.mini-skirt'),
    ('footwear', 'starter.footwear.casual'),
    ('footwear', 'starter.footwear.punk'),
    ('footwear', 'starter.footwear.suit'),
    ('footwear', 'starter.footwear.canvas'),
    ('footwear', 'starter.footwear.black-boots'),
    ('footwear', 'starter.footwear.brown-boots'),
    ('footwear', 'starter.footwear.canvas-trainers'),
    ('footwear', 'starter.footwear.combat-boots'),
    ('footwear', 'starter.footwear.two-tone'),
    ('footwear', 'starter.footwear.patent')) AS items(slot,item_id);
  IF total_items<>50 OR cardinality(invalid_items)>0 THEN
    RAISE EXCEPTION 'Avatar V1 item whitelist drift: % of 50 checked, invalid=%',total_items,invalid_items;
  END IF;
END
$test$;