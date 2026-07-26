-- Final cross-phase contract: explicit runtime outcome v2 and observable simulation workers.
ALTER TABLE public.festival_performance_simulation_jobs
  ADD COLUMN canonical_engine_version text NOT NULL DEFAULT 'canonical-gig-v1',
  ADD COLUMN festival_adapter_version text NOT NULL DEFAULT 'festival-gig-adapter-v2',
  ADD COLUMN runtime_formula_version text NOT NULL DEFAULT 'festival-runtime-v1';

-- Earlier jobs used `gig-v1` and `engine_version` for several different concepts.
UPDATE public.festival_performance_simulation_jobs
SET canonical_engine_version = CASE WHEN engine_version IN ('gig-v1','canonical-gig-v1') THEN 'canonical-gig-v1' ELSE engine_version END,
    engine_version = CASE WHEN engine_version='gig-v1' THEN 'canonical-gig-v1' ELSE engine_version END;

CREATE TABLE public.festival_simulation_worker_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), worker_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
  recovered_leases integer NOT NULL DEFAULT 0, processed_job_id uuid REFERENCES public.festival_performance_simulation_jobs(id),
  error_code text, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE public.festival_simulation_worker_invocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_simulation_worker_invocations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public._festival_runtime_performance_projection(p public.festival_runtime_performances)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object(
  'id',p.id,'runtimePerformanceId',p.id,'runtimeDayId',p.runtime_day_id,'runtimeStageId',p.runtime_stage_id,
  'status',p.status,'artistType',CASE WHEN p.band_id IS NOT NULL THEN 'band' WHEN p.solo_artist_profile_id IS NOT NULL THEN 'solo' ELSE 'npc' END,
  'artistId',coalesce(p.band_id,p.solo_artist_profile_id,p.npc_artist_id),'bandId',p.band_id,
  'soloArtistProfileId',p.solo_artist_profile_id,'npcArtistId',p.npc_artist_id,'artistName',p.artist_name,
  'billingPosition',coalesce((p.engine_input_snapshot->>'billingPosition')::integer,0),
  'isHeadliner',coalesce((p.engine_input_snapshot->>'headlinerExpectation')::numeric,0)>0,
  'performanceScore',p.performance_score,'technicalScore',p.technical_score,
  'crowdResponse',coalesce(p.engine_result_snapshot->'crowdResponse','{}'::jsonb),'attendance',coalesce(p.estimated_audience,0),
  'scheduledStart',p.scheduled_start,'scheduledEnd',p.scheduled_end,'actualStart',p.actual_start,'actualEnd',p.actual_end,
  'delayMinutes',p.delay_minutes,'canonicalEngineVersion',CASE WHEN p.engine_version='gig-v1' THEN 'canonical-gig-v1' ELSE p.engine_version END,
  'festivalAdapterVersion','festival-gig-adapter-v2','resultSchemaVersion','festival-performance-result-v1',
  'runtimeFormulaVersion',p.formula_version,'inputDigest',j.input_digest,'outputDigest',j.output_digest,
  'setlistItemOutcomes',coalesce(x.setlist_item_outcomes,'[]'::jsonb),'stageActions',coalesce(x.stage_actions,'[]'::jsonb),
  'highlights',coalesce(x.generated_highlights,'[]'::jsonb),
  'band_id',p.band_id,'solo_artist_profile_id',p.solo_artist_profile_id,'npc_artist_id',p.npc_artist_id,
  'artist_name',p.artist_name,'billing_position',coalesce((p.engine_input_snapshot->>'billingPosition')::integer,0),
  'performance_score',p.performance_score,'technical_score',p.technical_score,'crowd_response',p.crowd_response)
 FROM public.festival_performance_simulation_jobs j
 LEFT JOIN public.festival_performance_simulation_results x ON x.runtime_performance_id=p.id
 WHERE j.runtime_performance_id=p.id
 UNION ALL
 SELECT jsonb_build_object(
  'id',p.id,'runtimePerformanceId',p.id,'runtimeDayId',p.runtime_day_id,'runtimeStageId',p.runtime_stage_id,'status',p.status,
  'artistType',CASE WHEN p.band_id IS NOT NULL THEN 'band' WHEN p.solo_artist_profile_id IS NOT NULL THEN 'solo' ELSE 'npc' END,
  'artistId',coalesce(p.band_id,p.solo_artist_profile_id,p.npc_artist_id),'bandId',p.band_id,'soloArtistProfileId',p.solo_artist_profile_id,
  'npcArtistId',p.npc_artist_id,'artistName',p.artist_name,'billingPosition',coalesce((p.engine_input_snapshot->>'billingPosition')::integer,0),
  'isHeadliner',coalesce((p.engine_input_snapshot->>'headlinerExpectation')::numeric,0)>0,'performanceScore',p.performance_score,
  'technicalScore',p.technical_score,'crowdResponse','{}'::jsonb,'attendance',coalesce(p.estimated_audience,0),
  'scheduledStart',p.scheduled_start,'scheduledEnd',p.scheduled_end,'actualStart',p.actual_start,'actualEnd',p.actual_end,
  'delayMinutes',p.delay_minutes,'canonicalEngineVersion',CASE WHEN p.engine_version='gig-v1' THEN 'canonical-gig-v1' ELSE p.engine_version END,
  'festivalAdapterVersion','festival-gig-adapter-v2','resultSchemaVersion','festival-performance-result-v1','runtimeFormulaVersion',p.formula_version,
  'inputDigest',NULL,'outputDigest',NULL,'setlistItemOutcomes','[]'::jsonb,'stageActions','[]'::jsonb,'highlights','[]'::jsonb,'band_id',p.band_id,'solo_artist_profile_id',p.solo_artist_profile_id,'npc_artist_id',p.npc_artist_id,
  'artist_name',p.artist_name,'billing_position',coalesce((p.engine_input_snapshot->>'billingPosition')::integer,0),
  'performance_score',p.performance_score,'technical_score',p.technical_score,'crowd_response',p.crowd_response)
 WHERE NOT EXISTS(SELECT 1 FROM public.festival_performance_simulation_jobs j WHERE j.runtime_performance_id=p.id)
 LIMIT 1
$$;

CREATE FUNCTION public._festival_runtime_outcome_projection(p_session uuid,p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$ BEGIN
 CASE p_kind
 WHEN 'attendance' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('runtimeDayId',x.runtime_day_id,'admittedCount',x.admitted_count,'exitedCount',x.exited_count,'onsiteCount',x.onsite_count,'capacity',x.capacity,'version',x.version,'updatedAt',x.updated_at) ORDER BY x.runtime_day_id) FROM public.festival_runtime_attendance x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'performances' THEN RETURN coalesce((SELECT jsonb_agg(public._festival_runtime_performance_projection(x) ORDER BY x.scheduled_start,x.id) FROM public.festival_runtime_performances x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'crowds' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('runtimeDayId',x.runtime_day_id,'allocatedCount',x.allocated_count,'unallocatedCount',x.unallocated_count,'satisfaction',x.satisfaction) ORDER BY x.runtime_day_id) FROM public.festival_runtime_crowds x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'stageCrowds' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('runtimeDayId',x.runtime_day_id,'runtimeStageId',x.runtime_stage_id,'currentCrowd',x.current_crowd,'stageCapacity',x.stage_capacity) ORDER BY x.runtime_day_id,x.runtime_stage_id) FROM public.festival_runtime_stage_crowds x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'crowdMovements' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'runtimeDayId',x.runtime_day_id,'fromStageId',x.from_stage_id,'toStageId',x.to_stage_id,'arrivals',x.arrivals,'departures',x.departures,'createdAt',x.created_at) ORDER BY x.created_at,x.id) FROM public.festival_runtime_crowd_movements x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'weather' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('runtimeDayId',x.runtime_day_id,'weatherState',x.weather_state,'temperatureBand',x.temperature_band,'groundCondition',x.ground_condition,'operationalImpact',x.operational_impact) ORDER BY x.runtime_day_id) FROM public.festival_runtime_weather x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'incidents' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'runtimeDayId',x.runtime_day_id,'runtimeStageId',x.runtime_stage_id,'category',x.category,'severity',x.severity,'status',x.status,'detectedAt',x.detected_at,'resolvedAt',x.resolved_at,'resolutionOutcome',x.resolution_outcome) ORDER BY x.detected_at,x.id) FROM public.festival_runtime_incidents x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'staffOutcomes' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'staffCheckinId',x.staff_checkin_id,'shiftCompletion',x.shift_completion,'roleEffectiveness',x.role_effectiveness,'latenessMinutes',x.lateness_minutes,'staff_checkin_id',x.staff_checkin_id,'shift_completion',x.shift_completion,'role_effectiveness',x.role_effectiveness,'lateness_minutes',x.lateness_minutes) ORDER BY x.id) FROM public.festival_runtime_staff_outcomes x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'supplierOutcomes' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'supplierCheckinId',x.supplier_checkin_id,'deliveryCompleteness',x.delivery_completeness,'productQuality',x.product_quality,'contractCompliance',x.contract_compliance,'latenessMinutes',x.lateness_minutes,'supplier_checkin_id',x.supplier_checkin_id,'delivery_completeness',x.delivery_completeness,'product_quality',x.product_quality,'contract_compliance',x.contract_compliance,'lateness_minutes',x.lateness_minutes) ORDER BY x.id) FROM public.festival_runtime_supplier_outcomes x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'sponsorActivations' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'contractDeliverableId',x.contract_deliverable_id,'status',x.status,'deliveryQuality',x.delivery_quality,'audienceExposure',x.audience_exposure,'contract_deliverable_id',x.contract_deliverable_id,'source_activation_id',x.source_activation_id,'delivery_quality',x.delivery_quality,'audience_exposure',x.audience_exposure) ORDER BY x.id) FROM public.festival_runtime_sponsor_activations x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'vendorSales' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'runtimeDayId',x.runtime_day_id,'category',x.category,'status',x.status,'currencyCode',x.currency_code,'grossRevenueMinor',x.gross_revenue_minor::text,'taxLiabilityMinor',x.tax_liability_minor::text,'costBasisMinor',x.cost_basis_minor::text,'unitsSold',x.units_sold) ORDER BY x.runtime_day_id,x.id) FROM public.festival_runtime_vendor_sales x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'revenuePostings' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'vendorSalesId',x.vendor_sales_id,'amountMinor',x.amount_minor::text,'currencyCode',x.currency_code,'postedAt',x.posted_at) ORDER BY x.posted_at,x.id) FROM public.festival_runtime_revenue_postings x JOIN public.festival_runtime_vendor_sales v ON v.id=x.vendor_sales_id WHERE v.runtime_session_id=p_session),'[]');
 WHEN 'headliners' THEN RETURN coalesce((SELECT jsonb_agg(public._festival_runtime_performance_projection(x) ORDER BY x.scheduled_start,x.id) FROM public.festival_runtime_performances x WHERE x.runtime_session_id=p_session AND coalesce((x.engine_input_snapshot->>'headlinerExpectation')::numeric,0)>0),'[]');
 WHEN 'timetable' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('runtimePerformanceId',x.id,'runtimeDayId',x.runtime_day_id,'runtimeStageId',x.runtime_stage_id,'scheduledStart',x.scheduled_start,'scheduledEnd',x.scheduled_end,'status',x.status) ORDER BY x.scheduled_start,x.id) FROM public.festival_runtime_performances x WHERE x.runtime_session_id=p_session),'[]');
 ELSE RAISE EXCEPTION 'festival_runtime_projection_unsupported'; END CASE;
 END $$;

CREATE FUNCTION public.assert_festival_runtime_outcome_v2(p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
 IF p_snapshot->>'schemaVersion'<>'festival-runtime-outcome-v2' THEN RAISE EXCEPTION 'festival_runtime_outcome_schema_unsupported'; END IF;
 IF p_snapshot->>'runtimeSessionId' IS NULL OR jsonb_typeof(p_snapshot->'performances')<>'array' THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
 END $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_runtime_outcomes(p_runtime_session_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_runtime_sessions%ROWTYPE; existing public.festival_runtime_outcome_snapshots%ROWTYPE; payload jsonb;snapshot jsonb;content_digest text;edition uuid;
BEGIN
 SELECT * INTO r FROM public.festival_runtime_sessions WHERE id=p_runtime_session_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'festival_runtime_chain_session'; END IF;
 IF NOT public._festival_runtime_owner(r.id,public._festival_runtime_actor()) THEN RAISE EXCEPTION 'festival_runtime_forbidden'; END IF;
 SELECT * INTO existing FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=r.id;
 IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('readyForSettlement',true,'outcomeDigest',existing.content_digest,'schemaVersion',existing.snapshot->>'schemaVersion','idempotent',true); END IF;
 IF r.version<>p_expected_version THEN RAISE EXCEPTION 'festival_runtime_stale'; END IF;
 IF r.status NOT IN('public_closed','site_clearance') OR r.gates_open
   OR EXISTS(SELECT 1 FROM public.festival_performance_simulation_jobs WHERE runtime_session_id=r.id AND status IN('pending','processing','failed','exhausted'))
   OR EXISTS(SELECT 1 FROM public.festival_runtime_performances WHERE runtime_session_id=r.id AND status NOT IN('completed','cancelled','abandoned'))
   OR EXISTS(SELECT 1 FROM public.festival_runtime_incidents WHERE runtime_session_id=r.id AND severity IN('major','critical') AND status NOT IN('resolved','handed_over'))
 THEN RAISE EXCEPTION 'festival_runtime_outcomes_blocked'; END IF;
 SELECT e.id INTO edition FROM public.festival_public_editions e WHERE e.festival_launch_id=r.festival_launch_id;
 payload:=jsonb_build_object('schemaVersion','festival-runtime-outcome-v2','engineVersion','canonical-gig-v1',
  'formulaVersions',jsonb_build_object('runtime',r.formula_version,'performance','festival-performance-result-v1','crowd','festival-crowd-largest-remainder-v2','settlement','festival-settlement-v1'),
  'runtimeSessionId',r.id,'festivalLaunchId',r.festival_launch_id,'festivalEditionId',edition,'createdAt',now(),
  'attendance',public._festival_runtime_outcome_projection(r.id,'attendance'),'performances',public._festival_runtime_outcome_projection(r.id,'performances'),
  'crowds',public._festival_runtime_outcome_projection(r.id,'crowds'),'stageCrowds',public._festival_runtime_outcome_projection(r.id,'stageCrowds'),
  'crowdMovements',public._festival_runtime_outcome_projection(r.id,'crowdMovements'),'weather',public._festival_runtime_outcome_projection(r.id,'weather'),
  'incidents',public._festival_runtime_outcome_projection(r.id,'incidents'),'staffOutcomes',public._festival_runtime_outcome_projection(r.id,'staffOutcomes'),
  'supplierOutcomes',public._festival_runtime_outcome_projection(r.id,'supplierOutcomes'),'sponsorActivations',public._festival_runtime_outcome_projection(r.id,'sponsorActivations'),
  'vendorSales',public._festival_runtime_outcome_projection(r.id,'vendorSales'),'revenuePostings',public._festival_runtime_outcome_projection(r.id,'revenuePostings'),
  'headliners',public._festival_runtime_outcome_projection(r.id,'headliners'),'timetable',public._festival_runtime_outcome_projection(r.id,'timetable'));
 content_digest:=encode(digest(payload::text,'sha256'),'hex'); snapshot:=payload||jsonb_build_object('contentDigest',content_digest);
 PERFORM public.assert_festival_runtime_outcome_v2(snapshot);
 INSERT INTO public.festival_runtime_outcome_snapshots(runtime_session_id,snapshot,engine_version,formula_versions,content_digest) VALUES(r.id,snapshot,'canonical-gig-v1',snapshot->'formulaVersions',content_digest);
 UPDATE public.festival_runtime_sessions SET status='runtime_complete',ready_for_settlement=true,completed_at=now(),gates_open=false,version=version+1,updated_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('readyForSettlement',true,'outcomeDigest',content_digest,'schemaVersion','festival-runtime-outcome-v2','idempotencyKey',p_idempotency_key,'idempotent',false);
END $$;

CREATE FUNCTION public._festival_settlement_runtime_contract_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE contract jsonb; BEGIN SELECT snapshot INTO contract FROM public.festival_runtime_outcome_snapshots WHERE runtime_session_id=NEW.runtime_session_id; PERFORM public.assert_festival_runtime_outcome_v2(contract); RETURN NEW; END $$;
CREATE TRIGGER festival_settlement_runtime_contract_guard BEFORE INSERT ON public.festival_financial_settlements FOR EACH ROW EXECUTE FUNCTION public._festival_settlement_runtime_contract_guard();

CREATE FUNCTION public.get_festival_simulation_worker_health() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_simulation_admin_required'; END IF;
 RETURN jsonb_build_object('pendingCount',(SELECT count(*) FROM public.festival_performance_simulation_jobs WHERE status='pending'),
 'processingCount',(SELECT count(*) FROM public.festival_performance_simulation_jobs WHERE status='processing'),'failedCount',(SELECT count(*) FROM public.festival_performance_simulation_jobs WHERE status='failed'),
 'exhaustedCount',(SELECT count(*) FROM public.festival_performance_simulation_jobs WHERE status='exhausted'),'oldestQueuedJob',(SELECT min(created_at) FROM public.festival_performance_simulation_jobs WHERE status IN('pending','failed')),
 'lastSuccessfulCompletion',(SELECT max(completed_at) FROM public.festival_performance_simulation_jobs WHERE status='completed'),'lastWorkerInvocation',(SELECT max(started_at) FROM public.festival_simulation_worker_invocations)); END $$;
CREATE FUNCTION public.get_exhausted_festival_simulation_jobs() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_simulation_admin_required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'runtimePerformanceId',runtime_performance_id,'attempts',attempts,'lastError',last_error,'createdAt',created_at) ORDER BY created_at) FROM public.festival_performance_simulation_jobs WHERE status='exhausted'),'[]'); END $$;
GRANT EXECUTE ON FUNCTION public.get_festival_simulation_worker_health(),public.get_exhausted_festival_simulation_jobs() TO authenticated;
REVOKE ALL ON FUNCTION public._festival_runtime_performance_projection(public.festival_runtime_performances),public._festival_runtime_outcome_projection(uuid,text),public.assert_festival_runtime_outcome_v2(jsonb) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public._festival_runtime_outcome_projection(uuid,text) IS 'Explicit projections for every festival-runtime-outcome-v2 collection; raw table rows are never the cross-phase API.';
