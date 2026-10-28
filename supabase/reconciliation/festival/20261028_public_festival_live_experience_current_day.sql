-- Festival V2 public crowd projection reconciliation (2026-10-28).
-- Apply only to environments that already have the full festival runtime
-- foundation and the 8B crowd/operations tables. Fresh installations use
-- the corrected definition in the original festival operations migration.
--
-- The currently connected RockMundo database has neither the runtime tables
-- nor this RPC; this reconciliation script MUST NOT be applied there yet.
-- SECURITY DEFINER, search_path and existing function grants are retained.
-- The query returns only the public-safe fields already exposed previously.
DO $festival_check$
BEGIN
  IF to_regclass('public.festival_runtime_stage_crowds') IS NULL
     OR to_regclass('public.festival_runtime_days') IS NULL
     OR to_regprocedure('public.get_public_festival_live_status(text)') IS NULL THEN
    RAISE EXCEPTION 'festival_runtime_prerequisites_missing';
  END IF;
END;
$festival_check$;

CREATE OR REPLACE FUNCTION public.get_public_festival_live_experience(p_public_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT public.get_public_festival_live_status(p_public_slug)||jsonb_build_object('weather',(SELECT jsonb_build_object('state',w.weather_state,'groundCondition',w.ground_condition) FROM public.festival_runtime_weather w JOIN public.festival_runtime_days d ON d.id=w.runtime_day_id WHERE w.runtime_session_id=r.id ORDER BY abs(d.festival_date-current_date) LIMIT 1),'stageCrowds',(SELECT coalesce(jsonb_agg(jsonb_build_object('stageId',c.runtime_stage_id,'stageName',s.stage_name,'festivalDate',d.festival_date,'lastCalculatedAt',c.last_calculated_at,'crowdBand',CASE WHEN c.current_crowd>=c.stage_capacity THEN 'full' WHEN c.current_crowd>=c.stage_capacity*.9 THEN 'near_capacity' WHEN c.current_crowd>=c.stage_capacity*.7 THEN 'very_busy' WHEN c.current_crowd>=c.stage_capacity*.4 THEN 'busy' WHEN c.current_crowd>=c.stage_capacity*.15 THEN 'building' ELSE 'quiet' END,'mood',c.mood,'stageStatus',s.status) ORDER BY s.stage_name),'[]') FROM public.festival_runtime_stage_crowds c JOIN public.festival_runtime_stages s ON s.id=c.runtime_stage_id AND s.runtime_session_id=r.id JOIN public.festival_runtime_days d ON d.id=c.runtime_day_id AND d.runtime_session_id=r.id WHERE c.runtime_session_id=r.id AND d.festival_date=current_date),'incidents',(SELECT coalesce(jsonb_agg(jsonb_build_object('message',i.public_safe_summary,'severity',i.severity)),'[]') FROM public.festival_runtime_incidents i WHERE i.runtime_session_id=r.id AND i.status NOT IN('resolved','handed_over')),'sponsors',(SELECT coalesce(jsonb_agg(jsonb_build_object('type',x.activation_type,'placement',x.placement,'status',x.status)),'[]') FROM public.festival_runtime_sponsor_activations x WHERE x.runtime_session_id=r.id AND x.public_visibility),'availability',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',v.category,'available',v.remaining_stock>0)),'[]') FROM public.festival_runtime_vendor_sales v WHERE v.runtime_session_id=r.id AND v.status='open')) FROM public.festival_runtime_sessions r JOIN public.festival_public_editions e ON e.festival_launch_id=r.festival_launch_id WHERE e.slug=p_public_slug$$;
