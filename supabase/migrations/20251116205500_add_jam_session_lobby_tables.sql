-- Create jam_session_participants table for lobby metadata
create table if not exists public.jam_session_participants (
  id uuid primary key default gen_random_uuid(),
  jam_session_id uuid not null references public.jam_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_ready boolean not null default false,
  skill_tier text not null default 'Rising Star',
  co_play_count integer not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jam_session_participants_unique_profile unique (jam_session_id, profile_id)
);

create index if not exists jam_session_participants_session_idx
  on public.jam_session_participants (jam_session_id);
create index if not exists jam_session_participants_profile_idx
  on public.jam_session_participants (profile_id);

create or replace function public.touch_jam_session_participants_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_jam_session_participants_updated_at on public.jam_session_participants;
create trigger touch_jam_session_participants_updated_at
  before update on public.jam_session_participants
  for each row
  execute function public.touch_jam_session_participants_updated_at();

alter table public.jam_session_participants enable row level security;

drop policy if exists "Participants can view session participants" on public.jam_session_participants;
create policy "Participants can view session participants"
  on public.jam_session_participants
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Participants can register themselves" on public.jam_session_participants;
create policy "Participants can register themselves"
  on public.jam_session_participants
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Participants can update readiness" on public.jam_session_participants;
create policy "Participants can update readiness"
  on public.jam_session_participants
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Create jam_session_messages table for lobby chat
create table if not exists public.jam_session_messages (
  id uuid primary key default gen_random_uuid(),
  jam_session_id uuid not null references public.jam_sessions(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists jam_session_messages_session_idx
  on public.jam_session_messages (jam_session_id, created_at desc);

alter table public.jam_session_messages enable row level security;

drop policy if exists "Jam messages readable by authenticated" on public.jam_session_messages;
create policy "Jam messages readable by authenticated"
  on public.jam_session_messages
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Jam messages insertable by authenticated" on public.jam_session_messages;
create policy "Jam messages insertable by authenticated"
  on public.jam_session_messages
  for insert
  with check (auth.role() = 'authenticated');

-- Track whether a session is broadcast to the community feed
alter table public.jam_sessions
  add column if not exists broadcast_to_feed boolean not null default false;
