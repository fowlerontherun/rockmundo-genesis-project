-- Process arrival notices daily to include students enrolling mid-residency.
DO $job$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'travelling_professor_arrivals',
      '15 0 * * *',
      $command$SELECT public.announce_travelling_professors((now() AT TIME ZONE 'UTC')::date);$command$
    );
  END IF;
END
$job$;
