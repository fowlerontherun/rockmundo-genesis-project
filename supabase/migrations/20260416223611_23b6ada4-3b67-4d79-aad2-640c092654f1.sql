-- One-time backfill so the dashboard immediately reflects pending tax for any company with recent revenue
SELECT public.generate_pending_company_taxes();

-- Daily cron at 03:00 UTC to bill new months as they begin
SELECT cron.schedule(
  'generate-company-taxes-daily',
  '0 3 * * *',
  $$ SELECT public.generate_pending_company_taxes(); $$
);