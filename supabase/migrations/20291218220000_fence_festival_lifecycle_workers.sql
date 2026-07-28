-- Fence lifecycle workers and make the private lease completion protocol usable
-- from authorised SECURITY DEFINER entry points.  Forward-only.

CREATE OR REPLACE FUNCTION public._complete_festival_lifecycle_operation(
 p_operation uuid,p_worker uuid,p_generation integer,p_result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.festival_lifecycle_operations%ROWTYPE;
BEGIN
 -- Authority is the EXECUTE privilege on this private function.  Testing
 -- session_user here breaks authenticated owner entry points after they have
 -- legitimately claimed work through their SECURITY DEFINER wrapper.
 SELECT * INTO STRICT o FROM public.festival_lifecycle_operations
  WHERE id=p_operation FOR UPDATE;
 IF o.status='completed' THEN RETURN o.result; END IF;
 IF o.status<>'processing' OR o.lease_owner IS DISTINCT FROM p_worker
    OR o.lease_generation<>p_generation THEN
  RAISE EXCEPTION 'festival_lifecycle_lease_lost';
 END IF;
 UPDATE public.festival_lifecycle_operations
 SET status='completed',result=p_result,last_error=NULL,lease_owner=NULL,
     lease_expires_at=NULL,completed_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE id=o.id;
 RETURN p_result;
END $$;

CREATE OR REPLACE FUNCTION public._fail_festival_lifecycle_operation(
 p_operation uuid,p_worker uuid,p_generation integer,p_error jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.festival_lifecycle_operations
 SET status='failed',last_error=p_error,lease_owner=NULL,lease_expires_at=NULL,
     updated_at=clock_timestamp()
 WHERE id=p_operation AND status='processing' AND lease_owner=p_worker
   AND lease_generation=p_generation;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_lifecycle_lease_lost'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._festival_physical_lifecycle_state(
 p_runtime uuid,p_settlement uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE physical text; found_row boolean;
BEGIN
 IF p_settlement IS NOT NULL THEN
  SELECT status,true INTO physical,found_row
  FROM public.festival_financial_settlements
  WHERE id=p_settlement AND runtime_session_id=p_runtime;
  IF NOT coalesce(found_row,false) THEN
   RAISE EXCEPTION USING MESSAGE='festival_lifecycle_state_unknown',
    DETAIL=format('physical_state=null runtime_id=%s settlement_id=%s',p_runtime,p_settlement);
  END IF;
  CASE physical
   WHEN 'draft' THEN RETURN 'settlement_preparing';
   WHEN 'calculated' THEN RETURN 'calculated';
   WHEN 'settled' THEN RETURN 'settled';
   WHEN 'finalising' THEN RETURN 'finalising';
   WHEN 'finalised' THEN RETURN 'finalised';
   WHEN 'finalisation_failed' THEN RETURN 'finalisation_failed';
   ELSE RAISE EXCEPTION USING MESSAGE='festival_lifecycle_state_unknown',
    DETAIL=format('physical_state=%s runtime_id=%s settlement_id=%s',coalesce(physical,'null'),p_runtime,p_settlement);
  END CASE;
 END IF;
 SELECT status,true INTO physical,found_row FROM public.festival_runtime_sessions WHERE id=p_runtime;
 IF NOT coalesce(found_row,false) THEN RAISE EXCEPTION 'festival_runtime_not_found'; END IF;
 CASE physical
  WHEN 'planning' THEN RETURN 'planning'; WHEN 'scheduled' THEN RETURN 'scheduled';
  WHEN 'preparing' THEN RETURN 'preparing'; WHEN 'live' THEN RETURN 'running';
  WHEN 'final_performance_complete' THEN RETURN 'running'; WHEN 'public_closed' THEN RETURN 'running';
  WHEN 'site_clearance' THEN RETURN 'running'; WHEN 'runtime_complete' THEN RETURN 'runtime_complete';
  ELSE RAISE EXCEPTION USING MESSAGE='festival_lifecycle_state_unknown',
   DETAIL=format('physical_state=%s runtime_id=%s settlement_id=null',coalesce(physical,'null'),p_runtime);
 END CASE;
END $$;

-- An operation attached to a transition is a capability, not decorative audit
-- metadata.  It must be the currently fenced operation for this runtime and
-- its kind must be able to produce the requested state.
CREATE OR REPLACE FUNCTION public._festival_transition_operation_valid(
 p_runtime uuid,p_operation uuid,p_to text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_operation IS NULL OR EXISTS (
  SELECT 1 FROM public.festival_lifecycle_operations o
  WHERE o.id=p_operation AND o.runtime_session_id=p_runtime
    AND o.status='processing' AND o.lease_expires_at>clock_timestamp()
    AND o.operation=CASE
      WHEN p_to='runtime_complete' THEN 'runtime_completion'
      WHEN p_to IN('settlement_preparing','calculated') THEN 'settlement_preparation'
      WHEN p_to='settled' THEN 'reconciliation'
      WHEN p_to IN('finalising','finalised','finalisation_failed') THEN 'finalisation'
      ELSE o.operation END)
$$;

CREATE OR REPLACE FUNCTION public.transition_festival_lifecycle(
 p_runtime uuid,p_from text,p_to text,p_operation uuid DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE;
 s public.festival_financial_settlements%ROWTYPE; current_state text;
 persisted text; resulting_version integer;
BEGIN
 SELECT * INTO STRICT r FROM public.festival_runtime_sessions WHERE id=p_runtime FOR UPDATE;
 SELECT * INTO s FROM public.festival_financial_settlements
  WHERE runtime_session_id=p_runtime FOR UPDATE;
 IF NOT public._festival_lifecycle_authorised(p_runtime) THEN
  RAISE EXCEPTION 'festival_lifecycle_transition_forbidden';
 END IF;
 current_state:=public._festival_physical_lifecycle_state(p_runtime,s.id);
 IF current_state IS DISTINCT FROM p_from THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='festival_lifecycle_state_stale',
   DETAIL=format('persisted_state=%s runtime_id=%s settlement_id=%s',current_state,p_runtime,coalesce(s.id::text,'null'));
 END IF;
 IF NOT public._festival_lifecycle_transition_allowed(current_state,p_to) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='festival_lifecycle_transition_invalid';
 END IF;
 IF NOT public._festival_transition_operation_valid(p_runtime,p_operation,p_to) THEN
  RAISE EXCEPTION 'festival_lifecycle_operation_authority_invalid';
 END IF;
 IF p_to IN ('settlement_preparing','calculated','settled','finalising','finalised','finalisation_failed') THEN
  IF s.id IS NULL THEN RAISE EXCEPTION 'festival_settlement_missing'; END IF;
  UPDATE public.festival_financial_settlements
  SET status=CASE p_to WHEN 'settlement_preparing' THEN 'draft' ELSE p_to END,
      version=version+1,updated_at=clock_timestamp()
  WHERE id=s.id RETURNING version INTO resulting_version;
 ELSE
  UPDATE public.festival_runtime_sessions
  SET status=CASE p_to WHEN 'running' THEN 'live' ELSE p_to END,
      version=version+1,updated_at=clock_timestamp()
  WHERE id=r.id RETURNING version INTO resulting_version;
 END IF;
 persisted:=public._festival_physical_lifecycle_state(p_runtime,s.id);
 INSERT INTO public.festival_lifecycle_transitions
  (runtime_session_id,settlement_id,from_state,to_state,operation_id,
   actor_profile_id,reason,resulting_version)
 VALUES(p_runtime,s.id,current_state,persisted,p_operation,
  public._caller_profile_id(),p_reason,resulting_version);
 RETURN jsonb_build_object('runtimeSessionId',p_runtime,'settlementId',s.id,
  'from',current_state,'to',persisted,'version',resulting_version);
END $$;

REVOKE ALL ON FUNCTION public._complete_festival_lifecycle_operation(uuid,uuid,integer,jsonb),
 public._fail_festival_lifecycle_operation(uuid,uuid,integer,jsonb),
 public._festival_physical_lifecycle_state(uuid,uuid),
 public._festival_transition_operation_valid(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.transition_festival_lifecycle(uuid,text,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_festival_lifecycle(uuid,text,text,uuid,text)
 TO authenticated;
