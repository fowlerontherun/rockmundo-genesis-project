-- Cooking rehearsal benefits use server-owned active food windows and the
-- existing authoritative session/day-cap ledger. The existing minigame
-- validates 12 hits before any familiarity is granted.
create table if not exists public.cooking_rehearsal_minute_carry (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  minute_hundredths integer not null default 0
    check (minute_hundredths between 0 and 99),
  updated_at timestamptz not null default now()
);
alter table public.cooking_rehearsal_minute_carry enable row level security;
do $$
begin
 if not exists (
  select 1 from pg_policies where schemaname='public'
   and tablename='cooking_rehearsal_minute_carry'
   and policyname='View own rehearsal food carry'
 ) then
  create policy "View own rehearsal food carry"
   on public.cooking_rehearsal_minute_carry for select to authenticated
   using (exists (select 1 from public.profiles p
    where p.id=profile_id and p.user_id=(select auth.uid())));
 end if;
end $$;
revoke all on public.cooking_rehearsal_minute_carry from public,anon,authenticated;
grant select on public.cooking_rehearsal_minute_carry to authenticated;

alter table public.active_rehearsal_sessions
 add column if not exists food_bonus_percent integer not null default 0
   check (food_bonus_percent between 0 and 5),
 add column if not exists food_bonus_minutes integer not null default 0
   check (food_bonus_minutes between 0 and 5);

-- Preserve the prior authenticated caller contract and use the validated
-- source of familiarity, not browser-supplied bonus data.
CREATE OR REPLACE FUNCTION public.submit_active_rehearsal_session(p_profile_id uuid, p_band_id uuid, p_song_id uuid, p_score integer, p_perfect_hits integer, p_tight_hits integer, p_recovery_hits integer, p_lost_hits integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid:=auth.uid(); v_sessions_today integer:=0; v_factor numeric:=1; v_minutes integer:=0; v_cohesion integer:=0;
  v_current_minutes integer:=0; v_new_minutes integer:=0; v_percentage integer:=0; v_total_hits integer; v_score integer;
  v_food_percent integer:=0; v_food_bonus integer:=0; v_carry_before integer:=0; v_carry_after integer:=0;
  v_base_gain integer:=0; v_available integer:=0; v_total_gain integer:=0;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  v_total_hits:=coalesce(p_perfect_hits,0)+coalesce(p_tight_hits,0)+coalesce(p_recovery_hits,0)+coalesce(p_lost_hits,0);
  if v_total_hits<>12 or least(p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits)<0 then raise exception 'A rehearsal session must contain exactly 12 scored beats.' using errcode='P0001'; end if;
  v_score:=round((p_perfect_hits*100+p_tight_hits*80+p_recovery_hits*55+p_lost_hits*20)/12.0);
  perform 1 from public.profiles where id=p_profile_id and user_id=v_user for update;
  if not found then raise exception 'This character is not available.' using errcode='P0001'; end if;
  if not public._band_active_member(p_band_id,p_profile_id) then raise exception 'You must be an active member of this band.' using errcode='P0001'; end if;
  if not exists(select 1 from public.songs s where s.id=p_song_id and (s.band_id=p_band_id or s.profile_id=p_profile_id) and coalesce(s.archived,false)=false) then raise exception 'This song is not available to rehearse.' using errcode='P0001'; end if;
  select count(*) into v_sessions_today from public.active_rehearsal_sessions where profile_id=p_profile_id and played_at>=date_trunc('day',now());
  if v_sessions_today>=10 then return jsonb_build_object('awarded',false,'reason','daily_cap','sessions_today',v_sessions_today,'familiarity_minutes_gained',0,'cohesion_gained',0,'score',v_score); end if;
  if v_sessions_today>=7 then v_factor:=0.25; elsif v_sessions_today>=4 then v_factor:=0.5; end if;
  v_minutes:=greatest(1,round((2+v_score*0.08)*v_factor)); if v_score>=85 and v_sessions_today<2 then v_cohesion:=1; end if;
  select familiarity_minutes into v_current_minutes from public.band_song_familiarity
    where band_id=p_band_id and song_id=p_song_id for update;
  v_current_minutes:=coalesce(v_current_minutes,0);
  v_available:=greatest(0,360-v_current_minutes);
  v_base_gain:=least(v_minutes,v_available);
  v_total_gain:=v_base_gain;

  -- Same-type food effects never stack. This is a point-in-time mini-game
  -- submission; never trust the browser to supply effect level or expiry.
  -- A score of 0 familiarity at cap cannot accumulate phantom food credit.
  if v_base_gain>0 then
    select coalesce(max(e.effect_percent),0) into v_food_percent
    from public.cooking_active_food_effects e
    where e.profile_id=p_profile_id and e.effect_slug='rehearsal'
      and e.started_at<=clock_timestamp()
      and e.expires_at>clock_timestamp();
    v_food_percent:=least(5,greatest(0,v_food_percent));

    insert into public.cooking_rehearsal_minute_carry(profile_id, minute_hundredths)
      values (p_profile_id,0) on conflict(profile_id) do nothing;
    select minute_hundredths into v_carry_before
      from public.cooking_rehearsal_minute_carry
      where profile_id=p_profile_id for update;

    -- A 5% buff on 8 earned minutes is 0.4 minutes. Four/three sessions
    -- eventually yield an extra full minute; credit cannot exceed 360 cap.
    v_food_bonus:=(v_carry_before+v_base_gain*v_food_percent)/100;
    v_carry_after:=mod(v_carry_before+v_base_gain*v_food_percent,100);
    v_total_gain:=least(v_available,v_base_gain+v_food_bonus);
    v_food_bonus:=v_total_gain-v_base_gain;
    update public.cooking_rehearsal_minute_carry
       set minute_hundredths=v_carry_after,updated_at=clock_timestamp()
       where profile_id=p_profile_id;
  end if;

  v_new_minutes:=v_current_minutes+v_total_gain;
  v_minutes:=v_new_minutes-v_current_minutes;
  v_percentage:=least(100,round((v_new_minutes/360.0)*100));
  insert into public.band_song_familiarity(band_id,song_id,familiarity_minutes,familiarity_percentage,last_rehearsed_at,updated_at)
  values(p_band_id,p_song_id,v_new_minutes,v_percentage,now(),now()) on conflict(band_id,song_id) do update set familiarity_minutes=excluded.familiarity_minutes,familiarity_percentage=excluded.familiarity_percentage,last_rehearsed_at=excluded.last_rehearsed_at,updated_at=excluded.updated_at;
  if v_cohesion>0 then update public.bands set cohesion_score=least(100,coalesce(cohesion_score,0)+v_cohesion),updated_at=now() where id=p_band_id; end if;
  insert into public.active_rehearsal_sessions(profile_id,band_id,song_id,user_id,score,perfect_hits,tight_hits,recovery_hits,lost_hits,familiarity_minutes_gained,cohesion_gained,food_bonus_percent,food_bonus_minutes)
  values(p_profile_id,p_band_id,p_song_id,v_user,v_score,p_perfect_hits,p_tight_hits,p_recovery_hits,p_lost_hits,v_minutes,v_cohesion,v_food_percent,v_food_bonus);
  return jsonb_build_object('awarded',true,'sessions_today',v_sessions_today+1,'diminishing',v_factor<1,'factor',v_factor,'score',v_score,'familiarity_minutes_gained',v_minutes,'food_bonus_percent',v_food_percent,'food_bonus_minutes',v_food_bonus,'familiarity_minutes',v_new_minutes,'familiarity_percentage',v_percentage,'cohesion_gained',v_cohesion);
end;$function$
;
