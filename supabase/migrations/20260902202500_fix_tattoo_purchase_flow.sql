begin;

alter table public.player_tattoos add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

update public.player_tattoos pt
set profile_id = (
  select p.id from public.profiles p
  where p.user_id = pt.user_id
  order by coalesce(p.slot_number, 1), p.created_at, p.id
  limit 1
)
where pt.profile_id is null;

alter table public.player_tattoos alter column user_id set default auth.uid();
alter table public.player_tattoos alter column tattoo_design_id drop not null;
create index if not exists idx_player_tattoos_profile_id on public.player_tattoos(profile_id);

alter table public.player_tattoos enable row level security;
drop policy if exists "Users can view own tattoos" on public.player_tattoos;
drop policy if exists "Users can insert own tattoos" on public.player_tattoos;
drop policy if exists "Users can update own tattoos" on public.player_tattoos;
drop policy if exists "Users can delete own tattoos" on public.player_tattoos;
drop policy if exists "Users can view active profile tattoos" on public.player_tattoos;
drop policy if exists "Users can insert active profile tattoos" on public.player_tattoos;
drop policy if exists "Users can update active profile tattoos" on public.player_tattoos;
drop policy if exists "Users can delete active profile tattoos" on public.player_tattoos;

create policy "Users can view active profile tattoos" on public.player_tattoos for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = player_tattoos.profile_id and p.user_id = (select auth.uid()))
);
create policy "Users can insert active profile tattoos" on public.player_tattoos for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = player_tattoos.profile_id and p.user_id = (select auth.uid()))
);
create policy "Users can update active profile tattoos" on public.player_tattoos for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = player_tattoos.profile_id and p.user_id = (select auth.uid()))
) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = player_tattoos.profile_id and p.user_id = (select auth.uid()))
);
create policy "Users can delete active profile tattoos" on public.player_tattoos for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = player_tattoos.profile_id and p.user_id = (select auth.uid()))
);

create or replace function public.purchase_tattoo(
  p_profile_id uuid,
  p_design_id uuid,
  p_parlour_id uuid,
  p_artist_id uuid default null,
  p_game_score integer default 50,
  p_game_accuracy integer default 50,
  p_game_coverage integer default 50,
  p_game_mistakes integer default 0,
  p_game_difficulty integer default 1
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid(); v_cash bigint; v_city_id uuid; v_design public.tattoo_designs%rowtype; v_parlour public.tattoo_parlours%rowtype; v_artist public.tattoo_artists%rowtype;
  v_artist_premium numeric := 1.0; v_artist_bonus integer := 0; v_specialty_bonus integer := 0; v_skill_level integer := 0; v_skill_bonus integer := 0; v_price integer; v_quality integer; v_infected boolean; v_tattoo_id uuid; v_base_min integer; v_base_max integer;
begin
  if v_user_id is null then raise exception 'You must be signed in'; end if;
  if p_game_score not between 0 and 100 or p_game_accuracy not between 0 and 100 or p_game_coverage not between 0 and 100 or p_game_mistakes < 0 or p_game_difficulty not between 1 and 5 then raise exception 'Invalid tattoo minigame result'; end if;
  select cash,current_city_id into v_cash,v_city_id from public.profiles where id=p_profile_id and user_id=v_user_id for update;
  if not found then raise exception 'Active character not found'; end if;
  select * into v_design from public.tattoo_designs where id=p_design_id;
  if not found then raise exception 'Tattoo design not found'; end if;
  select * into v_parlour from public.tattoo_parlours where id=p_parlour_id and city_id=v_city_id;
  if not found then raise exception 'Tattoo parlour is not in your current city'; end if;
  if exists(select 1 from public.player_tattoos where profile_id=p_profile_id and body_slot=v_design.body_slot) then raise exception 'That body area already has a tattoo'; end if;
  if p_artist_id is not null then
    select * into v_artist from public.tattoo_artists where id=p_artist_id and parlour_id=p_parlour_id;
    if not found then raise exception 'Selected tattoo artist is unavailable'; end if;
    v_artist_premium:=coalesce(v_artist.price_premium,1.0); v_artist_bonus:=coalesce(v_artist.quality_bonus,0);
    if v_artist.specialty=v_design.category then v_specialty_bonus:=5; end if;
  end if;
  v_price:=round(v_design.base_price*v_parlour.price_multiplier*v_artist_premium);
  if v_cash<v_price then raise exception 'Insufficient funds'; end if;
  select coalesce(max(current_level),0) into v_skill_level from public.skill_progress where profile_id=p_profile_id and skill_slug like 'tattooing_%';
  v_skill_bonus:=least(8,round((least(v_skill_level,30)::numeric/30)*8));
  case v_parlour.quality_tier when 1 then v_base_min:=20;v_base_max:=50; when 2 then v_base_min:=35;v_base_max:=65; when 3 then v_base_min:=50;v_base_max:=80; when 4 then v_base_min:=70;v_base_max:=92; else v_base_min:=85;v_base_max:=100; end case;
  v_quality:=least(100,greatest(1,v_base_min+floor(random()*(v_base_max-v_base_min+1))::integer+v_artist_bonus+v_specialty_bonus+round((p_game_score-50)*0.45)+v_skill_bonus));
  v_infected:=random()<v_parlour.infection_risk;
  update public.profiles set cash=cash-v_price where id=p_profile_id;
  insert into public.player_tattoos(user_id,profile_id,tattoo_design_id,parlour_id,artist_id,body_slot,quality_score,ink_color,price_paid,is_infected,minigame_score,minigame_accuracy,minigame_coverage,minigame_mistakes,minigame_difficulty)
  values(v_user_id,p_profile_id,p_design_id,p_parlour_id,p_artist_id,v_design.body_slot,v_quality,v_design.ink_color_primary,v_price,v_infected,p_game_score,p_game_accuracy,p_game_coverage,p_game_mistakes,p_game_difficulty) returning id into v_tattoo_id;
  if p_artist_id is not null then update public.tattoo_artists set total_tattoos_done=total_tattoos_done+1 where id=p_artist_id; end if;
  return jsonb_build_object('tattoo_id',v_tattoo_id,'price',v_price,'quality_score',v_quality,'is_infected',v_infected,'cash_remaining',v_cash-v_price);
end;
$$;

revoke all on function public.purchase_tattoo(uuid,uuid,uuid,uuid,integer,integer,integer,integer,integer) from public,anon;
grant execute on function public.purchase_tattoo(uuid,uuid,uuid,uuid,integer,integer,integer,integer,integer) to authenticated;

commit;
