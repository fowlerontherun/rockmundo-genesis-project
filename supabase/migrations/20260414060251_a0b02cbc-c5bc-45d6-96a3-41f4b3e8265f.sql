-- Schedule auto-hype to run every 6 hours
SELECT cron.schedule(
  'auto-build-release-hype',
  '0 */6 * * *',
  'SELECT public.auto_build_release_hype()'
);