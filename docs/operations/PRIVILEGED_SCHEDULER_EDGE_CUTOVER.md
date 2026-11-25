# Privileged scheduler Edge cutover — review and rollback gate

Status: **prepared, not deployed**. Issues: #4228 (university attendance),
#4255 (six privileged lifecycle workers). Never use this procedure to run a
global worker manually, force a game reward, or replay missed economy work.

## Read-only production audit — 25 November 2026

Project: RockMundo `yztogmdixmchsmimtent`.

The repository handlers for six lifecycle jobs import
`_shared/trusted-scheduler.ts` and verify an internal Vault secret **before**
reading the request payload, logging a run or accessing global data. They then
claim a unique scheduled window in `public.claim_privileged_job_window`.
However, a direct comparison with the **currently deployed** Supabase Edge
function sources found that the six deployed handlers do **not** contain the
corresponding secret/claim guard. Git commits alone have not secured the live
endpoints. They must be redeployed and checked.

| Worker | Active Vault-backed cron | Repository guard | Deployed guard |
| --- | --- | --- | --- |
| `generate-gig-offers` | yes, every 6 hours | yes | missing |
| `generate-pr-offers` | yes, every 6 hours | yes | missing |
| `generate-radio-invitations` | yes, every 6 hours | yes | missing |
| `complete-release-manufacturing` | yes, every 2 minutes | yes | missing |
| `process-tour-travel` | yes, hourly | yes | missing |
| `auto-complete-gigs` | yes, every 15 minutes | yes | missing |

The live university-attendance Edge function **does** contain the shared
secret verifier; its hourly job uses the Vault header. The SQL tests
`university_auto_scheduler_and_class_window_harness.sql` and
`privileged_job_scheduler_harness.sql` both passed in live rollback-only
transactions without retaining changes. The 7-day university audit found
168 reported successful cron runs, 7 positive-XP attendance receipts,
0 before their university-local class end, and 7 unique enrollment/day keys.
This provides evidence for #4228 but is not a substitute for future automated
production checks.

For the other workers, 7-day `cron_job_runs` recorded 661/661 successes for
auto-complete-gigs, 28/28 for gig offers and 26/26 for PR offers, all with
zero job-level errors. The absence of matching run logs for the remaining
three jobs must be investigated; an active `cron.job` row is **not** proof of
successful execution. Prior gig-offer runs also reported success despite
missing active promoters; the repository now fails explicitly instead of
fabricating offers or silently treating failed inserts as success.

The audit queried only job names, schedules, ACLs, counts and status; it did
not display any Vault secret, cron command, token, user ID or payload.

## Prerequisites for any production cutover

1. Review this PR, the six handler entrypoints, the shared scheduler helper,
   its negative/concurrency tests and **deployed-vs-repository source diffs**.
2. Certify the six handlers together on a disposable/staging Supabase project,
   including the same database claim RPC, cron secret, rate windows, no-source
   behavior and a safe way to restore previous bundles. There is currently no
   staging project connected to this workspace; **do not treat production as
   a staging sandbox**.
3. Obtain approval from the responsible release/security/database operators.
   Confirm backups, the previous six deployed function bundles and a rollback
   route. Changing the repository does not revoke the vulnerable live versions.
4. Check that all six active `pg_cron` jobs still send the Vault-resolved
   `x-cron-secret` at execution time, not a literal bearer. Validate
   `verify_internal_cron_secret` and `claim_privileged_job_window` grants;
   both currently exist, and their rollback-only SQL gate passed on 25 Nov.
5. Determine why the radio-invitations, manufacturing and tour-travel workers
   have no matching seven-day `cron_job_runs`; ensure monitoring can
   distinguish a successful zero-work run from an invocation that never began.

## Controlled deployment (after the prerequisites)

The manually dispatched GitHub workflow
`.github/workflows/privileged-scheduler-edge-cutover.yml` targets only the six
named handlers and only RockMundo's reviewed project ref. It runs on `main`,
requires an exact typed acknowledgement, a reviewed staging receipt and the
GitHub `production` environment. **Maintainers must configure required
reviewers on that environment before running it**; its name alone does not
enforce approval. It uses the existing private `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_URL`
GitHub secrets (they must already be configured). Neither token nor URL is
printed. If the required secrets are not configured, the workflow stops.

The workflow runs the repository's contract/type checks, both rollback-only
database preflights and sequential function deployment. `--no-verify-jwt`
preserves the existing cron invocation mode; protection is **inside** each
new handler's fail-closed `x-cron-secret` verification. The workflow never
calls a live job, updates game balances, creates offers or prunes functions.

After the deploy, operators must still validate **each** active deployed
bundle/source (not just version numbers), then make a **credential-free POST**
that yields HTTP 401 without changing job-run, reward or finance rows. Do not
run this negative HTTP probe *before* the secure source is verified on that
specific deployment, because an older unprotected version might execute a
global job. Test the legitimate Vault-backed scheduled call on its normal
cadence and confirm real job log/receipt outcomes. Test two concurrent claims
and a retry against disposable fixture data, not live player balances.

Keep a release receipt: approved commit, six previous/new Edge versions,
operator and time, test URLs/counts, redacted HTTP result summaries, live cron
outcomes, reconciliation evidence and a signed go/no-go decision.

## Stop and rollback

- If any deployment fails, **stop the cutover**; do not run the remaining jobs
  manually to compensate. Determine which handlers changed and stop their
  affected scheduled invocation before any attempted rollback.
- Restore only the approved, previously archived handler bundle after checking
  its authorization status. **Rolling back to the known unauthenticated version
  reopens the vulnerability**; prefer a reviewed secure hotfix or temporary
  scheduler pause while an authorized operator repairs the deployment.
- Never alter the Vault secret or cron job identity without a separately
  reviewed rotation and a verified, continuous schedule. Do not change
  financial, ticket, XP or gig records during this Edge-only release.
- Re-run the SQL gates and source/HTTP checks after a repair. Keep #4255 open
  until all six functions are protected live and their record-level
  idempotence, retry behavior and real scheduled runs are verified.

## Completion criteria

University attendance #4228 can be closed independently after its live auth,
hourly scheduler, local-class-end, unique-XP and retry receipts are recorded.
The remaining #4255 cutover is **not** done by merging this workflow; it
requires the approved staged deployment and post-deploy certification above.
