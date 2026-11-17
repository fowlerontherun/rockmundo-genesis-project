# Retired economy worker certification — 17 November 2026

Issues: [#4242](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4242) radio plays, [#4224](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4224) lottery draw and [#4253](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4253) music-video completion.

## Security boundary

All three legacy Edge routes are intentionally retired (HTTP **410 Gone**) and have **verify_jwt=true** on the live deployment. Their deployed source contains no service-role client, database mutation or RPC invocation. Their PostgreSQL replacements are service-only, and the private cron jobs call the SQL procedures without HTTP or stored JWT credentials.

| Old endpoint | Active job | Schedule (UTC) | Security mechanism |
| --- | --- | --- | --- |
| `simulate-radio-plays` | `simulate-radio-plays-cron` #55 | Hourly | Unique playlist/hour receipt and locked playlist rows |
| `lottery-draw` | `weekly-lottery-draw` #123 | Monday 00:05 | UTC due-time guard, locked draw and atomic ticket settlement |
| `complete-video-production` | `complete-video-production` #48 | Every 30 minutes | Serialized worker, locked due videos and unique video award receipt |

## Production read-only verification

On 2026-11-17 the Supabase project `rockmundo` was inspected without invoking any privileged worker or making a database write.

- `supabase/tests/retired_economy_workers_readonly_20261117.sql`: **11 of 11 checks passed**. Checks include exact job wiring, active cron schedules, absence of JWT-shaped credentials in the three scheduled commands, denied anonymous/authenticated execution privileges, uniqueness constraints and no awarded-but-unreleased video.
- Live Edge function versions: radio **266**, lottery **131**, video completion **265**. All were JWT-protected and the fetched deployed source was a no-op **410** handler.
- Recent cron history: **28 succeeded** hourly radio executions and **56 succeeded** video-completion executions in the retained recent run detail window. Lottery cron #123 is active; its last run was **not present in the retained `cron.job_run_details` rows** viewed.
- The latest lottery week shown as `paid_out` was **2026-11-09**. Week **2026-11-16** remained pending and was **not past its server-owned cutoff**. No overdue pending lottery draws were seen.
- No overdue music-video productions, no awarded-but-unreleased videos and no video award receipts were present. The **zero video receipts means real paid-video reward settlement and parallel-worker stress are not certified by this read-only snapshot**.

## Regression protection

`src/lib/security/__tests__/retiredEconomySchedulers.contract.test.ts` prevents the legacy Edge endpoints regaining privileged mutation paths, and checks the three source-controlled database scheduling/settlement contracts. Existing rollback-only SQL fixtures remain available at:

- `supabase/tests/radio_hourly_atomic_4242.sql`
- `supabase/tests/lottery_cron_only_draw_authority_harness.sql`
- `supabase/tests/music_video_atomic_completion_4253.sql`

Those fixtures were **not rerun** as part of this production read-only certification. Their concurrency and payment scenarios should be rerun in staging, and real production schedules should be observed as part of ongoing operations. No live user-facing endpoints were invoked to test unauthorized calls.

## Rollback and alerting

Do **not** restore any old public Edge worker to fix a failed cron. Investigate server-side SQL job history, grants, due-time predicates and existing award/payment receipts first. Recovery should preserve once-only ledger entries; never delete a claim or rerun a financial reward job blindly. An empty/failing cron history, a non-410 retired endpoint, a JWT-shaped cron command, an unexpected new `EXECUTE` grant, or any false certification check is a release blocker.
