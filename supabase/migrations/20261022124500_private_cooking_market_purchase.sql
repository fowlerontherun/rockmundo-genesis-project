-- Keep the verified atomic ingredient purchase implementation unchanged,
-- but remove direct public-schema SECURITY DEFINER exposure. Clients continue
-- calling the same public SECURITY INVOKER RPC, which delegates to a private
-- privileged function after Supabase provides the real auth.uid() context.
create schema if not exists cooking_internal;
revoke all on schema cooking_internal from public,anon;
grant usage on schema cooking_internal to authenticated;

alter function public.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
  set schema cooking_internal;

create or replace function public.purchase_cooking_market_ingredient(
  p_profile_id uuid, p_offer_id uuid, p_quantity integer, p_request_id uuid
) returns jsonb
language sql security invoker set search_path=''
as $wrapper$
 select cooking_internal.purchase_cooking_market_ingredient(
    p_profile_id,p_offer_id,p_quantity,p_request_id);
$wrapper$;
revoke all on function public.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
  to authenticated;
revoke all on function cooking_internal.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
  from public,anon;
grant execute on function cooking_internal.purchase_cooking_market_ingredient(uuid,uuid,integer,uuid)
  to authenticated;
