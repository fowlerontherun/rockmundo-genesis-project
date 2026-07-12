-- RockMundo Wellness food, nutrition, hydration and meal planning expansion.
-- Safe additive schema; reuses profiles, companies/storefronts, scheduled activities and wellness history.

alter table public.profiles
  add column if not exists hydration integer not null default 76 check (hydration between 0 and 100),
  add column if not exists last_meaningful_meal_at timestamptz,
  add column if not exists nutrition_state text not null default 'Adequate',
  add column if not exists hydration_state text not null default 'Hydrated',
  add column if not exists meal_plan_type text not null default 'manual' check (meal_plan_type in ('manual','budget','balanced','performance','recovery','luxury')),
  add column if not exists meal_plan_daily_budget_cents integer not null default 0 check (meal_plan_daily_budget_cents >= 0);

create table if not exists public.food_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('snack','light_meal','standard_meal','healthy_meal','high_protein_meal','comfort_food','fast_food','luxury_meal','recovery_meal','breakfast','pre_performance_meal','post_performance_meal','travel_meal')),
  nutrition_value integer not null default 50 check (nutrition_value between -25 and 100),
  energy_value integer not null default 0 check (energy_value between -25 and 40),
  hydration_value integer not null default 0 check (hydration_value between -50 and 60),
  satiety integer not null default 50 check (satiety between 0 and 100),
  meal_quality integer not null default 55 check (meal_quality between 0 and 100),
  preparation_quality integer not null default 55 check (preparation_quality between 0 and 100),
  freshness integer not null default 85 check (freshness between 0 and 100),
  portion_size numeric(4,2) not null default 1.00 check (portion_size between 0.25 and 2.50),
  sugar_load integer not null default 0 check (sugar_load between 0 and 100),
  stimulant_level integer not null default 0 check (stimulant_level between 0 and 100),
  alcohol_content integer not null default 0 check (alcohol_content between 0 and 100),
  recovery_support integer not null default 0 check (recovery_support between -25 and 40),
  stress_effect integer not null default 0 check (stress_effect between -20 and 20),
  base_cost_cents integer not null default 0 check (base_cost_cents >= 0),
  consumption_duration_minutes integer not null default 20 check (consumption_duration_minutes between 1 and 240),
  availability_window jsonb not null default '[]'::jsonb,
  dietary_tags text[] not null default '{}',
  source_type text not null default 'restaurant' check (source_type in ('restaurant','home_cooking','prepared_meal','grocery','accommodation','tour_catering','venue_catering','hydration')),
  unlock_tier text not null default 'new_artist' check (unlock_tier in ('new_artist','active_musician','professional_artist','superstar')),
  player_summary jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_food_menu_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  food_definition_id uuid not null references public.food_definitions(id),
  price_cents integer not null check (price_cents >= 0),
  availability jsonb not null default '{}'::jsonb,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, food_definition_id)
);

create table if not exists public.meal_consumption_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  food_definition_id uuid not null references public.food_definitions(id),
  source_type text not null,
  company_id uuid references public.companies(id) on delete set null,
  scheduled_activity_id uuid,
  prepared_meal_id uuid,
  consumed_at timestamptz not null default now(),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  nutrition_delta integer not null default 0,
  hydration_delta integer not null default 0,
  energy_delta integer not null default 0,
  satiety_delta integer not null default 0,
  recovery_modifier numeric(5,3) not null default 0,
  performance_modifier numeric(5,3) not null default 0,
  suitability text,
  effects jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(profile_id, idempotency_key)
);
create index if not exists idx_meal_history_profile_time on public.meal_consumption_history(profile_id, consumed_at desc);

create table if not exists public.prepared_meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  food_definition_id uuid not null references public.food_definitions(id),
  charges_remaining integer not null default 1 check (charges_remaining >= 0 and charges_remaining <= 12),
  freshness integer not null default 100 check (freshness between 0 and 100),
  prepared_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  source_activity_id uuid,
  idempotency_key text not null,
  unique(profile_id, idempotency_key)
);

create table if not exists public.meal_plan_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_type text not null check (plan_type in ('budget','balanced','performance','recovery','luxury')),
  planned_for timestamptz not null,
  status text not null default 'planned' check (status in ('planned','completed','failed','cancelled')),
  food_definition_id uuid references public.food_definitions(id),
  company_id uuid references public.companies(id),
  cost_cents integer not null default 0,
  failure_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(profile_id, idempotency_key)
);

create table if not exists public.tour_catering_plans (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null,
  stop_id uuid,
  catering_tier text not null check (catering_tier in ('self_catered','budget','standard','performance','premium')),
  arranged_by uuid references public.profiles(id) on delete set null,
  cost_cents integer not null default 0,
  forecast jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','applied','cancelled','failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists public.food_condition_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  condition_slug text not null check (condition_slug in ('upset_stomach','food_poisoning','indigestion','dehydration','severe_hunger_fatigue')),
  severity integer not null default 1 check (severity between 1 and 5),
  source_meal_id uuid references public.meal_consumption_history(id) on delete set null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  idempotency_key text not null,
  unique(profile_id, idempotency_key)
);

create table if not exists public.food_balance_config (
  key text primary key,
  value jsonb not null,
  description text not null,
  updated_at timestamptz not null default now()
);

insert into public.food_balance_config(key, value, description) values
('nutrition_thresholds','{"excellent":86,"well_nourished":72,"adequate":50,"poor":30}'::jsonb,'Recent-meal rolling nutrition state thresholds.'),
('hydration_thresholds','{"fully_hydrated":88,"hydrated":70,"slightly_dehydrated":50,"dehydrated":30}'::jsonb,'Lightweight hydration state thresholds.'),
('effect_caps','{"recovery_bonus":0.10,"recovery_penalty":-0.15,"performance_bonus":0.06,"performance_penalty":-0.12,"restaurant_quality_influence":0.12}'::jsonb,'Fairness caps preventing pay-to-win stacking.'),
('meal_expectations','{"meaningful_meals_per_day":2,"free_hydration":true,"prepared_meal_fresh_hours":48}'::jsonb,'Daily meal expectations without micromanagement.')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();

insert into public.food_definitions(slug,name,category,nutrition_value,energy_value,hydration_value,satiety,meal_quality,preparation_quality,freshness,portion_size,sugar_load,stimulant_level,alcohol_content,recovery_support,stress_effect,base_cost_cents,consumption_duration_minutes,dietary_tags,source_type,unlock_tier,player_summary) values
('free_water','Water refill','snack',0,0,28,2,55,70,100,1,0,0,0,2,0,0,5,'{hydration,free}','hydration','new_artist','{"hydration":"Strong hydration","use":"Hydration anytime"}'::jsonb),
('budget_fast_food','Budget fast-food meal','fast_food',32,10,2,62,35,45,70,1.05,55,8,0,-4,-2,900,20,'{quick,cheap}','restaurant','new_artist','{"nutrition":"Low nutrition","energy":"Quick energy","fullness":"Filling"}'::jsonb),
('standard_restaurant_meal','Standard restaurant meal','standard_meal',58,7,6,72,60,60,78,1,18,0,0,4,-3,2200,40,'{balanced}','restaurant','new_artist','{"nutrition":"Balanced","fullness":"Filling"}'::jsonb),
('home_balanced_meal','Home-cooked balanced meal','healthy_meal',70,6,8,75,70,62,86,1,10,0,0,8,-2,750,55,'{balanced,home}','home_cooking','active_musician','{"nutrition":"High nutrition","use":"Home cooking"}'::jsonb),
('pre_gig_light_meal','Pre-performance light meal','pre_performance_meal',64,8,10,58,68,65,86,0.85,12,5,0,5,-1,1800,25,'{pre-gig,light}','restaurant','active_musician','{"use":"Recommended before performances"}'::jsonb),
('post_show_recovery_bowl','Post-show recovery meal','post_performance_meal',78,5,12,82,76,70,88,1,8,0,0,18,-4,3200,35,'{recovery,high nutrition}','restaurant','professional_artist','{"nutrition":"High nutrition","use":"Good for recovery"}'::jsonb),
('premium_catering','Premium catering plate','luxury_meal',82,6,10,80,84,82,90,1,10,0,0,12,-7,8000,30,'{catering,luxury}','tour_catering','superstar','{"nutrition":"High nutrition","use":"Premium convenience, capped effects"}'::jsonb)
on conflict (slug) do update set name=excluded.name, category=excluded.category, player_summary=excluded.player_summary, updated_at=now();

create or replace function public.food_nutrition_state(_score integer) returns text language sql immutable as $$
  select case when _score >= 86 then 'Excellent' when _score >= 72 then 'Well nourished' when _score >= 50 then 'Adequate' when _score >= 30 then 'Poor' else 'Deficient' end;
$$;

create or replace function public.food_hydration_state(_score integer) returns text language sql immutable as $$
  select case when _score >= 88 then 'Fully hydrated' when _score >= 70 then 'Hydrated' when _score >= 50 then 'Slightly dehydrated' when _score >= 30 then 'Dehydrated' else 'Severely dehydrated' end;
$$;

create or replace function public.process_food_daily(_profile_id uuid, _day date default current_date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype;
  meals int;
  new_nutrition int;
  new_hydration int;
  key text := 'food-daily-' || _day::text;
begin
  select * into p from profiles where id = _profile_id for update;
  if not found then raise exception 'profile not found'; end if;

  if exists (select 1 from wellness_history where profile_id = _profile_id and processed_on = _day and source = 'food_daily') then
    return jsonb_build_object('ok',true,'idempotent',true,'nutrition',p.nutrition,'hydration',p.hydration);
  end if;

  select count(*) into meals from meal_consumption_history
  where profile_id = _profile_id and consumed_at >= _day::timestamptz and consumed_at < (_day + 1)::timestamptz and satiety_delta >= 40;

  new_nutrition := least(100, greatest(0, coalesce(p.nutrition,68) - case when meals >= 2 then 0 when meals = 1 then 4 else 9 end));
  new_hydration := least(100, greatest(0, coalesce(p.hydration,76) - 12));

  update profiles set nutrition = new_nutrition, hydration = new_hydration,
    nutrition_state = food_nutrition_state(new_nutrition), hydration_state = food_hydration_state(new_hydration), last_health_update = now()
  where id = _profile_id;

  insert into wellness_history(user_id, profile_id, processed_on, overall_wellness, state, values, source)
  values (p.user_id, _profile_id, _day, calculate_overall_wellness(p.energy,p.physical_health,p.happiness,p.stress,p.fatigue,p.sleep_quality,new_nutrition,p.fitness,p.motivation,p.burnout_risk), wellness_state(calculate_overall_wellness(p.energy,p.physical_health,p.happiness,p.stress,p.fatigue,p.sleep_quality,new_nutrition,p.fitness,p.motivation,p.burnout_risk)), jsonb_build_object('nutrition',new_nutrition,'hydration',new_hydration,'meaningful_meals',meals), 'food_daily');

  return jsonb_build_object('ok',true,'idempotent',false,'nutrition',new_nutrition,'hydration',new_hydration,'meaningful_meals',meals);
exception when others then
  raise warning '[food_daily_processing_failure] profile_id=%, day=%, error=%', _profile_id, _day, sqlerrm;
  raise;
end;
$$;

create or replace function public.consume_food(_profile_id uuid, _food_slug text, _idempotency_key text, _company_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype;
  f food_definitions%rowtype;
  existing meal_consumption_history%rowtype;
  cost int;
  n_delta int;
  h_delta int;
  e_delta int;
begin
  select * into existing from meal_consumption_history where profile_id = _profile_id and idempotency_key = _idempotency_key;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'meal_id',existing.id); end if;

  select * into p from profiles where id = _profile_id for update;
  if not found then raise exception 'profile not found'; end if;
  select * into f from food_definitions where slug = _food_slug and is_active;
  if not found then raise exception 'food unavailable'; end if;

  cost := coalesce((select price_cents from company_food_menu_items where company_id = _company_id and food_definition_id = f.id and is_available), f.base_cost_cents);
  if cost > 0 and coalesce(p.cash,0) < cost then raise exception 'insufficient funds'; end if;

  n_delta := greatest(-10, least(16, round(f.nutrition_value / 8.0)::int));
  h_delta := greatest(-20, least(30, f.hydration_value));
  e_delta := greatest(-8, least(12, f.energy_value));

  if cost > 0 then update profiles set cash = cash - cost where id = _profile_id; end if;
  if _company_id is not null and cost > 0 then
    update companies set balance = coalesce(balance,0) + cost where id = _company_id;
    insert into company_transactions(company_id, transaction_type, amount, description, related_entity_id, related_entity_type)
    values (_company_id, 'income', cost, 'Restaurant meal purchase', _profile_id, 'profile');
  end if;

  update profiles set nutrition = least(100,greatest(0,coalesce(nutrition,68)+n_delta)), hydration = least(100,greatest(0,coalesce(hydration,76)+h_delta)), energy = least(100,greatest(0,coalesce(energy,80)+e_delta)), last_meaningful_meal_at = case when f.satiety >= 40 or f.nutrition_value >= 45 then now() else last_meaningful_meal_at end, nutrition_state = food_nutrition_state(least(100,greatest(0,coalesce(nutrition,68)+n_delta))), hydration_state = food_hydration_state(least(100,greatest(0,coalesce(hydration,76)+h_delta))), last_health_update = now() where id = _profile_id;

  insert into meal_consumption_history(profile_id,food_definition_id,source_type,company_id,cost_cents,nutrition_delta,hydration_delta,energy_delta,satiety_delta,recovery_modifier,performance_modifier,suitability,effects,idempotency_key)
  values(_profile_id,f.id,f.source_type,_company_id,cost,n_delta,h_delta,e_delta,f.satiety,least(0.10,greatest(-0.15,f.recovery_support/200.0)),least(0.06,greatest(-0.12,(f.nutrition_value-50)/1000.0)),case when f.category in ('pre_performance_meal','post_performance_meal','travel_meal','recovery_meal') then f.category else null end,jsonb_build_object('player_summary',f.player_summary,'category',f.category),_idempotency_key)
  returning * into existing;

  return jsonb_build_object('ok',true,'idempotent',false,'meal_id',existing.id,'cost_cents',cost,'nutrition_delta',n_delta,'hydration_delta',h_delta);
exception when unique_violation then
  raise warning '[duplicate_consumption_prevented] profile_id=%, key=%', _profile_id, _idempotency_key;
  return jsonb_build_object('ok',true,'idempotent',true);
when others then
  raise warning '[meal_processing_failure] profile_id=%, food=%, error=%', _profile_id, _food_slug, sqlerrm;
  raise;
end;
$$;
