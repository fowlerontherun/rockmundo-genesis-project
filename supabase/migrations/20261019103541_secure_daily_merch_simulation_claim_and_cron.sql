-- Receipt 20261019103541: #4249 production daily simulation claim.
-- ONE service-role-authorized UTC day, preserving completed historical runs.
CREATE TABLE IF NOT EXISTS public.merch_sales_simulation_runs (
  sales_day date primary key,
  run_id uuid not null unique default gen_random_uuid(),
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  orders_recorded integer not null default 0 check (orders_recorded>=0),
  failure_note text
);
ALTER TABLE public.merch_sales_simulation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merch_sales_simulation_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.merch_sales_simulation_runs TO service_role;

-- Import successful daily-run claims before cutover, especially the 883
-- already-committed simulated sales on 2026-10-19 (06:00 UTC).
INSERT INTO public.merch_sales_simulation_runs
  (sales_day,status,started_at,completed_at,orders_recorded)
SELECT DISTINCT ON ((started_at AT TIME ZONE 'UTC')::date)
  (started_at AT TIME ZONE 'UTC')::date,'completed',
  started_at,completed_at,greatest(0,coalesce(processed_count,0))
FROM public.cron_job_runs
WHERE job_name='simulate-merch-sales' AND status='success'
  AND started_at >= now()-interval '60 days'
ORDER BY (started_at AT TIME ZONE 'UTC')::date,started_at DESC
ON CONFLICT (sales_day) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_daily_merch_simulation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date:=(now() at time zone 'UTC')::date;
  v_claim public.merch_sales_simulation_runs%rowtype;
begin
  if (now() at time zone 'UTC')::time < time '06:00' then
    return jsonb_build_object('claimed',false,'reason','before_utc_06');
  end if;
  insert into public.merch_sales_simulation_runs(sales_day,status)
  values (v_today,'running')
  on conflict (sales_day) do nothing
  returning * into v_claim;
  if found then
    return jsonb_build_object('claimed',true,'run_id',v_claim.run_id,'sales_day',v_claim.sales_day);
  end if;
  return jsonb_build_object('claimed',false,'reason','already_claimed');
end
$function$
;
CREATE OR REPLACE FUNCTION public.finish_daily_merch_simulation(p_run_id uuid, p_status text, p_orders integer DEFAULT 0, p_failure_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_run_id is null or p_status not in ('completed','failed')
    or p_orders is null or p_orders<0 then
    raise exception 'merch_simulation_invalid_finish'; end if;
  update public.merch_sales_simulation_runs
  set status=p_status,orders_recorded=p_orders,
      completed_at=now(),failure_note=left(p_failure_note,800)
  where run_id=p_run_id and status='running';
  return found;
end
$function$
;
REVOKE ALL ON FUNCTION public.claim_daily_merch_simulation()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_daily_merch_simulation(uuid,text,integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_merch_simulation() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_daily_merch_simulation(uuid,text,integer,text) TO service_role;

-- Existing daily cron job #62 keeps the 06:00 UTC cadence; runtime Vault
-- lookup replaces any persisted JWT or literal secret in its job command.
DO $cron$
DECLARE v_original bigint; v_new bigint;
BEGIN
  SELECT jobid INTO STRICT v_original FROM cron.job
    WHERE jobname='simulate-merch-sales-daily' AND active=true;
  IF (SELECT count(*) FROM vault.decrypted_secrets
      WHERE name='internal_cron_secret' AND length(decrypted_secret)>=32)<>1
  THEN RAISE EXCEPTION 'merch_cron_secret_missing_or_invalid'; END IF;
  v_new:=cron.schedule('simulate-merch-sales-daily','0 6 * * *',
    $cmd$SELECT net.http_post(
      url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/simulate-merch-sales',
      headers:=jsonb_build_object('Content-Type','application/json',
        'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets
                         WHERE name='internal_cron_secret' LIMIT 1)),
      body:=jsonb_build_object('triggeredBy','pg_cron'),
      timeout_milliseconds:=120000
    );$cmd$);
  IF v_new IS DISTINCT FROM v_original THEN
    RAISE EXCEPTION 'merch_cron_job_replaced_%_%',v_original,v_new;
  END IF;
END $cron$;
