-- Limit player event mutations to privileged server paths.
drop policy if exists "Users can update their own events" on public.player_events;
revoke update on public.player_events from anon, authenticated;

-- Atomic choice transition. A second concurrent request cannot overwrite the first.
create or replace function public.submit_random_event_choice(p_player_event_id uuid, p_choice text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_event record;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if p_choice not in ('a','b') then raise exception 'Invalid choice' using errcode='22023'; end if;
  update public.player_events
  set choice_made=p_choice, choice_made_at=now(), status='awaiting_outcome'
  where id=p_player_event_id and user_id=auth.uid()
    and status='pending_choice' and choice_made is null
  returning id, event_id, choice_made into v_event;
  if not found then
    return jsonb_build_object('success', false, 'reason','already_selected_or_missing');
  end if;
  insert into public.player_event_history (user_id,event_id,first_seen_at)
  select auth.uid(), re.id, now() from public.random_events re
  where re.id=v_event.event_id and not re.is_common
  on conflict (user_id,event_id) do nothing;
  return jsonb_build_object('success',true,'event_id',v_event.event_id,'choice',p_choice);
end;
$$;
revoke all on function public.submit_random_event_choice(uuid,text) from public,anon;
grant execute on function public.submit_random_event_choice(uuid,text) to authenticated,service_role;
