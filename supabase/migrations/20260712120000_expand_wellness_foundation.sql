-- Expanded wellness foundation: safe additive schema and balance seeds.

alter table public.profiles
  add column if not exists physical_health integer not null default 80 check (physical_health between 0 and 100),
  add column if not exists happiness integer not null default 72 check (happiness between 0 and 100),
  add column if not exists fatigue integer not null default 35 check (fatigue between 0 and 100),
  add column if not exists sleep_quality integer not null default 72 check (sleep_quality between 0 and 100),
  add column if not exists nutrition integer not null default 68 check (nutrition between 0 and 100),
  add column if not exists fitness integer not null default 55 check (fitness between 0 and 100),
  add column if not exists motivation integer not null default 72 check (motivation between 0 and 100),
  add column if not exists burnout_risk integer not null default 18 check (burnout_risk between 0 and 100),
  add column if not exists wellness_last_processed_on date;

update public.profiles
set physical_health = coalesce(health, physical_health, 80),
    happiness = coalesce(mood, happiness, 72),
    burnout_risk = least(100, greatest(0, round(coalesce(stress, 28) * 0.45)::int))
where physical_health = 80 or happiness = 72 or burnout_risk = 18;

create table if not exists public.wellness_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  processed_on date not null,
  overall_wellness integer not null check (overall_wellness between 0 and 100),
  state text not null check (state in ('Excellent','Good','Stable','Struggling','Critical')),
  values jsonb not null default '{}'::jsonb,
  source text not null default 'daily',
  created_at timestamptz not null default now(),
  unique(profile_id, processed_on, source)
);

alter table public.wellness_activity_catalog
  add column if not exists unlock_tier text not null default 'new_artist',
  add column if not exists can_overlap boolean not null default false,
  add column if not exists location_tags text[] not null default '{}',
  add column if not exists gameplay_impact text;

alter table public.player_ailments
  add column if not exists expected_recovery_at timestamptz,
  add column if not exists recovery_progress integer not null default 0 check (recovery_progress between 0 and 100),
  add column if not exists treatment_modifier numeric not null default 1,
  add column if not exists worsened_at timestamptz;

create or replace function public.calculate_overall_wellness(
  _energy integer,
  _physical_health integer,
  _happiness integer,
  _stress integer,
  _fatigue integer,
  _sleep_quality integer,
  _nutrition integer,
  _fitness integer,
  _motivation integer,
  _burnout_risk integer
) returns integer
language sql immutable as $$
  select least(100, greatest(0, round((
    coalesce(_energy,80) * 0.16 +
    coalesce(_physical_health,80) * 0.18 +
    coalesce(_happiness,72) * 0.12 +
    (100 - coalesce(_stress,28)) * 0.05 +
    (100 - coalesce(_fatigue,35)) * 0.04 +
    coalesce(_sleep_quality,72) * 0.13 +
    coalesce(_nutrition,68) * 0.10 +
    coalesce(_fitness,55) * 0.09 +
    coalesce(_motivation,72) * 0.10 +
    (100 - coalesce(_burnout_risk,18)) * 0.03
  ) / 1.00)::int));
$$;

create or replace function public.wellness_state(_score integer) returns text
language sql immutable as $$
  select case when _score >= 85 then 'Excellent'
              when _score >= 70 then 'Good'
              when _score >= 50 then 'Stable'
              when _score >= 30 then 'Struggling'
              else 'Critical' end;
$$;

create or replace function public.process_daily_wellness(_profile_id uuid, _day date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles%rowtype;
  new_energy int;
  new_fatigue int;
  new_nutrition int;
  new_stress int;
  new_sleep int;
  new_motivation int;
  new_burnout int;
  score int;
  state text;
begin
  select * into p from profiles where id = _profile_id for update;
  if not found then
    raise exception 'profile not found';
  end if;

  if p.wellness_last_processed_on is not null and p.wellness_last_processed_on >= _day then
    score := calculate_overall_wellness(p.energy, p.physical_health, p.happiness, p.stress, p.fatigue, p.sleep_quality, p.nutrition, p.fitness, p.motivation, p.burnout_risk);
    return jsonb_build_object('ok', true, 'idempotent', true, 'overall_wellness', score, 'state', wellness_state(score));
  end if;

  new_energy := least(100, greatest(0, coalesce(p.energy,80) + 3));
  new_fatigue := least(100, greatest(0, coalesce(p.fatigue,35) - 4));
  new_nutrition := least(100, greatest(0, coalesce(p.nutrition,68) - 3));
  new_stress := least(100, greatest(0, coalesce(p.stress,28) + 1));
  new_sleep := least(100, greatest(0, coalesce(p.sleep_quality,72) - 2));
  new_motivation := least(100, greatest(0, coalesce(p.motivation,72) + case when coalesce(p.happiness,72) > 70 then 1 else -1 end));
  new_burnout := least(100, greatest(0, coalesce(p.burnout_risk,18) + case when coalesce(p.stress,28) > 70 then 5 else -3 end + case when coalesce(p.fatigue,35) > 75 then 4 else 0 end));
  score := calculate_overall_wellness(new_energy, p.physical_health, p.happiness, new_stress, new_fatigue, new_sleep, new_nutrition, p.fitness, new_motivation, new_burnout);
  state := wellness_state(score);

  update profiles set energy = new_energy, fatigue = new_fatigue, nutrition = new_nutrition, stress = new_stress,
    sleep_quality = new_sleep, motivation = new_motivation, burnout_risk = new_burnout,
    wellness_last_processed_on = _day, last_health_update = now()
  where id = _profile_id;

  insert into wellness_history(user_id, profile_id, processed_on, overall_wellness, state, values, source)
  values (p.user_id, p.id, _day, score, state,
    jsonb_build_object('energy',new_energy,'physical_health',p.physical_health,'happiness',p.happiness,'stress',new_stress,'fatigue',new_fatigue,'sleep_quality',new_sleep,'nutrition',new_nutrition,'fitness',p.fitness,'motivation',new_motivation,'burnout_risk',new_burnout), 'daily')
  on conflict (profile_id, processed_on, source) do nothing;

  update player_ailments
  set recovery_progress = least(100, recovery_progress + case when new_fatigue < 50 then 26 else 18 end),
      resolved_at = case when recovery_progress + case when new_fatigue < 50 then 26 else 18 end >= 100 then now() else resolved_at end
  where profile_id = _profile_id and resolved_at is null;

  return jsonb_build_object('ok', true, 'idempotent', false, 'overall_wellness', score, 'state', state);
exception when others then
  raise warning '[wellness_daily_processing_failure] profile_id=%, day=%, error=%', _profile_id, _day, sqlerrm;
  raise;
end;
$$;

insert into public.wellness_activity_catalog (slug, name, category, description, duration_minutes, cooldown_hours, stamina_cost, cost_cents, stat_effects, ailment_risk, treats_ailment_slug, unlock_min_fame, unlock_tier, can_overlap, location_tags, gameplay_impact, is_active, sort_order)
values
('rest','Rest','recovery','Reduce fatigue and take pressure off your next commitment.',60,2,0,0,'{"fatigue":-10,"energy":6,"stress":-4}','{}',null,0,'new_artist',false,'{home,hotel}','Reduces fatigue before practice, gigs and travel.',true,10),
('sleep','Sleep','recovery','A full sleep block for meaningful recovery.',480,16,0,0,'{"energy":28,"sleep_quality":18,"fatigue":-24,"stress":-5}','{}',null,0,'new_artist',false,'{home,hotel}','Best recovery for energy, fatigue and illness progress.',true,20),
('power_nap','Power nap','recovery','Short recovery when you cannot afford a full sleep.',25,8,0,0,'{"energy":10,"fatigue":-5}','{}',null,0,'new_artist',false,'{home,studio,venue}','Short energy recovery with limited daily value.',true,30),
('healthy_meal','Healthy meal','recovery','Eat properly at home or at a suitable restaurant.',45,4,0,1800,'{"nutrition":14,"energy":4,"happiness":2}','{}',null,0,'new_artist',false,'{restaurant,home}','Improves nutrition and avoids poorly-fed penalties.',true,40),
('relaxation','Relaxation','recovery','Unplug, decompress and lower stress.',45,3,0,0,'{"stress":-12,"happiness":6,"motivation":2}','{}',null,0,'new_artist',false,'{home,park}','Lowers stress and improves mood before demanding work.',true,50),
('exercise','Exercise','fitness','Build conditioning, at the cost of short-term energy.',60,12,8,0,'{"fitness":8,"stress":-8,"fatigue":6,"physical_health":3}','{"muscle_strain":0.03}',null,100,'active_musician',false,'{gym,park}','Builds fitness but adds fatigue if overused.',true,60),
('massage','Massage','recovery','Paid recovery for accumulated fatigue and muscle tension.',60,24,0,6500,'{"fatigue":-16,"physical_health":5,"stress":-5}','{}',null,100,'active_musician',false,'{wellness_center,hotel}','Paid fatigue recovery for rehearsals, tours and long studio days.',true,70),
('doctor_visit','Doctor visit','medical','Assess and treat minor conditions; recovery still takes time.',90,24,0,12000,'{"physical_health":8,"fatigue":-4}','{}','common_cold',0,'new_artist',false,'{hospital,clinic}','Treats minor conditions; recovery still depends on time and rest.',true,80)
on conflict (slug) do update set
  name=excluded.name, category=excluded.category, description=excluded.description, duration_minutes=excluded.duration_minutes,
  cooldown_hours=excluded.cooldown_hours, stamina_cost=excluded.stamina_cost, cost_cents=excluded.cost_cents,
  stat_effects=excluded.stat_effects, ailment_risk=excluded.ailment_risk, treats_ailment_slug=excluded.treats_ailment_slug,
  unlock_min_fame=excluded.unlock_min_fame, unlock_tier=excluded.unlock_tier, can_overlap=excluded.can_overlap,
  location_tags=excluded.location_tags, gameplay_impact=excluded.gameplay_impact, is_active=excluded.is_active, sort_order=excluded.sort_order;
