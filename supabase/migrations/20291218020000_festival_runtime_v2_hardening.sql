-- Forward-only runtime v2 hardening. Existing outcome and settlement rows remain immutable.
ALTER TABLE public.festival_runtime_staff_outcomes
  ADD COLUMN approved_overtime_minutes integer NOT NULL DEFAULT 0 CHECK (approved_overtime_minutes >= 0);
ALTER FUNCTION public._festival_runtime_outcome_projection(uuid,text) RENAME TO _festival_runtime_outcome_projection_v2_legacy;
CREATE FUNCTION public._festival_runtime_outcome_projection(p_session uuid,p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$ BEGIN
 CASE p_kind
 WHEN 'attendance' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'runtimeDayId',x.runtime_day_id,'admittedCount',x.admitted_count,'exitedCount',x.exited_count,'onsiteCount',x.onsite_count,'capacity',x.capacity,
   'admitted_count',x.admitted_count,'exited_count',x.exited_count,'onsite_count',x.onsite_count) ORDER BY x.runtime_day_id)
   FROM public.festival_runtime_attendance x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'vendorSales' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',x.id,'runtimeDayId',x.runtime_day_id,'category',x.category,'status',x.status,'currencyCode',x.currency_code,
   'grossRevenueMinor',x.gross_revenue_minor::text,'taxLiabilityMinor',x.tax_liability_minor::text,'costBasisMinor',x.cost_basis_minor::text,
   'unitsSold',x.units_sold,'openingStock',x.opening_stock,'remainingStock',x.remaining_stock,'wasteUnits',x.waste_units,
   'gross_revenue_minor',x.gross_revenue_minor::text,'tax_liability_minor',x.tax_liability_minor::text,'cost_basis_minor',x.cost_basis_minor::text,
   'units_sold',x.units_sold,'opening_stock',x.opening_stock,'remaining_stock',x.remaining_stock,'waste_units',x.waste_units,'currency_code',x.currency_code)
   ORDER BY x.runtime_day_id,x.id) FROM public.festival_runtime_vendor_sales x WHERE x.runtime_session_id=p_session),'[]');
 WHEN 'staffOutcomes' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',o.id,'staffCheckinId',o.staff_checkin_id,'expectedStart',c.expected_start,'expectedEnd',c.expected_end,
   'checkedInAt',c.checked_in_at,'checkedOutAt',c.checked_out_at,
   'workedMinutes',greatest(0,floor(extract(epoch FROM (coalesce(c.checked_out_at,c.checked_in_at)-c.checked_in_at))/60))::integer,
   'contractedMinutes',greatest(0,floor(extract(epoch FROM (c.expected_end-c.expected_start))/60))::integer,
   'approvedOvertimeMinutes',o.approved_overtime_minutes,
   'roleEffectiveness',o.role_effectiveness,'latenessMinutes',o.lateness_minutes,
   'staff_checkin_id',o.staff_checkin_id,'role_effectiveness',o.role_effectiveness,'lateness_minutes',o.lateness_minutes)
   ORDER BY o.id) FROM public.festival_runtime_staff_outcomes o JOIN public.festival_runtime_staff_checkins c ON c.id=o.staff_checkin_id WHERE o.runtime_session_id=p_session),'[]');
 WHEN 'supplierOutcomes' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',o.id,'supplierCheckinId',o.supplier_checkin_id,'deliveryCompleteness',o.delivery_completeness,'productQuality',o.product_quality,
   'contractCompliance',o.contract_compliance,'serviceQuality',o.service_quality,'latenessMinutes',o.lateness_minutes,
   'delivery_completeness',o.delivery_completeness,'product_quality',o.product_quality,'contract_compliance',o.contract_compliance,
   'service_quality',o.service_quality,'lateness_minutes',o.lateness_minutes,'formulaVersion',o.formula_version)
   ORDER BY o.id) FROM public.festival_runtime_supplier_outcomes o WHERE o.runtime_session_id=p_session),'[]');
 WHEN 'sponsorActivations' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',a.id,'contractId',d.sponsor_contract_id,'deliverableId',a.contract_deliverable_id,'status',a.status,
   'deliveryQuality',a.delivery_quality,'audienceExposure',a.audience_exposure,'milestones',coalesce(a.operational_issues,'[]'::jsonb),
   'contract_deliverable_id',a.contract_deliverable_id,'delivery_quality',a.delivery_quality,'audience_exposure',a.audience_exposure)
   ORDER BY a.id) FROM public.festival_runtime_sponsor_activations a LEFT JOIN public.festival_sponsor_deliverables d ON d.id=a.contract_deliverable_id WHERE a.runtime_session_id=p_session),'[]');
 ELSE RETURN public._festival_runtime_outcome_projection_v2_legacy(p_session,p_kind); END CASE;
END $$;
COMMENT ON FUNCTION public._festival_runtime_outcome_projection(uuid,text) IS 'Canonical v2 camelCase projection. Supplier serviceQuality is the persisted festival-supplier-v1 service_quality score; settlement never reconstructs or guesses it.';
REVOKE ALL ON FUNCTION public._festival_runtime_outcome_projection(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.assert_festival_runtime_outcome_v2(p_snapshot jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE collection text; item jsonb;
BEGIN
  IF jsonb_typeof(p_snapshot) <> 'object' THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  IF p_snapshot->>'schemaVersion' <> 'festival-runtime-outcome-v2' THEN RAISE EXCEPTION 'festival_runtime_outcome_schema_unsupported'; END IF;
  IF coalesce(p_snapshot->>'runtimeSessionId','') !~ '^[0-9a-fA-F-]{36}$'
     OR coalesce(p_snapshot->>'festivalLaunchId','') !~ '^[0-9a-fA-F-]{36}$'
     OR coalesce(p_snapshot->>'festivalEditionId','') !~ '^[0-9a-fA-F-]{36}$'
     OR coalesce(p_snapshot->>'contentDigest','') !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(p_snapshot->'formulaVersions') <> 'object'
     OR nullif(p_snapshot#>>'{formulaVersions,runtime}','') IS NULL
     OR nullif(p_snapshot#>>'{formulaVersions,performance}','') IS NULL
  THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;

  FOREACH collection IN ARRAY ARRAY['attendance','performances','crowds','stageCrowds','crowdMovements','weather','incidents','staffOutcomes','supplierOutcomes','sponsorActivations','vendorSales','revenuePostings','headliners','timetable'] LOOP
    IF jsonb_typeof(p_snapshot->collection) <> 'array' THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot->'attendance') LOOP
    IF coalesce(item->>'runtimeDayId','') !~ '^[0-9a-fA-F-]{36}$'
       OR jsonb_typeof(item->'admittedCount') <> 'number' OR jsonb_typeof(item->'exitedCount') <> 'number'
       OR jsonb_typeof(item->'onsiteCount') <> 'number' OR jsonb_typeof(item->'capacity') <> 'number'
       OR (item->>'onsiteCount')::bigint <> (item->>'admittedCount')::bigint-(item->>'exitedCount')::bigint
    THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot->'performances') LOOP
    IF coalesce(item->>'runtimePerformanceId','') !~ '^[0-9a-fA-F-]{36}$'
       OR item->>'status' NOT IN ('completed','cancelled','abandoned')
       OR nullif(item->>'artistId','') IS NULL OR nullif(item->>'canonicalEngineVersion','') IS NULL
       OR (item->>'status'='completed' AND (jsonb_typeof(item->'performanceScore') <> 'number'
           OR coalesce(item->>'inputDigest','') !~ '^[0-9a-f]{64}$' OR coalesce(item->>'outputDigest','') !~ '^[0-9a-f]{64}$'))
    THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot->'vendorSales') LOOP
    IF item->>'status'<>'closed' OR coalesce(item->>'currencyCode','') !~ '^[A-Z]{3}$'
       OR coalesce(item->>'grossRevenueMinor','') !~ '^-?[0-9]+$'
       OR coalesce(item->>'taxLiabilityMinor','') !~ '^-?[0-9]+$'
       OR coalesce(item->>'costBasisMinor','') !~ '^-?[0-9]+$'
       OR jsonb_typeof(item->'unitsSold')<>'number' OR jsonb_typeof(item->'openingStock')<>'number'
       OR jsonb_typeof(item->'remainingStock')<>'number' OR jsonb_typeof(item->'wasteUnits')<>'number'
    THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot->'staffOutcomes') LOOP
    IF coalesce(item->>'staffCheckinId','') !~ '^[0-9a-fA-F-]{36}$'
       OR jsonb_typeof(item->'workedMinutes')<>'number' OR jsonb_typeof(item->'contractedMinutes')<>'number'
       OR jsonb_typeof(item->'approvedOvertimeMinutes')<>'number' OR jsonb_typeof(item->'roleEffectiveness')<>'number'
       OR jsonb_typeof(item->'latenessMinutes')<>'number'
    THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_snapshot->'supplierOutcomes') LOOP
    IF coalesce(item->>'supplierCheckinId','') !~ '^[0-9a-fA-F-]{36}$'
       OR jsonb_typeof(item->'deliveryCompleteness')<>'number' OR jsonb_typeof(item->'productQuality')<>'number'
       OR jsonb_typeof(item->'contractCompliance')<>'number' OR jsonb_typeof(item->'serviceQuality')<>'number'
       OR jsonb_typeof(item->'latenessMinutes')<>'number' OR nullif(item->>'formulaVersion','') IS NULL
    THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
  END LOOP;
  IF EXISTS (SELECT value->>'runtimePerformanceId' FROM jsonb_array_elements(p_snapshot->'performances') GROUP BY 1 HAVING count(*)>1)
     OR EXISTS (SELECT value->>'id' FROM jsonb_array_elements(p_snapshot->'vendorSales') GROUP BY 1 HAVING count(*)>1)
     OR EXISTS (SELECT value->>'staffCheckinId' FROM jsonb_array_elements(p_snapshot->'staffOutcomes') GROUP BY 1 HAVING count(*)>1)
     OR EXISTS (SELECT value->>'supplierCheckinId' FROM jsonb_array_elements(p_snapshot->'supplierOutcomes') GROUP BY 1 HAVING count(*)>1)
  THEN RAISE EXCEPTION 'festival_runtime_outcome_contract_invalid'; END IF;
END $$;

CREATE FUNCTION public._assert_festival_runtime_finalisation_complete(p_runtime_session_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SET search_path='' AS $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.festival_runtime_days d WHERE d.runtime_session_id=p_runtime_session_id AND d.status NOT IN('completed','cancelled'))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_gate_sessions g WHERE g.runtime_session_id=p_runtime_session_id AND g.status<>'closed')
    OR EXISTS(SELECT 1 FROM public.festival_runtime_performances p WHERE p.runtime_session_id=p_runtime_session_id AND
       (p.status NOT IN('completed','cancelled','abandoned') OR (p.status IN('cancelled','abandoned') AND nullif(p.engine_result_snapshot->>'reason','') IS NULL)))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_days d WHERE d.runtime_session_id=p_runtime_session_id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_weather w WHERE w.runtime_day_id=d.id))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_days d JOIN public.festival_runtime_attendance a ON a.runtime_day_id=d.id WHERE d.runtime_session_id=p_runtime_session_id AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_crowds c WHERE c.runtime_day_id=d.id AND c.allocated_count+c.unallocated_count=a.onsite_count))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_crowds c WHERE c.runtime_session_id=p_runtime_session_id AND c.allocated_count<>(SELECT coalesce(sum(s.current_crowd),0) FROM public.festival_runtime_stage_crowds s WHERE s.runtime_day_id=c.runtime_day_id))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_staff_checkins c WHERE c.runtime_session_id=p_runtime_session_id AND c.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_staff_outcomes o WHERE o.staff_checkin_id=c.id))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_supplier_checkins c WHERE c.runtime_session_id=p_runtime_session_id AND c.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_supplier_outcomes o WHERE o.supplier_checkin_id=c.id))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_sponsor_activations a WHERE a.runtime_session_id=p_runtime_session_id AND a.status NOT IN('completed','partially_completed','failed','cancelled'))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_vendor_sales v WHERE v.runtime_session_id=p_runtime_session_id AND (v.status<>'closed' OR (v.gross_revenue_minor>0 AND NOT EXISTS(SELECT 1 FROM public.festival_runtime_revenue_postings r WHERE r.vendor_sales_id=v.id))))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_incidents i WHERE i.runtime_session_id=p_runtime_session_id AND i.severity IN('major','critical') AND i.status NOT IN('resolved','handed_over'))
    OR EXISTS(SELECT 1 FROM public.festival_runtime_jobs j WHERE j.runtime_session_id=p_runtime_session_id AND j.job_type IN('close_gates','close_stage','close_public_site','complete_runtime') AND j.status NOT IN('completed','paused'))
  THEN RAISE EXCEPTION 'festival_runtime_outcomes_blocked'; END IF;
END $$;

ALTER FUNCTION public.finalise_festival_runtime_outcomes(uuid,integer,uuid) RENAME TO _finalise_festival_runtime_outcomes_v2_unchecked;
CREATE FUNCTION public.finalise_festival_runtime_outcomes(p_runtime_session_id uuid,p_expected_version integer,p_idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM public._assert_festival_runtime_finalisation_complete(p_runtime_session_id);
  RETURN public._finalise_festival_runtime_outcomes_v2_unchecked(p_runtime_session_id,p_expected_version,p_idempotency_key);
END $$;
REVOKE ALL ON FUNCTION public._assert_festival_runtime_finalisation_complete(uuid),public._finalise_festival_runtime_outcomes_v2_unchecked(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_festival_runtime_outcomes(uuid,integer,uuid) TO authenticated;

-- Scheduling is opt-in for local databases. Hosted deployment sets the flag and Vault secrets.
CREATE FUNCTION public.invoke_festival_performance_worker() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE endpoint text; secret text;
BEGIN
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1' INTO secret USING 'festival_performance_worker_secret';
  endpoint := current_setting('app.festival_worker_url',true);
  IF nullif(endpoint,'') IS NULL OR nullif(secret,'') IS NULL THEN RAISE EXCEPTION 'festival_worker_configuration_missing'; END IF;
  EXECUTE 'SELECT net.http_post(url := $1, headers := jsonb_build_object(''authorization'',''Bearer ''||$2), body := ''{}''::jsonb)' USING endpoint,secret;
END $$;
REVOKE ALL ON FUNCTION public.invoke_festival_performance_worker() FROM PUBLIC,anon,authenticated;

DO $$ BEGIN
  IF coalesce(current_setting('app.enable_festival_worker_schedule',true),'false')::boolean THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='festival-performance-worker-every-minute') THEN
      PERFORM cron.schedule('festival-performance-worker-every-minute','* * * * *','SELECT public.invoke_festival_performance_worker()');
    END IF;
  END IF;
END $$;

CREATE FUNCTION public.verify_festival_performance_worker_schedule() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE enabled boolean:=coalesce(current_setting('app.enable_festival_worker_schedule',true),'false')::boolean; present boolean:=false;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname=$1 AND schedule=$2 AND active)' INTO present
      USING 'festival-performance-worker-every-minute','* * * * *';
  END IF;
  RETURN jsonb_build_object('supported',to_regclass('cron.job') IS NOT NULL,'enabled',enabled,'scheduleExists',present,
    'valid',CASE WHEN enabled THEN present ELSE true END);
END $$;
REVOKE ALL ON FUNCTION public.verify_festival_performance_worker_schedule() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_festival_performance_worker_schedule() TO service_role;

COMMENT ON FUNCTION public.invoke_festival_performance_worker() IS 'Minute scheduler target. URL is a database setting and bearer token is read from Supabase Vault; neither is stored in migration source.';
