-- #4305: one authenticated dispatcher tick per minute. The worker's
-- PostgreSQL claim enforces rate spacing and in-flight limits, even if
-- a manual invocation races with this cron. Secrets remain in Vault.
select cron.schedule('dispatch-ai-song-queue','* * * * *',$job$
 select net.http_post(
  url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-ai-song-queue',
  body := '{}'::jsonb,
  headers := jsonb_build_object('Content-Type','application/json',
    'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets
      where name='internal_cron_secret' limit 1)),
  timeout_milliseconds := 30000
 );
$job$);
