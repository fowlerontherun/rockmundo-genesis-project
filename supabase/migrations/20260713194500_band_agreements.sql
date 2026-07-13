create table if not exists public.band_agreement_templates (
  id uuid primary key default gen_random_uuid(),
  band_id uuid references public.bands(id) on delete cascade,
  template_key text not null,
  title text not null,
  version integer not null default 1 check (version > 0),
  terms_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (band_id, template_key, version)
);
create table if not exists public.band_agreements (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('standard_membership','trial_membership','full_membership','touring_member','session_musician','temporary_stand_in','songwriting_collaboration','recording_participation','revenue_share_amendment','departure_settlement','founder_ownership')),
  title text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','proposed','awaiting_signatures','partially_signed','active','rejected','withdrawn','expired','superseded','terminated','completed','disputed','cancelled')),
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_by uuid not null references auth.users(id),
  supersedes_agreement_id uuid references public.band_agreements(id),
  governance_proposal_id uuid,
  template_id uuid references public.band_agreement_templates(id),
  terms_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), activated_at timestamptz, terminated_at timestamptz,
  check (effective_until is null or effective_until > effective_from)
);
create table if not exists public.band_agreement_parties (
  agreement_id uuid not null references public.band_agreements(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  party_role text not null check (party_role in ('member','band_signatory','affected_member','contributor','owner')),
  mandatory boolean not null default true,
  signature_status text not null default 'pending' check (signature_status in ('pending','signed','rejected','withdrawn','invalidated')),
  signed_at timestamptz, rejected_at timestamptz, withdrawn_at timestamptz,
  signature_version integer,
  acknowledgement_snapshot jsonb not null default '{}'::jsonb,
  primary key (agreement_id, player_id, party_role)
);
create table if not exists public.band_revenue_allocation_snapshots (
  id uuid primary key default gen_random_uuid(), agreement_id uuid references public.band_agreements(id), agreement_version integer,
  band_id uuid not null references public.bands(id) on delete cascade, revenue_category text not null, revenue_source_type text not null, revenue_source_id uuid,
  gross_amount numeric(12,2) not null check (gross_amount >= 0), costs numeric(12,2) not null default 0 check (costs >= 0), net_distributable numeric(12,2) not null check (net_distributable >= 0),
  share_rules_used jsonb not null default '[]'::jsonb, recipient_allocations jsonb not null default '[]'::jsonb, allocated_at timestamptz not null default now(), unique (revenue_source_type, revenue_source_id, revenue_category)
);
create table if not exists public.agreement_disputes (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.band_agreements(id) on delete cascade, raised_by uuid not null references public.profiles(id), category text not null, description text not null, status text not null default 'open' check (status in ('open','under_review','awaiting_response','resolved','rejected','withdrawn')), related_transaction_id uuid, created_at timestamptz not null default now(), resolved_at timestamptz, resolution_summary text
);
create index if not exists idx_band_agreements_band_status_dates on public.band_agreements (band_id, status, effective_from, effective_until);
create index if not exists idx_band_agreement_parties_player_status on public.band_agreement_parties (player_id, signature_status);
create index if not exists idx_band_revenue_allocation_snapshots_band on public.band_revenue_allocation_snapshots (band_id, allocated_at desc);
alter table public.band_agreements enable row level security; alter table public.band_agreement_parties enable row level security; alter table public.band_revenue_allocation_snapshots enable row level security; alter table public.agreement_disputes enable row level security; alter table public.band_agreement_templates enable row level security;
create policy "band members can view agreement headers" on public.band_agreements for select using (exists (select 1 from public.band_members bm where bm.band_id = band_agreements.band_id and bm.user_id = auth.uid()));
create policy "agreement parties can view party rows" on public.band_agreement_parties for select using (exists (select 1 from public.profiles p where p.id = band_agreement_parties.player_id and p.user_id = auth.uid()) or exists (select 1 from public.band_agreements ba join public.band_members bm on bm.band_id = ba.band_id where ba.id = band_agreement_parties.agreement_id and bm.user_id = auth.uid() and lower(coalesce(bm.role,'')) in ('leader','founder','manager')));
create policy "band finance managers can view allocation snapshots" on public.band_revenue_allocation_snapshots for select using (exists (select 1 from public.band_members bm where bm.band_id = band_revenue_allocation_snapshots.band_id and bm.user_id = auth.uid() and lower(coalesce(bm.role,'')) in ('leader','founder','manager')));
create policy "agreement parties can view disputes" on public.agreement_disputes for select using (exists (select 1 from public.band_agreements ba join public.band_agreement_parties bap on bap.agreement_id = ba.id join public.profiles p on p.id = bap.player_id where ba.id = agreement_disputes.agreement_id and p.user_id = auth.uid()));
create policy "band managers can view templates" on public.band_agreement_templates for select using (band_id is null or exists (select 1 from public.band_members bm where bm.band_id = band_agreement_templates.band_id and bm.user_id = auth.uid() and lower(coalesce(bm.role,'')) in ('leader','founder','manager')));
