-- Shared multi-step scene stories for Nightclubs and the Underworld.
-- Live DB was applied directly before this migration was committed.

create table if not exists public.scene_story_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  source_surface text not null check (source_surface in ('nightclub','underworld','both')),
  minimum_age integer not null default 18 check (minimum_age between 16 and 100),
  risk_tier integer not null default 1 check (risk_tier between 1 and 5),
  min_cred integer not null default 0 check (min_cred between 0 and 100),
  min_heat integer not null default 0 check (min_heat between 0 and 100),
  max_heat integer not null default 100 check (max_heat between 0 and 100),
  requires_scandal boolean not null default false,
  requires_contact boolean not null default false,
  requires_recovery boolean not null default false,
  cooldown_hours integer not null default 24 check (cooldown_hours between 1 and 720),
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_scene_story_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.scene_story_catalog(id) on delete cascade,
  surface text not null check (surface in ('nightclub','underworld')),
  current_step_key text not null,
  status text not null default 'active' check (status in ('active','completed','failed','expired','abandoned')),
  context jsonb not null default '{}'::jsonb,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  last_resolved_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_scene_story_history (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.player_scene_story_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  step_key text not null,
  choice_key text not null,
  outcome text not null check (outcome in ('success','failure','completed','abandoned')),
  chance numeric,
  roll numeric,
  effects_applied jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scene_story_runs_profile_status on public.player_scene_story_runs(profile_id,status,updated_at desc);
create index if not exists idx_scene_story_history_profile_created on public.player_scene_story_history(profile_id,created_at desc);

alter table public.scene_story_catalog enable row level security;
alter table public.player_scene_story_runs enable row level security;
alter table public.player_scene_story_history enable row level security;

drop policy if exists "Authenticated can read active scene stories" on public.scene_story_catalog;
create policy "Authenticated can read active scene stories" on public.scene_story_catalog for select to authenticated using (is_active=true);
drop policy if exists "Players can view own scene story runs" on public.player_scene_story_runs;
create policy "Players can view own scene story runs" on public.player_scene_story_runs for select to authenticated using (exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=auth.uid()));
drop policy if exists "Players can view own scene story history" on public.player_scene_story_history;
create policy "Players can view own scene story history" on public.player_scene_story_history for select to authenticated using (exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=auth.uid()));

revoke all on public.scene_story_catalog from anon;
revoke all on public.player_scene_story_runs from anon;
revoke all on public.player_scene_story_history from anon;
revoke insert,update,delete on public.scene_story_catalog from authenticated;
revoke insert,update,delete on public.player_scene_story_runs from authenticated;
revoke insert,update,delete on public.player_scene_story_history from authenticated;
grant select on public.scene_story_catalog, public.player_scene_story_runs, public.player_scene_story_history to authenticated;

insert into public.scene_story_catalog(slug,name,description,source_surface,minimum_age,risk_tier,min_cred,min_heat,max_heat,requires_scandal,requires_contact,requires_recovery,cooldown_hours,steps)
values
('velvet_rope_afterparty','The Velvet Rope','A familiar face waves you past the queue into an invitation-only afterparty.','nightclub',18,2,0,0,80,false,true,false,18,
'[ {"key":"invitation","title":"A Quiet Invitation","body":"A scene contact has access to a private afterparty upstairs. The room is full of musicians, promoters and familiar faces.","choices":[{"key":"work_the_room","label":"Work the room","description":"Stay social and make useful connections.","successChance":0.80,"successEffects":{"underground_cred":3,"scene_connections":5,"fame":1,"happiness":3,"fatigue":4},"failureEffects":{"heat":2,"stress":3,"fatigue":5},"nextSuccess":"late_room","nextFailure":"late_room"},{"key":"keep_it_light","label":"Keep it light","description":"Enjoy the invite without chasing every opportunity.","successChance":0.95,"successEffects":{"happiness":4,"stress":-2,"recovery_support":3},"failureEffects":{"fatigue":2},"terminal":true}]},{"key":"late_room","title":"The Room Gets Smaller","body":"As the night thins out, the remaining guests are the people who actually shape the local scene.","choices":[{"key":"stay_for_introductions","label":"Stay for introductions","description":"Push your luck for a stronger scene connection.","successChance":0.70,"successEffects":{"underground_cred":4,"scene_connections":7,"notoriety":2,"heat":2},"failureEffects":{"heat":5,"stress":4,"gossip_exposure":6},"terminal":true},{"key":"leave_on_a_high","label":"Leave on a high","description":"Head home before the night gets complicated.","successChance":1.0,"successEffects":{"stress":-2,"sleep_quality":3},"failureEffects":{},"terminal":true}]} ]'::jsonb),
('paparazzi_side_exit','Flashbulbs at the Exit','A current story has drawn photographers to the club entrance. Staff offer two ways out.','nightclub',18,3,0,10,100,true,false,false,12,
'[ {"key":"exit_choice","title":"Cameras Outside","body":"Your name is already circulating. How you leave could calm the story or turn tonight into tomorrow''s headline.","choices":[{"key":"front_door","label":"Take the front door","description":"Face the attention and own the moment.","successChance":0.62,"successEffects":{"fame":3,"notoriety":4,"heat":4,"scandal_exposure":5},"failureEffects":{"heat":8,"stress":5,"scandal_exposure":14},"terminal":true},{"key":"side_exit","label":"Use the side exit","description":"Try to leave without feeding the story.","successChance":0.78,"successEffects":{"heat":-5,"scandal_exposure":-8,"stress":2},"failureEffects":{"heat":5,"scandal_exposure":8,"stress":4},"terminal":true}]} ]'::jsonb),
('shadow_promoter_offer','The Backroom Promoter','A promoter operating on reputation rather than paperwork offers a lucrative underground slot.','underworld',18,4,20,0,85,false,false,false,36,
'[ {"key":"offer","title":"An Off-Grid Offer","body":"A promoter offers quick money and underground visibility for a low-profile event. The details are intentionally vague.","choices":[{"key":"take_offer","label":"Take the offer","description":"Accept the risk for cash and underground standing.","successChance":0.62,"successEffects":{"cash":2500,"underground_cred":6,"notoriety":5,"heat":7,"fame":2},"failureEffects":{"cash":-500,"heat":12,"stress":7,"scandal_exposure":10},"nextSuccess":"settlement","nextFailure":"fallout"},{"key":"decline","label":"Decline politely","description":"Keep the connection without taking the risk.","successChance":1.0,"successEffects":{"scene_connections":2,"heat":-1},"failureEffects":{},"terminal":true}]},{"key":"settlement","title":"After the Show","body":"The promoter is impressed and asks how visible you want the success to become.","choices":[{"key":"stay_underground","label":"Keep it underground","description":"Take the cred and avoid extra attention.","successChance":0.90,"successEffects":{"underground_cred":5,"heat":-2,"scene_connections":3},"failureEffects":{"heat":2},"terminal":true},{"key":"make_noise","label":"Make some noise","description":"Turn the story into notoriety and fame.","successChance":0.70,"successEffects":{"fame":4,"notoriety":6,"heat":6},"failureEffects":{"heat":9,"scandal_exposure":12},"terminal":true}]},{"key":"fallout","title":"The Deal Unravels","body":"The arrangement has become messy. You can cut your losses or try to salvage the relationship.","choices":[{"key":"cut_losses","label":"Cut your losses","description":"Walk away before the situation grows.","successChance":0.90,"successEffects":{"heat":-3,"stress":2},"failureEffects":{"heat":3},"terminal":true},{"key":"repair_connection","label":"Repair the connection","description":"Try to preserve your standing with the promoter.","successChance":0.55,"successEffects":{"scene_connections":4,"underground_cred":2},"failureEffects":{"heat":5,"stress":4},"terminal":true}]} ]'::jsonb),
('recovery_safehouse','The Quiet Room','Someone in the scene knows a quiet place where people step away from the noise and regroup.','both',18,1,0,0,100,false,false,true,24,
'[ {"key":"check_in","title":"A Different Kind of Night","body":"The room is low-key: food, conversation and people who understand why you are trying to change pace.","choices":[{"key":"accept_support","label":"Accept the support","description":"Stay, talk and strengthen your recovery network.","successChance":1.0,"successEffects":{"recovery_support":10,"recovery_severity":-3,"stress":-5,"happiness":3,"sleep_quality":4},"failureEffects":{},"terminal":true},{"key":"just_rest","label":"Just rest","description":"Keep to yourself and use the space to recover.","successChance":1.0,"successEffects":{"stress":-3,"fatigue":-5,"energy":4,"sleep_quality":5},"failureEffects":{},"terminal":true}]} ]'::jsonb),
('scene_connector_intro','A Name Worth Knowing','One of your contacts offers an introduction that could change how the local scene sees you.','both',18,2,5,0,90,false,true,false,24,
'[ {"key":"introduction","title":"Make the Introduction Count","body":"You get a few minutes with someone well-connected. The impression you make will travel.","choices":[{"key":"be_genuine","label":"Be genuine","description":"Build trust rather than chase status.","successChance":0.82,"successEffects":{"contact_trust":6,"contact_chemistry":3,"scene_connections":4,"underground_cred":2},"failureEffects":{"stress":2},"terminal":true},{"key":"sell_yourself","label":"Sell yourself","description":"Push for visibility and momentum.","successChance":0.68,"successEffects":{"fame":2,"scene_connections":6,"notoriety":2},"failureEffects":{"contact_trust":-3,"gossip_exposure":5,"heat":2},"terminal":true}]} ]'::jsonb)
on conflict(slug) do update set name=excluded.name,description=excluded.description,source_surface=excluded.source_surface,minimum_age=excluded.minimum_age,risk_tier=excluded.risk_tier,min_cred=excluded.min_cred,min_heat=excluded.min_heat,max_heat=excluded.max_heat,requires_scandal=excluded.requires_scandal,requires_contact=excluded.requires_contact,requires_recovery=excluded.requires_recovery,cooldown_hours=excluded.cooldown_hours,steps=excluded.steps,is_active=true,updated_at=now();

-- Eligibility, snapshots and mutation RPCs are server authoritative. They intentionally
-- reuse existing Heat, scandals, contacts, addictions and wellness/profile state.
create or replace function public.scene_story_is_eligible(p_profile_id uuid,p_story_id uuid,p_surface text) returns boolean language plpgsql security definer set search_path='public' as $$
declare v_profile public.profiles%rowtype; v_story public.scene_story_catalog%rowtype; v_state public.player_underground_state%rowtype;
begin
 select * into v_profile from public.profiles where id=p_profile_id; if not found or v_profile.user_id<>auth.uid() then return false; end if;
 select * into v_story from public.scene_story_catalog where id=p_story_id and is_active=true; if not found or p_surface not in ('nightclub','underworld') or v_story.source_surface not in (p_surface,'both') then return false; end if;
 if floor(coalesce(v_profile.age,0))<v_story.minimum_age then return false; end if;
 select * into v_state from public.player_underground_state where profile_id=p_profile_id;
 if not found then v_state.underground_cred:=0; v_state.heat:=0; end if;
 if v_state.underground_cred<v_story.min_cred or v_state.heat<v_story.min_heat or v_state.heat>v_story.max_heat then return false; end if;
 if v_story.requires_scandal and not exists(select 1 from public.player_scandals where profile_id=p_profile_id and stage<>'resolved' and resolved_at is null) then return false; end if;
 if v_story.requires_contact and not exists(select 1 from public.player_scene_contacts where profile_id=p_profile_id and relationship_status<>'ended') then return false; end if;
 if v_story.requires_recovery and not exists(select 1 from public.player_addictions where profile_id=p_profile_id and status='recovering') then return false; end if;
 if exists(select 1 from public.player_scene_story_runs r where r.profile_id=p_profile_id and r.story_id=p_story_id and r.status in ('completed','failed','abandoned') and coalesce(r.completed_at,r.updated_at)>now()-make_interval(hours=>v_story.cooldown_hours)) then return false; end if;
 return true;
end; $$;

create or replace function public.scene_story_snapshot(p_run_id uuid) returns jsonb language plpgsql security definer set search_path='public' as $$
declare r public.player_scene_story_runs%rowtype; c public.scene_story_catalog%rowtype; v_step jsonb;
begin
 select * into r from public.player_scene_story_runs where id=p_run_id; if not found then return null; end if;
 select * into c from public.scene_story_catalog where id=r.story_id;
 select value into v_step from jsonb_array_elements(c.steps) where value->>'key'=r.current_step_key limit 1;
 return jsonb_build_object('id',r.id,'profileId',r.profile_id,'storyId',r.story_id,'slug',c.slug,'name',c.name,'description',c.description,'surface',r.surface,'riskTier',c.risk_tier,'status',r.status,'currentStepKey',r.current_step_key,'step',v_step,'context',r.context,'expiresAt',r.expires_at,'completedAt',r.completed_at);
end; $$;

create or replace function public.get_scene_story_opportunities(p_profile_id uuid,p_surface text) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_profile public.profiles%rowtype; v_active uuid; v_opps jsonb;
begin
 if p_surface not in ('nightclub','underworld') then return jsonb_build_object('ok',false,'reason','invalid_surface'); end if;
 select * into v_profile from public.profiles where id=p_profile_id; if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
 update public.player_scene_story_runs set status='expired',updated_at=now() where profile_id=p_profile_id and status='active' and expires_at<=now();
 select id into v_active from public.player_scene_story_runs where profile_id=p_profile_id and status='active' and surface=p_surface and expires_at>now() order by offered_at desc limit 1;
 select coalesce(jsonb_agg(x.item),'[]'::jsonb) into v_opps from (select jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name,'description',c.description,'riskTier',c.risk_tier,'minimumAge',c.minimum_age,'minCred',c.min_cred,'surface',c.source_surface) item from public.scene_story_catalog c where c.is_active=true and public.scene_story_is_eligible(p_profile_id,c.id,p_surface) and (v_active is null or c.id<>(select story_id from public.player_scene_story_runs where id=v_active)) order by random() limit 3) x;
 return jsonb_build_object('ok',true,'surface',p_surface,'activeRun',case when v_active is null then null else public.scene_story_snapshot(v_active) end,'opportunities',v_opps);
end; $$;

create or replace function public.start_scene_story(p_profile_id uuid,p_story_slug text,p_surface text) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_story public.scene_story_catalog%rowtype; v_profile public.profiles%rowtype; v_first text; v_run uuid;
begin
 select * into v_profile from public.profiles where id=p_profile_id; if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
 select * into v_story from public.scene_story_catalog where slug=p_story_slug and is_active=true; if not found then return jsonb_build_object('ok',false,'reason','story_not_found'); end if;
 if not public.scene_story_is_eligible(p_profile_id,v_story.id,p_surface) then return jsonb_build_object('ok',false,'reason','not_eligible'); end if;
 if exists(select 1 from public.player_scene_story_runs where profile_id=p_profile_id and surface=p_surface and status='active' and expires_at>now()) then return jsonb_build_object('ok',false,'reason','active_story_exists'); end if;
 v_first:=v_story.steps->0->>'key'; if v_first is null then return jsonb_build_object('ok',false,'reason','invalid_story'); end if;
 insert into public.player_scene_story_runs(profile_id,story_id,surface,current_step_key,status,expires_at) values(p_profile_id,v_story.id,p_surface,v_first,'active',now()+interval '12 hours') returning id into v_run;
 return jsonb_build_object('ok',true,'run',public.scene_story_snapshot(v_run));
end; $$;

-- This resolver applies effects to existing systems and records every step.
create or replace function public.resolve_scene_story_choice(p_profile_id uuid,p_run_id uuid,p_choice_key text) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
 v_profile public.profiles%rowtype; v_run public.player_scene_story_runs%rowtype; v_story public.scene_story_catalog%rowtype; v_state public.player_underground_state%rowtype; v_step jsonb; v_choice jsonb; v_base numeric; v_chance numeric; v_roll numeric; v_success boolean; v_effects jsonb; v_next text; v_terminal boolean; v_status text; v_latest_scandal uuid; v_contact uuid; v_max_severity integer:=0; v_withdrawal boolean:=false;
begin
 select * into v_profile from public.profiles where id=p_profile_id for update; if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
 select * into v_run from public.player_scene_story_runs where id=p_run_id and profile_id=p_profile_id for update; if not found or v_run.status<>'active' then return jsonb_build_object('ok',false,'reason','run_not_active'); end if;
 if v_run.expires_at<=now() then update public.player_scene_story_runs set status='expired',updated_at=now() where id=p_run_id; return jsonb_build_object('ok',false,'reason','expired'); end if;
 select * into v_story from public.scene_story_catalog where id=v_run.story_id;
 select value into v_step from jsonb_array_elements(v_story.steps) where value->>'key'=v_run.current_step_key limit 1;
 select value into v_choice from jsonb_array_elements(coalesce(v_step->'choices','[]'::jsonb)) where value->>'key'=p_choice_key limit 1; if v_choice is null then return jsonb_build_object('ok',false,'reason','choice_not_found'); end if;
 insert into public.player_underground_state(profile_id) values(p_profile_id) on conflict(profile_id) do nothing; select * into v_state from public.player_underground_state where profile_id=p_profile_id for update;
 select coalesce(max(severity),0),coalesce(bool_or(withdrawal_until>now()),false) into v_max_severity,v_withdrawal from public.player_addictions where profile_id=p_profile_id and status in ('active','recovering','relapsed');
 v_base:=coalesce((v_choice->>'successChance')::numeric,1); v_chance:=greatest(0.25,least(0.98,v_base+v_state.underground_cred*0.0015+v_state.scene_connections*0.001-v_state.heat*0.001-v_max_severity*0.001-case when v_withdrawal then 0.05 else 0 end)); if v_story.slug='recovery_safehouse' then v_chance:=1; end if;
 v_roll:=random(); v_success:=v_roll<=v_chance; v_effects:=case when v_success then coalesce(v_choice->'successEffects','{}'::jsonb) else coalesce(v_choice->'failureEffects','{}'::jsonb) end; v_next:=case when v_success then v_choice->>'nextSuccess' else v_choice->>'nextFailure' end; v_terminal:=coalesce((v_choice->>'terminal')::boolean,false) or v_next is null;
 update public.player_underground_state set underground_cred=greatest(0,least(100,underground_cred+coalesce((v_effects->>'underground_cred')::integer,0))),heat=greatest(0,least(100,heat+coalesce((v_effects->>'heat')::integer,0))),notoriety=greatest(0,least(100,notoriety+coalesce((v_effects->>'notoriety')::integer,0))),scene_connections=greatest(0,least(100,scene_connections+coalesce((v_effects->>'scene_connections')::integer,0))),last_event_at=now(),updated_at=now() where profile_id=p_profile_id;
 update public.profiles set cash=greatest(0,cash+coalesce((v_effects->>'cash')::bigint,0)),fame=greatest(0,fame+coalesce((v_effects->>'fame')::integer,0)),fans=greatest(0,fans+coalesce((v_effects->>'fans')::integer,0)),energy=greatest(0,least(100,energy+coalesce((v_effects->>'energy')::integer,0))),fatigue=greatest(0,least(100,fatigue+coalesce((v_effects->>'fatigue')::integer,0))),stress=greatest(0,least(100,stress+coalesce((v_effects->>'stress')::integer,0))),happiness=greatest(0,least(100,happiness+coalesce((v_effects->>'happiness')::integer,0))),sleep_quality=greatest(0,least(100,sleep_quality+coalesce((v_effects->>'sleep_quality')::integer,0))),physical_health=greatest(0,least(100,physical_health+coalesce((v_effects->>'physical_health')::integer,0))),motivation=greatest(0,least(100,motivation+coalesce((v_effects->>'motivation')::integer,0))),updated_at=now() where id=p_profile_id;
 if coalesce((v_effects->>'recovery_support')::integer,0)<>0 or coalesce((v_effects->>'recovery_severity')::integer,0)<>0 then update public.player_addictions set support_score=greatest(0,least(100,support_score+coalesce((v_effects->>'recovery_support')::integer,0))),severity=greatest(0,least(100,severity+coalesce((v_effects->>'recovery_severity')::integer,0))),status=case when greatest(0,severity+coalesce((v_effects->>'recovery_severity')::integer,0))=0 then 'recovered' else status end,recovered_at=case when greatest(0,severity+coalesce((v_effects->>'recovery_severity')::integer,0))=0 then now() else recovered_at end,updated_at=now() where profile_id=p_profile_id and status in ('active','recovering','relapsed'); end if;
 if coalesce((v_effects->>'scandal_exposure')::integer,0)<>0 then select id into v_latest_scandal from public.player_scandals where profile_id=p_profile_id and resolved_at is null and stage<>'resolved' order by created_at desc limit 1; if v_latest_scandal is not null then update public.player_scandals set exposure=greatest(0,least(100,exposure+coalesce((v_effects->>'scandal_exposure')::integer,0))),updated_at=now() where id=v_latest_scandal; elsif coalesce((v_effects->>'scandal_exposure')::integer,0)>=10 then insert into public.player_scandals(profile_id,source_type,source_id,category,headline,summary,severity,credibility,exposure,metadata) values(p_profile_id,'scene_story',p_run_id,'nightlife','A night out starts attracting attention','Loose talk around the scene has begun circulating beyond the room.',2,35,least(100,coalesce((v_effects->>'scandal_exposure')::integer,10)),jsonb_build_object('story',v_story.slug)); end if; end if;
 if coalesce((v_effects->>'contact_trust')::integer,0)<>0 or coalesce((v_effects->>'contact_chemistry')::integer,0)<>0 or coalesce((v_effects->>'gossip_exposure')::integer,0)<>0 then select id into v_contact from public.player_scene_contacts where profile_id=p_profile_id and relationship_status<>'ended' order by updated_at desc limit 1; if v_contact is not null then update public.player_scene_contacts set trust=greatest(0,least(100,trust+coalesce((v_effects->>'contact_trust')::integer,0))),chemistry=greatest(0,least(100,chemistry+coalesce((v_effects->>'contact_chemistry')::integer,0))),gossip_exposure=greatest(0,least(100,gossip_exposure+coalesce((v_effects->>'gossip_exposure')::integer,0))),updated_at=now() where id=v_contact; end if; end if;
 v_status:=case when v_terminal then 'completed' else 'active' end; update public.player_scene_story_runs set current_step_key=coalesce(v_next,current_step_key),status=v_status,last_resolved_at=now(),completed_at=case when v_terminal then now() else completed_at end,context=context||jsonb_build_object('lastChoice',p_choice_key,'lastOutcome',case when v_success then 'success' else 'failure' end),updated_at=now() where id=p_run_id;
 insert into public.player_scene_story_history(run_id,profile_id,step_key,choice_key,outcome,chance,roll,effects_applied) values(p_run_id,p_profile_id,v_run.current_step_key,p_choice_key,case when v_terminal then 'completed' when v_success then 'success' else 'failure' end,v_chance,v_roll,v_effects);
 return jsonb_build_object('ok',true,'outcome',case when v_success then 'success' else 'failure' end,'chance',v_chance,'effects',v_effects,'completed',v_terminal,'run',public.scene_story_snapshot(p_run_id));
end; $$;

revoke all on function public.scene_story_is_eligible(uuid,uuid,text) from public,anon;
revoke all on function public.scene_story_snapshot(uuid) from public,anon;
revoke all on function public.get_scene_story_opportunities(uuid,text) from public,anon;
revoke all on function public.start_scene_story(uuid,text,text) from public,anon;
revoke all on function public.resolve_scene_story_choice(uuid,uuid,text) from public,anon;
grant execute on function public.get_scene_story_opportunities(uuid,text) to authenticated;
grant execute on function public.start_scene_story(uuid,text,text) to authenticated;
grant execute on function public.resolve_scene_story_choice(uuid,uuid,text) to authenticated;
