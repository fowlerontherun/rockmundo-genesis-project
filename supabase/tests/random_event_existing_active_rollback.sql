-- Rollback-only smoke test: existing active event must prevent reassignment.
-- Works with any account already holding a pending choice.
-- Never persist any test write.
begin;
do $$
declare v record; v_result uuid;
begin
 select pe.user_id, pe.profile_id, pe.event_id into v
 from public.player_events pe
 join public.profiles p on p.id=pe.profile_id and p.user_id=pe.user_id
 where pe.status='pending_choice'
 limit 1;
 if not found then raise notice 'SKIP: no active event fixture'; return; end if;
 v_result := public.assign_random_event_if_available(v.user_id,v.profile_id,v.event_id);
 if v_result is not null then
   raise exception 'Assignment allowed a duplicate current event for account';
 end if;
 raise notice 'PASS: existing active event prevents another assignment';
end;
$$;
rollback;
