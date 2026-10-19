-- Production receipt 20261019112904. Replace six stored cron JWTs
-- with one Vault lookup evaluated at HTTP dispatch, preserving each job ID,
-- owner and cadence (each Edge endpoint verifies x-cron-secret in service SQL).
DO $reconfigure$
DECLARE x record; prev bigint; new_id bigint;
BEGIN
 IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name='internal_cron_secret' AND length(decrypted_secret)>=32)<>1
 THEN RAISE EXCEPTION 'internal_cron_secret_missing'; END IF;
 FOR x IN SELECT * FROM (VALUES
 (12,'generate-gig-offers-cron','0 */6 * * *','generate-gig-offers'),
 (49,'generate-pr-offers-cron','0 */6 * * *','generate-pr-offers'),
 (53,'generate-radio-invitations-cron','0 */6 * * *','generate-radio-invitations'),
 (47,'complete-release-manufacturing','*/2 * * * *','complete-release-manufacturing'),
 (64,'process-tour-travel-hourly','0 * * * *','process-tour-travel'),
 (45,'auto-complete-gigs','*/15 * * * *','auto-complete-gigs')
 ) AS jobs(id,job_name,cadence,slug)
 LOOP
 SELECT jobid INTO STRICT prev FROM cron.job WHERE jobname=x.job_name AND active;
 IF prev IS DISTINCT FROM x.id THEN RAISE EXCEPTION 'cron_identity_mismatch'; END IF;
 new_id:=cron.schedule(x.job_name,x.cadence,format(
 $job$SELECT net.http_post(
 url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/%s',
 headers:=jsonb_build_object('Content-Type','application/json',
 'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_cron_secret' LIMIT 1)),
 body:=jsonb_build_object('triggeredBy','pg_cron'),
 timeout_milliseconds:=120000);$job$,x.slug));
 IF new_id IS DISTINCT FROM prev THEN RAISE EXCEPTION 'cron_job_id_changed'; END IF;
 END LOOP;
END $reconfigure$;
UPDATE public.cron_job_config SET allow_manual_trigger=false,updated_at=now()
 WHERE edge_function_name IN ('generate-gig-offers','generate-pr-offers','generate-radio-invitations',
 'complete-release-manufacturing','process-tour-travel','auto-complete-gigs');
