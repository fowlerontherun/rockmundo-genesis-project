-- Emergency closure must always be possible if ingredients sell out, recipes
-- drift or Japan's city coverage changes. Release preflight remains strict
-- only for enabling. This migration DOES NOT activate any offers or recipes.
-- The explicit service-role-only privilege and audited reason are preserved.
create or replace function public.set_japan_rice_bowl_pilot(
  p_enable boolean, p_reason text
) returns jsonb
language plpgsql security invoker set search_path=''
as $pilot$
declare
 v_recipe public.cooking_recipes%rowtype;
 v_cities integer;
 v_offers integer;
 v_ready integer;
 v_open integer;
 v_changed timestamptz := clock_timestamp();
 v_event_id uuid;
begin
 if p_enable is null or p_reason is null or length(trim(p_reason)) not between 12 and 500 then
   raise exception 'COOKING_PILOT_REASON_REQUIRED';
 end if;
 -- A recipe-row lock serializes competing release/pause requests. The only
 -- allowed offer set is the three rice-bowl ingredients in existing Japan cities.
 select * into v_recipe from public.cooking_recipes
 where slug='rice-bowl' for update;
 if p_enable and (not found or v_recipe.method <> 'pan' or v_recipe.portions <> 2) then
   raise exception 'COOKING_PILOT_RECIPE_DRIFT';
 end if;
 select count(*) into v_cities from public.cities where country='Japan';
 if p_enable and v_cities<>2 then
   raise exception 'COOKING_PILOT_CITY_SCOPE_DRIFT';
 end if;

 -- Verify recipe ingredient quantities and all authoritative cooking windows.
 select count(*) into v_ready
 from public.cooking_recipe_ingredients i
 join public.cooking_ingredient_cook_windows w on w.ingredient_slug=i.ingredient_slug
 where i.recipe_slug='rice-bowl'
   and i.ingredient_slug in ('mushrooms','rice','soy-seasoning')
   and i.units_required=1
   and w.ready_seconds>0
   and w.ready_seconds<w.overdone_seconds
   and w.overdone_seconds<w.burnt_seconds;
 if p_enable and (v_ready<>3 or
   (select count(*) from public.cooking_recipe_ingredients
     where recipe_slug='rice-bowl')<>3) then
   raise exception 'COOKING_PILOT_INGREDIENT_DRIFT';
 end if;
 select count(*) into v_offers
 from public.cooking_city_market_offers o
 join public.cities c on c.id=o.city_id
 where c.country='Japan' and o.ingredient_slug in ('mushrooms','rice','soy-seasoning')
   and o.stock>=1 and o.unit_price between 1 and 100000
   and o.quality between 1 and 100;
 if p_enable and v_offers<>(3*v_cities) then
   raise exception 'COOKING_PILOT_MARKET_STOCK_NOT_READY';
 end if;

 if p_enable then
   -- Fail if an unrelated global rollout is underway: this operation must
   -- never silently certify markets or recipes outside its pilot scope.
   if exists (select 1 from public.cooking_recipes
              where is_active and slug<>'rice-bowl') then
     raise exception 'COOKING_PILOT_OTHER_RECIPES_ALREADY_ACTIVE';
   end if;
   if exists (
     select 1 from public.cooking_city_market_offers o
     join public.cities c on c.id=o.city_id
     where o.is_active and not (
       c.country='Japan' and o.ingredient_slug in ('mushrooms','rice','soy-seasoning')
     )
   ) then raise exception 'COOKING_PILOT_OTHER_MARKETS_ALREADY_ACTIVE'; end if;
 end if;

 select count(*) into v_open
 from public.cooking_city_market_offers o
 join public.cities c on c.id=o.city_id
 where c.country='Japan' and o.ingredient_slug in ('mushrooms','rice','soy-seasoning')
 and o.is_active;
 if v_recipe.is_active=p_enable
   and ( (p_enable and v_open=3*v_cities) or (not p_enable and v_open=0) ) then
   return jsonb_build_object('status','already_configured',
     'enabled',p_enable,'pilot','japan_rice_bowl','cities',v_cities);
 end if;

 update public.cooking_city_market_offers o
   set is_active=p_enable,updated_at=v_changed
 from public.cities c
 where c.id=o.city_id and c.country='Japan'
   and o.ingredient_slug in ('mushrooms','rice','soy-seasoning');
 update public.cooking_recipes
   set is_active=p_enable where slug='rice-bowl';
 insert into public.cooking_pilot_release_events(pilot,enabled,reason,affected_cities,changed_at)
 values ('japan_rice_bowl',p_enable,trim(p_reason),v_cities,v_changed)
 returning id into v_event_id;
 return jsonb_build_object('status','changed','enabled',p_enable,
   'pilot','japan_rice_bowl','cities',v_cities,
   'offers',v_offers,'eventId',v_event_id);
end;
$pilot$;
revoke all on function public.set_japan_rice_bowl_pilot(boolean,text)
 from public,anon,authenticated;
grant execute on function public.set_japan_rice_bowl_pilot(boolean,text) to service_role;


-- NOTE: p_enable=false only closes Tokyo/Osaka-by-country rice bowl offers
-- and the rice-bowl recipe. It does not touch stock, wallets or food receipts.
