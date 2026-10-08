-- Repair canonical festival operations projection used by the London fixture and owner dashboard.

CREATE OR REPLACE FUNCTION public.festival_edition_operations_summary(p_edition_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  WITH e AS (SELECT * FROM public.festival_editions WHERE id=p_edition_id),
  slots AS (
    SELECT sl.*, sa.id system_act_id, sa.display_name system_act_name, sa.status system_act_status,
      coalesce(sl.reservation_metadata->>'contract_status', CASE WHEN sa.id IS NOT NULL THEN 'published' END) contract_status
    FROM public.festival_stage_slots sl
    LEFT JOIN public.festival_system_acts sa ON sa.slot_id=sl.id AND sa.edition_id=sl.edition_id
    WHERE sl.edition_id=p_edition_id AND sl.archived_at IS NULL
  ), ticket AS (
    SELECT coalesce((e.lifecycle_metadata->'ticket_summary'->>'capacity')::integer,e.capacity,0) capacity,
      coalesce((e.lifecycle_metadata->'ticket_summary'->>'tickets_sold')::integer,0) tickets_sold,
      coalesce(e.lifecycle_metadata->'ticket_summary'->'tiers','[]'::jsonb) tiers
    FROM e
  )
  SELECT jsonb_build_object(
    'edition_id',p_edition_id,
    'festival_id',(SELECT festival_id FROM e),
    'festival_name',(SELECT f.name FROM public.festivals f JOIN e ON e.festival_id=f.id),
    'venue_name',(SELECT v.name FROM public.venues v JOIN e ON e.venue_id=v.id),
    'stages',(SELECT coalesce(jsonb_agg(to_jsonb(st) ORDER BY st.stage_number),'[]'::jsonb) FROM public.festival_stages st WHERE st.edition_id=p_edition_id AND st.archived_at IS NULL),
    'slots',(SELECT coalesce(jsonb_agg(to_jsonb(sl) || jsonb_build_object('system_act_id',sl.system_act_id,'system_act_name',sl.system_act_name,'contract_status',sl.contract_status) ORDER BY sl.day_number, sl.start_time),'[]'::jsonb) FROM slots sl),
    'staff',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.role, s.name),'[]'::jsonb) FROM public.festival_staff s WHERE s.edition_id=p_edition_id),
    'permit_requirements',public.festival_edition_permit_requirements(p_edition_id),
    'staffing_readiness',public.festival_edition_staffing_readiness(p_edition_id),
    'insurance_policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM public.festival_insurance_policies p WHERE p.edition_id=p_edition_id),
    'ticket_summary',(SELECT jsonb_build_object('capacity',capacity,'tickets_sold',tickets_sold,'tiers',tiers) FROM ticket),
    'ticketing',(SELECT jsonb_build_object('capacity',capacity,'tickets_sold',tickets_sold,'tiers',tiers) FROM ticket),
    'tickets_sold',(SELECT tickets_sold FROM ticket),
    'schedule_summary',(SELECT jsonb_build_object('total_slots',count(*),'occupied_slots',count(*) FILTER (WHERE system_act_id IS NOT NULL OR reservation_metadata ? 'system_act_id'),'contracted_acts',count(*) FILTER (WHERE contract_status IN ('signed','accepted')),'published_acts',count(*) FILTER (WHERE system_act_id IS NOT NULL)) FROM slots),
    'finance',public.festival_edition_finance_summary(p_edition_id),
    'data_health',public.festival_data_health(p_edition_id)
  );
$$;

REVOKE ALL ON FUNCTION public.festival_edition_operations_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.festival_edition_operations_summary(uuid) TO authenticated, service_role;
