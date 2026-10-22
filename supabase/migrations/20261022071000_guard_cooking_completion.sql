-- Harden completion: only a valid already-reserved, scored, finished session can mint food.
-- NOTE: accepted 'finish' events and trusted scoring have not yet been implemented.
-- This function therefore FAILS CLOSED until that backend integration is delivered.
create or replace function public.complete_cooking_batch(
  _profile_id uuid, _recipe_slug text, _session_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  session_row public.cooking_sessions%rowtype;
  recipe public.cooking_recipes%rowtype;
  requirement record;
  existing_id uuid;
  started timestamptz;
  earliest_expiry timestamptz;
  reserved_quantity bigint;
  total_units bigint;
  weighted_quality bigint;
  ingredient_score numeric;
  final_quality integer;
begin
  if _profile_id is null or _recipe_slug is null or _session_id is null then
    raise exception 'Missing cooking completion arguments';
  end if;
  -- Serialize with start and any retry, and prevent two separate completions
  -- spending the same stock. No new stock deductions happen at completion.
  perform 1 from public.profiles where id=_profile_id for update;
  if not found then raise exception 'Profile unavailable'; end if;
  select * into session_row from public.cooking_sessions
    where id=_session_id for update;
  if not found or session_row.profile_id<>_profile_id
    or session_row.recipe_slug<>_recipe_slug then
    raise exception 'Cooking session does not match request';
  end if;

  select id into existing_id from public.cooking_food_batches
    where crafting_session_id=_session_id;
  if found then
    if session_row.status<>'completed'
      or session_row.result_batch_id is distinct from existing_id then
      raise exception 'Inconsistent completed cooking state';
    end if;
    return existing_id;
  end if;

  started := clock_timestamp();
  if session_row.status<>'running' or session_row.mode<>'manual'
    or session_row.finished_at is not null
    or session_row.expires_at<=started
    or session_row.execution_score is null then
    raise exception 'Cooking session is not ready for completion';
  end if;

  -- A trusted timing/replay processor, not the browser, must insert the
  -- terminal finish event and set execution_score after validating doneness.
  if not exists (
    select 1 from public.cooking_session_actions
    where session_id=_session_id and action_type='finish'
  ) then raise exception 'Cooking actions have not been validated'; end if;

  select * into recipe from public.cooking_recipes where slug=_recipe_slug;
  if not found then raise exception 'Recipe no longer exists'; end if;
  if not exists (
    select 1 from public.cooking_recipe_ingredients where recipe_slug=_recipe_slug
  ) then raise exception 'Recipe has no ingredients'; end if;

  for requirement in select ingredient_slug, units_required
    from public.cooking_recipe_ingredients where recipe_slug=_recipe_slug
  loop
    select coalesce(sum(quantity),0) into reserved_quantity
      from public.cooking_session_ingredients
      where session_id=_session_id and ingredient_slug=requirement.ingredient_slug;
    if reserved_quantity<>requirement.units_required then
      raise exception 'Ingredient reservation mismatch: %', requirement.ingredient_slug;
    end if;
    if not exists (
      select 1 from public.cooking_session_actions a
      where a.session_id=_session_id
        and a.ingredient_slug=requirement.ingredient_slug
        and a.action_type='remove'
        and not exists (
          select 1 from public.cooking_session_actions b
          where b.session_id=_session_id and b.ingredient_slug=a.ingredient_slug
            and b.action_sequence>a.action_sequence
            and b.action_type in ('add','remove')
        )
    ) then raise exception 'Unplated ingredient: %', requirement.ingredient_slug; end if;
  end loop;

  if exists (
    select 1 from public.cooking_session_ingredients si
    where si.session_id=_session_id
      and not exists (
        select 1 from public.cooking_recipe_ingredients ri
        where ri.recipe_slug=_recipe_slug and ri.ingredient_slug=si.ingredient_slug
      )
  ) then raise exception 'Unexpected ingredient in reservation'; end if;

  select coalesce(sum(quantity),0),
         coalesce(sum(quantity::bigint*quality),0),
         min(original_expires_at)
    into total_units, weighted_quality, earliest_expiry
    from public.cooking_session_ingredients
    where session_id=_session_id;
  if total_units=0 or earliest_expiry is null or earliest_expiry<=started then
    raise exception 'Reserved ingredients no longer fresh'; end if;

  ingredient_score := weighted_quality::numeric/total_units;
  -- Temporary conservative quality formula until recipe skill/equipment
  -- contribution is implemented and balance-tested. Authoritative score only.
  final_quality := greatest(0,least(100,
    round(ingredient_score*0.6 + session_row.execution_score*0.4)::integer));

  insert into public.cooking_food_batches
    (profile_id,recipe_slug,portions,quality,prepared_at,expires_at,crafting_session_id)
  values (_profile_id,_recipe_slug,recipe.portions,final_quality,started,
    least(started+make_interval(hours=>recipe.shelf_life_hours),
      earliest_expiry),_session_id)
  returning id into existing_id;

  update public.cooking_sessions
    set status='completed',updated_at=started,finished_at=started,
      result_batch_id=existing_id
    where id=_session_id;
  return existing_id;
end;
$$;
revoke all on function public.complete_cooking_batch(uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.complete_cooking_batch(uuid,text,uuid)
  to service_role;
