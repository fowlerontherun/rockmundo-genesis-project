-- The queue's watchdog quarantines missing callbacks after 25 minutes.
-- Give submitted paid predictions 30 minutes before generic cleanup can
-- finalize them, while preserving all existing privileged RPC grants.
do $$
declare v_definition text;
begin
 select pg_get_functiondef(to_regprocedure('public.mark_ai_song_submitted(uuid,text)'))
 into v_definition;
 if v_definition is null then raise exception 'AI queue submission RPC missing'; end if;
 if position('timeout_at=now()+interval ''15 minutes''' in v_definition)>0 then
   execute replace(v_definition,'timeout_at=now()+interval ''15 minutes''',
                               'timeout_at=now()+interval ''30 minutes''');
 elsif position('timeout_at=now()+interval ''30 minutes''' in v_definition)=0 then
   raise exception 'Unexpected queue submission timeout implementation';
 end if;
end $$;
