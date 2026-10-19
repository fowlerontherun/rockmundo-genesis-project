-- #4242: retire the obsolete application scheduler/manual trigger.
-- The real radio engine is the active PostgreSQL job #55, running hourly.
UPDATE public.cron_job_config
SET is_active=false,
    allow_manual_trigger=false,
    schedule='0 * * * *',
    description='Legacy Edge/manual entry retired. Active radio rotation runs through SQL-only pg_cron job simulate-radio-plays-cron once per hour.',
    updated_at=now()
WHERE job_name='simulate-radio-plays';

-- Do not disable the real pg_cron job.
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.cron_job_config
  WHERE job_name='simulate-radio-plays'
    AND (is_active OR allow_manual_trigger)) THEN
   RAISE EXCEPTION 'Legacy radio manual scheduler remains enabled';
 END IF;
END;
$guard$;
