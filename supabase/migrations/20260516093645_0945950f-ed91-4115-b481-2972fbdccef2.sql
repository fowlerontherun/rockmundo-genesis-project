do $$
begin
  if exists (select 1 from cron.job where jobname='acting-daily-tick') then
    perform cron.unschedule('acting-daily-tick');
  end if;
end $$;

select cron.schedule(
  'acting-daily-tick',
  '0 3 * * *',
  $$
  select net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/acting-daily-tick',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);