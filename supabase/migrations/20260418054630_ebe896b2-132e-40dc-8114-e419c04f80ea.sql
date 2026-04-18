-- 1. Add percent column (0-100)
ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS weekly_pay_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.bands
DROP CONSTRAINT IF EXISTS bands_weekly_pay_percent_range;

ALTER TABLE public.bands
ADD CONSTRAINT bands_weekly_pay_percent_range
CHECK (weekly_pay_percent >= 0 AND weekly_pay_percent <= 100);

COMMENT ON COLUMN public.bands.weekly_pay_percent IS
'Percentage (0-100) of band balance paid out weekly, split equally among real player members. Paid Saturdays at 10:00 UTC.';

-- 2. Reschedule cron: Saturday 10:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('process-weekly-band-pay');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process-weekly-band-pay',
  '0 10 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-weekly-band-pay',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);