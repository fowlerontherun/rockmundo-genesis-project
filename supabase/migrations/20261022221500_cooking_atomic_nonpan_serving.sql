-- Atomically plate all ingredients of a non-pan dish.
-- An interrupted browser can retry without half-complete stage transitions.
-- All removes are recorded with the server clock in the same transaction;
-- if one fails no removes commit. The existing trusted scorer and completion
-- contract remain authoritative. No recipes or offers are activated.
create or replace function public.serve_cooking_technique(_session_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public
as $fn$
declare
  owner_profile uuid;
  s public.cooking_sessions%rowtype;
  method_name text;
  ingredient record;
  ingredient_count integer := 0;
  newly_plated integer := 0;
  total_plated integer := 0;
begin
  select profile_id into owner_profile from public.cooking_sessions where id=_session_id;
  if not found then raise exception 'Cooking technique session unavailable'; end if;
  -- Match the established profile -> session lock order for concurrent starts
  -- and finishes. The nested record_cooking_technique_action holds the same lock.
  perform 1 from public.profiles where id=owner_profile for update;
  if not found then raise exception 'Cooking character unavailable'; end if;
  select * into s from public.cooking_sessions where id=_session_id for update;
  select method into method_name from public.cooking_recipes where slug=s.recipe_slug;
  if s.mode<>'manual' or method_name not in ('oven','simmer','mix')
    or method_name is null then raise exception 'Invalid serving method'; end if;

  if s.status='completed' then
    return jsonb_build_object('status','already_completed','plated',0);
  end if;
  if s.status not in ('pending','running') or clock_timestamp()>=s.expires_at
    then raise exception 'Cooking technique is no longer active'; end if;

  for ingredient in
    select ingredient_slug from public.cooking_recipe_ingredients
    where recipe_slug=s.recipe_slug order by ingredient_slug
  loop
    ingredient_count:=ingredient_count+1;
    if ingredient_count>12 then raise exception 'Too many recipe ingredients'; end if;
    if not exists(select 1 from public.cooking_session_actions
      where session_id=_session_id and action_type='add'
        and ingredient_slug=ingredient.ingredient_slug)
      then raise exception 'Incomplete recipe components'; end if;

    if not exists(select 1 from public.cooking_session_actions
      where session_id=_session_id and action_type='remove'
        and ingredient_slug=ingredient.ingredient_slug)
    then
      perform public.record_cooking_technique_action(
        _session_id,'remove',ingredient.ingredient_slug,null);
      newly_plated:=newly_plated+1;
    end if;
    total_plated:=total_plated+1;
  end loop;
  if ingredient_count=0 then raise exception 'Empty recipe cannot be served'; end if;
  return jsonb_build_object('status','served','plated',total_plated,
    'newly_plated',newly_plated);
end;
$fn$;
revoke all on function public.serve_cooking_technique(uuid)
  from public,anon,authenticated;
grant execute on function public.serve_cooking_technique(uuid) to service_role;
