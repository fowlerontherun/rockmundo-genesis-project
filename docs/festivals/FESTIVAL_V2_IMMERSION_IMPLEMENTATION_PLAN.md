# RockMundo Festival V2 — Immersion & Usability Implementation Plan

Status: Planned (unchecked items are not implemented or verified)  
Owner: RockMundo  
Created: 2026-10-28  
Scope: Player, artist, owner and attendee festival experience  
Principle: **Reuse canonical festival-company edition runtime and shared gig engine. Do not create another festival simulation or double-post rewards.**

## Outcome and design rules
Festival should feel like a persistent location with a living lineup, interactive grounds, shared performances, fan activity and coherent owner controls, not a set of disconnected forms. Preserve existing player history, bookings, tickets and settlement. Gameplay authority remains server-side; public views are privacy-filtered. Release progressively behind flags.

## Phase overview
| Phase | Priority | Exit gate |
|---|---|---|
| P0 Foundation | P0 | Existing festival paths and economy are correct and test-covered |
| P1 Hub | P1 | Artist and visitor can complete core journeys in a single coherent hub |
| P2 Grounds | P1 | Site map and festival brand visibly reflect real edition data |
| P3 Live | P1 | Accurate shared live status and existing 3D gig playback |
| P4 Social | P2 | Verified participation rewards and connected community activities |
| P5 Operations | P2 | Owner can plan, run and conclude without fragmented admin screens |
| P6 QA / release | P1 | Verified tests, performance, monitoring and rollback |

## Work items

### P0 Foundation and reliability (P0)
- [ ] FEST-001 Audit canonical and legacy routes, tables, RPCs, feature flags and ownership; record reuse/retirement decisions
- [ ] FEST-002 Fix lineup and booking cache invalidations (#3429 #3435), with realtime/refetch fallback
- [ ] FEST-003 Correct completed appearance semantics (#3233) and invitation deadline validation (#3481)
- [ ] FEST-004 Distinguish fetch errors from empty states for public detail and ticket wallet (#3406 #4074)
- [ ] FEST-005 Validate ticket allocations, timezone rendering, sale expiry and cross-festival state resets (#3471 #3964 #3963 #3402)
- [ ] FEST-006 Establish contract tests for admission, bookings, attendance, runtime, rewards and settlement; avoid duplicate payouts

### P1 Unified festival hub (P1)
- [ ] FEST-101 Build one festival landing experience: festival identity, art, status, date, location, CTA, alerts
- [ ] FEST-102 Create artist, attendee and owner views sharing edition-scoped data with permissions
- [ ] FEST-103 Stage/lineup timetable with NOW/NEXT, filters, conflicts and local edition timezone
- [ ] FEST-104 Simplify festival discovery, applications, invitations, check-in and ticket wallet flows
- [ ] FEST-105 Accessible responsive navigation and desktop/mobile companion read views

### P2 Visual grounds and art (P1)
- [ ] FEST-201 Interactive 2D/isometric site map, clickable stage/market/backstage/camping/hospitality hotspots
- [ ] FEST-202 Stage identities, layouts and visual density scaled to festival size/upgrades
- [ ] FEST-203 Distinct procedural/curated festival branding, poster, banners and lineup cards
- [ ] FEST-204 Crowd density, day/night and weather overlays driven by authoritative runtime snapshots
- [ ] FEST-205 Graceful low-end fallback, loading/error states and asset performance budgets

### P3 Live performances and atmosphere (P1)
- [ ] FEST-301 Extend shared gig 3D stage presets for outdoor stages, screens, lighting, cameras and crowd audio (#2002)
- [ ] FEST-302 Live stage-status integration: soundcheck, changeover, performance, delay, cancellation
- [ ] FEST-303 Frozen outfit/instrument and lineup snapshots for festival replay, privacy and consistency
- [ ] FEST-304 Public festival feed for stage updates, artist arrivals, weather, incidents and highlights without private data
- [ ] FEST-305 Shared-view consistency and reconnect/replay handling; no second simulation engine

### P4 Social engagement and rewards (P2)
- [ ] FEST-401 Festival passport with verifiable attendance/view/watch stamps and anti-farming limits
- [ ] FEST-402 Optional social encounters and band connections within festival attendance permissions
- [ ] FEST-403 Festival-wide daily/weekend/community challenges reusing City Music Scenes contribution pattern
- [ ] FEST-404 Cosmetic collectibles, photos/posters, archived moments and achievements
- [ ] FEST-405 Food/merch discovery using existing economies; server-authoritative sales and reward settlement

### P5 Owner experience and operations (P2)
- [ ] FEST-501 Visual planning overlay for stages/capacity/facilities and operational constraints
- [ ] FEST-502 Owner readiness checklist and plain-English warnings with quick actions
- [ ] FEST-503 Live control-room overview of schedule, crowd, staffing, safety and sales using role-scoped projections
- [ ] FEST-504 Post-event wrap-up showing attendance, costs, income, fans, highlights and satisfaction
- [ ] FEST-505 Accessibility/permissions audit across owner, staff, artist and visitor roles

### P6 Release quality and adoption (P1)
- [ ] FEST-601 Migration audit and direct DB apply only after review, backup, idempotent rollout and verification
- [ ] FEST-602 Unit/integration/e2e coverage for multi-day, multi-stage, timezones, cancelled and interrupted editions
- [ ] FEST-603 Load test concurrent viewers, tick processing, data freshness, reconnection and slow devices
- [ ] FEST-604 Feature-flag pilot on seeded festival, track failures, festival engagement and completion
- [ ] FEST-605 Release notes, help guide, fallback route and rollback playbook

## Cross-cutting acceptance criteria
- Every mutation respects role scopes, RLS and edition identity. No browser writes to authoritative festival runtime tables.
- Every live panel shows consistent edition-local time, loading, stale, failed and reconnect states.
- The canonical published lineup, stage and runtime evidence are the only authority for live presentation.
- Attending/performing earns exactly one eligible reward, even on retries; cancellation never marks a performance completed.
- Live map, 3D and low-bandwidth alternatives all function with keyboard, reduced-motion and mobile responsive layouts.
- Festival history and ticket wallet survive migration; migrations use additive, idempotent steps with verified rollback.
- Existing bug issues are linked and resolved only when tested; do not close simply because a new screen hides the failure.

## Required end-to-end user journeys
1. Visitor discovers festival → buys ticket → wallet verifies → checks in → visits stage → earns passport proof.
2. Band applies → negotiates/accepts → scheduled slot publishes → plays via shared gig engine → receives correct result.
3. Owner sets edition → books acts → publishes lineup → monitors live operations → closes gates → settles once.
4. Late timetable change → everyone sees correct schedule and notifications; prior snapshots remain auditable.
5. Delayed/cancelled performance and disconnection → accurate state, recovery, no false completion or duplicate payout.

## Rollout and measurement
Start with a seeded pilot edition behind a Festival V2 flag. Track errors by route, time-to-book/check-in, stale lineup rate, session time at festival, stage visits, repeat attendance, completed performances, reward duplicate count and owner task completion. Gate each phase before enabling it for all editions. Record database change receipts and rollback steps.

## Existing issues to link
#3233 #3429 #3435 #3481 #3402 #3406 #4074 #3471 #3963 #3964 #2002 #2183 #2182

## Execution notes
- Create phase-sized PRs and avoid conflicting with the ongoing lint baseline repair and other festival changes.
- Only change live Supabase database after confirming project/environment, migration ordering, backup path and post-apply checks.
- Keep the V1 fallback available until complete acceptance testing; prevent legacy and new flows from both settling.
