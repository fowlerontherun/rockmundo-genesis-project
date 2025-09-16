create table if not exists public.band_relations (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null,
  instrument text not null,
  avatar_icon text,
  personality text,
  mood text not null default 'Neutral',
  chemistry integer not null default 50,
  morale integer not null default 50,
  loyalty integer not null default 50,
  skill_rating integer not null default 50,
  energy integer not null default 50,
  strengths text[] not null default '{}'::text[],
  issues text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint band_relations_chemistry_range check (chemistry between 0 and 100),
  constraint band_relations_morale_range check (morale between 0 and 100),
  constraint band_relations_loyalty_range check (loyalty between 0 and 100),
  constraint band_relations_skill_range check (skill_rating between 0 and 100),
  constraint band_relations_energy_range check (energy between 0 and 100),
  constraint band_relations_unique_member unique (band_id, member_id)
);

create index if not exists band_relations_band_id_idx on public.band_relations (band_id);
create index if not exists band_relations_member_id_idx on public.band_relations (member_id);

create table if not exists public.band_conflicts (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  conflict_type text not null,
  description text,
  severity text not null,
  involved_member_ids uuid[] not null default '{}'::uuid[],
  issue_tags text[] not null default '{}'::text[],
  resolved boolean not null default false,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint band_conflicts_severity_check check (severity in ('Low', 'Medium', 'High'))
);

create index if not exists band_conflicts_band_id_idx on public.band_conflicts (band_id);
create index if not exists band_conflicts_resolved_idx on public.band_conflicts (band_id, resolved);

alter table public.band_relations enable row level security;
alter table public.band_conflicts enable row level security;

create policy "Band members can view relation stats"
  on public.band_relations for select
  using (
    exists (
      select 1 from public.band_members
      where band_members.band_id = band_relations.band_id
        and band_members.user_id = auth.uid()
    )
    or exists (
      select 1 from public.bands
      where bands.id = band_relations.band_id
        and bands.leader_id = auth.uid()
    )
  );

create policy "Band leaders can manage relation stats"
  on public.band_relations for all
  using (
    exists (
      select 1 from public.bands
      where bands.id = band_relations.band_id
        and bands.leader_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bands
      where bands.id = band_relations.band_id
        and bands.leader_id = auth.uid()
    )
  );

create policy "Band members can view conflicts"
  on public.band_conflicts for select
  using (
    exists (
      select 1 from public.band_members
      where band_members.band_id = band_conflicts.band_id
        and band_members.user_id = auth.uid()
    )
    or exists (
      select 1 from public.bands
      where bands.id = band_conflicts.band_id
        and bands.leader_id = auth.uid()
    )
  );

create policy "Band leaders can manage conflicts"
  on public.band_conflicts for all
  using (
    exists (
      select 1 from public.bands
      where bands.id = band_conflicts.band_id
        and bands.leader_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bands
      where bands.id = band_conflicts.band_id
        and bands.leader_id = auth.uid()
    )
  );

create trigger update_band_relations_updated_at
  before update on public.band_relations
  for each row execute function public.update_updated_at_column();

create trigger update_band_conflicts_updated_at
  before update on public.band_conflicts
  for each row execute function public.update_updated_at_column();
