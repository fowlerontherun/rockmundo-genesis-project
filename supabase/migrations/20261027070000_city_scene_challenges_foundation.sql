-- City Scene Challenges: schema-only, fail-closed foundation.
-- No cron, source adapter, scoring RPC, financial mutation or reward payout is enabled here.
-- Review deployed migration order and run staging dry-run before applying.
begin;

create table public.scene_challenge_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 3 and 100),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  title text not null check (length(title) between 3 and 120),
  description text not null default '',
  action_type text not null check (length(action_type) between 3 and 80),
  target_weight numeric(8,3) not null default 1 check (target_weight > 0),
  reward_config jsonb not null default '{}'::jsonb,
  art_theme text not null default 'city-scene',
  version integer not null default 1 check (version > 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.scene_challenge_cycles (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active_population_snapshot integer not null default 0 check (active_population_snapshot >= 0),
  theme_slug text not null default 'city-scene',
  art_version integer not null default 1 check (art_version > 0),
  target_total integer not null check (target_total > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint scene_challenge_cycles_dates check (ends_at > starts_at),
  constraint scene_challenge_cycles_unique unique (city_id, cadence, starts_at)
);
create index scene_challenge_cycles_lookup
  on public.scene_challenge_cycles(city_id, cadence, starts_at desc, ends_at);

create table public.scene_challenge_objectives (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.scene_challenge_cycles(id) on delete cascade,
  template_id uuid not null references public.scene_challenge_templates(id) on delete restrict,
  target_points integer not null check (target_points > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'disabled')),
  source_health_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint scene_challenge_objectives_unique unique (cycle_id, template_id)
);
create index scene_challenge_objectives_cycle
  on public.scene_challenge_objectives(cycle_id);

-- One scene per human account per UTC day, even when controlling multiple profiles.
create table public.scene_daily_affiliations (
  account_id uuid not null references auth.users(id) on delete cascade,
  date_utc date not null,
  city_id uuid not null references public.cities(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, date_utc)
);

-- Derived progress must be computed from this canonical ledger; no mutable counter
-- can drift independently from verified contributions.
create table public.scene_contributions (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.scene_challenge_objectives(id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  band_id uuid references public.bands(id) on delete set null,
  city_id uuid not null references public.cities(id) on delete restrict,
  source_type text not null check (length(source_type) between 3 and 80),
  source_event_id text not null check (length(source_event_id) between 1 and 160),
  source_completed_at timestamptz not null,
  points smallint not null check (points between 1 and 5),
  bonus_reason text,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scene_contributions_dedupe unique (objective_id, source_type, source_event_id, account_id)
);
create index scene_contributions_live_objective
  on public.scene_contributions(objective_id) include (points)
  where invalidated_at is null;
create index scene_contributions_account_history
  on public.scene_contributions(account_id, source_completed_at desc);
create index scene_contributions_source
  on public.scene_contributions(source_type, source_event_id);

create table public.scene_milestones (
  cycle_id uuid not null references public.scene_challenge_cycles(id) on delete cascade,
  percent_threshold smallint not null check (percent_threshold in (25, 50, 75, 100)),
  reached_at timestamptz not null default now(),
  art_version integer not null check (art_version > 0),
  announcement_id uuid,
  primary key (cycle_id, percent_threshold)
);

-- No reward issuance is possible from this migration. The later grant processor
-- must store the canonical XP/fame ledger reference BEFORE setting 'granted'.
create table public.scene_reward_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cycle_id uuid not null references public.scene_challenge_cycles(id) on delete restrict,
  reward_key text not null check (length(reward_key) between 1 and 100),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'granted', 'retry_required', 'expired')),
  entitled_at timestamptz not null default now(),
  claimed_at timestamptz,
  expires_at timestamptz,
  grant_reference text,
  unique (account_id, cycle_id, reward_key),
  constraint scene_reward_claims_grant_evidence
    check (status <> 'granted' or (claimed_at is not null and grant_reference is not null))
);
create index scene_reward_claims_owner_status
  on public.scene_reward_claims(account_id, status, entitled_at desc);

alter table public.scene_challenge_templates enable row level security;
alter table public.scene_challenge_cycles enable row level security;
alter table public.scene_challenge_objectives enable row level security;
alter table public.scene_daily_affiliations enable row level security;
alter table public.scene_contributions enable row level security;
alter table public.scene_milestones enable row level security;
alter table public.scene_reward_claims enable row level security;

revoke all on public.scene_challenge_templates, public.scene_challenge_cycles,
  public.scene_challenge_objectives, public.scene_daily_affiliations,
  public.scene_contributions, public.scene_milestones, public.scene_reward_claims
  from public, anon, authenticated;

-- Aggregates and templates have no private actor data.
grant select on public.scene_challenge_templates, public.scene_challenge_cycles,
  public.scene_challenge_objectives, public.scene_milestones to authenticated;
grant select on public.scene_daily_affiliations, public.scene_contributions,
  public.scene_reward_claims to authenticated;
grant all on public.scene_challenge_templates, public.scene_challenge_cycles,
  public.scene_challenge_objectives, public.scene_daily_affiliations,
  public.scene_contributions, public.scene_milestones, public.scene_reward_claims
  to service_role;

create policy scene_templates_visible on public.scene_challenge_templates
  for select to authenticated using (enabled = true);
create policy scene_cycles_visible on public.scene_challenge_cycles
  for select to authenticated using (true);
create policy scene_objectives_visible on public.scene_challenge_objectives
  for select to authenticated using (true);
create policy scene_milestones_visible on public.scene_milestones
  for select to authenticated using (true);

create policy scene_affiliation_owner_read on public.scene_daily_affiliations
  for select to authenticated using (account_id = (select auth.uid()));
create policy scene_contribution_owner_read on public.scene_contributions
  for select to authenticated using (account_id = (select auth.uid()));
create policy scene_reward_owner_read on public.scene_reward_claims
  for select to authenticated using (account_id = (select auth.uid()));

-- No authenticated INSERT/UPDATE/DELETE policies, public-scoring RPCs,
-- source adapters or reward processing are installed by this foundation.
commit;
