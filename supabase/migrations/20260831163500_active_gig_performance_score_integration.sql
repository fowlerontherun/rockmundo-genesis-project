-- Apply only the band's best Active Performance result to persisted gig scores.
-- Existing rows receive only the delta when a new best result is submitted;
-- future rows receive the current best multiplier on insert.

create or replace function public.submit_active_gig_performance(
  p_profile_id uuid,
  p_gig_id uuid,
  p_cue_scores integer[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_gig public.gigs%rowtype;
  v_score integer;
  v_multiplier numeric(6,4) := 0;
  v_old_best numeric(6,4) := 0;
  v_new_best numeric(6,4) := 0;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='P0001'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user) then
    raise exception 'This character is not available.' using errcode='P0001';
  end if;
  if coalesce(array_length(p_cue_scores,1),0) <> 5 then
    raise exception 'Active Performance requires exactly five cue scores.' using errcode='P0001';
  end if;
  if exists(select 1 from unnest(p_cue_scores) v where v < 0 or v > 100) then
    raise exception 'Cue scores must be between 0 and 100.' using errcode='P0001';
  end if;

  select * into v_gig from public.gigs where id=p_gig_id for update;
  if not found then raise exception 'Gig not found.' using errcode='P0001'; end if;
  if v_gig.started_at is null or v_gig.status in ('completed','cancelled','failed') or v_gig.result_ready_at is not null then
    raise exception 'Active Performance is only available while this gig is live.' using errcode='P0001';
  end if;
  if not public._band_active_member(v_gig.band_id,p_profile_id) then
    raise exception 'You must be an active member of the performing band.' using errcode='P0001';
  end if;
  if exists(select 1 from public.active_gig_performance_sessions where gig_id=p_gig_id and profile_id=p_profile_id) then
    raise exception 'This character has already completed Active Performance for this gig.' using errcode='P0001';
  end if;

  select coalesce(max(s.rating_multiplier),0) into v_old_best
  from public.active_gig_performance_sessions s where s.gig_id=p_gig_id;

  select round(avg(v))::integer into v_score from unnest(p_cue_scores) v;
  if v_score >= 90 then v_multiplier := 0.015;
  elsif v_score >= 75 then v_multiplier := 0.010;
  elsif v_score >= 60 then v_multiplier := 0.005;
  else v_multiplier := 0;
  end if;

  insert into public.active_gig_performance_sessions(gig_id,band_id,profile_id,user_id,cue_scores,score,rating_multiplier)
  values(p_gig_id,v_gig.band_id,p_profile_id,v_user,p_cue_scores,v_score,v_multiplier);

  select coalesce(max(s.rating_multiplier),0) into v_new_best
  from public.active_gig_performance_sessions s where s.gig_id=p_gig_id;

  if v_new_best > v_old_best then
    update public.gig_song_performances p
    set performance_score = least(
      25::numeric,
      round(coalesce(p.performance_score,0) * ((1 + v_new_best) / (1 + v_old_best)), 2)
    )
    where p.gig_outcome_id in (
      select o.id from public.gig_outcomes o where o.gig_id=p_gig_id
    );
  end if;

  return jsonb_build_object(
    'awarded',true,
    'score',v_score,
    'rating_multiplier',v_multiplier,
    'band_best_multiplier',v_new_best
  );
end;
$$;

create or replace function public.apply_active_gig_performance_to_song()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_multiplier numeric(6,4) := 0;
begin
  select coalesce(max(s.rating_multiplier),0)
  into v_multiplier
  from public.active_gig_performance_sessions s
  join public.gig_outcomes o on o.gig_id=s.gig_id
  where o.id=NEW.gig_outcome_id;

  if v_multiplier > 0 then
    NEW.performance_score := least(
      25::numeric,
      round(coalesce(NEW.performance_score,0) * (1 + v_multiplier), 2)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists apply_active_gig_performance_to_song_trigger on public.gig_song_performances;
create trigger apply_active_gig_performance_to_song_trigger
before insert on public.gig_song_performances
for each row execute function public.apply_active_gig_performance_to_song();
