-- Serialize assignments per account without modifying existing duplicate events.
create or replace function public.assign_random_event_if_available(
 p_user_id uuid,p_profile_id uuid,p_event_id uuid,
 p_target_release_id uuid default null,p_target_skill_slug text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_profile_id and user_id=p_user_id) then
   raise exception 'Profile does not belong to user';
 end if;
 -- All assignment paths share the same user-row lock.
 perform 1 from auth.users where id=p_user_id for update;
 if not found then return null; end if;
 if exists (
   select 1 from public.player_events
   where user_id=p_user_id and (
     status='pending_choice' or
     (status='awaiting_outcome' and choice_made_at >= timestamptz '2026-10-09 00:00:00+00')
   )
 ) then return null; end if;
 insert into public.player_events (
   user_id, profile_id, event_id, target_release_id, target_skill_slug, status
 ) values (
   p_user_id,p_profile_id,p_event_id,p_target_release_id,p_target_skill_slug,'pending_choice'
 ) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.assign_random_event_if_available(uuid,uuid,uuid,uuid,text)
 from public, anon, authenticated;
grant execute on function public.assign_random_event_if_available(uuid,uuid,uuid,uuid,text) to service_role;
