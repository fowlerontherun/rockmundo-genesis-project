-- Canonical balance-management registry, validation/simulation history, activation audit,
-- and immutable snapshot columns for progression/outcome records where tables exist.
create type public.balance_version_status as enum ('draft','validating','valid','invalid','approved','scheduled','active','retired','rolled_back');
create table if not exists public.balance_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  name text not null,
  description text,
  status public.balance_version_status not null default 'draft',
  parent_version_id uuid references public.balance_versions(id),
  config jsonb not null,
  schema_version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint balance_versions_config_object check (jsonb_typeof(config) = 'object')
);
create unique index if not exists balance_versions_one_active_global on public.balance_versions ((status)) where status = 'active';
create table if not exists public.balance_validation_results (id uuid primary key default gen_random_uuid(), balance_version_id uuid not null references public.balance_versions(id), status text not null, issues jsonb not null default '[]'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.balance_simulation_results (id uuid primary key default gen_random_uuid(), balance_version_id uuid not null references public.balance_versions(id), scenario_set text not null, status text not null, summary jsonb not null default '{}'::jsonb, report_path text, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.balance_rollouts (id uuid primary key default gen_random_uuid(), balance_version_id uuid not null references public.balance_versions(id), status text not null, scheduled_for timestamptz, activated_at timestamptz, cancelled_at timestamptz, actor_id uuid references auth.users(id), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.balance_audit_log (id uuid primary key default gen_random_uuid(), balance_version_id uuid references public.balance_versions(id), action text not null, actor_id uuid references auth.users(id), change_summary text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create or replace function public.prevent_activated_balance_version_mutation() returns trigger language plpgsql security definer set search_path = public as $$ begin if old.status in ('active','retired','rolled_back') and (new.config is distinct from old.config or new.version_key is distinct from old.version_key or new.schema_version is distinct from old.schema_version) then raise exception 'Activated balance versions are immutable'; end if; return new; end; $$;
drop trigger if exists trg_prevent_activated_balance_version_mutation on public.balance_versions;
create trigger trg_prevent_activated_balance_version_mutation before update on public.balance_versions for each row execute function public.prevent_activated_balance_version_mutation();
create or replace function public.prevent_activated_balance_version_delete() returns trigger language plpgsql security definer set search_path = public as $$ begin if old.status in ('active','retired','rolled_back') then raise exception 'Activated balance versions cannot be deleted'; end if; return old; end; $$;
drop trigger if exists trg_prevent_activated_balance_version_delete on public.balance_versions;
create trigger trg_prevent_activated_balance_version_delete before delete on public.balance_versions for each row execute function public.prevent_activated_balance_version_delete();
alter table public.balance_versions enable row level security; alter table public.balance_validation_results enable row level security; alter table public.balance_simulation_results enable row level security; alter table public.balance_rollouts enable row level security; alter table public.balance_audit_log enable row level security;
create policy balance_versions_service_role_all on public.balance_versions for all using (auth.role()='service_role') with check (auth.role()='service_role');
create policy balance_validation_service_role_all on public.balance_validation_results for all using (auth.role()='service_role') with check (auth.role()='service_role');
create policy balance_simulation_service_role_all on public.balance_simulation_results for all using (auth.role()='service_role') with check (auth.role()='service_role');
create policy balance_rollouts_service_role_all on public.balance_rollouts for all using (auth.role()='service_role') with check (auth.role()='service_role');
create policy balance_audit_service_role_all on public.balance_audit_log for all using (auth.role()='service_role') with check (auth.role()='service_role');
do $$ begin
  if to_regclass('public.player_xp_ledger') is not null then alter table public.player_xp_ledger add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
  if to_regclass('public.player_attributes') is not null then alter table public.player_attributes add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
  if to_regclass('public.songs') is not null then alter table public.songs add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
  if to_regclass('public.recording_sessions') is not null then alter table public.recording_sessions add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
  if to_regclass('public.gig_outcomes') is not null then alter table public.gig_outcomes add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
  if to_regclass('public.band_contribution_events') is not null then alter table public.band_contribution_events add column if not exists balance_version_key text, add column if not exists balance_snapshot jsonb; end if;
end $$;
