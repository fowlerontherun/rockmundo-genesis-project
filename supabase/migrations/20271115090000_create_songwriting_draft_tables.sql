create table if not exists public.songwriting_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid null references public.songwriting_projects(id) on delete set null,
  title text not null,
  content jsonb,
  last_edited_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songwriting_draft_revisions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.songwriting_drafts(id) on delete cascade,
  content jsonb,
  summary text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists songwriting_drafts_user_id_idx
  on public.songwriting_drafts (user_id);

create index if not exists songwriting_draft_revisions_draft_id_idx
  on public.songwriting_draft_revisions (draft_id);

comment on table public.songwriting_drafts is 'Collaborative songwriting lyric drafts for the studio experience.';
comment on table public.songwriting_draft_revisions is 'Immutable snapshots captured from songwriting drafts.';

alter table public.songwriting_drafts enable row level security;
alter table public.songwriting_draft_revisions enable row level security;

create policy "Users can read their songwriting drafts"
  on public.songwriting_drafts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert songwriting drafts they own"
  on public.songwriting_drafts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their songwriting drafts"
  on public.songwriting_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their songwriting drafts"
  on public.songwriting_drafts
  for delete
  using (auth.uid() = user_id);

create policy "Users can read revisions for their drafts"
  on public.songwriting_draft_revisions
  for select
  using (
    exists (
      select 1
      from public.songwriting_drafts d
      where d.id = songwriting_draft_revisions.draft_id
        and d.user_id = auth.uid()
    )
  );

create policy "Users can add revisions to their drafts"
  on public.songwriting_draft_revisions
  for insert
  with check (
    exists (
      select 1
      from public.songwriting_drafts d
      where d.id = songwriting_draft_revisions.draft_id
        and d.user_id = auth.uid()
    )
  );
