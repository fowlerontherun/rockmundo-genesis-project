-- Live repair applied on 2026-10-26: daily record sales stopped on 2026-10-13
-- because pg_cron was sending an anonymous bearer to a privileged edge function.
-- Do not store scheduler tokens or service-role keys in cron metadata.
ALTER TABLE public.privileged_job_window_claims DROP CONSTRAINT IF EXISTS privileged_job_window_allowed;
ALTER TABLE public.privileged_job_window_claims ADD CONSTRAINT privileged_job_window_allowed
 CHECK (job_name IN (
   'generate-gig-offers','generate-pr-offers','generate-radio-invitations',
   'complete-release-manufacturing','process-tour-travel','auto-complete-gigs',
   'generate-daily-sales'
 ));
CREATE OR REPLACE FUNCTION public.claim_privileged_job_window(p_job_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $claim$
DECLARE v_minutes integer; v_window timestamptz;
BEGIN
 v_minutes:=CASE p_job_name
 WHEN 'generate-gig-offers' THEN 360
 WHEN 'generate-pr-offers' THEN 360
 WHEN 'generate-radio-invitations' THEN 360
 WHEN 'complete-release-manufacturing' THEN 2
 WHEN 'process-tour-travel' THEN 60
 WHEN 'auto-complete-gigs' THEN 15
 WHEN 'generate-daily-sales' THEN 1440
 ELSE NULL END;
 IF v_minutes IS NULL THEN RAISE EXCEPTION 'unknown_internal_job_window'; END IF;
 v_window:=to_timestamp(floor(extract(epoch from clock_timestamp())/(v_minutes*60))*(v_minutes*60));
 INSERT INTO public.privileged_job_window_claims(job_name,window_started_at)
 VALUES(p_job_name,v_window) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('claimed',FOUND,'job_name',p_job_name,'window_started_at',v_window);
END $claim$;
REVOKE ALL ON FUNCTION public.claim_privileged_job_window(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_privileged_job_window(text) TO service_role;

DO $cron$ DECLARE v_job_id bigint; BEGIN
 SELECT jobid INTO STRICT v_job_id FROM cron.job WHERE jobname='generate-daily-sales';
 PERFORM cron.alter_job(v_job_id, command := $job$
   SELECT net.http_post(
     url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-daily-sales',
     headers := jsonb_build_object(
       'Content-Type','application/json',
       'x-cron-secret',(
         SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name='internal_cron_secret' LIMIT 1
       )
     ),
     body := jsonb_build_object('triggeredBy','pg_cron'),
     timeout_milliseconds := 120000
   );
 $job$);
END $cron$;
