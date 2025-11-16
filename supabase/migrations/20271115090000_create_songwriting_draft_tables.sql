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
