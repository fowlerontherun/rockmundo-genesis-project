# Festival V2 visitor reliability — release, fallback and rollback

Status: implementation batch under review (not a declaration of production release).
Issues: #4620 (booking/timetable cache), #4622 (loading/error vs empty), #4634 (low-end fallback), #4639 (shared-view freshness/reconnect), #4649 (accessibility), #4651–#4652 (QA), #4654 (visitor help/release).

**Production readiness check, 24 November 2026 (read-only):**
`get_public_festival_edition_live_status(text)` exists; the additive
`get_public_festival_edition_live_experience(text)` RPC and private canonical
stage-event/stage-crowd tables do **not** exist. The browser deliberately falls
back to the existing status RPC when the richer RPC is missing. **Do not
advertise stage announcements or audience-density reports as live** until
their canonical writers and publishing gates are deployed and verified.

## Draft player-facing release note (publish after acceptance)

Festival stage pages now distinguish published set times from confirmed live appearances.
When official live data is old or unavailable, the stage guide and published timetable remain available without implying that a band is currently playing. A retry control helps restore the live view. Ticket wallets display a verification state while loading instead of prematurely saying the character has no tickets. Booking and launch changes refresh the public timetable and related views.

If a festival detail page fails to load, visitors can retry or follow **Browse
other festivals** to the canonical public directory. The visitor-guide and
grounds links now move keyboard focus to the destination tab, so people using
keyboard navigation or screen readers do not remain focused inside a hidden
panel. This note is for **publication after** the release verification below,
not a claim that the browser changes have been deployed.

**Limits:** The stage directory is not a geographic site map. Weather and crowds are reported in-game runtime observations, not forecasts or live venue headcounts. Stage-specific audience and artist states appear only when authoritative snapshots exist. The visitor page does not create a second festival simulation or award tickets/rewards.

## Visitor recovery and accessibility

1. On a festival's public page, use the **Grounds** tab for the interactive illustrated stage directory; select a stage by keyboard, touch or mouse.
2. Use the **Timetable** tab or the Grounds **Open published timetable** control whenever live indicators are unavailable. Published times may change; they are *not* confirmation an act is performing.
3. Use **Retry live festival updates** after a connection failure or an outdated runtime snapshot. If still unavailable, rely on published organiser information rather than interpreting an empty crowd meter as an empty venue.
4. On **Tickets**, select an active character. While verification is pending the wallet shows a loading status; on error it offers a separate retry. Do not repurchase tickets merely because verification is down.
5. Stage pictures are not maps. Only organiser-published physical directions and accessibility information should be used for travel and wayfinding. Reduced-motion users do not need animation to understand the indicators.
6. If a festival detail cannot be loaded, select **Retry festival details**;
   if it still fails, select **Browse other festivals**. A not-found edition
   is not the same as a sold-out event. Do not infer cancellation or refund
   eligibility from either condition.

## Operator decision guide and safe fallback routes

| Symptom | Safe visitor/owner action | Do not do |
| --- | --- | --- |
| One public detail returns an error | Retry; use `/world/festivals` to browse; capture route and response code | Recreate the edition or issue tickets to mask the error |
| Live-feed RPC missing (`PGRST202`) | Existing read-only status projection and published timetable remain the fallback | Enable the retired launch-scoped simulation or synthesize stage events |
| Runtime observation stale, wrong-day or mismatched edition | Hide live badges/crowds; use the published timetable and manual retry | Present cached headcounts or artist names as current |
| Ticket wallet or eligibility query fails | Preserve the server's ownership and transaction state; retry verification for the active character | Show zero tickets, repurchase automatically or manually mint attendance |
| Public route or browser build regresses | Roll back the frontend release and retest the canonical directory/detail | Turn on legacy festival writes or revert financial/database evidence |
| Canonical runtime or settlement fails | Stop rollout; escalate for a separate DB/runtime incident and receipt reconciliation | Rerun ticks, purchases or settlement without idempotent evidence |

The fallback navigation is **`/world/festivals`**, the existing canonical
directory. `/festivals/history` is read-only historical information, **not**
a replacement for current ticket sales, check-in, live operations or settlement.
The `VITE_FEATURE_NEW_FESTIVAL_SYSTEM` build flag gates *some new-company
creation UI*, not all canonical public and owner routes; toggling it is **not**
a Festival V2 kill switch. Similarly, `VITE_FEATURE_LEGACY_FESTIVAL_WRITE`
must remain **false**; it is not an approved production rollback mechanism.

## Release owners, sign-off and evidence to capture

**Assign actual named owners before deploying:** release coordinator (go/no-go,
rollback authorisation), frontend operator (build and routing revert), database
operator (read-only projection health and backup verification), and QA owner
(authenticated multi-role browser acceptance). These roles are mandatory
sign-off fields, not claims that unnamed people have approved this release.

Use this record with each staging pilot or production rollout:

| Field | Required receipt |
| --- | --- |
| Target environment, commit/build and deployment | Environment and immutable IDs; never include credentials |
| Named release/QA/database owners | Who approved which gate and when |
| Database preflight | Presence of canonical status/feed RPCs and stage evidence dependencies; migration/backup record |
| Automated gates | GitHub Actions URLs, exit statuses, exact commit and test counts |
| Browser acceptance | Device, role, fixture/edition, time-zone, ticket state, cancellation and recovery observations |
| Load/reconnect | Viewer counts, p95/p99 response times, query error rate, stale-age and reconnect recovery rates |
| Economy guard | Verified reward/purchase/settlement receipt counts before and after; no duplicate payouts |
| Revert rehearsal | Old/new build IDs, route tests after revert, who performed it, timing and result |
| Decision | Go/no-go, outstanding blockers, sign-off and follow-up ticket URLs |

Do not put player IDs, full JWTs, cron commands, secret values, private
stage events or exact attendance counts in public issue comments or traces.

## Verification gates before merge or deployment

| Gate | Required verification |
| --- | --- |
| Unit | `npm run test:festivals` (includes freshness and invalidation contracts) |
| Types | `npm run typecheck` |
| Lint | `npm run lint:ci` |
| Visitor browser | `npm run test:e2e:festival:pr` (requires the test fixture/environment) |
| Reconnect | Simulate a stale active runtime >30 minutes old, missing `updatedAt`, RPC error and healthy refresh. Ensure no old live artist/crowd/weather indicator is shown. |
| Cross-edition | Navigate between different festival slugs and characters; verify wallet, stage and lineup caches are isolated by their keys. |
| User roles | Test anonymous visitor, signed-in attendee, artist and organiser. Only server-authorised data may be rendered. |
| Economy | Ticket purchase, refunds and event settlement must remain server-authoritative and unchanged. |

The isolated shared-cache regression demonstrates that 12 viewers of one
edition use **one** React Query request on initial load and one on refresh,
while a different slug has a separate cache entry. This is *not* a substitute
for FEST-603 network load testing with concurrent authenticated/mobile clients
or a live server tick. The previous-local-day Grounds regression similarly
checks stale-state suppression in the browser, not DB settlement.

An in-progress festival may have no runtime tick for a while; a snapshot older than 30 minutes is conservatively hidden rather than presented as current. If that policy causes misleading unavailability, calibrate its interval against real engine cadence before release rather than bypassing freshness checks.

## Deployment and rollback

This batch is frontend/query-cache/docs only. **No DB migration, economy write, scheduler or settlement code is part of the batch.**

1. Merge only after relevant CI and visitor E2E pass; observe errors on the public festival pages after deployment.
2. Keep the existing canonical `festival_editions_v2` and `festival_edition_runtimes` as sole runtime authority. Do not apply legacy `festival_runtime_sessions` migrations as a workaround.
3. On regression, revert this frontend PR/build; keep the existing authoritative public RPC and game data intact. A rollback must not delete attendance, tickets, festival evidence, funds or history.
4. Smoke-test public festival detail, Grounds, Timetable, signed-in Ticket Wallet, and owner edition views after revert.
5. If live public projection itself fails, present its error state and the published timetable fallback. Investigate the public RPC and permissions separately; do not expose owner-only control room projections.
6. Record reproduction, regression result, revert commit/deployment identifier and the follow-up issue before declaring the incident resolved.

### Frontend rollback rehearsal (staging, before production)

1. Save the approved pre-release build ID and route/response snapshots. Agree
   in advance who can redeploy that build and how to verify its integrity.
2. Deploy the candidate build to a staging environment with a seeded annual
   edition. Capture an anonymous detail/grounds/timetable session and a
   separate authenticated ticket-wallet session; use no production accounts.
3. Simulate **only** public-read errors or a frontend failure using staging
   fixtures/network interception. Confirm the published-timetable fallback and
   `/world/festivals` link work without any new ticket/reward RPC calls.
4. Redeploy the previously approved frontend build (or revert the exact
   frontend commit), without changing the DB, cron jobs, RPC privileges,
   ticket history or settlement rows.
5. Re-test the public routes, selected-character wallet, edition-local dates,
   owner read view and the existing status RPC. Compare financial and attendance
   receipt counts to the pre-rehearsal snapshot.
6. Record the operators, environment, elapsed time and verification evidence
   in the sign-off table. Do not claim a successful rollback until rehearsed.

If a database migration is part of a later rollout, perform a **separate**
schema-specific dependency/backup/recovery review. This frontend rehearsal
does not authorise dropping canonical runtime data or re-running payouts.

## Completion criteria

A successful release requires documented green checks, named operational
ownership, a signed-off public release note, manual multi-role verified smoke
runs and the recorded staging rollback rehearsal. This playbook supplies the
instructions and evidence template for #4654; its final release gate is
**not satisfied by a documentation PR alone**.
