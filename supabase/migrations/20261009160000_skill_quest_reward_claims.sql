-- Phase 2: server-owned reward claims, without activating any currency/XP grant.
-- A claim is distinct from a paid reward: no grant occurs until a trusted
-- processor records a configured reward transaction in a later migration.
create table if not exists public.skill_quest_reward_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null check (length(quest_id) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','granted','failed')),
  reward_kind text,
  reward_amount integer,
  reward_transaction_id uuid,
  created_at timestamptz not null default now(),
  granted_at timestamptz,
  unique (profile_id, quest_id),
  constraint skill_quest_reward_claims_grant_consistency check (
    (status = 'granted' and reward_kind is not null and reward_amount is not null
       and reward_amount > 0 and reward_transaction_id is not null and granted_at is not null)
    or (status <> 'granted' and reward_transaction_id is null and granted_at is null)
  )
);
create index if not exists skill_quest_reward_claims_profile_idx
  on public.skill_quest_reward_claims(profile_id, created_at desc);
alter table public.skill_quest_reward_claims enable row level security;
revoke all on public.skill_quest_reward_claims from public, anon, authenticated;
grant select on public.skill_quest_reward_claims to authenticated;
drop policy if exists skill_quest_reward_claims_owner_read on public.skill_quest_reward_claims;
create policy skill_quest_reward_claims_owner_read on public.skill_quest_reward_claims
  for select to authenticated
  using (exists (select 1 from public.profiles p
    where p.id = skill_quest_reward_claims.profile_id and p.user_id = (select auth.uid())));

-- Seed pending claims only from verified ledger events; no rewards granted.
insert into public.skill_quest_reward_claims(profile_id, quest_id)
select e.profile_id, e.quest_id
from public.skill_quest_events e
where (e.quest_id, e.source_type) in (('first_live_show','gig_completed'),('first_finished_song','songwriting_completed'),('first_recording','recording_completed'),('first_crafted_instrument','instrument_crafted'))
group by e.profile_id, e.quest_id
having count(distinct (e.source_type, e.source_id)) >= 1
on conflict (profile_id, quest_id) do nothing;

create or replace function public.enqueue_skill_quest_reward_claim()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.quest_id, new.source_type) in (('first_live_show','gig_completed'),('first_finished_song','songwriting_completed'),('first_recording','recording_completed'),('first_crafted_instrument','instrument_crafted')) then
    insert into public.skill_quest_reward_claims(profile_id, quest_id)
    values (new.profile_id, new.quest_id)
    on conflict (profile_id, quest_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_skill_quest_reward_claim() from public, anon, authenticated;
drop trigger if exists enqueue_skill_quest_reward_claim on public.skill_quest_events;
create trigger enqueue_skill_quest_reward_claim
after insert on public.skill_quest_events
for each row execute function public.enqueue_skill_quest_reward_claim();

-- Existing events may have been corrected after a claim was created. Remove
-- pending claims with no matching evidence; never delete a paid claim.
delete from public.skill_quest_reward_claims c
where c.status = 'pending'
  and not exists (
    select 1 from public.skill_quest_events e
    where e.profile_id = c.profile_id and e.quest_id = c.quest_id
      and (e.quest_id, e.source_type) in (('first_live_show','gig_completed'),('first_finished_song','songwriting_completed'),('first_recording','recording_completed'),('first_crafted_instrument','instrument_crafted'))
  );
