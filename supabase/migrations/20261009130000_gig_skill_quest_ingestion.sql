-- Gig quest: credit active band members only when a gig has verified
-- completed consequence processing and is marked result-ready.
-- Deliberately no historical backfill: current membership cannot prove past participation.
create or replace function public.record_completed_gig_skill_quest()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_band_id uuid;
begin
  if new.status <> 'completed'
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  select g.band_id into v_band_id
  from public.gigs g
  where g.id = new.gig_id
    and g.status = 'completed'
    and g.result_ready_at is not null;

  if v_band_id is null then return new; end if;

  insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
  select distinct bm.profile_id, 'first_live_show', 'gig_completed', new.gig_id
  from public.band_members bm
  where bm.band_id = v_band_id and bm.profile_id is not null
    and coalesce(bm.is_touring_member, false) = false
  on conflict (profile_id, quest_id, source_type, source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.record_completed_gig_skill_quest() from public, anon, authenticated;
drop trigger if exists record_completed_gig_skill_quest on public.gig_post_processing;
create trigger record_completed_gig_skill_quest
after insert or update of status on public.gig_post_processing
for each row execute function public.record_completed_gig_skill_quest();
