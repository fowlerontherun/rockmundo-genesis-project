# Festival V2 visitor reliability — release, fallback and rollback

Status: implementation batch under review (not a declaration of production release).
Issues: #4620 (booking/timetable cache), #4622 (loading/error vs empty), #4634 (low-end fallback), #4639 (shared-view freshness/reconnect), #4654 (visitor help/release).

## Draft player-facing release note (publish after acceptance)

Festival stage pages now distinguish published set times from confirmed live appearances.
When official live data is old or unavailable, the stage guide and published timetable remain available without implying that a band is currently playing. A retry control helps restore the live view. Ticket wallets display a verification state while loading instead of prematurely saying the character has no tickets. Booking and launch changes refresh the public timetable and related views.

**Limits:** The stage directory is not a geographic site map. Weather and crowds are reported in-game runtime observations, not forecasts or live venue headcounts. Stage-specific audience and artist states appear only when authoritative snapshots exist. The visitor page does not create a second festival simulation or award tickets/rewards.

## Visitor recovery and accessibility

1. On a festival's public page, use the **Grounds** tab for the interactive illustrated stage directory; select a stage by keyboard, touch or mouse.
2. Use the **Timetable** tab or the Grounds **Open published timetable** control whenever live indicators are unavailable. Published times may change; they are *not* confirmation an act is performing.
3. Use **Retry live festival updates** after a connection failure or an outdated runtime snapshot. If still unavailable, rely on published organiser information rather than interpreting an empty crowd meter as an empty venue.
4. On **Tickets**, select an active character. While verification is pending the wallet shows a loading status; on error it offers a separate retry. Do not repurchase tickets merely because verification is down.
5. Stage pictures are not maps. Only organiser-published physical directions and accessibility information should be used for travel and wayfinding. Reduced-motion users do not need animation to understand the indicators.

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

An in-progress festival may have no runtime tick for a while; a snapshot older than 30 minutes is conservatively hidden rather than presented as current. If that policy causes misleading unavailability, calibrate its interval against real engine cadence before release rather than bypassing freshness checks.

## Deployment and rollback

This batch is frontend/query-cache/docs only. **No DB migration, economy write, scheduler or settlement code is part of the batch.**

1. Merge only after relevant CI and visitor E2E pass; observe errors on the public festival pages after deployment.
2. Keep the existing canonical `festival_editions_v2` and `festival_edition_runtimes` as sole runtime authority. Do not apply legacy `festival_runtime_sessions` migrations as a workaround.
3. On regression, revert this frontend PR/build; keep the existing authoritative public RPC and game data intact. A rollback must not delete attendance, tickets, festival evidence, funds or history.
4. Smoke-test public festival detail, Grounds, Timetable, signed-in Ticket Wallet, and owner edition views after revert.
5. If live public projection itself fails, present its error state and the published timetable fallback. Investigate the public RPC and permissions separately; do not expose owner-only control room projections.
6. Record reproduction, regression result, revert commit/deployment identifier and the follow-up issue before declaring the incident resolved.

## Completion criteria

A successful release requires documented green checks and manual verified smoke runs. This guide and the in-app fallback are a subset of #4654; do not close the broader release issue until launch notes, operational ownership and the full rollback rehearsal are approved.
