-- Explicit, non-rewarding resolution of quarantined pre-rollout random events.
-- No historical XP, cash, fame, band rewards, or profile identity is inferred.
create table if not exists public.random_event_legacy_resolutions (
  player_event_id uuid primary key references public.player_events(id),
  user_id uuid not null,
  resolution text not null check (resolution = 'closed_without_replay'),
  reason text not null,
  resolved_at timestamptz not null default now()
);
alter table public.random_event_legacy_resolutions enable row level security;
revoke all on public.random_event_legacy_resolutions from anon, authenticated;
grant select, insert on public.random_event_legacy_resolutions to service_role;

create or replace function public.close_quarantined_random_event(
  p_player_event_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare v_event record;
begin
  if nullif(btrim(coalesce(p_reason,'')), '') is null then
    raise exception 'A human-reviewed reconciliation reason is required';
  end if;
  select id, user_id, status, choice_made_at, outcome_applied
  into v_event
  from public.player_events
  where id = p_player_event_id
  for update;
  if not found then return jsonb_build_object('closed',false,'reason','not_found'); end if;
  if exists(select 1 from public.random_event_legacy_resolutions
            where player_event_id = p_player_event_id) then
    return jsonb_build_object('closed',false,'reason','already_reconciled');
  end if;
  if v_event.status <> 'awaiting_outcome'
     or v_event.outcome_applied
     or v_event.choice_made_at is null
     or v_event.choice_made_at >= timestamptz '2026-10-09 00:00:00+00'
  then
    return jsonb_build_object('closed',false,'reason','not_quarantined');
  end if;
  insert into public.random_event_legacy_resolutions
    (player_event_id,user_id,resolution,reason)
  values (p_player_event_id,v_event.user_id,'closed_without_replay',p_reason);

  update public.player_events
  set status='expired',
      outcome_message='This older event was closed without replaying rewards to avoid duplicate or misdirected payouts.'
  where id=p_player_event_id;

  insert into public.player_inbox(
    user_id,category,priority,title,message,metadata,
    related_entity_type,related_entity_id,action_type,action_data
  ) values (
    v_event.user_id,'random_event','normal',
    'Older daily event closed',
    'An older daily event could not be safely replayed. It has been closed without changing your XP, cash, fame, or other rewards. If you believe a reward is missing, please contact game support.',
    jsonb_build_object('player_event_id',p_player_event_id,'resolution','closed_without_replay'),
    'player_event',p_player_event_id,null,null
  );
  return jsonb_build_object('closed',true,'reason','closed_without_replay');
end;
$$;
revoke all on function public.close_quarantined_random_event(uuid,text) from public,anon,authenticated;
grant execute on function public.close_quarantined_random_event(uuid,text) to service_role;
