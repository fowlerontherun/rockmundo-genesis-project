-- Read-only contract check: every starter garment, both frames and all size bounds.
-- A passing run returns zero rows (only failed cases are selected).
with base as (
  select '{"version":1,"body":{"frame":"feminine","height":1,"build":1,"skin":"#c58c66"},"head":{"style":"casual","hair":"#20232b"},"equipment":{"top":{"itemId":"starter.top.casual","color":"#d376a1"},"bottom":{"itemId":"starter.bottom.casual","color":"#20232b"},"footwear":{"itemId":"starter.footwear.casual","color":"#20232b"},"instrument":{"itemId":"starter.instrument.standard","color":"#20232b"}}}'::jsonb as appearance
), garments(slot, item) as (
  select 'top', 'starter.top.' || unnest(array['casual','topless','punk','suit','stripe','plain-black','plain-white','vintage-charcoal','plaid','pinstripe','v-neck','long-sleeve','tank','hoodie','zip-hoodie','denim-jacket','flannel-shirt','vest','striped-vest','sundress','skater-dress'])
  union all
  select 'bottom', 'starter.bottom.' || unnest(array['casual','punk','suit','denim','blue-jeans','black-jeans','dark-slim-jeans','plaid','pinstripe','denim-shorts','cargo-shorts','athletic-shorts','boxer-briefs','briefs','chinos','wide-leg','pleated-skirt','mini-skirt'])
  union all
  select 'footwear', 'starter.footwear.' || unnest(array['casual','punk','suit','canvas','black-boots','brown-boots','canvas-trainers','combat-boots','two-tone','patent'])
), cases as (
  select item || '/' || frame || '/' || size as name, true as expected,
    jsonb_set(jsonb_set(jsonb_set(appearance, array['equipment',slot,'itemId'], to_jsonb(item)), '{body,frame}', to_jsonb(frame)), '{body,breastSize}', to_jsonb(size)) as appearance
  from base cross join garments cross join unnest(array['masculine','feminine']) frame cross join unnest(array[0.7,1.0,1.85]) size
  union all select 'legacy size omitted', true, appearance from base
  union all select 'unknown paid top', false, jsonb_set(appearance,'{equipment,top,itemId}','"paid.top.unknown"') from base
  union all select 'wrong slot', false, jsonb_set(appearance,'{equipment,bottom,itemId}','"starter.top.sundress"') from base
  union all select 'invalid dye', false, jsonb_set(appearance,'{equipment,top,color}','"not-a-colour"') from base
  union all select 'size too large', false, jsonb_set(appearance,'{body,breastSize}','1.86') from base
  union all select 'size too small', false, jsonb_set(appearance,'{body,breastSize}','0.69') from base
)
select name, expected, public.is_valid_player_stage_appearance(appearance) as actual
from cases
where public.is_valid_player_stage_appearance(appearance) is distinct from expected;
