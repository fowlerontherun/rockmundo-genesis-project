-- Cooking inventory foundation (applied directly to live Rockmundo on 2026-10-21).
-- No direct client writes; subsequent server RPCs must enforce ownership and atomicity.
create table if not exists public.cooking_ingredient_lots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ingredient_slug text not null check (length(ingredient_slug) between 1 and 100),
  origin_city_id uuid references public.cities(id) on delete set null,
  quantity integer not null check (quantity >= 0 and quantity <= 100000),
  quality integer not null check (quality between 0 and 100),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint cooking_ingredient_lots_valid_expiry check (expires_at > acquired_at)
);
create index if not exists cooking_ingredient_lots_profile_expiry_idx
  on public.cooking_ingredient_lots(profile_id, expires_at);

create table if not exists public.cooking_food_batches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipe_slug text not null check (length(recipe_slug) between 1 and 100),
  origin_city_id uuid references public.cities(id) on delete set null,
  portions integer not null check (portions >= 0 and portions <= 1000),
  quality integer not null check (quality between 0 and 100),
  prepared_at timestamptz not null,
  expires_at timestamptz not null,
  crafting_session_id uuid unique,
  created_at timestamptz not null default now(),
  constraint cooking_food_batches_valid_expiry check (expires_at > prepared_at)
);
create index if not exists cooking_food_batches_profile_expiry_idx
  on public.cooking_food_batches(profile_id, expires_at);

alter table public.cooking_ingredient_lots enable row level security;
alter table public.cooking_food_batches enable row level security;

do $policies$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_ingredient_lots' and policyname='Players can read own cooking ingredient lots') then
    create policy "Players can read own cooking ingredient lots"
      on public.cooking_ingredient_lots for select to authenticated
      using (exists (select 1 from public.profiles p
        where p.id=profile_id and p.user_id=(select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_food_batches' and policyname='Players can read own cooking food batches') then
    create policy "Players can read own cooking food batches"
      on public.cooking_food_batches for select to authenticated
      using (exists (select 1 from public.profiles p
        where p.id=profile_id and p.user_id=(select auth.uid())));
  end if;
end
$policies$;

revoke all on public.cooking_ingredient_lots from anon, authenticated;
revoke all on public.cooking_food_batches from anon, authenticated;
grant select on public.cooking_ingredient_lots to authenticated;
grant select on public.cooking_food_batches to authenticated;
