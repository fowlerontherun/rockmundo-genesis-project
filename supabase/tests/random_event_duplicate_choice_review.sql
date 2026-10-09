-- Read-only review of multiple current random-event choices per account.
-- Preserve choices; no event expiry or reward mutation.
with current_events as (
  select pe.*, re.title as event_title,
    count(*) over(partition by pe.user_id) as active_event_count,
    row_number() over(partition by pe.user_id order by pe.created_at,pe.id) as event_order
  from public.player_events pe
  join public.random_events re on re.id=pe.event_id
  where pe.status='pending_choice'
     or (pe.status='awaiting_outcome' and pe.choice_made_at >= timestamptz '2026-10-09 00:00:00+00')
)
select ce.user_id, ce.id as player_event_id,ce.event_title,
       ce.profile_id,ce.status,ce.created_at,ce.choice_made_at,
       ce.active_event_count,ce.event_order,
       (p.id is not null) as character_ownership_valid,
       case when ce.status='pending_choice'
         then 'preserve_player_choice_until_review'
         else 'preserve_chosen_event_and_outcome'
       end as recommendation
from current_events ce
left join public.profiles p on p.id=ce.profile_id and p.user_id=ce.user_id
where ce.active_event_count>1
order by ce.user_id,ce.created_at,ce.id;
