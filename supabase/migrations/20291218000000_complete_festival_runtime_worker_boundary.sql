-- Phase 8 worker boundary correctness: immutable inputs, leases, idempotency and complete outcomes.
ALTER TABLE public.festival_performance_simulation_jobs
  ADD COLUMN input_snapshot jsonb,
  ADD COLUMN result_version text NOT NULL DEFAULT 'festival-performance-result-v1';

CREATE TABLE public.festival_performance_resolution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_performance_id uuid NOT NULL REFERENCES public.festival_runtime_performances(id),
  idempotency_key uuid NOT NULL, request_digest text NOT NULL, simulation_job_id uuid REFERENCES public.festival_performance_simulation_jobs(id),
  response jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(runtime_performance_id,idempotency_key), UNIQUE(idempotency_key)
);
ALTER TABLE public.festival_performance_resolution_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_performance_resolution_requests FROM PUBLIC,anon,authenticated;

CREATE TABLE public.festival_performance_simulation_requeue_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.festival_performance_simulation_jobs(id),
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id), previous_attempts integer NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), idempotency_key uuid NOT NULL UNIQUE
);
ALTER TABLE public.festival_performance_simulation_requeue_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_performance_simulation_requeue_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.resolve_festival_performance(p_runtime_performance_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.festival_runtime_performances%ROWTYPE;j public.festival_performance_simulation_jobs%ROWTYPE;req public.festival_performance_resolution_requests%ROWTYPE;snapshot jsonb;digest_input text;response jsonb;
BEGIN
 SELECT * INTO p FROM public.festival_runtime_performances WHERE id=p_runtime_performance_id FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'festival_runtime_chain_performance';END IF;
 PERFORM public._festival_assert_runtime_chain(p.runtime_session_id,p.runtime_day_id,p.runtime_stage_id,p.id);
 IF NOT public._festival_runtime_owner(p.runtime_session_id,public._festival_runtime_actor()) THEN RAISE EXCEPTION 'festival_runtime_forbidden';END IF;
 snapshot:=jsonb_build_object(
   'canonicalGigInput',p.engine_input_snapshot,'festivalModifiers',jsonb_build_object(
     'stageQuality',coalesce((p.engine_input_snapshot->>'stageQuality')::numeric,50),'soundAndLighting',coalesce((p.engine_input_snapshot->>'soundAndLighting')::numeric,50),
     'technicalReadiness',coalesce((p.engine_input_snapshot->>'technicalReadiness')::numeric,50),'rehearsal',coalesce((p.engine_input_snapshot->>'rehearsal')::numeric,50),
     'crewEffectiveness',coalesce((p.engine_input_snapshot->>'crewEffectiveness')::numeric,50),'weather',coalesce(100-(SELECT operational_impact FROM public.festival_runtime_weather WHERE runtime_day_id=p.runtime_day_id),50),
     'delayMinutes',p.delay_minutes,'crowdMood',coalesce((SELECT satisfaction FROM public.festival_runtime_crowds WHERE runtime_day_id=p.runtime_day_id),50),
     'crowdDensity',coalesce((SELECT round(current_crowd::numeric/nullif(stage_capacity,0)*100) FROM public.festival_runtime_stage_crowds WHERE runtime_day_id=p.runtime_day_id AND runtime_stage_id=p.runtime_stage_id),50),
     'equipmentCondition',coalesce((p.engine_input_snapshot->>'equipmentCondition')::numeric,50),'billingPosition',coalesce((p.engine_input_snapshot->>'billingPosition')::numeric,50),
     'headlinerExpectation',coalesce((p.engine_input_snapshot->>'headlinerExpectation')::numeric,50),'incidentDisruption',coalesce((SELECT sum(CASE severity WHEN 'critical' THEN 40 WHEN 'major' THEN 25 WHEN 'moderate' THEN 12 ELSE 4 END) FROM public.festival_runtime_incidents WHERE runtime_day_id=p.runtime_day_id AND (runtime_stage_id IS NULL OR runtime_stage_id=p.runtime_stage_id)),0),
     'setLengthMinutes',greatest(10,extract(epoch from(p.scheduled_end-p.scheduled_start))/60)),
   'runtimeSessionId',p.runtime_session_id,'dayId',p.runtime_day_id,'stageId',p.runtime_stage_id,'performanceId',p.id,'seed',p.performance_seed,
   'engineVersion',p.engine_version,'formulaVersions',jsonb_build_object('performance',p.formula_version,'runtime',(SELECT formula_version FROM public.festival_runtime_sessions WHERE id=p.runtime_session_id),'crowd','festival-crowd-largest-remainder-v2'),
   'runtimeVersion',(SELECT version FROM public.festival_runtime_sessions WHERE id=p.runtime_session_id),
   'weatherEvidence',(SELECT to_jsonb(w) FROM public.festival_runtime_weather w WHERE runtime_day_id=p.runtime_day_id),
   'crowdEvidence',jsonb_build_object('attendance',least(coalesce((SELECT current_crowd FROM public.festival_runtime_stage_crowds WHERE runtime_day_id=p.runtime_day_id AND runtime_stage_id=p.runtime_stage_id),0),(SELECT capacity FROM public.festival_runtime_stages WHERE id=p.runtime_stage_id)),'stageCapacity',(SELECT capacity FROM public.festival_runtime_stages WHERE id=p.runtime_stage_id)),
   'delayEvidence',jsonb_build_object('minutes',p.delay_minutes,'actualStart',p.actual_start),'incidentEvidence',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.festival_runtime_incidents i WHERE i.runtime_day_id=p.runtime_day_id AND (i.runtime_stage_id IS NULL OR i.runtime_stage_id=p.runtime_stage_id)),'[]'),
   'crewEquipmentEvidence',jsonb_build_object('crew',coalesce(p.engine_input_snapshot->'crew','[]'),'equipment',coalesce(p.engine_input_snapshot->'equipment','[]')));
 digest_input:=encode(digest(snapshot::text,'sha256'),'hex');
 INSERT INTO public.festival_performance_resolution_requests(runtime_performance_id,idempotency_key,request_digest) VALUES(p.id,p_idempotency_key,digest_input) ON CONFLICT(idempotency_key) DO NOTHING;
 SELECT * INTO req FROM public.festival_performance_resolution_requests WHERE idempotency_key=p_idempotency_key FOR UPDATE;
 IF req.runtime_performance_id<>p.id OR req.request_digest<>digest_input THEN RAISE EXCEPTION 'festival_performance_idempotency_conflict';END IF;
 IF req.response IS NOT NULL THEN RETURN req.response;END IF;
 IF p.status='completed' THEN response:=jsonb_build_object('runtimePerformanceId',p.id,'simulationStatus','completed','canonicalResult',p.engine_result_snapshot);UPDATE public.festival_performance_resolution_requests SET response=response,completed_at=now() WHERE id=req.id;RETURN response;END IF;
 IF p.version<>p_expected_version THEN RAISE EXCEPTION 'festival_runtime_stale';END IF;
 IF p.status<>'live' OR p.engine_input_snapshot IS NULL THEN RAISE EXCEPTION 'festival_performance_resolution_invalid';END IF;
 INSERT INTO public.festival_performance_simulation_jobs(runtime_session_id,runtime_day_id,runtime_stage_id,runtime_performance_id,seed,engine_version,input_digest,input_snapshot)
 VALUES(p.runtime_session_id,p.runtime_day_id,p.runtime_stage_id,p.id,p.performance_seed,p.engine_version,digest_input,snapshot) ON CONFLICT(runtime_performance_id) DO NOTHING RETURNING * INTO j;
 IF j.id IS NULL THEN SELECT * INTO j FROM public.festival_performance_simulation_jobs WHERE runtime_performance_id=p.id;IF j.input_digest<>digest_input THEN RAISE EXCEPTION 'festival_simulation_input_digest_mismatch';END IF;END IF;
 response:=jsonb_build_object('runtimePerformanceId',p.id,'simulationJobId',j.id,'simulationStatus',j.status,'idempotencyKey',p_idempotency_key);
 UPDATE public.festival_performance_resolution_requests SET simulation_job_id=j.id,response=response,completed_at=now() WHERE id=req.id;RETURN response;
END$$;

CREATE FUNCTION public.validate_festival_performance_simulation_input(p_job uuid,p_input_digest text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.festival_performance_simulation_jobs j WHERE j.id=p_job AND j.input_digest=p_input_digest AND j.input_snapshot IS NOT NULL AND encode(digest(j.input_snapshot::text,'sha256'),'hex')=j.input_digest)
$$;

CREATE FUNCTION public.fail_festival_performance_simulation_job(p_job uuid,p_worker text,p_error text,p_retryable boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.festival_performance_simulation_jobs%ROWTYPE;terminal boolean;
BEGIN SELECT * INTO j FROM public.festival_performance_simulation_jobs WHERE id=p_job FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.locked_by IS DISTINCT FROM p_worker THEN RAISE EXCEPTION 'festival_simulation_job_not_claimed';END IF;
 terminal:=NOT p_retryable OR j.attempts>=j.max_attempts;
 UPDATE public.festival_performance_simulation_jobs SET status=CASE WHEN terminal THEN 'exhausted' ELSE 'failed' END,last_error=left(p_error,1000),next_attempt_at=CASE WHEN terminal THEN next_attempt_at ELSE now()+make_interval(secs=>least(3600,power(2,j.attempts)::integer*5)) END,locked_at=NULL,locked_by=NULL WHERE id=j.id RETURNING * INTO j;RETURN to_jsonb(j);
END$$;

CREATE FUNCTION public.recover_stale_festival_performance_simulation_jobs(p_lease_seconds integer DEFAULT 300) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;BEGIN UPDATE public.festival_performance_simulation_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'exhausted' ELSE 'failed' END,last_error='processing_lease_expired',next_attempt_at=now(),locked_at=NULL,locked_by=NULL WHERE status='processing' AND locked_at<now()-make_interval(secs=>greatest(30,p_lease_seconds));GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END$$;

CREATE FUNCTION public.requeue_festival_performance_simulation_job(p_job uuid,p_reason text,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.festival_performance_simulation_jobs%ROWTYPE;a uuid:=public._caller_profile_id();BEGIN IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_simulation_admin_required';END IF;SELECT * INTO j FROM public.festival_performance_simulation_jobs WHERE id=p_job FOR UPDATE;IF j.status NOT IN('failed','exhausted') THEN RAISE EXCEPTION 'festival_simulation_job_not_requeueable';END IF;INSERT INTO public.festival_performance_simulation_requeue_audit(job_id,actor_profile_id,previous_attempts,reason,idempotency_key)VALUES(j.id,a,j.attempts,p_reason,p_idempotency_key) ON CONFLICT(idempotency_key) DO NOTHING;UPDATE public.festival_performance_simulation_jobs SET status='pending',attempts=0,next_attempt_at=now(),last_error=NULL,locked_at=NULL,locked_by=NULL WHERE id=j.id RETURNING * INTO j;RETURN to_jsonb(j);END$$;

-- Completion is strict and version-safe; the result trigger makes a successful result immutable.
CREATE OR REPLACE FUNCTION public.complete_festival_performance_simulation_job(p_job uuid,p_worker text,p_input_digest text,p_output jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.festival_performance_simulation_jobs%ROWTYPE;p public.festival_runtime_performances%ROWTYPE;rts public.festival_runtime_sessions%ROWTYPE;d text;res public.festival_performance_simulation_results%ROWTYPE;
BEGIN SELECT * INTO j FROM public.festival_performance_simulation_jobs WHERE id=p_job FOR UPDATE;SELECT * INTO p FROM public.festival_runtime_performances WHERE id=j.runtime_performance_id FOR UPDATE;SELECT * INTO rts FROM public.festival_runtime_sessions WHERE id=j.runtime_session_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.locked_by IS DISTINCT FROM p_worker THEN RAISE EXCEPTION 'festival_simulation_job_not_claimed';END IF;
 PERFORM public._festival_assert_runtime_chain(j.runtime_session_id,j.runtime_day_id,j.runtime_stage_id,j.runtime_performance_id);
 IF rts.status IN('runtime_complete','cancelled','failed') OR rts.completed_at IS NOT NULL OR p.status<>'live' THEN RAISE EXCEPTION 'festival_simulation_completion_superseded';END IF;
 IF j.input_digest<>p_input_digest OR encode(digest(j.input_snapshot::text,'sha256'),'hex')<>j.input_digest THEN RAISE EXCEPTION 'festival_simulation_input_digest_mismatch';END IF;
 IF p_output->>'resultVersion'<>j.result_version OR p_output->>'engineVersion'<>j.engine_version OR p_output->>'seed'<>j.seed OR p_output->>'performanceId'<>j.runtime_performance_id::text OR p_output->>'inputDigest'<>j.input_digest THEN RAISE EXCEPTION 'festival_simulation_result_identity_invalid';END IF;
 IF jsonb_typeof(p_output->'basePerformanceScore')<>'number' OR jsonb_typeof(p_output->'finalScore')<>'number' OR jsonb_typeof(p_output->'technicalScore')<>'number' OR jsonb_typeof(p_output->'crowdResponse')<>'object' OR jsonb_typeof(p_output->'setlistItemOutcomes')<>'array' OR jsonb_typeof(p_output->'stageActions')<>'array' OR jsonb_typeof(p_output->'generatedHighlights')<>'array' THEN RAISE EXCEPTION 'festival_simulation_result_schema_invalid';END IF;
 IF (p_output->>'attendance')::integer<0 OR (p_output->>'attendance')::integer>(p_output->>'stageCapacity')::integer OR (p_output->>'stageCapacity')::integer<>(SELECT capacity FROM public.festival_runtime_stages WHERE id=j.runtime_stage_id) THEN RAISE EXCEPTION 'festival_simulation_result_attendance_invalid';END IF;
 d:=encode(digest(p_output::text,'sha256'),'hex');
 INSERT INTO public.festival_performance_simulation_results(runtime_performance_id,canonical_gig_result_id,engine_version,seed,input_digest,output_digest,base_performance_score,festival_modifiers,final_score,technical_score,crowd_response,attendance,delay_impact,weather_impact,incident_impact,setlist_item_outcomes,stage_actions,generated_highlights)
 VALUES(j.runtime_performance_id,nullif(p_output->>'canonicalGigResultId','')::uuid,j.engine_version,j.seed,j.input_digest,d,(p_output->>'basePerformanceScore')::numeric,p_output->'festivalModifiers',(p_output->>'finalScore')::numeric,(p_output->>'technicalScore')::numeric,p_output->'crowdResponse',(p_output->>'attendance')::integer,(p_output->>'delayImpact')::numeric,(p_output->>'weatherImpact')::numeric,(p_output->>'incidentImpact')::numeric,p_output->'setlistItemOutcomes',p_output->'stageActions',p_output->'generatedHighlights') ON CONFLICT(runtime_performance_id) DO NOTHING RETURNING * INTO res;
 IF res.id IS NULL THEN SELECT * INTO res FROM public.festival_performance_simulation_results WHERE runtime_performance_id=j.runtime_performance_id;IF res.input_digest<>j.input_digest OR res.output_digest<>d THEN RAISE EXCEPTION 'festival_simulation_result_conflict';END IF;END IF;
 UPDATE public.festival_runtime_performances SET engine_result_snapshot=p_output,performance_score=res.final_score,technical_score=res.technical_score,crowd_response=res.crowd_response::text,estimated_audience=res.attendance,status='completed',actual_end=coalesce(actual_end,now()),version=version+1 WHERE id=p.id AND status='live' AND engine_result_snapshot IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_simulation_completion_superseded';END IF;
 UPDATE public.festival_performance_simulation_jobs SET status='completed',output_digest=d,completed_at=now(),locked_at=NULL,locked_by=NULL WHERE id=j.id;RETURN to_jsonb(res);
END$$;

REVOKE ALL ON FUNCTION public.validate_festival_performance_simulation_input(uuid,text),public.fail_festival_performance_simulation_job(uuid,text,text,boolean),public.recover_stale_festival_performance_simulation_jobs(integer),public.complete_festival_performance_simulation_job(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_festival_performance_simulation_job(text),public.validate_festival_performance_simulation_input(uuid,text),public.fail_festival_performance_simulation_job(uuid,text,text,boolean),public.recover_stale_festival_performance_simulation_jobs(integer),public.complete_festival_performance_simulation_job(uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_festival_performance_simulation_job(uuid,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalise_festival_runtime_outcomes(p_runtime_session_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE;snapshot jsonb;content_digest text;existing public.festival_runtime_outcome_snapshots%ROWTYPE;
BEGIN SELECT * INTO r FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'festival_runtime_chain_session';END IF;PERFORM public._festival_assert_runtime_chain(r.id,NULL,NULL,NULL);
 IF NOT public._festival_runtime_owner(r.id,public._festival_runtime_actor()) THEN RAISE EXCEPTION 'festival_runtime_forbidden';END IF;
 SELECT * INTO existing FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=r.id;IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('readyForSettlement',true,'outcomeDigest',existing.content_digest,'idempotent',true);END IF;
 IF r.version<>p_expected_version THEN RAISE EXCEPTION 'festival_runtime_stale';END IF;
 IF r.status NOT IN('public_closed','site_clearance') OR r.gates_open
  OR EXISTS(SELECT 1 FROM public.festival_performance_simulation_jobs WHERE runtime_session_id=r.id AND status IN('pending','processing','failed','exhausted'))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_performances WHERE runtime_session_id=r.id AND status NOT IN('completed','cancelled','abandoned'))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_incidents WHERE runtime_session_id=r.id AND severity IN('major','critical') AND status NOT IN('resolved','handed_over'))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_days d WHERE d.runtime_session_id=r.id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_weather w WHERE w.runtime_day_id=d.id))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_days d WHERE d.runtime_session_id=r.id AND NOT EXISTS(SELECT 1 FROM public.festival_crowd_recalculation_requests q WHERE q.runtime_day_id=d.id AND q.status='completed'))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_attendance a LEFT JOIN public.festival_runtime_crowds c ON c.runtime_day_id=a.runtime_day_id WHERE a.runtime_session_id=r.id AND (coalesce(c.allocated_count,0)+coalesce(c.unallocated_count,0)<>a.onsite_count OR coalesce((SELECT sum(sc.current_crowd) FROM public.festival_runtime_stage_crowds sc WHERE sc.runtime_day_id=a.runtime_day_id),0)<>coalesce(c.allocated_count,0)))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins c WHERE c.runtime_session_id=r.id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_staff_outcomes o WHERE o.staff_checkin_id=c.id))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_supplier_checkins c WHERE c.runtime_session_id=r.id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_supplier_outcomes o WHERE o.supplier_checkin_id=c.id))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_sponsor_activations WHERE runtime_session_id=r.id AND status NOT IN('completed','partially_completed','failed','cancelled'))
  OR EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales v WHERE v.runtime_session_id=r.id AND (v.status<>'closed' OR NOT EXISTS(SELECT 1 FROM public.festival_runtime_revenue_postings rp WHERE rp.vendor_sales_id=v.id)))
 THEN RAISE EXCEPTION 'festival_runtime_outcomes_blocked';END IF;
 snapshot:=jsonb_build_object(
  'attendance',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.runtime_day_id) FROM public.festival_runtime_attendance x WHERE x.runtime_session_id=r.id),'[]'),
  'performances',coalesce((SELECT jsonb_agg(jsonb_build_object('performance',to_jsonb(p),'result',to_jsonb(x)) ORDER BY p.scheduled_start,p.id) FROM public.festival_runtime_performances p LEFT JOIN public.festival_performance_simulation_results x ON x.runtime_performance_id=p.id WHERE p.runtime_session_id=r.id),'[]'),
  'crowds',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.runtime_day_id) FROM public.festival_runtime_crowds x WHERE x.runtime_session_id=r.id),'[]'),
  'stageCrowds',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.runtime_day_id,x.runtime_stage_id) FROM public.festival_runtime_stage_crowds x WHERE x.runtime_session_id=r.id),'[]'),
  'crowdMovements',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id) FROM public.festival_runtime_crowd_movements x WHERE x.runtime_session_id=r.id),'[]'),
  'weather',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.runtime_day_id) FROM public.festival_runtime_weather x WHERE x.runtime_session_id=r.id),'[]'),
  'incidents',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.detected_at,x.id) FROM public.festival_runtime_incidents x WHERE x.runtime_session_id=r.id),'[]'),
  'incidentOutcomes',coalesce((SELECT jsonb_agg(jsonb_build_object('incidentId',x.id,'status',x.status,'resolutionOutcome',x.resolution_outcome,'resolvedAt',x.resolved_at) ORDER BY x.id) FROM public.festival_runtime_incidents x WHERE x.runtime_session_id=r.id),'[]'),
  'staffOutcomes',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.festival_runtime_staff_outcomes x WHERE x.runtime_session_id=r.id),'[]'),
  'supplierOutcomes',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.festival_runtime_supplier_outcomes x WHERE x.runtime_session_id=r.id),'[]'),
  'sponsorActivations',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.festival_runtime_sponsor_activations x WHERE x.runtime_session_id=r.id),'[]'),
  'vendorSales',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.runtime_day_id,x.id) FROM public.festival_runtime_vendor_sales x WHERE x.runtime_session_id=r.id),'[]'),
  'revenuePostings',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.posted_at,x.id) FROM public.festival_runtime_revenue_postings x JOIN public.festival_runtime_vendor_sales v ON v.id=x.vendor_sales_id WHERE v.runtime_session_id=r.id),'[]'),
  'headliners',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.scheduled_start,p.id) FROM public.festival_runtime_performances p WHERE p.runtime_session_id=r.id AND coalesce((p.engine_input_snapshot->>'headlinerExpectation')::numeric,0)>0),'[]'),
  'timetable',coalesce((SELECT jsonb_agg(jsonb_build_object('performanceId',p.id,'dayId',p.runtime_day_id,'stageId',p.runtime_stage_id,'scheduledStart',p.scheduled_start,'scheduledEnd',p.scheduled_end,'status',p.status) ORDER BY p.scheduled_start,p.id) FROM public.festival_runtime_performances p WHERE p.runtime_session_id=r.id),'[]'),
  'runtimeMetadata',jsonb_build_object('runtimeSessionId',r.id,'runtimeVersion',r.version,'engineVersion',r.engine_version,'finalisedAt',now(),'idempotencyKey',p_idempotency_key),
  'sourceDigests',jsonb_build_object('performanceInputs',coalesce((SELECT jsonb_agg(input_digest ORDER BY runtime_performance_id) FROM public.festival_performance_simulation_jobs WHERE runtime_session_id=r.id),'[]'),'crowdInputs',coalesce((SELECT jsonb_agg(input_digest ORDER BY runtime_day_id,created_at) FROM public.festival_crowd_recalculation_requests WHERE runtime_session_id=r.id AND status='completed'),'[]')),
  'formulaVersions',jsonb_build_object('runtime',r.formula_version,'engine',r.engine_version,'performance','festival-performance-result-v1','crowd','festival-crowd-largest-remainder-v2','settlement','festival-settlement-v2'));
 content_digest:=encode(digest(snapshot::text,'sha256'),'hex');INSERT INTO public.festival_runtime_outcome_snapshots(runtime_session_id,snapshot,engine_version,formula_versions,content_digest)VALUES(r.id,snapshot,r.engine_version,snapshot->'formulaVersions',content_digest);
 UPDATE public.festival_runtime_sessions SET status='runtime_complete',ready_for_settlement=true,completed_at=now(),gates_open=false,version=version+1,updated_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('readyForSettlement',true,'outcomeDigest',content_digest,'idempotencyKey',p_idempotency_key,'idempotent',false);
END$$;
