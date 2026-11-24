CREATE OR REPLACE FUNCTION public.get_canonical_festival_live_day_availability(p_company_id uuid,p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 PERFORM public.get_simplified_festival_run_readiness(p_company_id,p_edition_id);
 RETURN jsonb_build_object('canOpen',false,'managed',false,'canAllocate',false,'liveDaySupported',false);
END;
$$;
REVOKE ALL ON FUNCTION public.get_canonical_festival_live_day_availability(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_canonical_festival_live_day_availability(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';