-- Active Sessions Phase 5: optional live stage-presence challenge.
-- Every active band member can play once; only the band's best result is applied at gig completion.

create table if not exists public.active_gig_performance_sessions (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  cue_scores integer[] not null,
  score integer not null check (score between 0 and 100),
  rating_multiplier numeric(6,4) not null default 0 check (rating_multiplier between 0 and 0.015),
  played_at timestamptz not null default now(),
  unique (gig_id, profile_id)
);

alter table public.active_gig_performance_sessions enable row level security;

drop policy if exists "active gig performance own select" on public.active_gig_performance_sessions;
create policy "active gig performance own select"
on public.active_gig_performance_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.active_gig_performance_sessions from anon;
revoke insert, update, delete on table public.active_gig_performance_sessions from authenticated;
grant select on table public.active_gig_performance_sessions to authenticated;

create index if not exists active_gig_performance_gig_idx
  on public.active_gig_performance_sessions(gig_id, rating_multiplier desc, played_at asc);

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

  select round(avg(v))::integer into v_score from unnest(p_cue_scores) v;
  if v_score >= 90 then v_multiplier := 0.015;
  elsif v_score >= 75 then v_multiplier := 0.010;
  elsif v_score >= 60 then v_multiplier := 0.005;
  else v_multiplier := 0;
  end if;

  insert into public.active_gig_performance_sessions(gig_id,band_id,profile_id,user_id,cue_scores,score,rating_multiplier)
  values(p_gig_id,v_gig.band_id,p_profile_id,v_user,p_cue_scores,v_score,v_multiplier);

  return jsonb_build_object(
    'awarded',true,
    'score',v_score,
    'rating_multiplier',v_multiplier,
    'band_best_multiplier',(
      select max(s.rating_multiplier) from public.active_gig_performance_sessions s where s.gig_id=p_gig_id
    )
  );
end;
$$;

revoke all on function public.submit_active_gig_performance(uuid,uuid,integer[]) from public;
revoke all on function public.submit_active_gig_performance(uuid,uuid,integer[]) from anon;
grant execute on function public.submit_active_gig_performance(uuid,uuid,integer[]) to authenticated;
