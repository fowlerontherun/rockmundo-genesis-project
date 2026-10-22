-- SERVER-VALIDATED OVEN, SIMMER AND DRINK TECHNIQUES (release-gated)
-- Additive foundation only: NO recipes, offers or crafting sessions activated.
-- All RPCs remain service-role-only. Never trust a browser timestamp or score.

alter table public.cooking_session_actions
  drop constraint if exists cooking_session_actions_action_type_check;
alter table public.cooking_session_actions
  add constraint cooking_session_actions_action_type_check
  check (action_type in ('heat','add','remove','stir','finish','timeout'));

create table if not exists public.cooking_method_windows (
  method text primary key check (method in ('oven','simmer')),
  ready_seconds numeric not null check (ready_seconds > 0),
  overdone_seconds numeric not null,
  burnt_seconds numeric not null,
  constraint cooking_method_windows_order check
    (ready_seconds < overdone_seconds and overdone_seconds < burnt_seconds and burnt_seconds <= 120)
);
insert into public.cooking_method_windows(method,ready_seconds,overdone_seconds,burnt_seconds)
values ('oven',15,23,31),('simmer',12,20,30)
on conflict (method) do nothing;
alter table public.cooking_method_windows enable row level security;
revoke all on public.cooking_method_windows from public,anon,authenticated;
grant select on public.cooking_method_windows to service_role;

-- No partial or client-authored transitions. A method session reserves real
-- inventory using the existing begin_cooking_session (manual mode).
create or replace function public.record_cooking_technique_action(
  _session_id uuid, _action_type text, _ingredient_slug text default null,
  _heat text default null
) returns bigint
language plpgsql security invoker set search_path=public
as $fn$
declare
  s public.cooking_sessions%rowtype;
  method_name text;
  previous text;
  started_heating boolean;
  ingredient_count integer;
  loaded_count integer;
  stir_count integer;
  next_sequence integer;
  action_id bigint;
  action_time timestamptz := clock_timestamp();
begin
  select * into s from public.cooking_sessions where id=_session_id for update;
  if not found or s.mode <> 'manual' or s.status not in ('pending','running')
    then raise exception 'Technique session is not active manual cooking'; end if;
  if action_time >= s.expires_at then raise exception 'Technique session expired'; end if;
  select method into method_name from public.cooking_recipes where slug=s.recipe_slug;
  if method_name not in ('oven','simmer','mix') or method_name is null
    then raise exception 'Technique method unsupported'; end if;
  if _action_type not in ('add','heat','remove','stir') or _action_type is null
    then raise exception 'Unknown technique action'; end if;

  select count(*) into ingredient_count from public.cooking_recipe_ingredients
    where recipe_slug=s.recipe_slug;
  if ingredient_count<1 or ingredient_count>12
    then raise exception 'Technique recipe component count out of bounds'; end if;

  select count(*) into loaded_count from public.cooking_session_actions
    where session_id=_session_id and action_type='add';
  select count(*) into stir_count from public.cooking_session_actions
    where session_id=_session_id and action_type='stir';
  select exists(select 1 from public.cooking_session_actions
    where session_id=_session_id and action_type='heat' and heat<>'off')
    into started_heating;

  if _action_type='add' then
    if _heat is not null or _ingredient_slug is null
      or started_heating or stir_count>0 or exists (
        select 1 from public.cooking_session_actions
        where session_id=_session_id and action_type='remove'
      ) then raise exception 'Cannot add ingredients after preparation'; end if;
    if not exists(select 1 from public.cooking_recipe_ingredients
      where recipe_slug=s.recipe_slug and ingredient_slug=_ingredient_slug)
       or exists(select 1 from public.cooking_session_actions
       where session_id=_session_id and action_type='add' and ingredient_slug=_ingredient_slug)
      then raise exception 'Unknown or duplicated technique ingredient'; end if;
    if loaded_count>=ingredient_count
      then raise exception 'All recipe ingredients already loaded'; end if;
  elsif _action_type='heat' then
    if method_name='mix' or _ingredient_slug is not null
      or _heat is null or _heat not in ('off','low','medium','high')
      or loaded_count<>ingredient_count
      then raise exception 'Invalid technique heat'; end if;
  elsif _action_type='stir' then
    if method_name<>'mix' or _ingredient_slug is not null or _heat is not null
      or loaded_count<>ingredient_count or stir_count>=8
      or exists(select 1 from public.cooking_session_actions
        where session_id=_session_id and action_type='remove')
      then raise exception 'Invalid drink stir'; end if;
  elsif _action_type='remove' then
    if _heat is not null or _ingredient_slug is null
      or (method_name='mix' and stir_count<3)
      or (method_name<>'mix' and not started_heating)
      then raise exception 'Cannot serve incomplete technique'; end if;
    select action_type into previous from public.cooking_session_actions
    where session_id=_session_id and ingredient_slug=_ingredient_slug
      and action_type in ('add','remove')
    order by action_sequence desc limit 1;
    if previous is distinct from 'add'
      then raise exception 'Technique ingredient not available to plate'; end if;
  end if;

  select coalesce(max(action_sequence),0)+1 into next_sequence
    from public.cooking_session_actions where session_id=_session_id;
  if next_sequence>255 then raise exception 'Technique action limit reached'; end if;
  insert into public.cooking_session_actions
    (session_id,action_sequence,action_type,ingredient_slug,heat,recorded_at)
  values (_session_id,next_sequence,_action_type,_ingredient_slug,_heat,action_time)
  returning id into action_id;
  update public.cooking_sessions set status='running',updated_at=action_time
    where id=_session_id;
  return action_id;
end;
$fn$;
revoke all on function public.record_cooking_technique_action(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_cooking_technique_action(uuid,text,text,text) to service_role;

-- A read-only deterministic replay of accepted, server-timestamped actions.
-- '_as_of' exists ONLY for transaction-rolled-back SQL fixtures.
create or replace function public.replay_cooking_technique(
  _session_id uuid, _as_of timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path=public
as $fn$
declare
  s public.cooking_sessions%rowtype;
  method_name text;
  rules public.cooking_method_windows%rowtype;
  final_time timestamptz;
  previous_time timestamptz;
  ingredient record;
  act record;
  item jsonb;
  states jsonb := '{}'::jsonb;
  components jsonb := '[]'::jsonb;
  component_score integer;
  component_count integer := 0;
  score_total integer := 0;
  loaded_count integer := 0;
  stir_count integer := 0;
  expected_sequence integer := 1;
  action_count integer := 0;
  rate numeric := 0;
  exposure numeric := 0;
  cooked numeric;
  failed boolean := false;
  started_heating boolean := false;
begin
  select * into s from public.cooking_sessions where id=_session_id;
  if not found or s.mode<>'manual' then raise exception 'No manual technique session'; end if;
  select method into method_name from public.cooking_recipes where slug=s.recipe_slug;
  if method_name not in ('oven','simmer','mix') or method_name is null
    then raise exception 'Technique scorer does not support this recipe method'; end if;
  if method_name<>'mix' then
    select * into rules from public.cooking_method_windows where method=method_name;
    if not found then raise exception 'Missing technique timing rules'; end if;
  end if;
  final_time:=coalesce(_as_of,clock_timestamp());
  if final_time<s.started_at or final_time>=s.expires_at
    then raise exception 'Technique replay outside allowed lifetime'; end if;
  for ingredient in select ingredient_slug from public.cooking_recipe_ingredients
    where recipe_slug=s.recipe_slug order by ingredient_slug loop
    states:=jsonb_set(states,array[ingredient.ingredient_slug],
      jsonb_build_object('position','tray','cooked',0),true);
    component_count:=component_count+1;
  end loop;
  if component_count<1 or component_count>12
    then raise exception 'Unsupported technique recipe components'; end if;
  previous_time:=s.started_at;

  for act in select action_sequence,action_type,ingredient_slug,heat,recorded_at
    from public.cooking_session_actions where session_id=_session_id
    order by action_sequence loop
    action_count:=action_count+1;
    if action_count>255 or act.action_sequence<>expected_sequence
      then raise exception 'Invalid technique action order'; end if;
    expected_sequence:=expected_sequence+1;
    if act.recorded_at<previous_time or act.recorded_at>final_time
      or act.recorded_at>=s.expires_at
      then raise exception 'Technique action timestamps invalid'; end if;
    exposure:=round(exposure+extract(epoch from (act.recorded_at-previous_time))*rate,6);
    previous_time:=act.recorded_at;

    if act.action_type='add' then
      if act.heat is not null or act.ingredient_slug is null
        or not(states ? act.ingredient_slug) or started_heating or stir_count>0
        then raise exception 'Invalid technique add event'; end if;
      item:=states->act.ingredient_slug;
      if item->>'position'<>'tray' then raise exception 'Technique ingredient duplicated'; end if;
      states:=jsonb_set(states,array[act.ingredient_slug,'position'],to_jsonb('vessel'::text));
      loaded_count:=loaded_count+1;
    elsif act.action_type='heat' then
      if method_name='mix' or act.ingredient_slug is not null
        or loaded_count<>component_count or act.heat not in ('off','low','medium','high')
        or act.heat is null then raise exception 'Invalid technique heat event'; end if;
      rate:=case act.heat when 'off' then 0 when 'low' then 0.65
        when 'medium' then 1 when 'high' then 1.5 end;
      if act.heat<>'off' then started_heating:=true; end if;
    elsif act.action_type='stir' then
      if method_name<>'mix' or act.ingredient_slug is not null or act.heat is not null
        or loaded_count<>component_count or stir_count>=8
        then raise exception 'Invalid drink stirring event'; end if;
      if exists(select 1 from jsonb_each(states) e where e.value->>'position'='plate')
        then raise exception 'Drink was stirred after serving'; end if;
      stir_count:=stir_count+1;
    elsif act.action_type='remove' then
      if act.heat is not null or act.ingredient_slug is null
        or not(states ? act.ingredient_slug)
        or (method_name='mix' and stir_count<3)
        or (method_name<>'mix' and not started_heating)
        then raise exception 'Invalid technique plating event'; end if;
      item:=states->act.ingredient_slug;
      if item->>'position'<>'vessel' then raise exception 'Technique ingredient plated twice'; end if;
      states:=jsonb_set(states,array[act.ingredient_slug,'position'],to_jsonb('plate'::text));
      states:=jsonb_set(states,array[act.ingredient_slug,'cooked'],to_jsonb(exposure));
    else
      raise exception 'Unexpected technique terminal event';
    end if;
  end loop;

  for ingredient in select ingredient_slug from public.cooking_recipe_ingredients
    where recipe_slug=s.recipe_slug order by ingredient_slug loop
    item:=states->ingredient.ingredient_slug;
    cooked:=(item->>'cooked')::numeric;
    if method_name='mix' then
      component_score:=case when item->>'position'<>'plate' or stir_count<3 then 0
        when stir_count<=5 then 100 else 65 end;
    else
      component_score:=case
        when item->>'position'<>'plate' or cooked<rules.ready_seconds
          or cooked>=rules.burnt_seconds then 0
        when cooked>=rules.overdone_seconds then 40 else 100 end;
    end if;
    if component_score=0 then failed:=true; end if;
    score_total:=score_total+component_score;
    components:=components||jsonb_build_array(jsonb_build_object(
      'ingredient',ingredient.ingredient_slug,'position',item->>'position',
      'exposure_seconds',cooked,'score',component_score));
  end loop;
  return jsonb_build_object('method',method_name,'eligible',not failed,
    'score',case when failed then 0 else round(score_total::numeric/component_count)::integer end,
    'stirs',stir_count,'components',components);
end;
$fn$;
revoke all on function public.replay_cooking_technique(uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.replay_cooking_technique(uuid,timestamptz) to service_role;

-- Same idempotency and lock ordering as finalize_manual_cooking.
create or replace function public.finalize_cooking_technique(_session_id uuid)
returns jsonb language plpgsql security invoker set search_path=public
as $fn$
declare
  owner_profile uuid;
  s public.cooking_sessions%rowtype;
  recipe_method text;
  outcome jsonb;
  ended timestamptz;
  next_sequence integer;
  food_id uuid;
  score integer;
begin
  select profile_id into owner_profile from public.cooking_sessions where id=_session_id;
  if not found then raise exception 'Technique session missing'; end if;
  perform 1 from public.profiles where id=owner_profile for update;
  select * into s from public.cooking_sessions where id=_session_id for update;
  select method into recipe_method from public.cooking_recipes where slug=s.recipe_slug;
  if recipe_method not in ('oven','simmer','mix') or s.mode<>'manual'
    then raise exception 'Wrong technique completion method'; end if;
  if s.status in ('completed','failed','timed_out','cancelled') then
    return jsonb_build_object('status',s.status,'score',s.execution_score,'batch_id',s.result_batch_id);
  end if;
  ended:=clock_timestamp();
  if ended>=s.expires_at then
    update public.cooking_sessions
      set status='timed_out',finished_at=ended,updated_at=ended where id=_session_id;
    return jsonb_build_object('status','timed_out','score',0,'batch_id',null);
  end if;
  outcome:=public.replay_cooking_technique(_session_id,ended);
  score:=(outcome->>'score')::integer;
  select coalesce(max(action_sequence),0)+1 into next_sequence from public.cooking_session_actions
    where session_id=_session_id;
  if next_sequence>256 then raise exception 'Too many technique actions'; end if;
  insert into public.cooking_session_actions(session_id,action_sequence,action_type,recorded_at)
    values(_session_id,next_sequence,'finish',ended);
  if (outcome->>'eligible')::boolean is not true then
    update public.cooking_sessions set status='failed',execution_score=0,
      finished_at=ended,updated_at=ended where id=_session_id;
    return jsonb_build_object('status','failed','score',0,'batch_id',null,
      'components',outcome->'components');
  end if;
  update public.cooking_sessions set status='running',execution_score=score,updated_at=ended
    where id=_session_id;
  food_id:=public.complete_cooking_batch(owner_profile,s.recipe_slug,_session_id);
  return jsonb_build_object('status','completed','score',score,'batch_id',food_id,
    'components',outcome->'components');
end;
$fn$;
revoke all on function public.finalize_cooking_technique(uuid) from public,anon,authenticated;
grant execute on function public.finalize_cooking_technique(uuid) to service_role;

-- Do not enable recipes here. Staging browser certification is required.
