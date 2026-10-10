-- Schedule daily reading with a secret resolved at execution time.
-- Requires the Edge Function's x-cron-secret verifier to be deployed first.
-- No credential is persisted in cron.job or migration source.
SELECT cron.schedule(
  'daily-book-reading-attendance',
  '0 23 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/book-reading-attendance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'internal_cron_secret' LIMIT 1
        )
      ),
      body := jsonb_build_object('triggeredBy', 'daily-book-reading-attendance')
    );
  $job$
);
