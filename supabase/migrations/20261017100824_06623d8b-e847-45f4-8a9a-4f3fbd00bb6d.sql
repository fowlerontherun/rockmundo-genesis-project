create table if not exists public.player_merch_wearables (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  design_id uuid not null references public.tshirt_designs(id) on delete cascade,
  equipped_at timestamptz not null default now()
);
grant select, insert, update, delete on public.player_merch_wearables to authenticated;
grant all on public.player_merch_wearables to service_role;
alter table public.player_merch_wearables enable row level security;

drop policy if exists "Players can view own merch wearable" on public.player_merch_wearables;
create policy "Players can view own merch wearable" on public.player_merch_wearables
for select to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Players can equip own band merch" on public.player_merch_wearables;
create policy "Players can equip own band merch" on public.player_merch_wearables
for insert to authenticated
with check (
  profile_id in (select id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.tshirt_designs td
    join public.band_members bm on bm.band_id = td.band_id
    where td.id = design_id
      and bm.profile_id = player_merch_wearables.profile_id
      and bm.member_status = 'active'
      and lower(coalesce(td.product_type, '')) in (
        'basic tee','graphic tee','heavyweight tee','long sleeve tee',
        'premium hoodie','zip hoodie','tour crewneck','football shirt')
  )
);

drop policy if exists "Players can change own band merch" on public.player_merch_wearables;
create policy "Players can change own band merch" on public.player_merch_wearables
for update to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()))
with check (
  profile_id in (select id from public.profiles where user_id = auth.uid())
  and exists (
    select 1 from public.tshirt_designs td
    join public.band_members bm on bm.band_id = td.band_id
    where td.id = design_id
      and bm.profile_id = player_merch_wearables.profile_id
      and bm.member_status = 'active')
);

drop policy if exists "Players can unequip own band merch" on public.player_merch_wearables;
create policy "Players can unequip own band merch" on public.player_merch_wearables
for delete to authenticated
using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create or replace function public.get_stage_merch_wearables(p_profile_ids uuid[])
returns table (profile_id uuid, design_id uuid, band_id uuid, design_name text, product_type text,
  artwork_url text, garment_color text, design_data jsonb)
language plpgsql stable security definer set search_path = ''
as $fn$
begin
  if (select auth.uid()) is null and coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if coalesce(cardinality(p_profile_ids), 0) = 0 then return; end if;
  if cardinality(p_profile_ids) > 64 then raise exception 'Too many profiles requested'; end if;
  return query
    select w.profile_id, d.id, d.band_id, d.design_name, d.product_type, d.artwork_url,
      coalesce(nullif(d.design_data->>'garmentColor',''), nullif(d.background_color,''), '#171717'),
      d.design_data
    from public.player_merch_wearables w
    join public.tshirt_designs d on d.id = w.design_id
    where w.profile_id = any(p_profile_ids)
      and lower(coalesce(d.product_type,'')) in (
        'basic tee','graphic tee','heavyweight tee','long sleeve tee',
        'premium hoodie','zip hoodie','tour crewneck','football shirt')
    order by w.profile_id;
end;
$fn$;
revoke all on function public.get_stage_merch_wearables(uuid[]) from public, anon;
grant execute on function public.get_stage_merch_wearables(uuid[]) to authenticated, service_role;

create or replace function public.get_gig_merch_crowd_signal(p_gig_id uuid)
returns table (gig_id uuid, band_id uuid, design_id uuid, fame_score integer,
  merch_popularity_score integer, on_sale boolean)
language sql security definer set search_path = public stable
as $fn$
  with gig_band as (
    select g.id gig_id, g.band_id, greatest(0, coalesce(b.fame, 0))::bigint fame
    from public.gigs g join public.bands b on b.id = g.band_id
    where g.id = p_gig_id
  ),
  equipped as (
    select distinct on (td.id) gb.gig_id, gb.band_id, gb.fame, td.id design_id
    from gig_band gb
    join public.band_members bm on bm.band_id = gb.band_id and bm.member_status = 'active'
    join public.player_merch_wearables pmw on pmw.profile_id = bm.profile_id
    join public.tshirt_designs td on td.id = pmw.design_id and td.band_id = gb.band_id
    order by td.id, pmw.equipped_at desc
  ),
  products as (
    select e.gig_id, e.band_id, e.fame, e.design_id, pm.id merchandise_id,
      ((pm.drop_starts_at is null or pm.drop_starts_at <= now())
        and (pm.available_until is null or pm.available_until > now())
        and not coalesce(pm.superfan_only, false)
        and (coalesce(pm.stock_quantity, 0) > 0
          or exists (select 1 from public.merch_variants mv
            where mv.merchandise_id = pm.id and mv.is_active and coalesce(mv.stock_quantity, 0) > 0))
      ) on_sale
    from equipped e
    left join public.player_merchandise pm on pm.band_id = e.band_id and pm.custom_design_id = e.design_id
  ),
  sales as (
    select p.design_id, coalesce(sum(mo.quantity) filter (where mo.id is not null), 0)::bigint units
    from products p left join public.merch_orders mo on mo.merchandise_id = p.merchandise_id
    group by p.design_id
  ),
  per_design as (
    select p.gig_id, p.band_id, p.fame, p.design_id, bool_or(coalesce(p.on_sale, false)) on_sale, s.units
    from products p join sales s using (design_id)
    group by p.gig_id, p.band_id, p.fame, p.design_id, s.units
  ),
  ranked as (select d.*, max(d.units) over () max_units from per_design d)
  select r.gig_id, r.band_id, r.design_id,
    least(100, round(100 * ln(1 + r.fame::numeric) / ln(1 + 50000000::numeric)))::integer,
    case when r.max_units > 0 then round(100 * r.units::numeric / r.max_units)::integer else 0 end,
    r.on_sale
  from ranked r
  order by r.on_sale desc, r.units desc, r.design_id;
$fn$;
revoke all on function public.get_gig_merch_crowd_signal(uuid) from public, anon;
grant execute on function public.get_gig_merch_crowd_signal(uuid) to authenticated;

create or replace function public.skill_tier_access_bulk(p_profile_id uuid, p_slugs text[])
returns table(skill_slug text, is_unlocked boolean)
language sql stable security invoker set search_path to ''
as $fn$
  select slug, public.skill_tier_unlocked(p_profile_id, slug)
  from unnest(coalesce(p_slugs, array[]::text[])) as slug
  group by slug;
$fn$;
grant execute on function public.skill_tier_access_bulk(uuid, text[]) to authenticated;

create or replace function public.skip_and_complete_songwriting_project(
  p_profile_id uuid, p_project_id uuid, p_catalog_status text default 'private', p_band_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_skip jsonb; v_result jsonb;
begin
  v_skip := public.skip_songwriting_polish(p_profile_id, p_project_id);
  v_result := public.complete_songwriting_project(p_profile_id, p_project_id, p_catalog_status, p_band_id);
  if v_result is null or nullif(v_result->>'song_id','') is null then
    raise exception 'songwriting_conversion_not_confirmed';
  end if;
  return v_result || jsonb_build_object('polishSkipped', true);
end $fn$;
revoke all on function public.skip_and_complete_songwriting_project(uuid,uuid,text,uuid) from public, anon;
grant execute on function public.skip_and_complete_songwriting_project(uuid,uuid,text,uuid) to authenticated;

create or replace function public.create_recovery_character_atomic(
  p_parent_profile_id uuid default null, p_username text default null, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_user uuid := auth.uid(); v_max integer; v_used integer; v_slot integer;
  v_parent public.profiles%rowtype; v_skills jsonb := '{}'::jsonb; v_cash integer := 10000;
  v_generation integer := 1; v_new uuid; v_name text;
begin
  if v_user is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('character-recovery:' || v_user::text, 0));
  select least(5, 2 + greatest(0, coalesce(extra_slots_purchased, 0))) into v_max
    from public.character_slots where user_id = v_user;
  v_max := coalesce(v_max, 2);
  select count(*) into v_used from public.profiles
    where user_id = v_user and deleted_at is null and died_at is null;
  if v_used >= v_max then raise exception 'NO_CHARACTER_SLOTS_AVAILABLE'; end if;
  if p_parent_profile_id is null and v_used > 0 then raise exception 'LIVING_CHARACTER_EXISTS'; end if;
  if p_parent_profile_id is not null then
    select * into v_parent from public.profiles
      where id = p_parent_profile_id and user_id = v_user and died_at is not null and deleted_at is null
      for update;
    if not found then raise exception 'INVALID_DEAD_PARENT'; end if;
    select coalesce(final_skills, '{}'::jsonb), coalesce(total_cash_at_death, 0)
      into v_skills, v_cash from public.hall_of_immortals where profile_id = p_parent_profile_id;
    if not found then raise exception 'PARENT_MEMORIAL_REQUIRED_FOR_INHERITANCE'; end if;
    v_cash := floor(v_cash * 0.5);
    v_generation := coalesce(v_parent.generation_number, 1) + 1;
  end if;
  select coalesce(max(slot_number), 0) + 1 into v_slot from public.profiles where user_id = v_user;
  v_name := coalesce(nullif(btrim(p_username), ''), 'player-' || left(v_user::text, 8) || '-' || v_slot::text);
  insert into public.profiles(user_id, username, display_name, avatar_url, bio, cash, fame, level,
    health, energy, experience, age, is_active, slot_number, generation_number, parent_profile_id)
  values (v_user, v_name, nullif(btrim(p_display_name), ''), null, null, v_cash, 0, 1,
    100, 100, 0, 16, false, v_slot, v_generation, p_parent_profile_id)
  returning id into v_new;
  if p_parent_profile_id is not null then
    insert into public.skill_progress(profile_id, skill_slug, current_level, current_xp, required_xp)
    select v_new, key, floor((value::numeric) * 0.1)::integer, 0, 100
    from jsonb_each_text(v_skills)
    where value ~ '^[0-9]+(\.[0-9]+)?$' and floor((value::numeric) * 0.1) > 0;
  end if;
  update public.profiles set is_active = false where user_id = v_user and id <> v_new and is_active;
  update public.profiles set is_active = true where id = v_new;
  return v_new;
end $fn$;
revoke all on function public.create_recovery_character_atomic(uuid,text,text) from public, anon;
grant execute on function public.create_recovery_character_atomic(uuid,text,text) to authenticated;

create or replace function public.finalize_character_retirement(
  p_profile_id uuid, p_type text, p_stats jsonb, p_skills jsonb, p_attributes jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_profile public.profiles%rowtype; v_hof uuid; v_generation integer;
  v_cash bigint; v_inherited jsonb; v_skill record;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_type not in ('voluntary','mandatory') or jsonb_typeof(p_stats) is distinct from 'object'
    or jsonb_typeof(p_skills) is distinct from 'object'
    or jsonb_typeof(p_attributes) is distinct from 'object' then
    raise exception 'INVALID_RETIREMENT_INPUT';
  end if;
  select * into v_profile from public.profiles
    where id = p_profile_id and user_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'PROFILE_NOT_OWNED' using errcode = '42501'; end if;
  select coalesce(max(generation_number), 1) into v_generation
    from public.character_generations where user_id = auth.uid();
  v_cash := floor(greatest(coalesce(v_profile.cash, 0), 0) * 0.5);
  select coalesce(jsonb_object_agg(skill_slug, floor(greatest(coalesce(current_level, 0), 0) * 0.1)::integer), '{}'::jsonb)
    into v_inherited from public.skill_progress where profile_id = p_profile_id;
  insert into public.hall_of_fame(user_id, character_name, avatar_url, final_age, years_active,
    total_fame, total_cash_earned, total_songs, total_gigs, total_albums, peak_chart_position,
    notable_achievements, final_skills, final_attributes, retirement_type, generation_number)
  values (auth.uid(), coalesce(v_profile.display_name, v_profile.username, 'Unknown Artist'),
    v_profile.avatar_url, coalesce(v_profile.age, 80), greatest(coalesce(v_profile.age, 80) - 16, 0),
    coalesce(v_profile.fame, 0), coalesce(v_profile.cash, 0),
    greatest(0, coalesce((p_stats->>'total_songs')::integer, 0)),
    greatest(0, coalesce((p_stats->>'total_gigs')::integer, 0)),
    greatest(0, coalesce((p_stats->>'total_albums')::integer, 0)),
    (p_stats->>'peak_chart_position')::integer, '[]'::jsonb, p_skills, p_attributes, p_type, v_generation)
  returning id into v_hof;
  insert into public.character_generations(user_id, generation_number, parent_character_id, inherited_cash, inherited_skills)
  values (auth.uid(), v_generation + 1, v_hof, v_cash, v_inherited);
  update public.profiles set display_name = null, avatar_url = null, bio = null, age = 16, fame = 0,
    cash = v_cash, experience = 0, level = 1, health = 100, energy = 100,
    last_retirement_prompt_age = 0, character_birth_date = null where id = p_profile_id;
  delete from public.skill_progress where profile_id = p_profile_id;
  for v_skill in select key, value from jsonb_each_text(v_inherited) loop
    if v_skill.value::integer > 0 then
      insert into public.skill_progress(profile_id, skill_slug, current_level, current_xp, required_xp)
      values (p_profile_id, v_skill.key, v_skill.value::integer, 0, 100);
    end if;
  end loop;
  return jsonb_build_object('hall_of_fame_id', v_hof, 'inherited_cash', v_cash,
    'inherited_skills', v_inherited, 'generation_number', v_generation + 1);
end $fn$;
revoke all on function public.finalize_character_retirement(uuid,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.finalize_character_retirement(uuid,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.book_gig_with_personal_funding(
  p_band_id uuid, p_venue_id uuid, p_setlist_id uuid, p_local_date date, p_slot text,
  p_ticket_price integer, p_request_id uuid, p_topup_minor bigint,
  p_rider_id uuid default null, p_ticket_operator_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_result jsonb;
begin
  if auth.uid() is null or p_request_id is null or not public.can_manage_band_gigs(p_band_id, auth.uid()) then
    raise exception 'gig_booking_forbidden' using errcode = '42501';
  end if;
  if p_topup_minor is null or p_topup_minor < 0 or p_topup_minor > 1000000000 or (p_topup_minor % 100) <> 0 then
    raise exception 'gig_booking_invalid_wallet_topup' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('personal-gig:' || p_request_id::text, 0));
  if exists (select 1 from public.gigs where booking_request_id = p_request_id) then
    return public.book_gig(p_band_id, p_venue_id, p_setlist_id, p_local_date,
      p_slot, p_ticket_price, p_request_id, p_rider_id, p_ticket_operator_id);
  end if;
  if p_topup_minor > 0 then
    perform public.fund_my_band(p_band_id, 'wallet', null, p_topup_minor,
      'Personal funds for gig booking / City Hall permit', 'gig-booking:' || p_request_id::text);
  end if;
  v_result := public.book_gig(p_band_id, p_venue_id, p_setlist_id, p_local_date,
    p_slot, p_ticket_price, p_request_id, p_rider_id, p_ticket_operator_id);
  if v_result is null or v_result->'gig' is null then
    raise exception 'gig_booking_not_confirmed';
  end if;
  return v_result;
end;
$fn$;
revoke all on function public.book_gig_with_personal_funding(uuid,uuid,uuid,date,text,integer,uuid,bigint,uuid,text) from public, anon;
grant execute on function public.book_gig_with_personal_funding(uuid,uuid,uuid,date,text,integer,uuid,bigint,uuid,text) to authenticated;

notify pgrst, 'reload schema';