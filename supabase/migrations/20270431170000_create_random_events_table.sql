-- Create random events table to power world environment random events UI
create table if not exists public.random_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    expiry timestamptz not null,
    rarity text not null default 'common',
    choices jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Helper function to keep the updated_at column fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Ensure updated_at is maintained automatically
create trigger set_random_events_updated_at
before update on public.random_events
for each row
execute function public.set_updated_at();

-- Helpful indexes for filtering
create index if not exists random_events_expiry_idx on public.random_events using btree (expiry);
create index if not exists random_events_rarity_idx on public.random_events using btree (rarity);

-- Seed a few starter events to avoid empty UI state during development
insert into public.random_events (id, title, description, expiry, rarity, choices)
values
    (
        gen_random_uuid(),
        'Backstage Equipment Glitch',
        'A sudden malfunction in critical gear threatens tonight''s show.',
        timezone('utc'::text, now()) + interval '2 days',
        'rare',
        '[
          {"id": "repair", "text": "Pay premium for emergency repairs", "effects": {"expenses": 500, "morale": 5}},
          {"id": "improvise", "text": "Improvise with backup equipment", "effects": {"gig_attendance": -10, "morale": 2}}
        ]'::jsonb
    ),
    (
        gen_random_uuid(),
        'Viral Street Performance',
        'A spontaneous performance downtown is drawing massive crowds and social buzz.',
        timezone('utc'::text, now()) + interval '5 days',
        'epic',
        '[
          {"id": "join_in", "text": "Join the jam to ride the wave", "effects": {"audience": 15, "morale": 8}},
          {"id": "promote", "text": "Promote upcoming tour dates to the crowd", "effects": {"attendance": 10, "travel_cost": 200}}
        ]'::jsonb
    )
on conflict do nothing;
