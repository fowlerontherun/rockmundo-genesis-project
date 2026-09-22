-- Automatically process accepted major-event performances at their scheduled start time.
-- The anon key is read from Supabase Vault at runtime; no key is stored in source control.

DO $$
BEGIN
  PERFORM cron.unschedule('auto-major-events');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-major-events',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/auto-major-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'rockmundo_anon_key'
        LIMIT 1
      ),
      'apikey', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'rockmundo_anon_key'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);
