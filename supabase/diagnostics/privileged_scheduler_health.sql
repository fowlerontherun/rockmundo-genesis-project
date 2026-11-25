-- Read-only operational preflight for #4228 and #4255.
-- Safe for production: no job commands, Vault contents, player identifiers,
-- request payloads, or manual worker executions are returned.
SELECT
  job_name,
  count(*) AS runs_14d,
  max(created_at) AS last_dispatched_at,
  count(*) FILTER (WHERE status = 'success') AS reported_successes,
  count(*) FILTER (WHERE status = 'error') AS reported_failures,
  coalesce(sum(error_count), 0) AS failed_items
FROM public.cron_job_runs
WHERE created_at >= now() - interval '14 days'
  AND job_name IN (
    'generate-gig-offers', 'generate-pr-offers',
    'generate-radio-invitations', 'complete-release-manufacturing',
    'process-tour-travel', 'auto-complete-gigs', 'university-attendance'
  )
GROUP BY job_name
ORDER BY job_name;

-- A missing source must not be treated as a healthy successful offer run.
SELECT
  (SELECT count(*) FROM public.promoters WHERE active IS TRUE) AS active_promoters,
  (SELECT count(*) FROM public.venues) AS venues,
  (SELECT count(*) FROM public.bands WHERE fame >= 100) AS eligible_bands;
