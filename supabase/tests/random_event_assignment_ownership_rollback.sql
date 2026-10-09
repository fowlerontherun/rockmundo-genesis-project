-- Rollback-only ownership rejection check for the atomic daily-event RPC.
-- An event can only be assigned to a character belonging to the user.
begin;
do $$
declare v record; v_wrong_user uuid; v_assigned uuid; v_denied boolean := false;
begin
  select pe.user_id,pe.profile_id,pe.event_id into v
    from public.player_events pe
    join public.profiles p on p.id=pe.profile_id and p.user_id=pe.user_id
    where pe.status='pending_choice' limit 1;
  if not found then
    raise notice 'SKIP: no pending choice test fixture';
    return;
  end if;
  select id into v_wrong_user from auth.users where id <> v.user_id limit 1;
  if not found then
    raise notice 'SKIP: no second auth user fixture';
    return;
  end if;
  begin
    v_assigned := public.assign_random_event_if_available(
      v_wrong_user,v.profile_id,v.event_id
    );
  exception when raise_exception then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Assignment accepted a character not owned by user';
  end if;
  raise notice 'PASS: cross-account character assignment rejected';
end;
$$;
rollback;
