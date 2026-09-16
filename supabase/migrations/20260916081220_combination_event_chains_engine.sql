alter table public.random_events
  add column if not exists combination_conditions jsonb not null default '{}'::jsonb,
  add column if not exists chain_key text,
  add column if not exists chain_step integer,
  add column if not exists chain_only boolean not null default false,
  add column if not exists next_event_title_a text,
  add column if not exists next_event_title_b text,
  add column if not exists next_event_delay_hours_a integer not null default 24,
  add column if not exists next_event_delay_hours_b integer not null default 24,
  add column if not exists event_weight integer not null default 100;

alter table public.player_events
  add column if not exists available_at timestamptz,
  add column if not exists chain_instance_id uuid,
  add column if not exists parent_player_event_id uuid references public.player_events(id) on delete set null,
  add column if not exists chain_key text;

create index if not exists idx_player_events_scheduled_available
  on public.player_events(status, available_at)
  where status = 'scheduled';

create index if not exists idx_player_events_profile_status
  on public.player_events(profile_id, status);

create index if not exists idx_random_events_chain_key_step
  on public.random_events(chain_key, chain_step)
  where chain_key is not null;

alter table public.random_events
  drop constraint if exists random_events_event_weight_positive;
alter table public.random_events
  add constraint random_events_event_weight_positive check (event_weight between 1 and 1000);

alter table public.random_events
  drop constraint if exists random_events_chain_step_positive;
alter table public.random_events
  add constraint random_events_chain_step_positive check (chain_step is null or chain_step > 0);

alter table public.random_events
  drop constraint if exists random_events_chain_delay_nonnegative;
alter table public.random_events
  add constraint random_events_chain_delay_nonnegative check (next_event_delay_hours_a >= 0 and next_event_delay_hours_b >= 0);
