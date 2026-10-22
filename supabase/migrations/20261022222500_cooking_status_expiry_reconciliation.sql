-- Trusted status-read expiry reconciliation for abandoned pan/oven/pot/drink attempts.
-- The database clock is the only authority for expiry. No rewards, inventory,
-- or food batches can be created by this function.
create or replace function public.expire_stale_cooking_session(_session_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public
as $fn$
declare
  owner_profile uuid;
  session_row public.cooking_sessions%rowtype;
  checked_at timestamptz;
  did_expire boolean := false;
begin
  select profile_id into owner_profile from public.cooking_sessions where id=_session_id;
  if not found then raise exception 'Cooking session unavailable'; end if;
  -- Preserve established lock ordering with starts, actions and finalization.
  perform 1 from public.profiles where id=owner_profile for update;
  if not found then raise exception 'Character unavailable'; end if;
  select * into session_row from public.cooking_sessions where id=_session_id for update;
  if not found then raise exception 'Cooking session unavailable'; end if;
  checked_at:=clock_timestamp();

  if session_row.status in ('pending','running')
    and session_row.expires_at<=checked_at then
    update public.cooking_sessions
      set status='timed_out',finished_at=checked_at,updated_at=checked_at
      where id=_session_id;
    did_expire:=true;
    session_row.status:='timed_out';
  end if;
  return jsonb_build_object(
    'status',session_row.status,'expired',did_expire,
    'checked_at',checked_at);
end;
$fn$;
revoke all on function public.expire_stale_cooking_session(uuid)
  from public,anon,authenticated;
grant execute on function public.expire_stale_cooking_session(uuid)
  to service_role;
