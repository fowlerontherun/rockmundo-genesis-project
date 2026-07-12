-- Long-term mastery and specialisation progression. Additive, server-authoritative structures only.
create table if not exists public.skill_specialisations (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null references public.skills(skill_id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null,
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  mastery_rank_cap integer not null default 4 check (mastery_rank_cap between 1 and 4),
  display_order integer not null default 0,
  icon_key text,
  balance_version text not null default 'mastery_v1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialisation_prerequisites (
  id uuid primary key default gen_random_uuid(),
  specialisation_id uuid not null references public.skill_specialisations(id) on delete cascade,
  prerequisite_type text not null check (prerequisite_type in ('primary_skill_level','supporting_skill_level','attribute_threshold','achievement','role_experience','activity_count','genre_knowledge','prior_specialisation')),
  source_key text not null,
  required_value numeric not null check (required_value >= 0),
  is_hidden boolean not null default false,
  unique (specialisation_id, prerequisite_type, source_key)
);

create table if not exists public.specialisation_effects (
  id uuid primary key default gen_random_uuid(),
  specialisation_id uuid not null references public.skill_specialisations(id) on delete cascade,
  rank_required integer not null check (rank_required between 1 and 4),
  system_key text not null check (system_key in ('songwriting','recording','live_gig','rehearsal','teaching','production','business','wellness')),
  effect_key text not null,
  effect_value numeric not null check (effect_value >= 0 and effect_value <= 0.10),
  effect_cap numeric not null check (effect_cap >= 0 and effect_cap <= 0.10),
  description text not null,
  unique (specialisation_id, rank_required, system_key, effect_key)
);

create table if not exists public.mastery_challenges (
  id uuid primary key default gen_random_uuid(),
  specialisation_id uuid not null references public.skill_specialisations(id) on delete cascade,
  rank_required integer not null check (rank_required between 1 and 4),
  challenge_type text not null,
  target_value integer not null check (target_value > 0),
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  unique (specialisation_id, rank_required, challenge_type)
);

create table if not exists public.player_skill_mastery (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null references public.skills(skill_id) on delete restrict,
  specialisation_id uuid not null references public.skill_specialisations(id) on delete restrict,
  mastery_xp integer not null default 0 check (mastery_xp >= 0),
  mastery_rank integer not null default 0 check (mastery_rank between 0 and 4),
  is_primary boolean not null default true,
  unlocked_at timestamptz not null default now(),
  last_progress_at timestamptz,
  last_respecialised_at timestamptz,
  balance_version text not null default 'mastery_v1.0.0',
  unique (profile_id, specialisation_id)
);
create unique index if not exists one_primary_mastery_path_per_skill on public.player_skill_mastery(profile_id, skill_id) where is_primary;

create table if not exists public.player_mastery_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  player_mastery_id uuid not null references public.player_skill_mastery(id) on delete cascade,
  challenge_id uuid not null references public.mastery_challenges(id) on delete cascade,
  progress_value integer not null default 0 check (progress_value >= 0),
  completed_at timestamptz,
  last_event_id text,
  unique (player_mastery_id, challenge_id)
);

create table if not exists public.mastery_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null references public.skills(skill_id) on delete restrict,
  specialisation_id uuid not null references public.skill_specialisations(id) on delete restrict,
  xp_amount integer not null check (xp_amount >= 0),
  source text not null check (source in ('gig','recording','songwriting','teaching','challenge','migration','admin_adjustment')),
  source_record_id text,
  balance_version text not null default 'mastery_v1.0.0',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.player_mastery_titles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  specialisation_id uuid not null references public.skill_specialisations(id) on delete restrict,
  title text not null,
  badge_key text not null,
  rank_awarded integer not null check (rank_awarded between 1 and 4),
  is_selected boolean not null default false,
  awarded_at timestamptz not null default now(),
  unique (profile_id, specialisation_id, rank_awarded)
);

alter table public.skill_specialisations enable row level security;
alter table public.specialisation_prerequisites enable row level security;
alter table public.specialisation_effects enable row level security;
alter table public.mastery_challenges enable row level security;
alter table public.player_skill_mastery enable row level security;
alter table public.player_mastery_challenge_progress enable row level security;
alter table public.mastery_xp_ledger enable row level security;
alter table public.player_mastery_titles enable row level security;

create policy "Visible active mastery specialisations" on public.skill_specialisations for select using (is_active and not is_hidden);
create policy "Visible active mastery prerequisites" on public.specialisation_prerequisites for select using (not is_hidden and exists (select 1 from public.skill_specialisations s where s.id = specialisation_id and s.is_active and not s.is_hidden));
create policy "Visible active mastery effects" on public.specialisation_effects for select using (exists (select 1 from public.skill_specialisations s where s.id = specialisation_id and s.is_active and not s.is_hidden));
create policy "Visible active mastery challenges" on public.mastery_challenges for select using (is_active and exists (select 1 from public.skill_specialisations s where s.id = specialisation_id and s.is_active and not s.is_hidden));
create policy "Players read own mastery" on public.player_skill_mastery for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Players read own mastery challenge progress" on public.player_mastery_challenge_progress for select using (player_mastery_id in (select id from public.player_skill_mastery where profile_id in (select id from public.profiles where user_id = auth.uid())));
create policy "Players read own mastery ledger" on public.mastery_xp_ledger for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Players read own mastery titles" on public.player_mastery_titles for select using (profile_id in (select id from public.profiles where user_id = auth.uid())) ;

create or replace view public.admin_mastery_diagnostics as
select s.skill_id, ss.slug, ss.name, ss.is_active, ss.is_hidden, ss.mastery_rank_cap, ss.balance_version,
  count(distinct psm.id) as player_records,
  coalesce(sum(ml.xp_amount), 0) as total_ledger_xp,
  count(distinct ml.idempotency_key) as ledger_events
from public.skill_specialisations ss
join public.skills s on s.skill_id = ss.skill_id
left join public.player_skill_mastery psm on psm.specialisation_id = ss.id
left join public.mastery_xp_ledger ml on ml.specialisation_id = ss.id
group by s.skill_id, ss.id;

insert into public.skill_specialisations (skill_id, slug, name, description, is_active, is_hidden, mastery_rank_cap, display_order, icon_key, balance_version)
select v.skill_id, v.slug, v.name, v.description, true, v.is_hidden, 4, v.display_order, v.icon_key, 'mastery_v1.0.0'
from (values
  ('guitar','live-guitar','Live Guitar','Recovery, endurance and stage reliability for guitar-led gigs.',false,10,'guitar'),
  ('guitar','studio-guitar','Studio Guitar','Consistent takes, tone choices and reduced retake waste in recording sessions.',false,20,'sliders'),
  ('vocals','frontperson','Frontperson','Crowd recovery, stage command and momentum management without improving instrumental accuracy.',false,30,'mic'),
  ('vocals','studio-vocals','Studio Vocals','Vocal consistency, harmony blend and retake efficiency for studio work.',false,40,'waveform'),
  ('songwriting','composition','Composition','Structural consistency and realised potential for complex songs.',false,50,'music'),
  ('songwriting','commercial-hooks','Commercial Hooks','Accessibility and memorable hook craft without boosting technical completion directly.',false,60,'sparkles'),
  ('production','mixing','Mixing','Engineering judgement, session consistency and professional studio reputation.',false,70,'audio-lines'),
  ('production','experimental-production','Experimental Production','Hidden path for unusual high-quality cross-genre studio work.',true,80,'flask')
) as v(skill_id, slug, name, description, is_hidden, display_order, icon_key)
where exists (select 1 from public.skills s where s.skill_id = v.skill_id)
on conflict (slug) do update set name = excluded.name, description = excluded.description, is_active = excluded.is_active, is_hidden = excluded.is_hidden, mastery_rank_cap = excluded.mastery_rank_cap, display_order = excluded.display_order, icon_key = excluded.icon_key, balance_version = excluded.balance_version;

insert into public.specialisation_prerequisites (specialisation_id, prerequisite_type, source_key, required_value, is_hidden)
select ss.id, 'primary_skill_level', ss.skill_id, 100, false from public.skill_specialisations ss
where ss.slug in ('live-guitar','studio-guitar','frontperson','studio-vocals','composition','commercial-hooks','mixing','experimental-production')
on conflict (specialisation_id, prerequisite_type, source_key) do nothing;

insert into public.specialisation_effects (specialisation_id, rank_required, system_key, effect_key, effect_value, effect_cap, description)
select ss.id, e.rank_required, e.system_key, e.effect_key, e.effect_value, 0.08, e.description
from public.skill_specialisations ss
join (values
  ('live-guitar',1,'live_gig','minor_error_recovery',0.015,'Improves recovery from small live guitar mistakes.'),
  ('live-guitar',2,'live_gig','timing_variance_reduction',0.020,'Reduces guitar timing variance during difficult sets.'),
  ('studio-guitar',1,'recording','retake_waste_reduction',0.015,'Reduces guitar retake waste in valid studio sessions.'),
  ('frontperson',1,'live_gig','crowd_recovery',0.015,'Improves crowd retention after a weak song.'),
  ('studio-vocals',1,'recording','vocal_consistency',0.015,'Improves vocal take consistency; does not replace required vocal roles.'),
  ('composition',1,'songwriting','structure_consistency',0.015,'Improves structural consistency for songwriting projects.'),
  ('commercial-hooks',1,'songwriting','accessibility_contribution',0.015,'Improves hook accessibility contribution only.'),
  ('mixing',1,'recording','engineering_consistency',0.015,'Improves engineering consistency in configured recording systems.')
) as e(slug, rank_required, system_key, effect_key, effect_value, description) on e.slug = ss.slug
on conflict (specialisation_id, rank_required, system_key, effect_key) do nothing;
