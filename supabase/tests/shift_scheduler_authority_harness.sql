-- #4215: safe to run against production. Never reveal Vault secret,
-- invoke the endpoint, or settle any player shift.
BEGIN;
DO $verify$
DECLARE
 v_job record;
 v_good boolean;
 v_bad boolean;
 v_null boolean;
BEGIN
 SELECT jobid,active,schedule,username,command INTO STRICT v_job
 FROM cron.job WHERE jobname='auto-clock-out-shifts';
 IF v_job.jobid<>5 OR NOT v_job.active OR v_job.schedule<>'*/15 * * * *'
 OR v_job.username<>'postgres'
 THEN RAISE EXCEPTION 'shift_cron_schedule_or_owner_drift'; END IF;
 IF v_job.command NOT ILIKE '%vault.decrypted_secrets%'
 OR v_job.command NOT ILIKE '%x-cron-secret%'
 OR v_job.command NOT ILIKE '%net.http_post%'
 OR v_job.command ILIKE '%authorization%'
 OR v_job.command ILIKE '%Bearer %'
 OR v_job.command ILIKE '%eyJ%'
 THEN RAISE EXCEPTION 'shift_cron_credential_or_command_drift'; END IF;
 SELECT public.verify_internal_cron_secret(null) INTO v_null;
 SELECT public.verify_internal_cron_secret('incorrect-cron-secret-must-be-rejected-0123456789') INTO v_bad;
 SELECT public.verify_internal_cron_secret(
   (select decrypted_secret from vault.decrypted_secrets
    where name='internal_cron_secret')
 ) INTO v_good;
 IF v_null IS DISTINCT FROM false OR v_bad IS DISTINCT FROM false
 OR v_good IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'shift_cron_auth_validation_incorrect'; END IF;
 IF has_function_privilege('anon','public.verify_internal_cron_secret(text)','execute')
 OR has_function_privilege('authenticated','public.verify_internal_cron_secret(text)','execute')
 OR has_function_privilege('anon','public.settle_work_shift_atomic(uuid,uuid)','execute')
 OR has_function_privilege('authenticated','public.settle_work_shift_atomic(uuid,uuid)','execute')
 OR NOT has_function_privilege('service_role','public.settle_work_shift_atomic(uuid,uuid)','execute')
 THEN RAISE EXCEPTION 'shift_privileged_rpc_grant_drift'; END IF;
END
$verify$;
ROLLBACK;
SELECT 'shift_scheduler_authority_contract_passed' AS result;
