-- Only finalised performers are eligible for gig quest credit.
-- Replaces the earlier membership-based trigger without rerolling or awarding XP.
create or replace function public.record_completed_gig_skill_quest()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;

  insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
  select distinct gp.profile_id, 'first_live_show', 'gig_completed', new.gig_id
  from public.gigs g
  join public.gig_performers gp on gp.gig_id = g.id and gp.band_id = g.band_id
  where g.id = new.gig_id
    and g.status = 'completed'
    and g.result_ready_at is not null
    and gp.lineup_status = 'performed'
    and gp.performed_at is not null
  on conflict (profile_id, quest_id, source_type, source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.record_completed_gig_skill_quest() from public, anon, authenticated;
-- Do not backfill or delete previous event records: reconcile separately using
-- authoritative historical attendance evidence before changing player progress.
