-- Casting call discovery and submission workflow
set check_function_bodies = off;

create table if not exists public.casting_calls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_type text not null,
  production_company text,
  description text,
  location text,
  is_remote_friendly boolean default false,
  union_status text,
  compensation_min integer,
  compensation_max integer,
  currency text default 'USD',
  application_deadline timestamptz,
  status text default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger casting_calls_set_updated_at
before update on public.casting_calls
for each row
execute function public.set_updated_at();

create index if not exists casting_calls_status_idx on public.casting_calls(status);
create index if not exists casting_calls_deadline_idx on public.casting_calls(application_deadline);
create index if not exists casting_calls_location_idx on public.casting_calls using gin (to_tsvector('simple', coalesce(location, '')));
create index if not exists casting_calls_project_type_idx on public.casting_calls(project_type);

create table if not exists public.casting_call_roles (
  id uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  name text not null,
  description text,
  role_type text,
  age_range text,
  gender text,
  required_skills text[],
  contract_type text,
  compensation_notes text,
  availability_requirements text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists casting_call_roles_call_idx on public.casting_call_roles(casting_call_id);

create table if not exists public.casting_submissions (
  id uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  casting_call_role_id uuid references public.casting_call_roles(id) on delete set null,
  talent_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted',
  cover_letter text,
  experience_summary text,
  portfolio_url text,
  resume_url text,
  audition_video_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (casting_call_id, casting_call_role_id, talent_profile_id)
);

create trigger casting_submissions_set_updated_at
before update on public.casting_submissions
for each row
execute function public.set_updated_at();

create index if not exists casting_submissions_status_idx on public.casting_submissions(status);
create index if not exists casting_submissions_profile_idx on public.casting_submissions(talent_profile_id);

create table if not exists public.casting_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.casting_submissions(id) on delete cascade,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  decision text not null default 'pending',
  score integer,
  feedback text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger casting_reviews_set_updated_at
before update on public.casting_reviews
for each row
execute function public.set_updated_at();

create index if not exists casting_reviews_submission_idx on public.casting_reviews(submission_id);
create index if not exists casting_reviews_reviewer_idx on public.casting_reviews(reviewer_profile_id);
