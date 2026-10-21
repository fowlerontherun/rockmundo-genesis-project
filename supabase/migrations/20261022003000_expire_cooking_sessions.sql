-- Backend-only expiry sweep. Idempotent, locks sessions to prevent races.
-- Pending/running sessions past deadline are closed without minting food.
create or replace function public.expire_cooking_sessions(_limit integer default 100)
returns integer language plpgsql security invoker set search_path = public
as $$
declare
  _session record;
  _count integer := 0;
begin
  if _limit is null or _limit < 1 or _limit > 500 then
    raise exception 'Invalid sweep limit';
  end if;
  for _session in
    select id from public.cooking_sessions
      where status in ('pending','running') and expires_at <= clock_timestamp()
      order by expires_at,id
      for update skip locked limit _limit
  loop
    update public.cooking_sessions
      set status='timed_out', finished_at=clock_timestamp(), updated_at=clock_timestamp()
      where id=_session.id and status in ('pending','running');
    if found then _count := _count + 1; end if;
  end loop;
  return _count;
end;
$$;
revoke all on function public.expire_cooking_sessions(integer) from public,anon,authenticated;
grant execute on function public.expire_cooking_sessions(integer) to service_role;
