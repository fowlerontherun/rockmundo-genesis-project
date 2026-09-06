-- Unify legacy player_addictions with nightclub, Underworld and substance dependency systems.
alter table public.player_addictions add column if not exists last_exposure_at timestamptz;
alter table public.player_addictions add column if not exists abstinent_since timestamptz;
alter table public.player_addictions add column if not exists withdrawal_until timestamptz;
alter table public.player_addictions add column if not exists recovery_ends_at timestamptz;
alter table public.player_addictions add column if not exists recovery_sessions integer not null default 0;
alter table public.player_addictions add column if not exists support_score integer not null default 0;
alter table public.player_addictions add column if not exists last_processed_at timestamptz;
alter table public.player_addictions add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.player_addiction_exposure (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  addiction_type text not null check (addiction_type in ('alcohol','substances','gambling','partying','shopping')),
  exposure_points integer not null default 0 check (exposure_points between 0 and 100),
  last_exposure_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(profile_id, addiction_type)
);

alter table public.player_addiction_exposure enable row level security;
drop policy if exists "Players can view own addiction exposure" on public.player_addiction_exposure;
create policy "Players can view own addiction exposure"
  on public.player_addiction_exposure for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=auth.uid()));

create or replace function public.record_addiction_exposure(
  p_profile_id uuid,
  p_addiction_type text,
  p_intensity integer default 10,
  p_source text default 'gameplay',
  p_source_id text default null
) returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_profile public.profiles%rowtype;
  v_row public.player_addictions%rowtype;
  v_intensity integer := greatest(1, least(30, coalesce(p_intensity,10)));
  v_new_severity integer := 0;
  v_triggered boolean := false;
  v_relapsed boolean := false;
  v_exposure integer := 0;
begin
  if p_addiction_type not in ('alcohol','substances','gambling','partying','shopping') then
    return jsonb_build_object('ok',false,'reason','invalid_type');
  end if;

  select * into v_profile from public.profiles where id=p_profile_id;
  if not found or v_profile.user_id <> auth.uid() then
    return jsonb_build_object('ok',false,'reason','not_allowed');
  end if;

  select * into v_row from public.player_addictions
   where profile_id=p_profile_id
     and addiction_type=p_addiction_type
     and status in ('active','recovering','relapsed')
   order by created_at desc limit 1 for update;

  if found then
    v_new_severity := least(100, greatest(v_row.severity,0) + greatest(1, round(v_intensity * 0.45)::integer));
    if v_row.status='recovering' then v_relapsed:=true; end if;

    update public.player_addictions set
      severity=v_new_severity,
      status=case when v_relapsed then 'relapsed' else 'active' end,
      relapse_count=relapse_count + case when v_relapsed then 1 else 0 end,
      days_clean=0,
      abstinent_since=null,
      recovery_ends_at=null,
      withdrawal_until=case when v_new_severity>=60 then now()+interval '36 hours' else withdrawal_until end,
      last_exposure_at=now(),
      last_processed_at=now(),
      source_metadata=coalesce(source_metadata,'{}'::jsonb) || jsonb_build_object('lastSource',p_source,'lastSourceId',p_source_id),
      updated_at=now()
    where id=v_row.id;
    v_exposure:=100;
  else
    insert into public.player_addiction_exposure(profile_id,addiction_type,exposure_points,last_exposure_at,updated_at)
    values(p_profile_id,p_addiction_type,v_intensity,now(),now())
    on conflict(profile_id,addiction_type) do update set
      exposure_points=least(100,public.player_addiction_exposure.exposure_points+v_intensity),
      last_exposure_at=now(), updated_at=now()
    returning exposure_points into v_exposure;

    if v_exposure>=100 then
      v_new_severity:=least(40,20+floor(v_intensity/2));
      insert into public.player_addictions(user_id,profile_id,addiction_type,severity,status,triggered_at,last_exposure_at,last_processed_at,source_metadata)
      values(v_profile.user_id,p_profile_id,p_addiction_type,v_new_severity,'active',now(),now(),now(),jsonb_build_object('lastSource',p_source,'lastSourceId',p_source_id));
      update public.player_addiction_exposure set exposure_points=25, updated_at=now()
       where profile_id=p_profile_id and addiction_type=p_addiction_type;
      v_triggered:=true;
    end if;
  end if;

  return jsonb_build_object('ok',true,'triggered',v_triggered,'relapsed',v_relapsed,'addictionType',p_addiction_type,'severity',v_new_severity,'exposure',v_exposure);
end;
$$;

create or replace function public.process_addiction_recovery(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_profile public.profiles%rowtype;
  r record;
  v_days integer;
  v_reduction integer;
  v_new integer;
  v_processed integer := 0;
begin
  select * into v_profile from public.profiles where id=p_profile_id;
  if not found or v_profile.user_id <> auth.uid() then
    return jsonb_build_object('ok',false,'reason','not_allowed');
  end if;

  for r in
    select * from public.player_addictions
    where profile_id=p_profile_id and status in ('active','recovering','relapsed')
    for update
  loop
    v_days := greatest(0, floor(extract(epoch from (now()-coalesce(r.last_processed_at,r.recovery_started_at,r.updated_at,r.created_at)))/86400)::integer);
    if v_days <= 0 then continue; end if;
    v_reduction := 0;

    if r.status='recovering' then
      v_reduction := case r.recovery_program
        when 'rehab' then 8*v_days
        when 'therapy' then 2*v_days
        when 'cold_turkey' then 1*v_days
        else 1*v_days end;
    elsif coalesce(r.last_exposure_at,r.triggered_at) < now()-interval '7 days' then
      v_reduction := least(v_days,3);
    end if;

    v_new := greatest(0,r.severity-v_reduction);
    update public.player_addictions set
      severity=v_new,
      days_clean=case when r.status='recovering' then r.days_clean+v_days else r.days_clean end,
      status=case when v_new=0 then 'recovered' else r.status end,
      recovered_at=case when v_new=0 then now() else r.recovered_at end,
      recovery_ends_at=case when v_new=0 then null else r.recovery_ends_at end,
      last_processed_at=now(), updated_at=now()
    where id=r.id;
    v_processed:=v_processed+1;
  end loop;

  update public.player_substance_state s
     set dependency=greatest(0,dependency-5), updated_at=now()
   where s.profile_id=p_profile_id
     and exists (
       select 1 from public.player_addictions a
       where a.profile_id=p_profile_id and a.status='recovering'
         and ((a.addiction_type='alcohol' and s.substance_slug in (select slug from public.substance_catalog where category='alcohol'))
           or (a.addiction_type='substances' and s.substance_slug in (select slug from public.substance_catalog where category<>'alcohol')))
     );

  return jsonb_build_object('ok',true,'processed',v_processed);
end;
$$;

create or replace function public.start_addiction_recovery(p_profile_id uuid,p_addiction_id uuid,p_program text)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_profile public.profiles%rowtype;
  v_addiction public.player_addictions%rowtype;
  v_cost integer := 0;
  v_days integer := 0;
  v_end timestamptz := null;
begin
  if p_program not in ('therapy','rehab','cold_turkey') then return jsonb_build_object('ok',false,'reason','invalid_program'); end if;
  select * into v_profile from public.profiles where id=p_profile_id for update;
  if not found or v_profile.user_id <> auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
  select * into v_addiction from public.player_addictions where id=p_addiction_id and profile_id=p_profile_id for update;
  if not found or v_addiction.status not in ('active','relapsed','recovering') then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  if p_program='rehab' then
    v_cost:=1200; v_days:=10; v_end:=now()+interval '10 days';
    if coalesce(v_profile.cash,0)<v_cost then return jsonb_build_object('ok',false,'reason','insufficient_cash','cost',v_cost); end if;
    if exists(select 1 from public.player_scheduled_activities where profile_id=p_profile_id and status in ('scheduled','in_progress') and scheduled_start<v_end and scheduled_end>now()) then
      return jsonb_build_object('ok',false,'reason','schedule_conflict');
    end if;
    update public.profiles set cash=cash-v_cost where id=p_profile_id;
    insert into public.player_scheduled_activities(user_id,profile_id,activity_type,scheduled_start,scheduled_end,duration_minutes,status,started_at,title,description,metadata)
    values(v_profile.user_id,p_profile_id,'rehab',now(),v_end,v_days*1440,'in_progress',now(),'Rehabilitation Program','Residential recovery programme that blocks other activities.',jsonb_build_object('addictionId',p_addiction_id));
  end if;

  update public.player_addictions set
    status='recovering', recovery_program=p_program, recovery_started_at=now(), abstinent_since=now(), days_clean=0,
    recovery_ends_at=v_end, withdrawal_until=now()+make_interval(hours=>least(72,greatest(12,v_addiction.severity))),
    last_processed_at=now(), updated_at=now()
  where id=p_addiction_id;

  return jsonb_build_object('ok',true,'program',p_program,'cost',v_cost,'recoveryEndsAt',v_end);
end;
$$;

create or replace function public.attend_addiction_therapy(p_profile_id uuid,p_addiction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_profile public.profiles%rowtype;
  v_addiction public.player_addictions%rowtype;
  v_reduction integer:=8;
  v_new integer;
begin
  select * into v_profile from public.profiles where id=p_profile_id for update;
  if not found or v_profile.user_id<>auth.uid() then return jsonb_build_object('ok',false,'reason','not_allowed'); end if;
  select * into v_addiction from public.player_addictions where id=p_addiction_id and profile_id=p_profile_id for update;
  if not found or v_addiction.status<>'recovering' or v_addiction.recovery_program<>'therapy' then return jsonb_build_object('ok',false,'reason','not_in_therapy'); end if;
  if coalesce(v_profile.cash,0)<100 then return jsonb_build_object('ok',false,'reason','insufficient_cash','cost',100); end if;
  update public.profiles set cash=cash-100 where id=p_profile_id;
  v_new:=greatest(0,v_addiction.severity-v_reduction);
  update public.player_addictions set
    severity=v_new, recovery_sessions=recovery_sessions+1, support_score=least(100,support_score+10), days_clean=days_clean+1,
    status=case when v_new=0 then 'recovered' else 'recovering' end,
    recovered_at=case when v_new=0 then now() else recovered_at end,
    updated_at=now()
  where id=p_addiction_id;
  return jsonb_build_object('ok',true,'reduction',v_reduction,'severity',v_new,'recovered',v_new=0);
end;
$$;

create or replace function public.sync_substance_dependency_to_addiction()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_category text;
  v_type text;
  v_profile public.profiles%rowtype;
  v_row public.player_addictions%rowtype;
begin
  if new.dependency<30 or new.dependency<=coalesce(old.dependency,0) then return new; end if;
  select category into v_category from public.substance_catalog where slug=new.substance_slug;
  v_type:=case when v_category='alcohol' then 'alcohol' else 'substances' end;
  select * into v_profile from public.profiles where id=new.profile_id;
  if not found then return new; end if;
  select * into v_row from public.player_addictions where profile_id=new.profile_id and addiction_type=v_type and status in ('active','recovering','relapsed') order by created_at desc limit 1;
  if found then
    update public.player_addictions set
      severity=greatest(severity,new.dependency),
      status=case when status='recovering' then 'relapsed' else 'active' end,
      relapse_count=relapse_count+case when status='recovering' then 1 else 0 end,
      days_clean=0,last_exposure_at=now(),updated_at=now()
    where id=v_row.id;
  else
    insert into public.player_addictions(user_id,profile_id,addiction_type,severity,status,triggered_at,last_exposure_at,last_processed_at,source_metadata)
    values(v_profile.user_id,new.profile_id,v_type,new.dependency,'active',now(),now(),now(),jsonb_build_object('lastSource','substance_dependency','substance',new.substance_slug));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_substance_dependency_to_addiction on public.player_substance_state;
create trigger trg_sync_substance_dependency_to_addiction
after update of dependency on public.player_substance_state
for each row execute function public.sync_substance_dependency_to_addiction();

grant execute on function public.record_addiction_exposure(uuid,text,integer,text,text) to authenticated;
grant execute on function public.process_addiction_recovery(uuid) to authenticated;
grant execute on function public.start_addiction_recovery(uuid,uuid,text) to authenticated;
grant execute on function public.attend_addiction_therapy(uuid,uuid) to authenticated;
