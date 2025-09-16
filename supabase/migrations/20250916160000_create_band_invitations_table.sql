create table if not exists public.band_invitations (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete set null,
  role varchar(100) not null,
  salary integer default 0,
  status varchar(20) not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint band_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

create index if not exists band_invitations_band_id_idx on public.band_invitations (band_id);
create index if not exists band_invitations_invitee_id_idx on public.band_invitations (invitee_id);
create index if not exists band_invitations_status_idx on public.band_invitations (status);

alter table public.band_invitations enable row level security;

create policy "Band invitations are viewable by everyone"
  on public.band_invitations for select
  using (true);

create policy "Band leaders can create invitations"
  on public.band_invitations for insert
  with check (
    inviter_id = auth.uid()
    and exists (
      select 1 from public.bands
      where id = band_id and leader_id = auth.uid()
    )
  );

create policy "Band leaders can update invitations"
  on public.band_invitations for update
  using (
    exists (
      select 1 from public.bands
      where id = band_id and leader_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bands
      where id = band_id and leader_id = auth.uid()
    )
  );

create policy "Band leaders can delete invitations"
  on public.band_invitations for delete
  using (
    exists (
      select 1 from public.bands
      where id = band_id and leader_id = auth.uid()
    )
  );

create policy "Invitees can accept invitations"
  on public.band_invitations for update
  using (
    invitee_id is null or invitee_id = auth.uid()
  )
  with check (
    invitee_id = auth.uid()
  );
