-- #4314: A submitted provider prediction with a lost callback must not
-- monopolize a global dispatch slot forever. Keep the original prediction ID
-- available for manual GET/reconciliation; NEVER submit that job again.
create or replace function public.flag_stale_ai_song_predictions()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 with stale as (
  select q.attempt_id
  from public.ai_song_generation_queue q
  join public.song_generation_attempts a on a.id=q.attempt_id
  where q.state='submitted'
    and q.submitted_at<now()-interval '25 minutes'
    and a.status='generating'
    and q.prediction_id is not null
  for update of q skip locked
 ), held as (
   update public.ai_song_generation_queue q
   set state='needs_review',lease_until=null,
     last_error='Provider prediction has exceeded 25 minutes without a completion callback. Check the saved prediction ID before resolving this request.'
   from stale
   where q.attempt_id=stale.attempt_id and q.state='submitted'
   returning q.attempt_id
 ), protected as (
   update public.song_generation_attempts a
   set timeout_at='infinity'::timestamptz
   from held
   where a.id=held.attempt_id and a.status='generating'
   returning a.id
 )
 select count(*) into v_count from protected;

 return v_count;
end $$;
revoke all on function public.flag_stale_ai_song_predictions()
 from public,anon,authenticated;
grant execute on function public.flag_stale_ai_song_predictions() to service_role;
