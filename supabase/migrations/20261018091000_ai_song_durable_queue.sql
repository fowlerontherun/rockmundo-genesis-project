
-- #4305: service-only, durable, global admission queue for paid AI music.
-- Fail CLOSED. Enable the dispatcher explicitly only after deployment/test.
create table if not exists public.ai_song_generation_queue (
 attempt_id uuid primary key references public.song_generation_attempts(id) on delete cascade,
 song_id uuid not null references public.songs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 model text not null check(model in ('music-1.5','music-2.6')),
 style_prompt text not null check(char_length(style_prompt) between 10 and 300),
 lyrics text not null check(char_length(lyrics) between 10 and 3500),
 state text not null default 'queued' check(state in ('queued','dispatching','submitted','completed','failed','cancelled')),
 created_at timestamptz not null default now(),
 available_at timestamptz not null default now(),
 claimed_at timestamptz,
 lease_until timestamptz,
 submitted_at timestamptz,
 finished_at timestamptz,
 prediction_id text,
 dispatch_count int not null default 0 check(dispatch_count between 0 and 4),
 last_error text
);
create unique index if not exists ai_song_queue_one_active_per_song
 on public.ai_song_generation_queue(song_id) where state in ('queued','dispatching','submitted');
create index if not exists ai_song_queue_due
 on public.ai_song_generation_queue(available_at,created_at) where state='queued';
create index if not exists ai_song_queue_owner
 on public.ai_song_generation_queue(user_id,created_at desc);
alter table public.ai_song_generation_queue enable row level security;
revoke all on public.ai_song_generation_queue from PUBLIC,anon,authenticated;
grant select on public.ai_song_generation_queue to authenticated;
drop policy if exists "Owners view their generation queue" on public.ai_song_generation_queue;
create policy "Owners view their generation queue" on public.ai_song_generation_queue
 for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.ai_song_dispatch_gate (
 id boolean primary key default true check (id=true),
 enabled boolean not null default false,
 next_allowed_at timestamptz not null default now(),
 submission_interval_seconds integer not null default 15 check(submission_interval_seconds between 10 and 3600),
 max_in_flight integer not null default 2 check(max_in_flight between 1 and 10),
 updated_at timestamptz not null default now()
);
insert into public.ai_song_dispatch_gate(id,enabled,submission_interval_seconds,max_in_flight)
values(true,false,15,2) on conflict(id) do nothing;
revoke all on public.ai_song_dispatch_gate from PUBLIC,anon,authenticated;
alter table public.ai_song_dispatch_gate enable row level security;

create or replace function public.enqueue_ai_song_generation(
 p_attempt_id uuid,p_song_id uuid,p_user_id uuid,p_model text,p_style text,p_lyrics text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_attempt public.song_generation_attempts%rowtype;
begin
 select * into v_attempt from public.song_generation_attempts
 where id=p_attempt_id and song_id=p_song_id and user_id=p_user_id for update;
 if not found or v_attempt.status<>'generating' or v_attempt.prediction_id is not null then
  raise exception 'ATTEMPT_NOT_RESERVABLE';
 end if;
 if not exists(select 1 from public.songs where id=p_song_id and user_id=p_user_id) then
  raise exception 'SONG_OWNER_MISMATCH';
 end if;
 insert into public.ai_song_generation_queue(attempt_id,song_id,user_id,model,style_prompt,lyrics)
 values(p_attempt_id,p_song_id,p_user_id,p_model,p_style,p_lyrics)
 on conflict(attempt_id) do nothing;
 -- Queuing is NOT a timeout of an already submitted model prediction.
 update public.song_generation_attempts set timeout_at=now()+interval '24 hours'
 where id=p_attempt_id and status='generating' and prediction_id is null;
 return jsonb_build_object('ok',true,'attempt_id',p_attempt_id,'state','queued');
end $$;
revoke all on function public.enqueue_ai_song_generation(uuid,uuid,uuid,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.enqueue_ai_song_generation(uuid,uuid,uuid,text,text,text) to service_role;

create or replace function public.claim_ai_song_generation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare gate public.ai_song_dispatch_gate%rowtype;
        job public.ai_song_generation_queue%rowtype;
        in_flight integer;
begin
 select * into gate from public.ai_song_dispatch_gate where id=true for update;
 if not found or not gate.enabled or gate.next_allowed_at>now() then return null; end if;
 select count(*) into in_flight from public.ai_song_generation_queue q
 join public.song_generation_attempts a on a.id=q.attempt_id
 where q.state in ('dispatching','submitted') and a.status='generating';
 if in_flight>=gate.max_in_flight then return null; end if;
 select * into job from public.ai_song_generation_queue
 where state='queued' and available_at<=now()
 order by available_at,created_at for update skip locked limit 1;
 if not found then return null; end if;
 -- A missing/finalized attempt must never be posted to the provider.
 if not exists(select 1 from public.song_generation_attempts
  where id=job.attempt_id and status='generating' and prediction_id is null) then
   update public.ai_song_generation_queue set state='failed',last_error='Attempt already finalized',
     finished_at=now() where attempt_id=job.attempt_id;
   return null;
 end if;
 update public.ai_song_generation_queue set state='dispatching',dispatch_count=dispatch_count+1,
   claimed_at=now(),lease_until=now()+interval '3 minutes'
 where attempt_id=job.attempt_id;
 update public.ai_song_dispatch_gate set next_allowed_at=now()+make_interval(secs=>gate.submission_interval_seconds),
 updated_at=now() where id=true;
 return jsonb_build_object('attempt_id',job.attempt_id,'song_id',job.song_id,
   'user_id',job.user_id,'model',job.model,'style_prompt',job.style_prompt,
   'lyrics',job.lyrics,'dispatch_count',job.dispatch_count+1);
end $$;
revoke all on function public.claim_ai_song_generation() from PUBLIC,anon,authenticated;
grant execute on function public.claim_ai_song_generation() to service_role;

create or replace function public.mark_ai_song_submitted(p_attempt uuid,p_prediction text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.ai_song_generation_queue%rowtype;
begin
 select * into job from public.ai_song_generation_queue where attempt_id=p_attempt for update;
 if not found or job.state<>'dispatching' or nullif(p_prediction,'') is null then return false; end if;
 update public.song_generation_attempts set prediction_id=p_prediction,
   provider_prediction_id=p_prediction, timeout_at=now()+interval '15 minutes'
 where id=p_attempt and status='generating' and prediction_id is null;
 if not found then return false; end if;
 update public.ai_song_generation_queue set state='submitted',prediction_id=p_prediction,
 submitted_at=now(),lease_until=null where attempt_id=p_attempt;
 return true;
end $$;
revoke all on function public.mark_ai_song_submitted(uuid,text) from PUBLIC,anon,authenticated;
grant execute on function public.mark_ai_song_submitted(uuid,text) to service_role;

create or replace function public.requeue_ai_song_throttled(p_attempt uuid,p_delay_seconds integer,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.ai_song_generation_queue%rowtype;
begin
 select * into job from public.ai_song_generation_queue where attempt_id=p_attempt for update;
 if not found or job.state<>'dispatching' or job.dispatch_count>=4
    or exists(select 1 from public.song_generation_attempts
         where id=p_attempt and prediction_id is not null) then return false; end if;
 update public.ai_song_generation_queue set state='queued',
  available_at=now()+make_interval(secs=>greatest(90,least(3600,p_delay_seconds))),
  claimed_at=null,lease_until=null,last_error=left(p_error,1000)
 where attempt_id=p_attempt;
 update public.ai_song_dispatch_gate set next_allowed_at=greatest(next_allowed_at,now()+interval '90 seconds'),
 updated_at=now() where id=true;
 return true;
end $$;
revoke all on function public.requeue_ai_song_throttled(uuid,integer,text) from PUBLIC,anon,authenticated;
grant execute on function public.requeue_ai_song_throttled(uuid,integer,text) to service_role;

create or replace function public.sync_ai_song_generation_queue()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('completed','failed','timeout') and new.status is distinct from old.status then
  update public.ai_song_generation_queue
   set state=case when new.status='completed' then 'completed' else 'failed' end,
       finished_at=now(),lease_until=null,last_error=left(coalesce(new.error_message,''),1000)
  where attempt_id=new.id and state not in ('completed','failed','cancelled');
 end if;
 return new;
end $$;
drop trigger if exists sync_ai_song_queue_attempt_status on public.song_generation_attempts;
create trigger sync_ai_song_queue_attempt_status
 after update of status on public.song_generation_attempts for each row
 execute function public.sync_ai_song_generation_queue();
revoke all on function public.sync_ai_song_generation_queue() from PUBLIC,anon,authenticated;
