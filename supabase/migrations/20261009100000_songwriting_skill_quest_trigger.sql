-- Record the first songwriting quest when the canonical project is completed.
-- Does not grant rewards. A unique source key makes repeated updates idempotent.
create or replace function public.record_completed_songwriting_skill_quest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null then
    return new;
  end if;

  if (new.status in ('completed', 'complete', 'converted') or new.song_id is not null)
     and (tg_op = 'INSERT' or (old.status is distinct from new.status or old.song_id is distinct from new.song_id)) then
    insert into public.skill_quest_events (profile_id, quest_id, source_type, source_id)
    values (new.profile_id, 'first_finished_song', 'songwriting_completed', new.id)
    on conflict (profile_id, quest_id, source_type, source_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.record_completed_songwriting_skill_quest() from public, anon, authenticated;

drop trigger if exists record_completed_songwriting_skill_quest on public.songwriting_projects;
create trigger record_completed_songwriting_skill_quest
after insert or update of status, song_id on public.songwriting_projects
for each row execute function public.record_completed_songwriting_skill_quest();

-- Historical reconciliation: only projects already marked complete in the database.
insert into public.skill_quest_events (profile_id, quest_id, source_type, source_id)
select sp.profile_id, 'first_finished_song', 'songwriting_completed', sp.id
from public.songwriting_projects sp
where sp.profile_id is not null
  and (sp.status in ('completed', 'complete', 'converted') or sp.song_id is not null)
on conflict (profile_id, quest_id, source_type, source_id) do nothing;
