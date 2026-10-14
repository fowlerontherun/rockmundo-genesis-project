-- #2598: explicit, service-only repair of daily-event backlogs.
-- Deployment does not apply historical events until service operators opt in.
CREATE TABLE IF NOT EXISTS public.random_event_reconciliation_audit (
  player_event_id uuid PRIMARY KEY REFERENCES public.player_events(id) ON DELETE RESTRICT,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  prior_status text NOT NULL,
  result jsonb NOT NULL
);
ALTER TABLE public.random_event_reconciliation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.random_event_reconciliation_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.random_event_reconciliation_audit TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_random_event_backlog(
 p_limit integer DEFAULT 25,p_apply boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_event record;v_result jsonb;v_results jsonb:='[]'::jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN
   RAISE EXCEPTION 'invalid_batch_limit' USING ERRCODE='22023';
 END IF;
 IF to_regclass('public.random_event_skill_xp_grants') IS NULL
   OR to_regprocedure('public.apply_random_event_outcome(uuid)') IS NULL
   OR to_regprocedure('public.submit_random_event_choice(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'missing_daily_event_schema';
 END IF;
 IF NOT p_apply THEN
   RETURN jsonb_build_object('dry_run',true,'pending',(
     SELECT count(*) FROM public.player_events
     WHERE status='awaiting_outcome' AND NOT COALESCE(outcome_applied,false)
       AND choice_made IN ('a','b') AND choice_made_at<now()-interval '15 minutes'
   ),'already_audited',(SELECT count(*) FROM public.random_event_reconciliation_audit));
 END IF;
 FOR v_event IN SELECT pe.id,pe.status FROM public.player_events pe
   WHERE pe.status='awaiting_outcome' AND NOT COALESCE(pe.outcome_applied,false)
     AND pe.choice_made IN ('a','b') AND pe.choice_made_at<now()-interval '15 minutes'
   ORDER BY pe.choice_made_at,pe.id LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
   BEGIN
     v_result:=public.apply_random_event_outcome(v_event.id);
   EXCEPTION WHEN OTHERS THEN
     v_result:=jsonb_build_object('applied',false,'reason','worker_failed',
       'sqlstate',SQLSTATE,'message',SQLERRM);
   END;
   INSERT INTO public.random_event_reconciliation_audit(player_event_id,prior_status,result)
   VALUES(v_event.id,v_event.status,v_result)
   ON CONFLICT (player_event_id) DO UPDATE
      SET attempted_at=now(),result=EXCLUDED.result;
   v_results:=v_results||jsonb_build_array(jsonb_build_object(
     'id',v_event.id,'result',v_result));
 END LOOP;
 RETURN jsonb_build_object('dry_run',false,
   'processed',jsonb_array_length(v_results),'results',v_results);
END $fn$;
REVOKE ALL ON FUNCTION public.apply_random_event_outcome(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_random_event_outcome(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_random_event_backlog(integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_random_event_backlog(integer,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
