create table if not exists public.recovery_activity_effects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  context text not null,
  modifier numeric(5,4) not null default 1,
  severity integer not null default 0,
  withdrawal_active boolean not null default false,
  stress_delta integer not null default 0,
  fatigue_delta integer not null default 0,
  energy_delta integer not null default 0,
  sleep_delta integer not null default 0,
  health_delta integer not null default 0,
  created_at timestamptz not null default now(),
  unique(profile_id, source_type, source_id, context)
);

alter table public.recovery_activity_effects enable row level security;
drop policy if exists "Players can view own recovery activity effects" on public.recovery_activity_effects;
create policy "Players can view own recovery activity effects"
  on public.recovery_activity_effects for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=profile_id and p.user_id=auth.uid()));

create index if not exists idx_recovery_activity_effects_profile_created
  on public.recovery_activity_effects(profile_id, created_at desc);

create or replace function public.get_recovery_activity_modifier(p_profile_id uuid, p_context text)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_severity integer := 0;
  v_support integer := 0;
  v_withdrawal boolean := false;
  v_base_cap numeric := 0.15;
  v_withdrawal_extra numeric := 0.05;
  v_penalty numeric := 0;
  v_modifier numeric := 1;
begin
  select
    coalesce(max(case when status in ('active','recovering','relapsed') then severity else 0 end),0),
    coalesce(max(case when status='recovering' then support_score else 0 end),0),
    coalesce(bool_or(status in ('active','recovering','relapsed') and withdrawal_until is not null and withdrawal_until > now()),false)
  into v_severity, v_support, v_withdrawal
  from public.player_addictions
  where profile_id=p_profile_id;

  if v_severity <= 0 then
    return jsonb_build_object('modifier',1.0,'penalty',0.0,'severity',0,'withdrawalActive',false,'supportScore',v_support);
  end if;

  v_base_cap := case p_context
    when 'gig' then 0.25
    when 'rehearsal' then 0.20
    when 'songwriting' then 0.18
    when 'recording' then 0.20
    when 'travel' then 0.08
    else 0.15 end;
  v_withdrawal_extra := case p_context
    when 'gig' then 0.10
    when 'rehearsal' then 0.08
    when 'songwriting' then 0.07
    when 'recording' then 0.08
    when 'travel' then 0.05
    else 0.05 end;

  v_penalty := (least(100,greatest(0,v_severity)) / 100.0) * v_base_cap;
  if v_withdrawal then v_penalty := v_penalty + v_withdrawal_extra; end if;
  v_penalty := greatest(0, v_penalty - least(0.05, greatest(0,v_support) * 0.0005));
  v_penalty := least(case when p_context='gig' then 0.35 else 0.30 end, v_penalty);
  v_modifier := greatest(0.65, 1.0-v_penalty);

  return jsonb_build_object('modifier',round(v_modifier,4),'penalty',round(v_penalty,4),'severity',v_severity,'withdrawalActive',v_withdrawal,'supportScore',v_support);
end;
$$;

create or replace function public.get_gig_recovery_modifier(p_gig_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  r record;
  v_count integer := 0;
  v_sum numeric := 0;
  v_worst numeric := 1;
  v_withdrawal_count integer := 0;
  v_mod jsonb;
begin
  for r in select distinct profile_id from public.gig_performers where gig_id=p_gig_id and lineup_status in ('selected','performed')
  loop
    v_mod := public.get_recovery_activity_modifier(r.profile_id,'gig');
    v_count := v_count+1;
    v_sum := v_sum + coalesce((v_mod->>'modifier')::numeric,1);
    v_worst := least(v_worst,coalesce((v_mod->>'modifier')::numeric,1));
    if coalesce((v_mod->>'withdrawalActive')::boolean,false) then v_withdrawal_count:=v_withdrawal_count+1; end if;
  end loop;
  if v_count=0 then return jsonb_build_object('modifier',1.0,'performerCount',0,'withdrawalCount',0,'worstModifier',1.0); end if;
  return jsonb_build_object('modifier',round(v_sum/v_count,4),'performerCount',v_count,'withdrawalCount',v_withdrawal_count,'worstModifier',round(v_worst,4));
end;
$$;

create or replace function public.apply_recovery_activity_strain(p_profile_id uuid,p_source_type text,p_source_id uuid,p_context text)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_mod jsonb; v_modifier numeric; v_severity integer; v_withdrawal boolean;
  v_stress integer:=0; v_fatigue integer:=0; v_energy integer:=0; v_sleep integer:=0; v_health integer:=0; v_id uuid;
begin
  v_mod:=public.get_recovery_activity_modifier(p_profile_id,p_context);
  v_modifier:=coalesce((v_mod->>'modifier')::numeric,1);
  v_severity:=coalesce((v_mod->>'severity')::integer,0);
  v_withdrawal:=coalesce((v_mod->>'withdrawalActive')::boolean,false);
  if v_severity<=0 then return v_mod || jsonb_build_object('applied',false); end if;

  v_stress := round((v_severity/100.0) * case p_context when 'gig' then 7 when 'travel' then 6 when 'songwriting' then 5 else 4 end)::integer + case when v_withdrawal then 3 else 0 end;
  v_fatigue := round((v_severity/100.0) * case p_context when 'gig' then 10 when 'travel' then 9 when 'rehearsal' then 6 else 4 end)::integer + case when v_withdrawal then 3 else 0 end;
  v_energy := -1 * (round((v_severity/100.0) * case p_context when 'gig' then 8 when 'travel' then 5 else 4 end)::integer + case when v_withdrawal then 2 else 0 end);
  v_sleep := case when p_context in ('gig','travel') then -1*(round((v_severity/100.0)*6)::integer + case when v_withdrawal then 2 else 0 end) else 0 end;
  v_health := case when v_severity>=70 then -1 else 0 end + case when v_withdrawal and v_severity>=85 then -1 else 0 end;

  insert into public.recovery_activity_effects(profile_id,source_type,source_id,context,modifier,severity,withdrawal_active,stress_delta,fatigue_delta,energy_delta,sleep_delta,health_delta)
  values(p_profile_id,p_source_type,p_source_id,p_context,v_modifier,v_severity,v_withdrawal,v_stress,v_fatigue,v_energy,v_sleep,v_health)
  on conflict(profile_id,source_type,source_id,context) do nothing returning id into v_id;
  if v_id is null then return v_mod || jsonb_build_object('applied',false,'duplicate',true); end if;

  update public.profiles set
    stress=least(100,greatest(0,coalesce(stress,0)+v_stress)),
    fatigue=least(100,greatest(0,coalesce(fatigue,0)+v_fatigue)),
    energy=least(100,greatest(0,coalesce(energy,100)+v_energy)),
    sleep_quality=least(100,greatest(0,coalesce(sleep_quality,100)+v_sleep)),
    physical_health=least(100,greatest(0,coalesce(physical_health,100)+v_health)),
    motivation=least(100,greatest(0,coalesce(motivation,50)+case when p_context='songwriting' then -round((v_severity/100.0)*4)::integer else 0 end)),
    updated_at=now()
  where id=p_profile_id;
  return v_mod || jsonb_build_object('applied',true,'stressDelta',v_stress,'fatigueDelta',v_fatigue,'energyDelta',v_energy,'sleepDelta',v_sleep,'healthDelta',v_health);
end;
$$;

create or replace function public.apply_recovery_rehearsal_effects()
returns trigger language plpgsql security definer set search_path='public' as $$
declare r record; v_mod numeric; v_avg numeric:=1; v_count integer:=0; v_penalty_minutes integer:=0; v_song_count integer:=0; s record;
begin
  if new.status<>'completed' or (tg_op='UPDATE' and old.status='completed') then return new; end if;
  v_avg:=0;
  for r in select profile_id from public.band_rehearsal_participants where rehearsal_id=new.id and (participation_status='confirmed' or attended_at is not null) loop
    v_mod:=coalesce((public.get_recovery_activity_modifier(r.profile_id,'rehearsal')->>'modifier')::numeric,1);
    v_avg:=v_avg+v_mod; v_count:=v_count+1;
    perform public.apply_recovery_activity_strain(r.profile_id,'rehearsal',new.id,'rehearsal');
  end loop;
  if v_count=0 then return new; end if;
  v_avg:=v_avg/v_count;
  if v_avg>=0.999 then return new; end if;
  if new.selected_song_id is not null then
    v_penalty_minutes:=round(greatest(coalesce(new.familiarity_gained,0), extract(epoch from (new.scheduled_end-new.scheduled_start))/60) * (1-v_avg))::integer;
    update public.band_song_familiarity set familiarity_minutes=greatest(0,familiarity_minutes-v_penalty_minutes),
      rehearsal_stage=case when greatest(0,familiarity_minutes-v_penalty_minutes)>=360 then 'perfected' when greatest(0,familiarity_minutes-v_penalty_minutes)>=300 then 'well_rehearsed' when greatest(0,familiarity_minutes-v_penalty_minutes)>=180 then 'familiar' when greatest(0,familiarity_minutes-v_penalty_minutes)>=60 then 'learning' else 'unlearned' end, updated_at=now()
    where band_id=new.band_id and song_id=new.selected_song_id;
  elsif new.setlist_id is not null then
    select count(*) into v_song_count from public.setlist_songs where setlist_id=new.setlist_id and song_id is not null;
    if v_song_count>0 then
      v_penalty_minutes:=round((greatest(coalesce(new.familiarity_gained,0), extract(epoch from (new.scheduled_end-new.scheduled_start))/60)/v_song_count) * (1-v_avg))::integer;
      for s in select song_id from public.setlist_songs where setlist_id=new.setlist_id and song_id is not null loop
        update public.band_song_familiarity set familiarity_minutes=greatest(0,familiarity_minutes-v_penalty_minutes),
          rehearsal_stage=case when greatest(0,familiarity_minutes-v_penalty_minutes)>=360 then 'perfected' when greatest(0,familiarity_minutes-v_penalty_minutes)>=300 then 'well_rehearsed' when greatest(0,familiarity_minutes-v_penalty_minutes)>=180 then 'familiar' when greatest(0,familiarity_minutes-v_penalty_minutes)>=60 then 'learning' else 'unlearned' end, updated_at=now()
        where band_id=new.band_id and song_id=s.song_id;
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_recovery_rehearsal_penalty on public.band_rehearsals;
create trigger zz_recovery_rehearsal_penalty after update of status on public.band_rehearsals for each row when (new.status='completed') execute function public.apply_recovery_rehearsal_effects();
drop trigger if exists zz_recovery_rehearsal_penalty_insert on public.band_rehearsals;
create trigger zz_recovery_rehearsal_penalty_insert after insert on public.band_rehearsals for each row when (new.status='completed') execute function public.apply_recovery_rehearsal_effects();

create or replace function public.apply_recovery_songwriting_progress()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_session public.songwriting_sessions%rowtype; v_mod numeric:=1; v_music_delta integer; v_lyrics_delta integer; v_quality_delta integer;
begin
  if coalesce(new.sessions_completed,0)<=coalesce(old.sessions_completed,0) then return new; end if;
  select * into v_session from public.songwriting_sessions where project_id=new.id and completed_at is not null order by completed_at desc limit 1;
  if not found or v_session.profile_id is null then return new; end if;
  v_mod:=coalesce((public.get_recovery_activity_modifier(v_session.profile_id,'songwriting')->>'modifier')::numeric,1);
  perform public.apply_recovery_activity_strain(v_session.profile_id,'songwriting',v_session.id,'songwriting');
  if v_mod>=0.999 then return new; end if;
  v_music_delta:=greatest(0,coalesce(new.music_progress,0)-coalesce(old.music_progress,0));
  v_lyrics_delta:=greatest(0,coalesce(new.lyrics_progress,0)-coalesce(old.lyrics_progress,0));
  v_quality_delta:=greatest(0,coalesce(new.quality_score,0)-coalesce(old.quality_score,0));
  new.music_progress:=coalesce(old.music_progress,0)+floor(v_music_delta*v_mod)::integer;
  new.lyrics_progress:=coalesce(old.lyrics_progress,0)+floor(v_lyrics_delta*v_mod)::integer;
  new.quality_score:=coalesce(old.quality_score,0)+floor(v_quality_delta*v_mod)::integer;
  update public.songwriting_sessions set music_progress_gained=floor(coalesce(music_progress_gained,0)*v_mod)::integer, lyrics_progress_gained=floor(coalesce(lyrics_progress_gained,0)*v_mod)::integer, xp_earned=floor(coalesce(xp_earned,0)*v_mod)::integer,
    notes=coalesce(notes,'') || case when coalesce((public.get_recovery_activity_modifier(v_session.profile_id,'songwriting')->>'withdrawalActive')::boolean,false) then ' Recovery symptoms disrupted focus.' else ' Recovery strain reduced creative output.' end
  where id=v_session.id;
  return new;
end;
$$;

drop trigger if exists aa_recovery_songwriting_progress on public.songwriting_projects;
create trigger aa_recovery_songwriting_progress before update on public.songwriting_projects for each row execute function public.apply_recovery_songwriting_progress();

create or replace function public.apply_recovery_travel_strain()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' and new.profile_id is not null then perform public.apply_recovery_activity_strain(new.profile_id,'travel',new.id,'travel'); end if;
  return new;
end;
$$;
drop trigger if exists trg_recovery_travel_strain on public.player_travel_history;
create trigger trg_recovery_travel_strain after update of status on public.player_travel_history for each row execute function public.apply_recovery_travel_strain();

create or replace function public.apply_recovery_gig_strain()
returns trigger language plpgsql security definer set search_path='public' as $$
declare r record;
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    for r in select distinct profile_id from public.gig_performers where gig_id=new.id and lineup_status in ('selected','performed') loop perform public.apply_recovery_activity_strain(r.profile_id,'gig',new.id,'gig'); end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_recovery_gig_strain on public.gigs;
create trigger trg_recovery_gig_strain after update of status on public.gigs for each row execute function public.apply_recovery_gig_strain();

revoke all on function public.get_recovery_activity_modifier(uuid,text) from public, anon, authenticated;
revoke all on function public.get_gig_recovery_modifier(uuid) from public, anon, authenticated;
revoke all on function public.apply_recovery_activity_strain(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.get_gig_recovery_modifier(uuid) to service_role;
grant select on public.recovery_activity_effects to authenticated;
