-- Trusted-server-only, idempotent cooking completion. All recipes stay inactive
-- until purchase/reservation and server-validated manual sessions are integrated.
create or replace function public.complete_cooking_batch(
  _profile_id uuid, _recipe_slug text, _session_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  r public.cooking_recipes%rowtype;
  req record;
  lot record;
  needed integer;
  earliest_expiry timestamptz;
  weighted_quality bigint := 0;
  total_units integer := 0;
  result_id uuid;
  prepared_time timestamptz;
begin
  if _profile_id is null or _session_id is null or _recipe_slug is null then
    raise exception 'Missing cooking arguments';
  end if;
  -- Serialize attempts for a profile, including different session keys.
  perform 1 from public.profiles where id = _profile_id for update;
  if not found then raise exception 'Profile does not exist'; end if;
  select id into result_id from public.cooking_food_batches where crafting_session_id = _session_id;
  if found then
    if not exists(select 1 from public.cooking_food_batches where id=result_id
      and profile_id=_profile_id and recipe_slug=_recipe_slug) then
      raise exception 'Session key belongs to a different cooking request';
    end if;
    return result_id;
  end if;
  select * into r from public.cooking_recipes
    where slug=_recipe_slug and is_active for share;
  if not found then raise exception 'Recipe unavailable'; end if;
  if not exists (select 1 from public.cooking_recipe_ingredients where recipe_slug=r.slug)
    then raise exception 'Recipe has no ingredients'; end if;
  prepared_time := clock_timestamp();
  for req in select ingredient_slug, units_required from public.cooking_recipe_ingredients
    where recipe_slug=r.slug order by ingredient_slug
  loop
    needed := req.units_required;
    for lot in select id, quantity, quality, expires_at
      from public.cooking_ingredient_lots
      where profile_id=_profile_id and ingredient_slug=req.ingredient_slug
        and quantity > 0 and expires_at > prepared_time
      order by expires_at,id for update
    loop
      exit when needed=0;
      declare
        taken integer := least(needed, lot.quantity);
      begin
        update public.cooking_ingredient_lots
          set quantity=quantity-taken where id=lot.id;
        needed := needed-taken;
        weighted_quality := weighted_quality + taken * lot.quality;
        total_units := total_units+taken;
        earliest_expiry := least(coalesce(earliest_expiry,lot.expires_at),lot.expires_at);
      end;
    end loop;
    if needed > 0 then raise exception 'Insufficient fresh ingredient: %', req.ingredient_slug; end if;
  end loop;
  insert into public.cooking_food_batches (
    profile_id,recipe_slug,portions,quality,prepared_at,expires_at,crafting_session_id
  ) values (
    _profile_id,r.slug,r.portions,round(weighted_quality::numeric/total_units)::integer,
    prepared_time, least(prepared_time + make_interval(hours=>r.shelf_life_hours),earliest_expiry),
    _session_id
  ) returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.complete_cooking_batch(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.complete_cooking_batch(uuid,text,uuid) to service_role;
