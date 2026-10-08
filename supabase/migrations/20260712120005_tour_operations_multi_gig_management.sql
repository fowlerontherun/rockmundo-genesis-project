-- Tour Operations, Touring Logistics and Multi-Gig Management

create table if not exists public.tour_operation_templates (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  name text not null,
  preferred_crew jsonb not null default '[]'::jsonb,
  production_package text not null default 'basic',
  vehicle_setup jsonb not null default '{}'::jsonb,
  accommodation_preferences jsonb not null default '{}'::jsonb,
  equipment_loadout jsonb not null default '[]'::jsonb,
  rehearsal_schedule jsonb not null default '{}'::jsonb,
  catering_preferences jsonb not null default '{}'::jsonb,
  backup_equipment jsonb not null default '[]'::jsonb,
  lighting_package text not null default 'house',
  audio_package text not null default 'house',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (band_id, name)
);

create table if not exists public.tour_operation_states (
  tour_id uuid primary key references public.tours(id) on delete cascade,
  current_city_id uuid references public.cities(id) on delete set null,
  current_stop_id uuid,
  template_id uuid references public.tour_operation_templates(id) on delete set null,
  budget_snapshot jsonb not null default '{}'::jsonb,
  logistics_snapshot jsonb not null default '{}'::jsonb,
  fatigue_score numeric not null default 0 check (fatigue_score between 0 and 100),
  health_score numeric not null default 100 check (health_score between 0 and 100),
  band_morale numeric not null default 70 check (band_morale between 0 and 100),
  crew_morale numeric not null default 70 check (crew_morale between 0 and 100),
  tour_reputation numeric not null default 50 check (tour_reputation between 0 and 100),
  tour_momentum numeric not null default 50 check (tour_momentum between 0 and 100),
  production_status text not null default 'ready' check (production_status in ('ready', 'at_risk', 'blocked')),
  outstanding_issues jsonb not null default '[]'::jsonb,
  last_recalculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_budget_ledger (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  gig_id uuid references public.gigs(id) on delete set null,
  category text not null,
  direction text not null check (direction in ('income', 'cost')),
  amount integer not null check (amount >= 0),
  source_type text not null,
  source_id text,
  description text,
  posted_at timestamptz not null default now(),
  unique (tour_id, source_type, source_id, category, direction)
);

create table if not exists public.tour_equipment_manifest (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  equipment_source text not null,
  equipment_id uuid,
  role text not null,
  load_weight numeric not null default 0 check (load_weight >= 0),
  condition_snapshot numeric not null default 100 check (condition_snapshot between 0 and 100),
  is_spare boolean not null default false,
  in_transit boolean not null default false,
  needs_repair boolean not null default false,
  replacement_cost integer not null default 0 check (replacement_cost >= 0),
  current_vehicle_id uuid,
  current_city_id uuid references public.cities(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_crew_schedules (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  gig_id uuid references public.gigs(id) on delete cascade,
  worker_type text not null check (worker_type in ('player', 'npc_staff', 'company_staff')),
  player_id uuid references public.profiles(id) on delete set null,
  npc_staff_id uuid,
  company_staff_id uuid,
  role text not null,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  daily_cost integer not null default 0 check (daily_cost >= 0),
  fatigue_score numeric not null default 0 check (fatigue_score between 0 and 100),
  morale_score numeric not null default 70 check (morale_score between 0 and 100),
  accommodation_status text not null default 'unassigned' check (accommodation_status in ('unassigned', 'booked', 'checked_in', 'missed')),
  transport_status text not null default 'pending' check (transport_status in ('pending', 'in_transit', 'arrived', 'missed')),
  created_at timestamptz not null default now(),
  check ((worker_type = 'player' and player_id is not null and npc_staff_id is null and company_staff_id is null) or (worker_type = 'npc_staff' and npc_staff_id is not null and player_id is null and company_staff_id is null) or (worker_type = 'company_staff' and company_staff_id is not null and player_id is null and npc_staff_id is null))
);

create table if not exists public.tour_merchandise_plans (
  tour_id uuid primary key references public.tours(id) on delete cascade,
  starting_stock integer not null default 0 check (starting_stock >= 0),
  stock_remaining integer not null default 0 check (stock_remaining >= 0),
  units_sold integer not null default 0 check (units_sold >= 0),
  lost_sales integer not null default 0 check (lost_sales >= 0),
  unit_cost integer not null default 0 check (unit_cost >= 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  reorder_quantity integer not null default 0 check (reorder_quantity >= 0),
  reorder_cost integer not null default 0 check (reorder_cost >= 0),
  shipping_cost integer not null default 0 check (shipping_cost >= 0),
  storage_cost_per_day integer not null default 0 check (storage_cost_per_day >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_sponsor_obligations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  sponsor_name text not null,
  obligation_type text not null check (obligation_type in ('meet_fans', 'social_post', 'vip_appearance', 'interview', 'merch_promotion')),
  due_gig_id uuid references public.gigs(id) on delete set null,
  due_at timestamptz,
  value_amount integer not null default 0 check (value_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'ignored', 'failed')),
  completed_at timestamptz,
  notes text,
  unique (tour_id, sponsor_name, obligation_type, due_gig_id)
);

create table if not exists public.tour_logistics_events (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  gig_id uuid references public.gigs(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  cost_impact integer not null default 0,
  fatigue_impact numeric not null default 0,
  morale_impact numeric not null default 0,
  resolved boolean not null default false,
  generated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.tour_completion_reports (
  tour_id uuid primary key references public.tours(id) on delete cascade,
  financial_performance jsonb not null default '{}'::jsonb,
  reputation_gained integer not null default 0,
  fans_gained integer not null default 0,
  crew_performance jsonb not null default '{}'::jsonb,
  equipment_wear jsonb not null default '{}'::jsonb,
  vehicle_usage jsonb not null default '{}'::jsonb,
  tour_highlights jsonb not null default '[]'::jsonb,
  best_gig_id uuid references public.gigs(id) on delete set null,
  worst_gig_id uuid references public.gigs(id) on delete set null,
  most_profitable_city_id uuid references public.cities(id) on delete set null,
  strongest_audience_city_id uuid references public.cities(id) on delete set null,
  biggest_media_story text,
  future_planning_modifiers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.tour_operation_templates enable row level security;
alter table public.tour_operation_states enable row level security;
alter table public.tour_budget_ledger enable row level security;
alter table public.tour_equipment_manifest enable row level security;
alter table public.tour_crew_schedules enable row level security;
alter table public.tour_merchandise_plans enable row level security;
alter table public.tour_sponsor_obligations enable row level security;
alter table public.tour_logistics_events enable row level security;
alter table public.tour_completion_reports enable row level security;

create policy "Band members view tour operation templates" on public.tour_operation_templates for select using (exists (select 1 from public.band_members bm where bm.band_id = tour_operation_templates.band_id and bm.user_id = auth.uid()));
create policy "Band leaders manage tour operation templates" on public.tour_operation_templates for all using (public.is_band_leader_or_manager(band_id, auth.uid())) with check (public.is_band_leader_or_manager(band_id, auth.uid()));

create policy "Band members view tour operation states" on public.tour_operation_states for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour operation states" on public.tour_operation_states for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour budget ledger" on public.tour_budget_ledger for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour budget ledger" on public.tour_budget_ledger for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour equipment manifest" on public.tour_equipment_manifest for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour equipment manifest" on public.tour_equipment_manifest for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour crew schedules" on public.tour_crew_schedules for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour crew schedules" on public.tour_crew_schedules for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour merchandise plans" on public.tour_merchandise_plans for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour merchandise plans" on public.tour_merchandise_plans for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour sponsor obligations" on public.tour_sponsor_obligations for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour sponsor obligations" on public.tour_sponsor_obligations for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour logistics events" on public.tour_logistics_events for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour logistics events" on public.tour_logistics_events for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create policy "Band members view tour completion reports" on public.tour_completion_reports for select using (exists (select 1 from public.tours t where t.id = tour_id and exists (select 1 from public.band_members bm where bm.band_id = t.band_id and bm.user_id = auth.uid())));
create policy "Band leaders manage tour completion reports" on public.tour_completion_reports for all using (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid()))) with check (exists (select 1 from public.tours t where t.id = tour_id and public.is_band_leader_or_manager(t.band_id, auth.uid())));

create index if not exists tour_budget_ledger_tour_id_idx on public.tour_budget_ledger(tour_id);
create index if not exists tour_equipment_manifest_tour_id_idx on public.tour_equipment_manifest(tour_id);
create index if not exists tour_crew_schedules_tour_id_idx on public.tour_crew_schedules(tour_id);
create index if not exists tour_logistics_events_tour_id_idx on public.tour_logistics_events(tour_id);
