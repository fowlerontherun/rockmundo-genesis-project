-- Queue claims from verified activity evidence, but do not pay them.
-- Reward definitions remain disabled; enabling payouts is a separate reviewed step.
create or replace function public.enqueue_verified_skill_quest_reward_claim()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.skill_quest_reward_claims(profile_id, quest_id, reward_kind, reward_amount)
  select new.profile_id, d.quest_id, d.reward_kind, d.reward_amount
  from public.skill_quest_reward_definitions d
  where d.quest_id = new.quest_id
    and d.source_type = new.source_type
  on conflict (profile_id, quest_id, reward_kind) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_verified_skill_quest_reward_claim() from public, anon, authenticated;
drop trigger if exists enqueue_verified_skill_quest_reward_claim on public.skill_quest_events;
create trigger enqueue_verified_skill_quest_reward_claim
after insert on public.skill_quest_events
for each row execute function public.enqueue_verified_skill_quest_reward_claim();

-- Reconcile existing verified events against their server-owned definitions.
insert into public.skill_quest_reward_claims(profile_id, quest_id, reward_kind, reward_amount)
select distinct e.profile_id, d.quest_id, d.reward_kind, d.reward_amount
from public.skill_quest_events e
join public.skill_quest_reward_definitions d
  on d.quest_id = e.quest_id and d.source_type = e.source_type
on conflict (profile_id, quest_id, reward_kind) do nothing;
