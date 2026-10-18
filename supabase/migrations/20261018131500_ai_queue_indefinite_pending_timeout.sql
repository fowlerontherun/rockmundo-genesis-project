-- Queued requests have not reached the provider; do not expire them while
-- waiting for available throughput or Replicate credit. The accepted-prediction
-- timeout and 25-minute missing-callback watchdog remain unchanged.
do $fix$
declare original_definition text;
begin
  select pg_get_functiondef(to_regprocedure(
    'public.enqueue_ai_song_generation(uuid,uuid,uuid,text,text,text)'))
  into original_definition;
  if original_definition is null then
    raise exception 'AI song enqueue RPC missing';
  end if;
  if position('timeout_at=now()+interval ''24 hours''' in original_definition)>0 then
    execute replace(original_definition,
      'timeout_at=now()+interval ''24 hours''',
      'timeout_at=''infinity''::timestamptz');
  elsif position('timeout_at=''infinity''::timestamptz' in original_definition)=0 then
    raise exception 'Unexpected AI enqueue RPC definition';
  end if;
end $fix$;

-- Preexisting queued attempts have never been submitted. Protect them now,
-- but do not change already-submitted or needs-review predictions.
update public.song_generation_attempts a
set timeout_at='infinity'::timestamptz
from public.ai_song_generation_queue q
where a.id=q.attempt_id
  and q.state='queued'
  and a.status='generating'
  and a.prediction_id is null;
