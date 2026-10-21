-- Cooking session lifecycle foundation. All gameplay actions remain backend-only.
create table if not exists public.cooking_sessions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 recipe_slug text not null references public.cooking_recipes(slug),
 mode text not null check (mode in ('manual','assisted')),
 status text not null default 'pending' check (status in ('pending','running','completed','failed','cancelled','timed_out')),
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 finished_at timestamptz,
 execution_score integer check (execution_score between 0 and 100),
 result_batch_id uuid references public.cooking_food_batches(id),
 constraint cooking_session_expiry check (expires_at > started_at),
 constraint cooking_session_finalized check (status not in ('completed','failed','cancelled','timed_out') or finished_at is not null)
);
create unique index if not exists cooking_one_active_session_per_profile
 on public.cooking_sessions(profile_id) where status in ('pending','running');
create index if not exists cooking_sessions_profile_recent
 on public.cooking_sessions(profile_id,started_at desc);
create table if not exists public.cooking_session_actions (
 id bigint generated always as identity primary key,
 session_id uuid not null references public.cooking_sessions(id) on delete cascade,
 action_sequence integer not null check (action_sequence > 0),
 action_type text not null check (action_type in ('heat','add','remove','finish','timeout')),
 ingredient_slug text,
 heat text check (heat in ('off','low','medium','high')),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(session_id,action_sequence)
);
create index if not exists cooking_session_actions_session_idx on public.cooking_session_actions(session_id,action_sequence);
alter table public.cooking_sessions enable row level security;
alter table public.cooking_session_actions enable row level security;
do $$
begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_sessions' and policyname='Read own cooking sessions') then
  create policy "Read own cooking sessions" on public.cooking_sessions for select to authenticated
   using (exists (select 1 from public.profiles p where p.id=profile_id and p.user_id=(select auth.uid())));
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_session_actions' and policyname='Read own cooking actions') then
  create policy "Read own cooking actions" on public.cooking_session_actions for select to authenticated
   using (exists (select 1 from public.cooking_sessions s join public.profiles p on p.id=s.profile_id where s.id=session_id and p.user_id=(select auth.uid())));
 end if;
end $$;
revoke all on public.cooking_sessions,public.cooking_session_actions from anon,authenticated;
grant select on public.cooking_sessions,public.cooking_session_actions to authenticated;
-- There is intentionally no client-callable start/finish API until input-reservation
-- and authoritative action replay are implemented. This migration mints no batches.
