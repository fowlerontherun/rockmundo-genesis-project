-- #4314. Keep ambiguous paid submissions locked to their original attempt,
-- but remove them from the global in-flight capacity. An uncertain POST is
-- NEVER automatically retried. Signed provider webhooks can still finish it.
begin;

alter table public.ai_song_generation_queue
  drop constraint if exists ai_song_generation_queue_state_check;
alter table public.ai_song_generation_queue
  add constraint ai_song_generation_queue_state_check
  check (state in ('queued','dispatching','submitted','needs_review','completed','failed','cancelled'));

create index if not exists ai_song_queue_needs_review
  on public.ai_song_generation_queue(claimed_at)
  where state='needs_review';

-- Handle a known ambiguous outcome immediately. No status=failed transition,
-- since a late provider callback may still arrive from a billed prediction.
create or replace function public.flag_ai_song_dispatch_uncertain(
  p_attempt uuid, p_reason text default 'Provider submission could have been accepted'
) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_job public.ai_song_generation_queue%rowtype;
begin
 select * into v_job
 from public.ai_song_generation_queue where attempt_id=p_attempt for update;
 if not found or v_job.state <> 'dispatching' then return false; end if;
 if not exists (
  select 1 from public.song_generation_attempts
  where id=p_attempt and status='generating' and prediction_id is null
 ) then return false; end if;

 update public.ai_song_generation_queue
 set state='needs_review',lease_until=null,
     last_error=left(coalesce(nullif(p_reason,''),'Provider submission uncertain: manual review required'),1000)
 where attempt_id=p_attempt and state='dispatching';

 -- Do not allow a generic 15min/24hr cleanup to permit a new paid request.
 update public.song_generation_attempts
 set timeout_at='infinity'::timestamptz
 where id=p_attempt and status='generating' and prediction_id is null;
 return true;
end $$;

revoke all on function public.flag_ai_song_dispatch_uncertain(uuid,text)
 from public,anon,authenticated;
grant execute on function public.flag_ai_song_dispatch_uncertain(uuid,text) to service_role;

-- Called every worker tick. Transitions stale claims to manual-review status,
-- or repairs a tracked prediction after an interruption between DB writes.
-- A "needs_review" job is excluded from global in-flight capacity but keeps
-- its song reserved, so no second paid prediction is ever submitted.
create or replace function public.reconcile_expired_ai_song_dispatches()
returns integer
language plpgsql security definer set search_path='' as $$
declare v_job public.ai_song_generation_queue%rowtype;
        v_status text; v_prediction text; v_count integer := 0;
begin
 for v_job in
   select * from public.ai_song_generation_queue
   where state='dispatching' and lease_until<now()
   order by lease_until for update skip locked
 loop
   select status, prediction_id into v_status,v_prediction
   from public.song_generation_attempts where id=v_job.attempt_id for update;

   if v_status='completed' then
     update public.ai_song_generation_queue
     set state='completed',finished_at=now(),lease_until=null
     where attempt_id=v_job.attempt_id and state='dispatching';
   elsif v_status in ('failed','timeout') or v_status is null then
     update public.ai_song_generation_queue
     set state='failed',finished_at=now(),lease_until=null,
         last_error='Generation attempt previously finalized'
     where attempt_id=v_job.attempt_id and state='dispatching';
   elsif nullif(v_prediction,'') is not null then
     update public.ai_song_generation_queue
     set state='submitted',prediction_id=v_prediction,
         submitted_at=coalesce(submitted_at,claimed_at,now()),lease_until=null
     where attempt_id=v_job.attempt_id and state='dispatching';
   else
     update public.ai_song_generation_queue
     set state='needs_review',lease_until=null,
         last_error='Dispatch lease expired with no confirmed provider ID. Admin review needed; automatic retry blocked.'
     where attempt_id=v_job.attempt_id and state='dispatching';
     update public.song_generation_attempts
     set timeout_at='infinity'::timestamptz
     where id=v_job.attempt_id and status='generating' and prediction_id is null;
   end if;
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

revoke all on function public.reconcile_expired_ai_song_dispatches()
 from public,anon,authenticated;
grant execute on function public.reconcile_expired_ai_song_dispatches() to service_role;
commit;
