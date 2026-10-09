-- A performer may be confirmed after post-gig processing completes.
-- Credit them at that transition too, without requiring a rerun of consequences.
create or replace function public.record_gig_skill_quest_on_performer_confirmation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.lineup_status <> 'performed' or new.performed_at is null
    or (tg_op = 'UPDATE' and old.lineup_status = 'performed' and old.performed_at is not null)
  then
    return new;
  end if;

  insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
  select new.profile_id, 'first_live_show', 'gig_completed', g.id
  from public.gigs g
  join public.gig_post_processing p on p.gig_id = g.id
  where g.id = new.gig_id
    and g.band_id = new.band_id
    and g.status = 'completed'
    and g.result_ready_at is not null
    and p.status = 'completed'
  on conflict (profile_id, quest_id, source_type, source_id) do nothing;

  return new;
end;
$$;
revoke all on function public.record_gig_skill_quest_on_performer_confirmation() from public, anon, authenticated;
drop trigger if exists record_gig_skill_quest_on_performer_confirmation on public.gig_performers;
create trigger record_gig_skill_quest_on_performer_confirmation
after insert or update of lineup_status, performed_at on public.gig_performers
for each row execute function public.record_gig_skill_quest_on_performer_confirmation();
