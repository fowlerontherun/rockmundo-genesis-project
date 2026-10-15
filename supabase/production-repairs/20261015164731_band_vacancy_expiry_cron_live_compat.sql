-- Durable expiry for open vacancy deadlines; service-only, no payouts.
-- band_membership_offers is missing in production, so deliberately skip it.
BEGIN;
DO $schedule$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='rockmundo-band-vacancy-expiry') THEN
   PERFORM cron.schedule('rockmundo-band-vacancy-expiry','*/15 * * * *',
                         'SELECT public.expire_band_recruitment_records()');
 END IF;
END;
$schedule$;
COMMIT;