# Festival V2 authority audit — 8 November 2026

FEST-001 / #4619. This completes the architecture inventory and reuse/retirement
decisions; it does not certify the remaining gameplay release gates.

## Evidence and reproduction

Source baseline: `8321708b74fddefb7a2ceff954a4d3b1082982e4`.
Read-only catalogue queries ran against Supabase project `rockmundo`
(`yztogmdixmchsmimtent`) at 09:06 UTC on 8 November 2026:

- `supabase/diagnostics/festival_v2_authority_audit.sql`: ownership, RLS,
  exposed RPC grants and relevant foreign keys.
- `supabase/tests/festival_runtime_production_preflight.sql`: installed runtime
  objects, independently of migration history. It now recognises the already
  deployed canonical public projection instead of prescribing another one.

The preflight returned `canonicalEditionRuntimeReady=true`,
`canonicalPublicProjectionPresent=true`, `launchScopedRuntimeReady=false` and
`launchScopedDayCrowdPatchPermitted=false`. The recorded 1,755 migration versions
are context only, never evidence of installed objects. No DDL, gameplay mutation,
settlement, reward or balance change was executed.

## Routes, identifiers and ownership

`src/features/festivals/routes.ts` owns URL construction and identifier semantics;
`src/App.tsx` mounts the routes. `festivalFeatureRegistry.ts` records audience,
permission, component and empty/error behavior. Reuse these contracts.

| Surface | Current entry | Authority and decision |
| --- | --- | --- |
| Public discovery | `/world/festivals` | Public directory projection; retain |
| Public company/edition | `/world/festivals/:festivalCompanyIdentifier[/editions/:editionIdentifier]` | Resolver distinguishes slug/company UUID and edition UUID/year; retain |
| Owner company | `/festival-company/:festivalCompanyId` | Company management checked by server projections; retain |
| Annual owner workspace | `/festival-company/:festivalCompanyId/editions/:editionId` and section routes | Edition-scoped plan, programme, tickets, runtime and settlement; retain |
| Artist opportunities | `/festival-opportunities` | Active-character/represented-band RPC authority; retain |
| Administration | `/admin/festivals` and company/edition children | Admin authority remains server-side; do not infer it from the route |
| Historical gameplay URLs | `/festivals`, marketplace, simulation, perform, sessions, run/manage/calendar | Directory or canonical resolver redirects; do not restore independent writers |
| Historical results | `/festivals/history`, results, awards, hall-of-fame, records, statistics | `FestivalLegacyPage`; preserve history without reopening settlement |

The July active-system certification document is historical evidence. Its claims
that canonical URLs are absent or shadowed do not describe this source baseline.
No route deletion or database retirement is performed by this audit.

## Data and RPC decisions

| Domain | Verified state | Decision |
| --- | --- | --- |
| Annual runtime | `festival_editions_v2`, `festival_edition_runtimes`, configuration versions and runtime evidence exist | Reuse the canonical annual runtime and immutable evidence; #4742 owns resumable ticks |
| Published visitor runtime | `get_public_festival_edition_live_status(text)` exists; anon/authenticated can execute; empty search path | Reuse this privacy-filtered projection; #4687 owns outstanding rollout checks |
| Owner control room | `get_festival_edition_runtime_control_room(uuid,uuid)` exists; authenticated only; empty search path | Never expose its payload publicly; retain management checks |
| Edition plans | Edition site, ticket and artist-programme reads are authenticated-only; programme save is authenticated-only | Keep edition UUIDs and server version/idempotency checks |
| Runtime commands | Source uses `run_simplified_festival_edition`; old prepare/transition endpoints deny both anon and authenticated execution | Do not restore old client grants as a workaround; follow canonical run readiness |
| Older stage evidence | Performance sessions and crowd snapshots reference **festival_editions**, not **festival_editions_v2** | Do not relabel old rows as canonical stage evidence; #4696 owns canonical sources |
| Launch-scoped alternative | Public editions, runtime sessions/days/stages/crowds and old public live RPCs are absent | Do not bulk-apply the future-dated launch runtime chain to satisfy visitor UI |
| Manual scheduling compatibility | `festival_schedule_upsert_item` exists and allows anon execution, with body-level management checking observed in the earlier audit | #4733/#4624 must verify permission rejection, revision locks and server deduplication; a client retry key alone is insufficient |

All 11 returned tables in the bounded inventory have RLS enabled and owner
`postgres`. All inventoried functions are security definers owned by `postgres`.
RLS and EXECUTE grants are an inventory, not proof that each definer function
enforces row-level authorization. In particular, the canonical runtime's FK
inventory does not itself establish an edition-v2 foreign key: enforce edition
identity in the canonical command/projection contracts and test it explicitly.

## Feature flags and fallback

Source: `src/features/festival-company/config/featureFlags.ts`. These are
build-time settings; the deployed frontend's values were not inspected.

- Legacy system/read/write switches default **false**.
- New system, creation, applications and live-performance switches default **true**.
- `LegacyFestivalGate` mounts no gameplay child when system/read is off or write
  is off. Enabling historical reads alone does not enable mutations.
- The write flag is configurable despite the comment saying it stays off.
  Keep it off operationally; it is not a security boundary or a rollback plan.
- No separate Festival V2 pilot flag was found in this flag module. #4653 must
  define and verify the pilot before claiming a gated rollout.
- Retain the canonical public timetable/wallet as the fallback for unavailable
  live observations. Do not infer crowds, completion or rewards from the clock.

## Validation and remaining work

The preflight executes in disposable PGlite fixtures for missing objects,
canonical runtime without projection, and canonical runtime with projection.
All three pass. Existing flag, legacy-gate and feature-registry tests pass too
(12 tests total). The modified preflight and the new authority audit both execute
successfully against the live catalogue using read-only SELECTs.

Follow-up implementation remains tracked separately: cache/session freshness
#4620, browser failure recovery #4622, scheduler authority #4733/#4624, public
projection release #4687, stage evidence #4696, resumable runtime #4742, and
deployment/permission/rollout certification #4650/#4649/#4653. Completing this
inventory does not close those items or establish an end-to-end gameplay pass.

Rollback: revert the documentation and read-only diagnostic changes. No database
rollback is needed because this batch changes no production object or data.
