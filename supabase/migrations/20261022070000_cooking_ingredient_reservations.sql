-- Persistent, consumptive ingredient reservation at the moment a manual session starts.
-- Restricted to an audited trusted backend: never pass browser profile/recipe/session
-- values without verifying the actor's active profile and rate limits.
create table if not exists public.cooking_session_ingredients (
  session_id uuid not null references public.cooking_sessions(id) on delete cascade,
  ingredient_lot_id uuid not null references public.cooking_ingredient_lots(id),
  ingredient_slug text not null,
  quantity integer not null check (quantity between 1 and 100000),
  quality integer not null check (quality between 0 and 100),
  original_expires_at timestamptz not null,
  reserved_at timestamptz not null default clock_timestamp(),
  primary key (session_id, ingredient_lot_id)
);
create index if not exists cooking_reserved_session_idx
  on public.cooking_session_ingredients(session_id, ingredient_slug);
alter table public.cooking_session_ingredients enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='cooking_session_ingredients'
    and policyname='Read own reserved cooking ingredients') then
    create policy "Read own reserved cooking ingredients"
      on public.cooking_session_ingredients for select to authenticated
      using (exists (
        select 1 from public.cooking_sessions s
        join public.profiles p on p.id=s.profile_id
        where s.id=session_id and p.user_id=(select auth.uid())
      ));
  end if;
end $$;
revoke all on public.cooking_session_ingredients from anon, authenticated;
grant select on public.cooking_session_ingredients to authenticated;

create or replace function public.begin_cooking_session(
  _profile_id uuid, _recipe_slug text, _session_id uuid
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  recipe public.cooking_recipes%rowtype;
  existing public.cooking_sessions%rowtype;
  requirement record;
  lot record;
  needed integer;
  portion integer;
  started timestamptz;
begin
  if _profile_id is null or _recipe_slug is null
    or _session_id is null then
    raise exception 'Missing cooking session arguments';
  end if;

  -- Serializes retries and concurrent starts for one character. A distinct
  -- session key cannot spend ingredients while another session is active.
  perform 1 from public.profiles where id=_profile_id for update;
  if not found then raise exception 'Profile unavailable'; end if;

  select * into existing from public.cooking_sessions
    where id=_session_id for update;
  if found then
    if existing.profile_id <> _profile_id or existing.recipe_slug <> _recipe_slug
      or existing.mode <> 'manual' then
      raise exception 'Cooking session key belongs to a different request';
    end if;
    return existing.id;
  end if;

  started := clock_timestamp();
  -- Expired abandoned sessions must not block a new session forever.
  -- Ingredients already consumed at the old start are not restored.
  update public.cooking_sessions
    set status='timed_out', finished_at=started, updated_at=started
    where profile_id=_profile_id and status in ('pending','running')
      and expires_at<=started;
  if exists (select 1 from public.cooking_sessions
    where profile_id=_profile_id and status in ('pending','running')) then
    raise exception 'A cooking session is already active';
  end if;

  select * into recipe from public.cooking_recipes
    where slug=_recipe_slug and is_active for share;
  if not found then raise exception 'Recipe is not enabled'; end if;
  if not exists (select 1 from public.cooking_recipe_ingredients
    where recipe_slug=_recipe_slug) then
    raise exception 'Recipe ingredients missing';
  end if;

  insert into public.cooking_sessions
    (id, profile_id, recipe_slug, mode, status, started_at, updated_at, expires_at)
  values
    (_session_id, _profile_id, _recipe_slug, 'manual', 'pending',
     started, started, started + interval '120 seconds');

  -- Fixed recipe requirements come from database definitions. Never trust
  -- the client to supply quantities, yield or estimated quality.
  for requirement in
    select ingredient_slug, units_required
    from public.cooking_recipe_ingredients
    where recipe_slug=_recipe_slug order by ingredient_slug
  loop
    needed := requirement.units_required;
    for lot in
      select id, quantity, quality, expires_at
      from public.cooking_ingredient_lots
      where profile_id=_profile_id
        and ingredient_slug=requirement.ingredient_slug
        and quantity>0 and expires_at>started
      order by expires_at,id
      for update
    loop
      exit when needed=0;
      portion := least(needed,lot.quantity);
      update public.cooking_ingredient_lots
        set quantity=quantity-portion where id=lot.id;
      insert into public.cooking_session_ingredients
        (session_id,ingredient_lot_id,ingredient_slug,quantity,quality,original_expires_at,reserved_at)
      values (_session_id,lot.id,requirement.ingredient_slug,portion,lot.quality,lot.expires_at,started);
      needed := needed-portion;
    end loop;
    if needed > 0 then
      raise exception 'Insufficient fresh ingredient: %',requirement.ingredient_slug;
    end if;
  end loop;
  return _session_id;
end;
$$;
revoke all on function public.begin_cooking_session(uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.begin_cooking_session(uuid,text,uuid)
  to service_role;
