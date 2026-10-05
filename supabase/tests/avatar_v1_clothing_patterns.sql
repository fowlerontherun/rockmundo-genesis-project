-- A passing read-only run returns zero failures.
with base as (
  select '{"version":1,"body":{"frame":"feminine","height":1,"build":1,"skin":"#c58c66"},"head":{"style":"casual","hair":"#20232b"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#d376a1"},"bottom":{"itemId":"starter.bottom.casual","color":"#20232b"},"footwear":{"itemId":"starter.footwear.casual","color":"#20232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#20232b"}}}'::jsonb as appearance
), cases as (
 select slot || '/' || pattern as name, true as expected,
   jsonb_set(jsonb_set(appearance, array['equipment',slot,'pattern'], to_jsonb(pattern)), array['equipment',slot,'secondaryColor'], '"#ed4495"') as appearance
 from base cross join unnest(array['top','bottom','footwear']) slot cross join unnest(array['solid','stripes','checks','dots','two-tone']) pattern
 union all select 'legacy',true,appearance from base
 union all select 'unknown pattern',false,jsonb_set(appearance,'{equipment,top,pattern}','"unknown"') from base
 union all select 'null pattern',false,jsonb_set(appearance,'{equipment,top,pattern}','null') from base
 union all select 'bad accent',false,jsonb_set(appearance,'{equipment,bottom,secondaryColor}','"red"') from base
 union all select 'null accent',false,jsonb_set(appearance,'{equipment,top,secondaryColor}','null') from base
 union all select 'instrument extras',false,jsonb_set(appearance,'{equipment,instrument,pattern}','"dots"') from base
 union all select 'unknown field',false,jsonb_set(appearance,'{equipment,top,bonus}','10') from base
)
select name, expected, public.is_valid_player_stage_appearance(appearance) as actual
from cases where public.is_valid_player_stage_appearance(appearance) is distinct from expected;
