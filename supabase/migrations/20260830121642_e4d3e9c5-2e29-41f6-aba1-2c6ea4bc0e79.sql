CREATE OR REPLACE FUNCTION public.send_friend_request(target_profile_id uuid, requestor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS public.friendships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  v_target uuid := target_profile_id;
  v_me uuid := public._assert_owned_profile(coalesce(requestor_profile_id, public.current_profile_id()));
  v_row public.friendships%rowtype;
  v_recent_decline timestamptz;
begin
  if v_target is null then raise exception 'Choose a player to add as a friend.'; end if;
  if v_me = v_target then raise exception 'You cannot add yourself'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_target and p.died_at is null) then raise exception 'That player could not be found'; end if;
  if public.are_profiles_blocked(v_me, v_target) then raise exception 'This player is unavailable'; end if;

  select max(a.created_at) into v_recent_decline
  from public.social_relationship_audit a
  where a.action = 'friend_request_declined'
    and a.actor_profile_id = v_target
    and a.target_profile_id = v_me;
  if v_recent_decline is not null and v_recent_decline > now() - interval '24 hours' then
    raise exception 'Friend request declined recently';
  end if;

  select f.* into v_row from public.friendships f
  where (f.requestor_id = v_me and f.addressee_id = v_target)
     or (f.requestor_id = v_target and f.addressee_id = v_me)
  order by f.updated_at desc limit 1 for update;

  if v_row.id is not null then
    if v_row.status = 'accepted' then return v_row; end if;
    if v_row.status = 'pending' then
      if v_row.addressee_id = v_me then
        update public.friendships set status='accepted', responded_at=now(), updated_at=now() where id = v_row.id returning * into v_row;
        insert into public.social_relationship_audit(actor_profile_id, target_profile_id, friendship_id, action)
        values (v_me, v_target, v_row.id, 'friend_request_accepted');
      end if;
      return v_row;
    end if;
    if v_row.status = 'blocked' then raise exception 'This player is unavailable'; end if;
    update public.friendships set status='pending', requestor_id=v_me, addressee_id=v_target, responded_at=null, updated_at=now() where id = v_row.id returning * into v_row;
  else
    insert into public.friendships(requestor_id, addressee_id, status) values (v_me, v_target, 'pending') returning * into v_row;
  end if;

  insert into public.social_relationship_audit(actor_profile_id, target_profile_id, friendship_id, action)
  values (v_me, v_target, v_row.id, 'friend_request_sent');
  return v_row;
end $function$;