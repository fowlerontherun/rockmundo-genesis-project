-- The privileged mayor investment implementation belongs in a schema
-- that is not exposed by PostgREST. Keep public RPC as SECURITY INVOKER.
create schema if not exists cooking_internal;
revoke all on schema cooking_internal from public,anon;
grant usage on schema cooking_internal to authenticated;
alter function public.upgrade_cooking_city_market(uuid,uuid,uuid)
  set schema cooking_internal;

create or replace function public.upgrade_cooking_city_market(
  p_city_id uuid, p_profile_id uuid, p_request_id uuid
) returns jsonb
language sql security invoker set search_path=''
as $wrapper$
 select cooking_internal.upgrade_cooking_city_market(
    p_city_id,p_profile_id,p_request_id);
$wrapper$;
revoke all on function public.upgrade_cooking_city_market(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.upgrade_cooking_city_market(uuid,uuid,uuid)
  to authenticated;
revoke all on function cooking_internal.upgrade_cooking_city_market(uuid,uuid,uuid)
  from public,anon;
grant execute on function cooking_internal.upgrade_cooking_city_market(uuid,uuid,uuid)
  to authenticated;
