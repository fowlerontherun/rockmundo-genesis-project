-- Configured manual-pan cooking windows. No player mutation access.
-- The production manual replay path intentionally supports pan recipes only.
create table if not exists public.cooking_ingredient_cook_windows (
  ingredient_slug text primary key,
  ready_seconds numeric(8,3) not null check (ready_seconds > 0),
  overdone_seconds numeric(8,3) not null,
  burnt_seconds numeric(8,3) not null,
  constraint cooking_window_order check (
    ready_seconds < overdone_seconds and overdone_seconds < burnt_seconds
    and burnt_seconds <= 180
  )
);
alter table public.cooking_ingredient_cook_windows enable row level security;
revoke all on public.cooking_ingredient_cook_windows from anon, authenticated;

insert into public.cooking_ingredient_cook_windows
  (ingredient_slug, ready_seconds, overdone_seconds, burnt_seconds)
select distinct ingredient_slug,
 case ingredient_slug
   when 'onion' then 12 when 'mushrooms' then 18
   when 'peppers' then 9 when 'rice' then 18
   when 'tomato' then 10 when 'lentils' then 16
   else 12 end,
 case ingredient_slug
   when 'onion' then 16 when 'mushrooms' then 23
   when 'peppers' then 13 when 'rice' then 24
   when 'tomato' then 15 when 'lentils' then 21
   else 17 end,
 case ingredient_slug
   when 'onion' then 21 when 'mushrooms' then 30
   when 'peppers' then 18 when 'rice' then 32
   when 'tomato' then 20 when 'lentils' then 28
   else 23 end
from public.cooking_recipe_ingredients
on conflict (ingredient_slug) do nothing;

-- Read-only deterministic replay of SERVER-timestamped, accepted actions.
-- The _as_of override exists for rollback-only test fixtures; it is not a
-- public API, and production finalization supplies clock_timestamp().
create or replace function public.replay_manual_cooking(
  _session_id uuid, _as_of timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path=public
as $$
declare
 s public.cooking_sessions%rowtype;
 spec record;
 a record;
 states jsonb := '{}'::jsonb;
 item jsonb;
 component_results jsonb := '[]'::jsonb;
 previous_time timestamptz;
 final_time timestamptz;
 elapsed_seconds numeric;
 rate numeric := 0;
 ingredient_count integer := 0;
 point_total integer := 0;
 component_score integer;
 cooked numeric;
 failed boolean := false;
 sequence_expected integer := 1;
 pan_count integer;
 action_count integer := 0;
begin
 select * into s from public.cooking_sessions where id=_session_id;
 if not found or s.mode <> 'manual' then
   raise exception 'Manual cooking session not found';
 end if;
 final_time := coalesce(_as_of,clock_timestamp());
 if final_time < s.started_at or final_time >= s.expires_at then
   raise exception 'Manual cooking replay outside session lifetime';
 end if;
 if not exists (select 1 from public.cooking_recipes
   where slug=s.recipe_slug and method='pan') then
   raise exception 'Manual pan replay does not support this recipe method';
 end if;

 for spec in
   select r.ingredient_slug,w.ready_seconds,w.overdone_seconds,w.burnt_seconds
   from public.cooking_recipe_ingredients r
   left join public.cooking_ingredient_cook_windows w
     on w.ingredient_slug=r.ingredient_slug
   where r.recipe_slug=s.recipe_slug
   order by r.ingredient_slug
 loop
   if spec.ready_seconds is null then
     raise exception 'Missing cooking window for %',spec.ingredient_slug;
   end if;
   states := jsonb_set(states, array[spec.ingredient_slug],
     jsonb_build_object('position','tray','cooked',0),true);
   ingredient_count := ingredient_count + 1;
 end loop;
 if ingredient_count=0 or ingredient_count>12 then
   raise exception 'Invalid manual pan recipe components';
 end if;
 previous_time := s.started_at;

 for a in
   select action_sequence,action_type,ingredient_slug,heat,recorded_at
   from public.cooking_session_actions
   where session_id=_session_id
   order by action_sequence
 loop
   action_count := action_count+1;
   if action_count>256 or a.action_sequence<>sequence_expected then
     raise exception 'Invalid cooking action sequence';
   end if;
   sequence_expected := sequence_expected+1;
   if a.recorded_at<previous_time or a.recorded_at>final_time
     or a.recorded_at>=s.expires_at then
     raise exception 'Invalid cooking action timestamp';
   end if;

   elapsed_seconds := extract(epoch from (a.recorded_at-previous_time)) * rate;
   if elapsed_seconds>0 then
     for spec in select ingredient_slug from public.cooking_recipe_ingredients
       where recipe_slug=s.recipe_slug
     loop
       item := states->spec.ingredient_slug;
       if item->>'position'='pan' then
         cooked := round((item->>'cooked')::numeric + elapsed_seconds,6);
         states := jsonb_set(states,array[spec.ingredient_slug,'cooked'],to_jsonb(cooked));
       end if;
     end loop;
   end if;
   previous_time := a.recorded_at;

   if a.action_type='heat' then
     if a.ingredient_slug is not null then raise exception 'Malformed heat action'; end if;
     rate := case a.heat
       when 'off' then 0 when 'low' then 0.65
       when 'medium' then 1 when 'high' then 1.5 else null end;
     if rate is null then raise exception 'Invalid heat setting'; end if;
   elsif a.action_type in ('add','remove') then
     if a.heat is not null or a.ingredient_slug is null
       or not (states ? a.ingredient_slug) then
       raise exception 'Unknown or malformed ingredient action';
     end if;
     item := states->a.ingredient_slug;
     if a.action_type='add' then
       if item->>'position'='pan' then
         raise exception 'Ingredient added twice';
       end if;
       select count(*) into pan_count from jsonb_each(states) e
         where e.value->>'position'='pan';
       if pan_count>=2 then raise exception 'Pan capacity exceeded'; end if;
       states := jsonb_set(states,array[a.ingredient_slug,'position'],to_jsonb('pan'::text));
     else
       if item->>'position'<>'pan' then
         raise exception 'Ingredient removed before being added';
       end if;
       states := jsonb_set(states,array[a.ingredient_slug,'position'],to_jsonb('plate'::text));
     end if;
   else
     raise exception 'Unexpected terminal action during replay';
   end if;
 end loop;

 -- Since unfinished pan items fail, we do not award quality for unplated food.
 for spec in
   select r.ingredient_slug,w.ready_seconds,w.overdone_seconds,w.burnt_seconds
   from public.cooking_recipe_ingredients r
   join public.cooking_ingredient_cook_windows w
     on w.ingredient_slug=r.ingredient_slug
   where r.recipe_slug=s.recipe_slug
   order by r.ingredient_slug
 loop
   item := states->spec.ingredient_slug;
   cooked := (item->>'cooked')::numeric;
   component_score := case
     when item->>'position'<>'plate' then 0
     when cooked < spec.ready_seconds or cooked >= spec.burnt_seconds then 0
     when cooked >= spec.overdone_seconds then 40
     else 100 end;
   if component_score=0 then failed:=true; end if;
   point_total := point_total + component_score;
   component_results := component_results || jsonb_build_array(jsonb_build_object(
     'ingredient',spec.ingredient_slug,
     'position',item->>'position',
     'cooked_seconds',cooked,
     'score',component_score
   ));
 end loop;
 return jsonb_build_object(
   'eligible', not failed,
   'score',case when failed then 0 else round(point_total::numeric/ingredient_count)::integer end,
   'components',component_results
 );
end;
$$;
revoke all on function public.replay_manual_cooking(uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.replay_manual_cooking(uuid,timestamptz) to service_role;

-- Trusted-backend-only, transactional result finalization. The caller must
-- validate actor ownership before supplying a cooking session ID.
create or replace function public.finalize_manual_cooking(_session_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public
as $$
declare
 owner_profile uuid;
 s public.cooking_sessions%rowtype;
 outcome jsonb;
 finished timestamptz;
 next_sequence integer;
 food_id uuid;
 score integer;
begin
 select profile_id into owner_profile from public.cooking_sessions where id=_session_id;
 if not found then raise exception 'Cooking session not found'; end if;
 -- Same lock order as start/complete, avoiding deadlocks on duplicate requests.
 perform 1 from public.profiles where id=owner_profile for update;
 select * into s from public.cooking_sessions where id=_session_id for update;
 if s.status in ('completed','failed','timed_out','cancelled') then
   return jsonb_build_object(
     'status',s.status,'score',s.execution_score,'batch_id',s.result_batch_id);
 end if;
 if s.mode<>'manual' then raise exception 'Not a manual cooking session'; end if;
 finished := clock_timestamp();
 if finished >= s.expires_at then
   update public.cooking_sessions
     set status='timed_out',finished_at=finished,updated_at=finished
     where id=_session_id;
   return jsonb_build_object('status','timed_out','score',0,'batch_id',null);
 end if;

 outcome := public.replay_manual_cooking(_session_id,finished);
 score := (outcome->>'score')::integer;
 select coalesce(max(action_sequence),0)+1 into next_sequence
   from public.cooking_session_actions where session_id=_session_id;
 insert into public.cooking_session_actions
   (session_id,action_sequence,action_type,recorded_at)
 values (_session_id,next_sequence,'finish',finished);
 if (outcome->>'eligible')::boolean is not true then
   update public.cooking_sessions
     set status='failed',execution_score=0,
       finished_at=finished,updated_at=finished
     where id=_session_id;
   return jsonb_build_object('status','failed','score',0,'batch_id',null,
     'components',outcome->'components');
 end if;

 update public.cooking_sessions
   set status='running',execution_score=score,updated_at=finished
   where id=_session_id;
 food_id := public.complete_cooking_batch(owner_profile,s.recipe_slug,_session_id);
 return jsonb_build_object('status','completed','score',score,'batch_id',food_id,
   'components',outcome->'components');
end;
$$;
revoke all on function public.finalize_manual_cooking(uuid)
  from public,anon,authenticated;
grant execute on function public.finalize_manual_cooking(uuid) to service_role;
