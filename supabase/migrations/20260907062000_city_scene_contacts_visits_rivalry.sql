-- Tighten city-scene integration: local contacts, real arrival counts and rivalry pressure.
alter table public.player_scene_contacts add column if not exists city_id uuid references public.cities(id) on delete set null;
create index if not exists idx_player_scene_contacts_city on public.player_scene_contacts(profile_id,city_id);

create or replace function public.discover_scene_contacts(p_profile_id uuid, p_limit integer default 3)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare
  v_age numeric; v_city_id uuid; v_existing integer; v_to_create integer; v_created integer:=0;
  v_arch public.scene_contact_archetypes%rowtype; v_contact_id uuid; v_name text;
  v_first_names text[]:=array['Alex','Jamie','Morgan','Riley','Casey','Jordan','Taylor','Avery','Cameron','Rowan','Harper','Quinn','Drew','Sam','Charlie','Frankie','Skyler'];
  v_last_names text[]:=array['Stone','Reed','Vale','Mercer','Hart','Rowe','Lane','Blake','Winter','Wilde','Cross','Fox','Flynn','Hayes','Monroe','Nash','Rivers'];
  v_attempts integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select age,current_city_id into v_age,v_city_id from public.profiles where id=p_profile_id and user_id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  if floor(v_age)<18 then return jsonb_build_object('ok',false,'reason','age_restricted','minimumAge',18); end if;
  select count(*) into v_existing from public.player_scene_contacts where profile_id=p_profile_id and relationship_status<>'ended';
  v_to_create:=least(greatest(coalesce(p_limit,3),1),3,greatest(8-v_existing,0));
  if v_to_create<=0 then return jsonb_build_object('ok',false,'reason','contact_limit','limit',8); end if;
  while v_created<v_to_create loop
    select * into v_arch from public.scene_contact_archetypes where is_active=true order by random() limit 1;
    v_attempts:=0;
    loop
      v_name:=v_first_names[1+floor(random()*array_length(v_first_names,1))::integer]||' '||v_last_names[1+floor(random()*array_length(v_last_names,1))::integer];
      exit when not exists(select 1 from public.player_scene_contacts where profile_id=p_profile_id and npc_name=v_name);
      v_attempts:=v_attempts+1; exit when v_attempts>=20;
    end loop;
    insert into public.player_scene_contacts(profile_id,city_id,npc_name,npc_age,archetype_slug,chemistry,trust,attachment,relationship_status)
    values(p_profile_id,v_city_id,v_name,21+floor(random()*20)::integer,v_arch.slug,
      least(100,greatest(5,15+floor(random()*21)::integer+floor(v_arch.social_energy/10.0)::integer)),8+floor(random()*13)::integer,0,'stranger')
    returning id into v_contact_id;
    insert into public.npc_relationships(profile_id,npc_type,npc_id,npc_name,affinity_score,trust_score,respect_score,interaction_count,relationship_stage,notes)
    select p_profile_id,'scene_contact',v_contact_id,v_name,chemistry-50,trust-50,0,0,'stranger',
      jsonb_build_array(jsonb_build_object('source','underground_scene','archetype',archetype_slug,'adult',true,'cityId',v_city_id))
    from public.player_scene_contacts where id=v_contact_id on conflict(profile_id,npc_type,npc_id) do nothing;
    v_created:=v_created+1;
  end loop;
  insert into public.player_underground_state(profile_id,scene_connections) values(p_profile_id,v_created)
  on conflict(profile_id) do update set scene_connections=least(100,public.player_underground_state.scene_connections+v_created),updated_at=now();
  return jsonb_build_object('ok',true,'created',v_created,'cityId',v_city_id);
end;$$;

create or replace function public.scene_story_award_city_rep() returns trigger language plpgsql security definer set search_path='public' as $$
declare
  v_city uuid; v_delta integer; v_rival_pressure integer:=0; v_rival_rep integer:=0; v_effective_penalty integer:=0;
begin
  select city_id into v_city from public.player_scene_story_runs where id=new.run_id;
  if v_city is null then return new; end if;
  v_delta:=case when new.outcome='success' then 3 when new.outcome='failure' then 1 else 1 end;
  select coalesce(max(r.intensity),0),coalesce(max(rep.reputation),0)
    into v_rival_pressure,v_rival_rep
  from public.city_scene_rivalries r
  left join public.player_city_scene_reputation rep on rep.profile_id=new.profile_id and rep.city_id=r.rival_city_id
  where r.city_id=v_city;
  if v_rival_pressure>=50 and v_rival_rep>=30 then v_effective_penalty:=1; end if;
  v_delta:=greatest(1,v_delta-v_effective_penalty);
  insert into public.player_city_scene_reputation(profile_id,city_id,reputation,successful_stories,failed_stories,last_active_at,updated_at)
  values(new.profile_id,v_city,v_delta,case when new.outcome='success' then 1 else 0 end,case when new.outcome='failure' then 1 else 0 end,now(),now())
  on conflict(profile_id,city_id) do update set
    reputation=least(100,public.player_city_scene_reputation.reputation+v_delta),
    successful_stories=public.player_city_scene_reputation.successful_stories+case when new.outcome='success' then 1 else 0 end,
    failed_stories=public.player_city_scene_reputation.failed_stories+case when new.outcome='failure' then 1 else 0 end,
    last_active_at=now(),updated_at=now();
  return new;
end;$$;

create or replace function public.track_city_scene_arrival() returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' and new.profile_id is not null and new.to_city_id is not null then
    insert into public.player_city_scene_reputation(profile_id,city_id,visits,last_active_at,updated_at)
    values(new.profile_id,new.to_city_id,1,now(),now())
    on conflict(profile_id,city_id) do update set visits=public.player_city_scene_reputation.visits+1,last_active_at=now(),updated_at=now();
  end if;
  return new;
end;$$;

drop trigger if exists trg_track_city_scene_arrival on public.player_travel_history;
create trigger trg_track_city_scene_arrival after update of status on public.player_travel_history for each row execute function public.track_city_scene_arrival();

create or replace function public.get_current_city_scene(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  v_profile public.profiles%rowtype; v_scene public.city_underground_scenes%rowtype; v_city public.cities%rowtype;
  v_rep public.player_city_scene_reputation%rowtype; v_rivals jsonb; v_rival_pressure integer:=0;
begin
  select * into v_profile from public.profiles where id=p_profile_id;
  if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
  select * into v_city from public.cities where id=v_profile.current_city_id;
  if not found then return jsonb_build_object('ok',false,'reason','no_city'); end if;
  select * into v_scene from public.city_underground_scenes where city_id=v_city.id;
  select * into v_rep from public.player_city_scene_reputation where profile_id=p_profile_id and city_id=v_city.id;
  select coalesce(jsonb_agg(jsonb_build_object('cityId',r.rival_city_id,'cityName',c.name,'name',r.rivalry_name,'intensity',r.intensity,'description',r.description,'yourReputation',coalesce(rep.reputation,0))),'[]'::jsonb),
         coalesce(max(case when coalesce(rep.reputation,0)>=30 then r.intensity else 0 end),0)
    into v_rivals,v_rival_pressure
  from public.city_scene_rivalries r join public.cities c on c.id=r.rival_city_id
  left join public.player_city_scene_reputation rep on rep.profile_id=p_profile_id and rep.city_id=r.rival_city_id
  where r.city_id=v_city.id;
  return jsonb_build_object('ok',true,'cityId',v_city.id,'cityName',v_city.name,'country',v_city.country,
    'scene',jsonb_build_object('name',v_scene.scene_name,'tagline',v_scene.tagline,'styles',v_scene.dominant_styles,'tags',v_scene.culture_tags,'riskLevel',v_scene.risk_level,'mediaAttention',v_scene.media_attention,'authorityPressure',v_scene.authority_pressure,'networkingStrength',v_scene.networking_strength,'undergroundDepth',v_scene.underground_depth,'flagship',v_scene.is_flagship),
    'reputation',coalesce(v_rep.reputation,0),'visits',coalesce(v_rep.visits,0),'successfulStories',coalesce(v_rep.successful_stories,0),'failedStories',coalesce(v_rep.failed_stories,0),
    'rivals',v_rivals,'rivalryPressure',v_rival_pressure);
end;$$;

revoke execute on function public.discover_scene_contacts(uuid,integer) from public,anon;
revoke execute on function public.scene_story_award_city_rep() from public,anon,authenticated;
revoke execute on function public.track_city_scene_arrival() from public,anon,authenticated;
revoke execute on function public.get_current_city_scene(uuid) from public,anon;
grant execute on function public.discover_scene_contacts(uuid,integer) to authenticated;
grant execute on function public.get_current_city_scene(uuid) to authenticated;
