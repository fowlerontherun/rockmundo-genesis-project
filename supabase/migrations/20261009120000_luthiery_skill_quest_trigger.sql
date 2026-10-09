-- Phase 2: authoritative luthiery completion to quest ledger.
-- Luthiery crafts are created by the existing server-side crafting function.
-- No XP or item rewards are granted by this trigger.
create or replace function public.record_luthiery_skill_quest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.skill_quest_events (profile_id, quest_id, source_type, source_id)
  values (new.profile_id, 'first_crafted_instrument', 'instrument_crafted', new.id)
  on conflict (profile_id, quest_id, source_type, source_id) do nothing;
  return new;
end;
$$;

revoke all on function public.record_luthiery_skill_quest() from public, anon, authenticated;
drop trigger if exists record_luthiery_skill_quest on public.luthiery_crafts;
create trigger record_luthiery_skill_quest
after insert on public.luthiery_crafts
for each row execute function public.record_luthiery_skill_quest();

-- Historical crafts: one source record per completed authoritative craft.
insert into public.skill_quest_events(profile_id, quest_id, source_type, source_id)
select c.profile_id, 'first_crafted_instrument', 'instrument_crafted', c.id
from public.luthiery_crafts c
on conflict (profile_id, quest_id, source_type, source_id) do nothing;
