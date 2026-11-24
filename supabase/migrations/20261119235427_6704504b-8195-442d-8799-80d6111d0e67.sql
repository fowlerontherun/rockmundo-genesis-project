BEGIN;
ALTER FUNCTION public._simplified_festival_run_readiness(uuid,uuid) RENAME TO _simplified_festival_run_readiness_before_final_day_guard;
REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness_before_final_day_guard(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public._simplified_festival_run_readiness(p_festival_company_id uuid,p_festival_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE result jsonb; e public.festival_editions_v2%ROWTYPE; zone text; blockers jsonb;
BEGIN
 result:=public._simplified_festival_run_readiness_before_final_day_guard(p_festival_company_id,p_festival_edition_id);
 IF coalesce((result->>'alreadyRun')::boolean,false) THEN RETURN result; END IF;
 SELECT * INTO e FROM public.festival_editions_v2 WHERE id=p_festival_edition_id AND festival_company_id=p_festival_company_id;
 SELECT c.timezone INTO zone FROM public.cities c WHERE c.id=e.city_id AND EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names tz WHERE tz.name=c.timezone);
 blockers:=coalesce(result->'blockers','[]'::jsonb);
 IF e.ends_on IS NOT NULL AND (zone IS NULL OR (now() AT TIME ZONE zone)::date <= e.ends_on) THEN
  blockers:=blockers||jsonb_build_array(jsonb_build_object('code','festival_final_results_not_due','message','Final results become available after the final festival day in the festival city.'));
 END IF;
 RETURN result||jsonb_build_object('blockers',blockers,'canRun',jsonb_array_length(blockers)=0);
END;
$$;
REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.get_canonical_festival_live_day_availability(p_company_id uuid,p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=public._caller_profile_id();
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL OR NOT coalesce(public._festival_edition_runtime_authorised(p_company_id,p_edition_id,actor),false) THEN RAISE EXCEPTION 'festival_runtime_forbidden'; END IF;
 -- The deployed database has no canonical stage/crowd ledgers or live-day receipt table.
 -- Do not falsely advertise writable live controls or label simplified results as live.
 RETURN jsonb_build_object('canOpen',false,'managed',false,'canAllocate',false,'liveDaySupported',false);
END;
$$;
REVOKE ALL ON FUNCTION public.get_canonical_festival_live_day_availability(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_canonical_festival_live_day_availability(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;