-- Reward catalogue is a server-owned allowlist, not a payment processor.
-- Activation is intentionally disabled until an atomic XP payout routine is reviewed.
create table if not exists public.skill_quest_reward_definitions (
  quest_id text primary key check (length(quest_id) between 1 and 100),
  source_type text not null check (source_type in ('gig_completed','songwriting_completed','recording_completed','instrument_crafted')),
  reward_kind text not null default 'xp' check (reward_kind = 'xp'),
  reward_amount integer not null check (reward_amount between 1 and 5000),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.skill_quest_reward_definitions enable row level security;
revoke all on public.skill_quest_reward_definitions from public, anon, authenticated;
grant select on public.skill_quest_reward_definitions to authenticated;
drop policy if exists skill_quest_reward_definitions_read on public.skill_quest_reward_definitions;
create policy skill_quest_reward_definitions_read on public.skill_quest_reward_definitions
for select to authenticated using (true);
insert into public.skill_quest_reward_definitions(quest_id,source_type,reward_kind,reward_amount,enabled)
values
('first_live_show','gig_completed','xp',500,false),
('first_finished_song','songwriting_completed','xp',400,false),
('first_recording','recording_completed','xp',400,false),
('first_crafted_instrument','instrument_crafted','xp',500,false)
on conflict (quest_id) do nothing;
