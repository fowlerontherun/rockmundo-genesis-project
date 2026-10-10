# Book attendance security rollout gate (#2652)

**Do not deploy the new endpoint guard alone.** The historical pg_cron job `daily-book-reading-attendance` in `20251011062941_5a0f65a9_3842_4c59_93f0_834091406436.sql` uses a public anon JWT and will receive HTTP 403 after the guard deploys.

The browser `useAutoBookReading` hook previously invoked the global function every 10 minutes; this branch removes that invocation.

## Before production rollout

1. Identify **all live callers**: pg_cron, job-runner metadata (`book_reading_attendance`), scheduled-activities function, and external monitors. Check actual deployed cron entries rather than assuming old migrations describe current jobs.
2. Move scheduled invocation credentials to a secret store; use the service-role token only from trusted server execution. Do **not** put service-role keys in source, migration SQL, browser code or logs. Reconfigure cron via an authenticated server-side dispatcher if vault/secret integration is not available.
3. Validate manual signed-in profile request, wrong-profile 403, no-token 401, anonymous non-manual 403, spoofed `triggeredBy` 403, and authorized scheduler success.
4. Verify a real scheduled run updates **only** eligible sessions once and that the job monitor reports success. Then rotate any exposed credentials if needed.

The separate non-transactional attendance bug remains open as #2651; this branch does **not** fix partially committed attendance or reconcile historical progress.
