-- City-specific Nightclub / Underworld scenes, local reputation and city-gated Scene Stories.
create table if not exists public.city_underground_scenes (
  city_id uuid primary key references public.cities(id) on delete cascade,
  scene_name text not null,
  tagline text not null,
  dominant_styles text[] not null default '{}',
  culture_tags text[] not null default '{}',
  risk_level integer not null default 2 check (risk_level between 1 and 5),
  media_attention integer not null default 50 check (media_attention between 0 and 100),
  authority_pressure integer not null default 50 check (authority_pressure between 0 and 100),
  networking_strength integer not null default 50 check (networking_strength between 0 and 100),
  underground_depth integer not null default 50 check (underground_depth between 0 and 100),
  is_flagship boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.city_underground_scenes(city_id,scene_name,tagline,dominant_styles,culture_tags,risk_level,media_attention,authority_pressure,networking_strength,underground_depth)
select c.id,c.name||' Underground','Every city has a scene. Learn who matters before you try to own the night.',
  case when c.population>=5000000 then array['big-city circuit','late-night clubs'] else array['local circuit','independent venues'] end,
  case when c.population>=5000000 then array['busy','competitive','international'] else array['local','tight-knit','word-of-mouth'] end,
  case when c.population>=5000000 then 3 else 2 end,
  case when c.population>=5000000 then 65 else 40 end,
  50,
  case when c.population>=5000000 then 70 else 50 end,
  case when c.population>=5000000 then 70 else 55 end
from public.cities c on conflict(city_id) do nothing;

update public.city_underground_scenes s set
  scene_name=v.scene_name,tagline=v.tagline,dominant_styles=v.styles,culture_tags=v.tags,risk_level=v.risk,
  media_attention=v.media,authority_pressure=v.authority,networking_strength=v.networking,underground_depth=v.depth,
  is_flagship=true,updated_at=now()
from (values
 ('London','London After Dark','Industry doors, basement rooms and tabloids all share the same postcode.',array['indie','punk','electronic','rock'],array['industry','tabloid','exclusive','basement'],4,85,70,90,85),
 ('Berlin','Berlin After Hours','The serious doors open late, reputations travel quietly, and the night rarely ends early.',array['electronic','industrial','punk','experimental'],array['warehouse','art-space','door-policy','after-hours'],4,45,55,80,95),
 ('Los Angeles','Sunset Underground','Backrooms, showcases and image-makers blur into one long audition.',array['rock','alternative','pop','hip-hop'],array['showcase','industry','celebrity','afterparty'],4,90,65,95,75),
 ('Tokyo','Tokyo Midnight Circuit','Listening rooms, tiny live houses and trusted introductions reward patience.',array['rock','electronic','pop','experimental'],array['live-house','listening-room','discreet','precision'],3,60,75,80,80),
 ('Manchester','Northern Underground','Basements, promoters and stubborn local loyalty still decide who belongs.',array['indie','rock','post-punk','electronic'],array['basement','local-loyalty','promoters','late-night'],3,55,50,80,85),
 ('New York','Downtown Circuit','Every room knows someone, every story moves fast, and anonymity never lasts.',array['rock','punk','hip-hop','electronic'],array['downtown','media','networking','competitive'],4,95,70,95,85),
 ('Liverpool','Mersey After Dark','Songs, loyalties and old venue networks matter more than flash.',array['rock','indie','alternative'],array['heritage','local-loyalty','pub-circuit','songwriters'],2,45,45,70,70),
 ('Nashville','Backroom Nashville','Writers, players and quiet introductions carry more weight than noise.',array['country','rock','americana'],array['songwriters','sessions','industry','backroom'],2,55,45,90,60),
 ('Austin','Red River Underground','Live rooms, DIY promoters and festival spillover keep the circuit moving.',array['rock','indie','alternative','country'],array['live-music','DIY','festival','promoters'],3,55,50,80,80),
 ('Ibiza','Ibiza After Hours','Guest lists, villas and sunrise sessions turn one night into a week of consequences.',array['electronic','dance','house'],array['VIP','villa','sunrise','international'],4,75,60,90,80),
 ('Seoul','Seoul Night Circuit','Fast-moving tastemakers, private rooms and intense fan attention reward momentum.',array['pop','electronic','rock','hip-hop'],array['tastemakers','private-room','fans','fast-moving'],3,85,75,90,70),
 ('Melbourne','Laneway Underground','Independent rooms and scene credibility build slowly but travel far.',array['indie','rock','electronic'],array['laneway','independent','art-scene','local'],2,45,40,75,75)
) as v(city_name,scene_name,tagline,styles,tags,risk,media,authority,networking,depth)
join public.cities c on c.name=v.city_name where s.city_id=c.id;

create table if not exists public.player_city_scene_reputation (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  reputation integer not null default 0 check (reputation between 0 and 100),
  visits integer not null default 0,
  successful_stories integer not null default 0,
  failed_stories integer not null default 0,
  last_active_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(profile_id,city_id)
);

create table if not exists public.city_scene_rivalries (
  city_id uuid not null references public.cities(id) on delete cascade,
  rival_city_id uuid not null references public.cities(id) on delete cascade,
  rivalry_name text not null,
  intensity integer not null default 50 check (intensity between 0 and 100),
  description text not null,
  primary key(city_id,rival_city_id),
  check(city_id<>rival_city_id)
);

insert into public.city_scene_rivalries(city_id,rival_city_id,rivalry_name,intensity,description)
select a.id,b.id,v.rivalry,v.intensity,v.description from (values
 ('Manchester','Liverpool','North-West Scene Rivalry',75,'Local credibility in one city can make the other scene harder to impress.'),
 ('Liverpool','Manchester','North-West Scene Rivalry',75,'Local credibility in one city can make the other scene harder to impress.'),
 ('New York','Los Angeles','Coast-to-Coast Attention',55,'Media and industry attention carries differently between the two major circuits.'),
 ('Los Angeles','New York','Coast-to-Coast Attention',55,'Media and industry attention carries differently between the two major circuits.'),
 ('Tokyo','Osaka','Japan Live Circuit Rivalry',45,'Strong local standing is respected, but outsiders still need to earn their room.'),
 ('Osaka','Tokyo','Japan Live Circuit Rivalry',45,'Strong local standing is respected, but outsiders still need to earn their room.')
) v(a,b,rivalry,intensity,description)
join public.cities a on a.name=v.a join public.cities b on b.name=v.b on conflict do nothing;

alter table public.scene_story_catalog add column if not exists city_names text[] not null default '{}';
alter table public.scene_story_catalog add column if not exists min_city_rep integer not null default 0;
alter table public.player_scene_story_runs add column if not exists city_id uuid references public.cities(id) on delete set null;

create or replace function public.scene_story_set_city() returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.city_id is null then select current_city_id into new.city_id from public.profiles where id=new.profile_id; end if;
  return new;
end;$$;
drop trigger if exists trg_scene_story_set_city on public.player_scene_story_runs;
create trigger trg_scene_story_set_city before insert on public.player_scene_story_runs for each row execute function public.scene_story_set_city();

create or replace function public.scene_story_award_city_rep() returns trigger language plpgsql security definer set search_path='public' as $$
declare v_city uuid;v_delta integer;
begin
  select city_id into v_city from public.player_scene_story_runs where id=new.run_id;
  if v_city is null then return new; end if;
  v_delta:=case when new.outcome='success' then 3 when new.outcome='failure' then 1 else 1 end;
  insert into public.player_city_scene_reputation(profile_id,city_id,reputation,visits,successful_stories,failed_stories,last_active_at,updated_at)
  values(new.profile_id,v_city,v_delta,1,case when new.outcome='success' then 1 else 0 end,case when new.outcome='failure' then 1 else 0 end,now(),now())
  on conflict(profile_id,city_id) do update set
    reputation=least(100,public.player_city_scene_reputation.reputation+v_delta),visits=public.player_city_scene_reputation.visits+1,
    successful_stories=public.player_city_scene_reputation.successful_stories+case when new.outcome='success' then 1 else 0 end,
    failed_stories=public.player_city_scene_reputation.failed_stories+case when new.outcome='failure' then 1 else 0 end,last_active_at=now(),updated_at=now();
  return new;
end;$$;
drop trigger if exists trg_scene_story_award_city_rep on public.player_scene_story_history;
create trigger trg_scene_story_award_city_rep after insert on public.player_scene_story_history for each row execute function public.scene_story_award_city_rep();

create or replace function public.scene_story_is_eligible(p_profile_id uuid,p_story_id uuid,p_surface text) returns boolean
language plpgsql security definer set search_path='public' as $$
declare v_profile public.profiles%rowtype;v_story public.scene_story_catalog%rowtype;v_state public.player_underground_state%rowtype;v_city_name text;v_city_rep integer:=0;
begin
  select * into v_profile from public.profiles where id=p_profile_id;
  if not found or v_profile.user_id<>auth.uid() then return false; end if;
  select * into v_story from public.scene_story_catalog where id=p_story_id and is_active=true;
  if not found or p_surface not in ('nightclub','underworld') or v_story.source_surface not in (p_surface,'both') then return false; end if;
  if floor(coalesce(v_profile.age,0))<v_story.minimum_age then return false; end if;
  select name into v_city_name from public.cities where id=v_profile.current_city_id;
  if coalesce(array_length(v_story.city_names,1),0)>0 and not(v_city_name=any(v_story.city_names)) then return false; end if;
  select coalesce(reputation,0) into v_city_rep from public.player_city_scene_reputation where profile_id=p_profile_id and city_id=v_profile.current_city_id;
  if coalesce(v_city_rep,0)<v_story.min_city_rep then return false; end if;
  select * into v_state from public.player_underground_state where profile_id=p_profile_id;
  if not found then v_state.underground_cred:=0;v_state.heat:=0;v_state.scene_connections:=0;v_state.notoriety:=0;end if;
  if v_state.underground_cred<v_story.min_cred or v_state.heat<v_story.min_heat or v_state.heat>v_story.max_heat then return false; end if;
  if v_story.requires_scandal and not exists(select 1 from public.player_scandals where profile_id=p_profile_id and stage<>'resolved' and resolved_at is null) then return false; end if;
  if v_story.requires_contact and not exists(select 1 from public.player_scene_contacts where profile_id=p_profile_id and relationship_status<>'ended') then return false; end if;
  if v_story.requires_recovery and not exists(select 1 from public.player_addictions where profile_id=p_profile_id and status='recovering') then return false; end if;
  if exists(select 1 from public.player_scene_story_runs r where r.profile_id=p_profile_id and r.story_id=p_story_id and r.status in ('completed','failed','abandoned') and coalesce(r.completed_at,r.updated_at)>now()-make_interval(hours=>v_story.cooldown_hours)) then return false; end if;
  return true;
end;$$;

insert into public.scene_story_catalog(slug,name,description,source_surface,minimum_age,risk_tier,min_cred,min_heat,max_heat,requires_scandal,requires_contact,requires_recovery,cooldown_hours,steps,is_active,city_names,min_city_rep)
values
('london_soho_lockin','Soho Lock-In','A promoter keeps a central London room open after close. The useful conversations happen once the public leaves.','nightclub',18,3,8,0,80,false,true,false,72,'[{"key":"door","title":"After the Shutters","body":"The room narrows to musicians, press and promoters.","choices":[{"key":"network","label":"Work the room","terminal":true,"successChance":0.76,"successEffects":{"scene_connections":7,"underground_cred":4,"fame":2},"failureEffects":{"heat":4,"gossip_exposure":5,"stress":3}},{"key":"leave","label":"Leave before it gets messy","terminal":true,"successChance":1,"successEffects":{"heat":-2,"sleep_quality":3},"failureEffects":{}}]}]'::jsonb,true,array['London'],5),
('berlin_concrete_dawn','Concrete Dawn','A warehouse host offers an invite that only matters if you can respect the room.','both',18,3,10,0,70,false,false,false,72,'[{"key":"entry","title":"No Photos","body":"Nobody cares about your fame here. They care whether you understand the scene.","choices":[{"key":"blend_in","label":"Respect the room","terminal":true,"successChance":0.86,"successEffects":{"underground_cred":6,"scene_connections":5,"heat":-2},"failureEffects":{"stress":2}},{"key":"make_scene","label":"Make sure people notice you","terminal":true,"successChance":0.5,"successEffects":{"fame":3,"notoriety":5,"heat":5},"failureEffects":{"heat":10,"stress":5}}]}]'::jsonb,true,array['Berlin'],8),
('la_sunset_backroom','Sunset Backroom','A showcase turns into a private industry room where every introduction feels like an audition.','nightclub',18,3,8,0,90,false,true,false,72,'[{"key":"pitch","title":"The Backroom","body":"Managers, stylists and promoters are comparing notes.","choices":[{"key":"pitch_hard","label":"Pitch yourself hard","terminal":true,"successChance":0.68,"successEffects":{"fame":4,"scene_connections":7,"notoriety":2},"failureEffects":{"gossip_exposure":7,"stress":4}},{"key":"build_trust","label":"Build one real connection","terminal":true,"successChance":0.84,"successEffects":{"contact_trust":6,"scene_connections":4,"underground_cred":3},"failureEffects":{"stress":2}}]}]'::jsonb,true,array['Los Angeles'],5),
('tokyo_listening_room','Midnight Listening Room','A tiny invitation-only room is testing unreleased music after the last train.','both',18,2,5,0,60,false,true,false,72,'[{"key":"listen","title":"One Track, One Chance","body":"The room rewards restraint and attention more than performance.","choices":[{"key":"listen_first","label":"Listen first, speak later","terminal":true,"successChance":0.9,"successEffects":{"scene_connections":5,"contact_trust":5,"underground_cred":3},"failureEffects":{"stress":1}},{"key":"take_over","label":"Take over the conversation","terminal":true,"successChance":0.48,"successEffects":{"fame":3,"notoriety":3},"failureEffects":{"contact_trust":-4,"heat":3}}]}]'::jsonb,true,array['Tokyo'],4),
('manchester_basement_invite','Northern Basement','A local promoter offers the sort of basement slot that scene regulars remember.','both',16,2,3,0,70,false,false,false,48,'[{"key":"slot","title":"Downstairs Only","body":"The room is small, loud and full of people who actually turn up next week.","choices":[{"key":"play_to_room","label":"Play to the room","terminal":true,"successChance":0.84,"successEffects":{"fans":12,"underground_cred":5,"scene_connections":4},"failureEffects":{"stress":2}},{"key":"chase_attention","label":"Chase a bigger reaction","terminal":true,"successChance":0.62,"successEffects":{"fame":2,"fans":18,"heat":2},"failureEffects":{"notoriety":3,"stress":4}}]}]'::jsonb,true,array['Manchester'],3),
('nyc_downtown_invite','Downtown Invite','A Lower East Side contact gets your name onto a room where stories travel faster than music.','nightclub',18,4,12,5,100,false,true,false,96,'[{"key":"room","title":"Everybody Knows Somebody","body":"One good conversation could open three doors. One bad one could become a headline.","choices":[{"key":"network","label":"Network carefully","terminal":true,"successChance":0.74,"successEffects":{"scene_connections":8,"fame":3,"underground_cred":4},"failureEffects":{"gossip_exposure":8,"heat":5}},{"key":"lean_in","label":"Become the story","terminal":true,"successChance":0.58,"successEffects":{"fame":6,"notoriety":6,"heat":6},"failureEffects":{"heat":12,"scandal_exposure":10,"stress":5}}]}]'::jsonb,true,array['New York'],10)
on conflict(slug) do update set steps=excluded.steps,city_names=excluded.city_names,min_city_rep=excluded.min_city_rep,is_active=true,updated_at=now();

create or replace function public.get_current_city_scene(p_profile_id uuid) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_profile public.profiles%rowtype;v_scene public.city_underground_scenes%rowtype;v_city public.cities%rowtype;v_rep public.player_city_scene_reputation%rowtype;v_rivals jsonb;
begin
  select * into v_profile from public.profiles where id=p_profile_id;
  if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
  select * into v_city from public.cities where id=v_profile.current_city_id;
  if not found then return jsonb_build_object('ok',false,'reason','no_city'); end if;
  select * into v_scene from public.city_underground_scenes where city_id=v_city.id;
  select * into v_rep from public.player_city_scene_reputation where profile_id=p_profile_id and city_id=v_city.id;
  select coalesce(jsonb_agg(jsonb_build_object('cityId',r.rival_city_id,'cityName',c.name,'name',r.rivalry_name,'intensity',r.intensity,'description',r.description)),'[]'::jsonb)
  into v_rivals from public.city_scene_rivalries r join public.cities c on c.id=r.rival_city_id where r.city_id=v_city.id;
  return jsonb_build_object('ok',true,'cityId',v_city.id,'cityName',v_city.name,'country',v_city.country,
    'scene',jsonb_build_object('name',v_scene.scene_name,'tagline',v_scene.tagline,'styles',v_scene.dominant_styles,'tags',v_scene.culture_tags,'riskLevel',v_scene.risk_level,'mediaAttention',v_scene.media_attention,'authorityPressure',v_scene.authority_pressure,'networkingStrength',v_scene.networking_strength,'undergroundDepth',v_scene.underground_depth,'flagship',v_scene.is_flagship),
    'reputation',coalesce(v_rep.reputation,0),'visits',coalesce(v_rep.visits,0),'successfulStories',coalesce(v_rep.successful_stories,0),'failedStories',coalesce(v_rep.failed_stories,0),'rivals',v_rivals);
end;$$;

alter table public.city_underground_scenes enable row level security;
alter table public.player_city_scene_reputation enable row level security;
alter table public.city_scene_rivalries enable row level security;
drop policy if exists "Read city underground scenes" on public.city_underground_scenes;
create policy "Read city underground scenes" on public.city_underground_scenes for select to authenticated using(true);
drop policy if exists "Read own city scene reputation" on public.player_city_scene_reputation;
create policy "Read own city scene reputation" on public.player_city_scene_reputation for select to authenticated using(exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=(select auth.uid())));
drop policy if exists "Read city scene rivalries" on public.city_scene_rivalries;
create policy "Read city scene rivalries" on public.city_scene_rivalries for select to authenticated using(true);

revoke all on public.city_underground_scenes,public.player_city_scene_reputation,public.city_scene_rivalries from anon;
revoke insert,update,delete,truncate,references,trigger on public.city_underground_scenes,public.player_city_scene_reputation,public.city_scene_rivalries from authenticated;
grant select on public.city_underground_scenes,public.player_city_scene_reputation,public.city_scene_rivalries to authenticated;
revoke all on function public.get_current_city_scene(uuid) from public,anon;
grant execute on function public.get_current_city_scene(uuid) to authenticated;
revoke all on function public.scene_story_is_eligible(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.scene_story_set_city() from public,anon,authenticated;
revoke all on function public.scene_story_award_city_rep() from public,anon,authenticated;
