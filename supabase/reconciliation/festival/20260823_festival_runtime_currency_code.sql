-- Production-forward reconciliation: project the exact annual edition currency into the simplified Festival runtime.

CREATE OR REPLACE FUNCTION public._festival_runtime_projection(p_runtime_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.festival_edition_runtimes%ROWTYPE;
  stages jsonb;
  role_name text := 'manager';
  v_currency text := 'GBP';
BEGIN
  SELECT * INTO r FROM public.festival_edition_runtimes WHERE id = p_runtime_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(tp.currency_code, 'GBP') INTO v_currency
  FROM public.festival_ticket_plans tp
  WHERE tp.festival_edition_id = r.edition_id
  LIMIT 1;
  v_currency := coalesce(v_currency, 'GBP');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',s->>'id','name',s->>'name',
    'status',CASE WHEN r.state='completed' THEN 'completed' ELSE 'ready' END,
    'currentArtist',NULL,'nextArtist',NULL,'delayMinutes',0,'artistReady',true
  ) ORDER BY coalesce((s->>'sortOrder')::int,0)),'[]'::jsonb)
  INTO stages
  FROM jsonb_array_elements(coalesce(r.generated_schedule->'stages','[]'::jsonb)) s;

  RETURN jsonb_build_object(
    'runtimeId',r.id,'festivalCompanyId',r.festival_company_id,'editionId',r.edition_id,
    'currencyCode',v_currency,'state',r.state,'version',r.version,'simulatedTime',r.simulated_time,
    'gates',jsonb_build_object('status',CASE WHEN r.state IN ('gates_open','live') THEN 'open' WHEN r.state='paused' THEN 'paused' ELSE 'closed' END,'queueSize',0,'waitMinutes',0),
    'attendance',jsonb_build_object('expected',r.expected_attendance,'admitted',r.admitted_attendance,'onsite',r.site_attendance,'departed',r.departed_attendance,'capacity',r.site_capacity),
    'weather',coalesce((r.weather_sequence->0),jsonb_build_object('condition','clear','temperatureC',18,'warning',NULL)),
    'readiness',jsonb_build_object('staff',r.staff_readiness,'suppliers',r.supplier_readiness,'sponsors',r.sponsor_readiness),
    'stages',stages,'incidents','[]'::jsonb,'sales',r.sales_snapshot,'satisfaction',r.satisfaction_snapshot,'blockers','[]'::jsonb,
    'recentEvents',jsonb_build_array(jsonb_build_object('id',r.id::text||'-completed','occurredAt',coalesce(r.completed_at,r.updated_at),'message',CASE WHEN r.state='completed' THEN 'Festival completed successfully.' ELSE 'Festival runtime prepared.' END)),
    'permissions',jsonb_build_object('role',role_name,'actions',CASE WHEN r.state='completed' THEN '[]'::jsonb ELSE jsonb_build_array('view') END)
  );
END
$function$;

NOTIFY pgrst, 'reload schema';
