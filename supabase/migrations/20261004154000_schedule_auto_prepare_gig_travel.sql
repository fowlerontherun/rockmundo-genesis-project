-- Ensure VIP/automatic gig travel is prepared before show time.
-- The concierge function deliberately waits until travel is near its required
-- departure window, so it must be polled independently of gig auto-start.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-prepare-gig-travel') THEN
    PERFORM cron.unschedule('auto-prepare-gig-travel');
  END IF;

  PERFORM cron.schedule(
    'auto-prepare-gig-travel',
    '*/5 * * * *',
    'SELECT public.auto_prepare_gig_travel();'
  );
END
$$;
