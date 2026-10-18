-- Syntax-only check for nested dollar-quoted pg_cron commands.
-- The false branch is parsed by PL/pgSQL but never schedules a job.
BEGIN;
DO $parse$
BEGIN
 IF FALSE THEN
  PERFORM cron.schedule(
    'weekly_experience_bonus_parser_fixture',
    '15 5 * * 1',
    $cron_command$SELECT public.process_weekly_experience_bonus();$cron_command$
  );
 END IF;
END $parse$;
ROLLBACK;

-- On a fully rebuilt clean database the historic migration should have
-- installed the original job once; this query never runs on production.
DO $verify$
BEGIN
 IF to_regprocedure('public.process_weekly_experience_bonus()') IS NULL THEN
  RAISE EXCEPTION 'Weekly XP bonus function missing after clean migration reset';
 END IF;
 IF (SELECT count(*) FROM cron.job WHERE jobname='weekly_experience_bonus')<>1 THEN
  RAISE EXCEPTION 'Expected one weekly XP cron after migration reset';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM cron.job
  WHERE jobname='weekly_experience_bonus'
    AND command='SELECT public.process_weekly_experience_bonus();'
    AND schedule='15 5 * * 1'
 ) THEN
  RAISE EXCEPTION 'Weekly XP job command or schedule differs from migration';
 END IF;
END $verify$;
