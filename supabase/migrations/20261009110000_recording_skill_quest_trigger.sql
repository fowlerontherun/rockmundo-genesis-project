-- Quest ingestion from completed recording sessions.
-- Require the scheduled end to have passed; avoid granting credit for early client status changes.
-- The quest has no XP or monetary reward.
create or replace function public.record_completed_recording_skill_quest()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.profile_id is not null
     and new.status = 'completed'
     and new.scheduled_end is not null
     and new.scheduled_end <= now()
     and (tg_op = 'INSERT' or old.status is distinct from new.status
          or old.scheduled_end is distinct from new.scheduled_end) then
    insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
    values (new.profile_id, 'first_recording', 'recording_completed', new.id)
    on conflict (profile_id, quest_id, source_type, source_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.record_completed_recording_skill_quest() from public, anon, authenticated;
drop trigger if exists record_completed_recording_skill_quest on public.recording_sessions;
create trigger record_completed_recording_skill_quest
after insert or update of status, scheduled_end on public.recording_sessions
for each row execute function public.record_completed_recording_skill_quest();

-- Backfill only genuine completed, elapsed sessions with an explicit profile.
insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
select rs.profile_id, 'first_recording', 'recording_completed', rs.id
from public.recording_sessions rs
where rs.profile_id is not null
  and rs.status = 'completed'
  and rs.scheduled_end is not null
  and rs.scheduled_end <= now()
on conflict (profile_id, quest_id, source_type, source_id) do nothing;
