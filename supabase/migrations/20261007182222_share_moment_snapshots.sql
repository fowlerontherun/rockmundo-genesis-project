create table if not exists public.share_moment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  moment_type text not null,
  source_id text not null,
  headline text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  last_shared_at timestamptz not null default now(),
  unique (user_id, moment_type, source_id)
);
alter table public.share_moment_snapshots enable row level security;
grant select, insert, update, delete on public.share_moment_snapshots to authenticated;
drop policy if exists "share snapshots select own" on public.share_moment_snapshots;
drop policy if exists "share snapshots insert own" on public.share_moment_snapshots;
drop policy if exists "share snapshots update own" on public.share_moment_snapshots;
drop policy if exists "share snapshots delete own" on public.share_moment_snapshots;
create policy "share snapshots select own" on public.share_moment_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "share snapshots insert own" on public.share_moment_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "share snapshots update own" on public.share_moment_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "share snapshots delete own" on public.share_moment_snapshots for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists share_moment_snapshots_user_created_idx on public.share_moment_snapshots(user_id, created_at desc);
