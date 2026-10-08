-- Wellness professionals schema extension. Non-destructive and designed to reuse
-- existing profiles, jobs, company_employees, schedule_events and finance ledgers.

create table if not exists public.wellness_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  provider_kind text not null check (provider_kind in ('npc', 'player')),
  role text not null,
  qualification_tier text not null default 'trainee' check (qualification_tier in ('trainee', 'qualified', 'experienced', 'expert', 'elite')),
  professional_xp integer not null default 0 check (professional_xp >= 0),
  completed_appointments integer not null default 0 check (completed_appointments >= 0),
  reliability numeric not null default 85 check (reliability >= 0 and reliability <= 100),
  reputation_score numeric not null default 0 check (reputation_score >= 0 and reputation_score <= 100),
  active boolean not null default true,
  server_assigned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_provider_player_or_npc check ((provider_kind = 'player' and profile_id is not null) or provider_kind = 'npc')
);

create unique index if not exists wellness_provider_profiles_player_role_idx
  on public.wellness_provider_profiles(profile_id, role)
  where profile_id is not null;

create table if not exists public.wellness_provider_listings (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references public.wellness_provider_profiles(id) on delete cascade,
  service_slug text not null,
  price_cents integer not null check (price_cents >= 0),
  city_id uuid references public.cities(id) on delete set null,
  remote_available boolean not null default false,
  weekly_capacity_minutes integer not null default 240 check (weekly_capacity_minutes >= 0 and weekly_capacity_minutes <= 2400),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_profile_id, service_slug, city_id, remote_available)
);

create table if not exists public.wellness_appointments (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references public.wellness_provider_profiles(id) on delete restrict,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  service_slug text not null,
  role text not null,
  schedule_event_id uuid references public.schedule_events(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_city_id uuid references public.cities(id) on delete set null,
  remote boolean not null default false,
  price_cents integer not null check (price_cents >= 0),
  status text not null default 'booked' check (status in ('requested', 'booked', 'cancelled_early', 'cancelled_late', 'client_no_show', 'provider_no_show', 'completed', 'partially_completed', 'refunded', 'disputed')),
  client_attended boolean,
  provider_attended boolean,
  payment_transaction_id uuid,
  refund_transaction_id uuid,
  outcome_applied_at timestamptz,
  xp_awarded_at timestamptz,
  cancellation_deadline timestamptz,
  related_party_flag boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_appointments_valid_time check (ends_at > starts_at)
);

create index if not exists wellness_appointments_provider_time_idx on public.wellness_appointments(provider_profile_id, starts_at, ends_at) where status in ('requested', 'booked');
create index if not exists wellness_appointments_client_time_idx on public.wellness_appointments(client_profile_id, starts_at, ends_at) where status in ('requested', 'booked');
create unique index if not exists wellness_appointments_outcome_once_idx on public.wellness_appointments(id) where outcome_applied_at is not null;

create table if not exists public.wellness_support_contracts (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references public.wellness_provider_profiles(id) on delete restrict,
  client_profile_id uuid references public.profiles(id) on delete cascade,
  band_id uuid references public.bands(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  service_package text not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'tour', 'retainer')),
  starts_on date not null,
  ends_on date,
  price_cents integer not null check (price_cents >= 0),
  included_appointments integer not null default 1 check (included_appointments >= 0),
  auto_renew boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'active', 'cancelled', 'completed', 'disputed')),
  last_cycle_processed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_support_contracts_client_or_band check (client_profile_id is not null or band_id is not null)
);

create table if not exists public.wellness_care_plans (
  id uuid primary key default gen_random_uuid(),
  provider_profile_id uuid not null references public.wellness_provider_profiles(id) on delete restrict,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  contract_id uuid references public.wellness_support_contracts(id) on delete set null,
  name text not null,
  starts_on date not null,
  ends_on date,
  review_on date,
  recommendations jsonb not null default '{}'::jsonb,
  expected_benefits jsonb not null default '{}'::jsonb,
  adherence_score numeric not null default 0 check (adherence_score >= 0 and adherence_score <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wellness_professional_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.wellness_appointments(id) on delete cascade,
  provider_profile_id uuid not null references public.wellness_provider_profiles(id) on delete cascade,
  client_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  punctual boolean,
  helpful boolean,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'flagged', 'hidden')),
  created_at timestamptz not null default now(),
  unique(appointment_id),
  unique(appointment_id, client_profile_id)
);

create table if not exists public.wellness_professional_audit_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.wellness_appointments(id) on delete set null,
  provider_profile_id uuid references public.wellness_provider_profiles(id) on delete set null,
  client_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'fraud_risk', 'admin')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.jobs add column if not exists wellness_role text;
alter table public.jobs add column if not exists wellness_required_qualification text check (wellness_required_qualification is null or wellness_required_qualification in ('trainee', 'qualified', 'experienced', 'expert', 'elite'));
alter table public.jobs add column if not exists wellness_required_skills jsonb not null default '{}'::jsonb;
alter table public.jobs add column if not exists remote_eligible boolean not null default false;
alter table public.company_employees add column if not exists wellness_role text;
alter table public.company_employees add column if not exists wellness_provider_profile_id uuid references public.wellness_provider_profiles(id) on delete set null;

alter table public.wellness_provider_profiles enable row level security;
alter table public.wellness_provider_listings enable row level security;
alter table public.wellness_appointments enable row level security;
alter table public.wellness_support_contracts enable row level security;
alter table public.wellness_care_plans enable row level security;
alter table public.wellness_professional_reviews enable row level security;
alter table public.wellness_professional_audit_events enable row level security;
