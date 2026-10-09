-- Phase 2: server-owned, idempotent skill quest progress foundation.
-- No client grants, XP rewards or inferred completions.
create table if not exists public.skill_quest_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null check (length(quest_id) between 1 and 100),
  source_type text not null check (source_type in ('gig_completed', 'songwriting_completed', 'recording_completed', 'instrument_crafted')),
  source_id uuid not null,
  recorded_at timestamptz not null default now(),
  constraint skill_quest_events_unique_source unique (profile_id, quest_id, source_type, source_id)
);

create index if not exists skill_quest_events_profile_quest_idx
  on public.skill_quest_events(profile_id, quest_id);

alter table public.skill_quest_events enable row level security;
revoke all on public.skill_quest_events from public, anon, authenticated;
grant select on public.skill_quest_events to authenticated;

drop policy if exists skill_quest_events_owner_read on public.skill_quest_events;
create policy skill_quest_events_owner_read on public.skill_quest_events
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = skill_quest_events.profile_id and p.user_id = (select auth.uid())
  ));

-- Service role workers may insert only verified, completed activity sources.
-- Their source validation is deliberately not implemented in this migration.
-- Never expose an authenticated INSERT policy or SECURITY DEFINER client RPC.
