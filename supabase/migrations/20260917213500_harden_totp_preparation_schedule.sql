-- Harden Top of the Pops automatic preparation.
-- Preparation is idempotent, so retrying Tuesday/Wednesday is safe and prevents one missed
-- Monday cron execution from cancelling an entire fortnightly show.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prepare_top_of_the_pops',
      '0 9 * * 1-3',
      $cron$SELECT public.totp_prepare_next_episode();$cron$
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.totp_prepare_next_episode() IS
  'Idempotently prepares the next scheduled TOTP Thursday. Invoked at 09:00 UTC Monday-Wednesday so Tuesday/Wednesday recover a missed preparation run.';
