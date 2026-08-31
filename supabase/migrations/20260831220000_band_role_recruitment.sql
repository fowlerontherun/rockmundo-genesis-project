create table if not exists public.band_vacancies (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null,
  short_description text,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','open','paused','filled','closed','expired','cancelled')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  role_type text not null default 'member',
  instrument text not null,
  vocal_role text,
  genres text[] not null default '{}',
  commitment_level text not null default 'flexible' check (commitment_level in ('casual','flexible','regular','serious','professional')),
  positions_available integer not null default 1 check (positions_available > 0),
  positions_filled integer not null default 0 check (positions_filled >= 0),
  application_deadline timestamptz,
  audition_required boolean not null default false,
  remote_or_travel_allowed boolean not null default true,
  direct_applications_allowed boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.band_vacancies enable row level security;

drop policy if exists "Open vacancies are viewable" on public.band_vacancies;
create policy "Open vacancies are viewable" on public.band_vacancies
for select to authenticated
using (
  (status = 'open' and visibility = 'public')
  or exists (
    select 1
    from public.bands b
    join public.profiles p on p.id = b.leader_id
    where b.id = band_vacancies.band_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Band leaders can create vacancies" on public.band_vacancies;
create policy "Band leaders can create vacancies" on public.band_vacancies
for insert to authenticated
with check (
  exists (
    select 1
    from public.bands b
    join public.profiles p on p.id = b.leader_id
    where b.id = band_vacancies.band_id
      and p.user_id = (select auth.uid())
  )
  and (
    created_by_profile_id is null
    or created_by_profile_id in (
      select id from public.profiles where user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Band leaders can update vacancies" on public.band_vacancies;
create policy "Band leaders can update vacancies" on public.band_vacancies
for update to authenticated
using (
  exists (
    select 1
    from public.bands b
    join public.profiles p on p.id = b.leader_id
    where b.id = band_vacancies.band_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.bands b
    join public.profiles p on p.id = b.leader_id
    where b.id = band_vacancies.band_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Band leaders can delete vacancies" on public.band_vacancies;
create policy "Band leaders can delete vacancies" on public.band_vacancies
for delete to authenticated
using (
  exists (
    select 1
    from public.bands b
    join public.profiles p on p.id = b.leader_id
    where b.id = band_vacancies.band_id
      and p.user_id = (select auth.uid())
  )
);

alter table public.band_applications
  add column if not exists vacancy_id uuid references public.band_vacancies(id) on delete set null;

create unique index if not exists band_applications_one_pending_per_vacancy
  on public.band_applications(vacancy_id, applicant_profile_id)
  where vacancy_id is not null and status = 'pending';

create index if not exists band_vacancies_open_idx
  on public.band_vacancies(status, visibility, instrument, created_at desc);

create index if not exists band_applications_vacancy_idx
  on public.band_applications(vacancy_id, created_at desc);

grant select, insert, update, delete on public.band_vacancies to authenticated;
