-- Server-only action acceptance and ordered cooking audit.
-- Trusted API must authorize the actor's profile before invoking this function.
-- No finished food, quality, XP or rewards are generated here.
create or replace function public.record_cooking_action(
  _session_id uuid, _action_type text, _ingredient_slug text default null,
  _heat text default null
) returns bigint
language plpgsql security invoker set search_path = public
as $$
declare
  s public.cooking_sessions%rowtype;
  _now timestamptz := clock_timestamp();
  _previous text;
  _pan_count integer;
  _sequence integer;
  _id bigint;
begin
  select * into s from public.cooking_sessions where id=_session_id for update;
  if not found then raise exception 'Cooking session unavailable'; end if;
  if s.mode <> 'manual' or s.status not in ('pending','running') then
    raise exception 'Cooking session is not active manual cooking';
  end if;
  if _now >= s.expires_at then raise exception 'Cooking session has expired'; end if;
  if _action_type not in ('heat','add','remove') then raise exception 'Invalid cooking action'; end if;

  if _action_type='heat' then
    if _ingredient_slug is not null or _heat is null or _heat not in ('off','low','medium','high') then
      raise exception 'Invalid heat action';
    end if;
  else
    if _heat is not null or _ingredient_slug is null or not exists (
      select 1 from public.cooking_recipe_ingredients
      where recipe_slug=s.recipe_slug and ingredient_slug=_ingredient_slug
    ) then raise exception 'Invalid ingredient action'; end if;

    select a.action_type into _previous
      from public.cooking_session_actions a
      where a.session_id=_session_id and a.ingredient_slug=_ingredient_slug
        and a.action_type in ('add','remove')
      order by a.action_sequence desc limit 1;
    if (_action_type='add' and _previous='add')
      or (_action_type='remove' and _previous is distinct from 'add') then
      raise exception 'Invalid ingredient transition';
    end if;
    if _action_type='add' then
      select count(*) into _pan_count from (
        select distinct on (ingredient_slug) ingredient_slug,action_type
        from public.cooking_session_actions
        where session_id=_session_id and action_type in ('add','remove')
        order by ingredient_slug,action_sequence desc
      ) latest where action_type='add';
      if _pan_count >= 2 then raise exception 'Pan is full'; end if;
    end if;
  end if;
  select coalesce(max(action_sequence),0)+1 into _sequence
    from public.cooking_session_actions where session_id=_session_id;
  insert into public.cooking_session_actions(session_id,action_sequence,action_type,ingredient_slug,heat,recorded_at)
    values (_session_id,_sequence,_action_type,_ingredient_slug,_heat,_now)
    returning id into _id;
  update public.cooking_sessions set status='running',updated_at=_now where id=_session_id;
  return _id;
end;
$$;
revoke all on function public.record_cooking_action(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_cooking_action(uuid,text,text,text) to service_role;
