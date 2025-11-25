begin;

create table if not exists public.songwriting_session_events (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.songwriting_projects(id) on delete cascade,
  session_id uuid references public.songwriting_sessions(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  event_type text not null,
  event_time timestamptz not null default now(),
  tempo_bpm integer,
  chord_progression text,
  lyrics_draft text,
  instrumentation text[] default array[]::text[],
  take_number integer,
  mood text,
  genre text,
  reference_tracks text[] default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songwriting_session_events_project_idx on public.songwriting_session_events(project_id);
create index if not exists songwriting_session_events_session_idx on public.songwriting_session_events(session_id);
create index if not exists songwriting_session_events_time_idx on public.songwriting_session_events(event_time desc);

drop trigger if exists songwriting_session_events_set_updated_at on public.songwriting_session_events;
create trigger songwriting_session_events_set_updated_at
  before update on public.songwriting_session_events
  for each row execute function public.set_updated_at();

create table if not exists public.songwriting_audio_stems (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.songwriting_projects(id) on delete cascade,
  session_event_id uuid references public.songwriting_session_events(id) on delete set null,
  section_name text not null,
  storage_path text not null,
  duration_seconds integer,
  recorded_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists songwriting_audio_stems_project_idx on public.songwriting_audio_stems(project_id);

create table if not exists public.songwriting_section_revisions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.songwriting_projects(id) on delete cascade,
  audio_stem_id uuid not null references public.songwriting_audio_stems(id) on delete cascade,
  section_name text not null,
  lyrics_draft text,
  chord_progression text,
  tempo_bpm integer,
  instrumentation text[] default array[]::text[],
  take_number integer,
  revision_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists songwriting_section_revisions_project_idx on public.songwriting_section_revisions(project_id);
create index if not exists songwriting_section_revisions_section_idx on public.songwriting_section_revisions(section_name);

commit;
