# RockMundo Consolidated Implementation Backlog

_Last updated: 2026-08-26_

## Purpose

This document is the canonical consolidated implementation backlog for functionality identified as incomplete, partially implemented, explicitly deferred, or still requiring verification across the RockMundo planning, audit, roadmap, and status Markdown files.

It is intended to replace the need to work directly from multiple overlapping historical plans.

The backlog is organised as a sequence of small, dependency-aware pull requests. Each PR should leave the repository deployable and should update this file when its scope is completed.

## Status legend

| Status | Meaning |
| --- | --- |
| `NOT STARTED` | No implementation work has begun for this consolidated PR. |
| `PARTIAL` | Some underlying capability exists but this PR's acceptance criteria are not complete. |
| `NEEDS VERIFICATION` | The repository appears to contain much of the functionality but requires an explicit closure audit. |
| `DEFERRED` | Intentionally post-beta or dependent on earlier platform work. |
| `COMPLETE` | Acceptance criteria met and verified. |

## Priority legend

| Priority | Meaning |
| --- | --- |
| `P0` | Current correctness, finance, security, data-integrity, or major gameplay blocker. |
| `P1` | Important gameplay completion or beta-readiness work. |
| `P2` | Significant depth/retention expansion after the core is stable. |
| `P3` | Long-horizon simulation and advanced live-ops expansion. |

## Global implementation rules

Every PR in this backlog should follow these rules unless a domain-specific plan explicitly requires stricter behaviour:

1. Keep high-value gameplay and financial mutations server-authoritative.
2. Prefer narrow RPCs/services over direct browser writes for authoritative state.
3. Make retriable operations idempotent.
4. Preserve existing deep links and production data unless a migration plan explicitly replaces them.
5. Add or update RLS policies for every new player-facing table or RPC.
6. Add loading, empty, error, and retry states to new UI.
7. Add tests around authoritative calculations, permissions, idempotency, and regressions.
8. Avoid creating duplicate legacy/canonical implementations.
9. Update the related feature/audit MD and this backlog when a PR closes work.
10. Do not mark a feature complete merely because a component/table exists; verify the full player journey.

---

# Programme A — Finance and Booking Stabilisation

Finance completion is a dependency for rehearsals, recording, bands, companies, festivals, and other paid gameplay actions.

## PR A1 — Rehearsal and recording booking finance integration ([#1619](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1619))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Integrate real rehearsal booking with the hardened finance/band-expense workflow.
- Integrate real recording booking with the hardened finance/band-expense workflow.
- Default band-owned activities to band funds where appropriate.
- Preserve explicit player-funded alternatives where product rules allow them.
- Remove remaining browser-side or generic destination-account payment paths.
- Return structured insufficient-funds and treasury-missing errors to the UI.

### Acceptance criteria

- Rehearsal booking can atomically validate the booking and chosen funding source.
- Recording booking can atomically validate the booking and chosen funding source.
- Failed finance operations do not leave orphan bookings.
- Failed booking operations do not leave orphan finance transactions.
- Retried submissions do not double-charge.
- Band and personal funding choices are clearly displayed.

### Dependencies

- Existing Finance Phase 8B.x journal and obligation primitives.

---

## PR A2 — Atomic booking commits, refunds, mortgage and obligation repair ([implementation](https://github.com/fowlerontherun/rockmundo-genesis-project/commit/51f2b1994be295ff3021f92c99a6728bc1a47d0a))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Make supported booking/payment commits atomic.
- Add source-aware refunds for cancelled/failed paid actions.
- Repair remaining mortgage trigger and schedule-version issues.
- Complete obligation idempotency guarantees.
- Complete collection retry policy and debt-state reconciliation.
- Ensure repeated processors do not duplicate missed-payment penalties or debts.

### Acceptance criteria

- Booking/payment/refund flows are replay-safe.
- Mortgage schedules remain consistent after retries and updates.
- Outstanding balances derive from authoritative schedule/debt state.
- Collection retries respect `next_retry_at` and do not inflate debt/miss counts.

### Dependencies

- PR A1.

---

## PR A3 — Band treasury and insufficient-funds UX ([implementation](https://github.com/fowlerontherun/rockmundo-genesis-project/commit/7243711a887fa75d3a0cd96b792be97037f05dee))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Complete band treasury UI for booking and operational expenses.
- Show current treasury balance and selected funding strategy before confirmation.
- Explain personal shortfall contributions when allowed.
- Add useful recovery actions when a band treasury account is missing.
- Ensure company/band borrowing remains unavailable unless governance permissions are complete.

### Acceptance criteria

- Players can understand exactly which balance will fund an action.
- Insufficient funds never result in a generic RPC/schema error.
- Band contribution records match actual personal-funded shortfalls.

### Dependencies

- PR A1.

---

## PR A4 — Finance executable verification and E2E closure

**Priority:** P0  
**Status:** NEEDS VERIFICATION

### Scope

- Run clean migration/reset verification in CI.
- Run database lint and RLS tests.
- Run finance behavioural SQL harnesses.
- Add browser E2E tests for rehearsal, recording, loan, mortgage, band treasury, retry, and refund paths.
- Add reconciliation checks to the release gate.

### Acceptance criteria

- Clean migration chain passes.
- Finance SQL tests pass.
- Loan/provider/band treasury reconciliation reports show no unexplained differences.
- Supported browser journeys pass in E2E.

### Dependencies

- PRs A1–A3.

### Implementation progress

- Added a repeatable finance database gate covering the A1–A4 behavioural and reconciliation harnesses.
- Added loan schedule and banking-provider ledger reconciliation to the release checks.
- Wired named database and browser commands into the Finance verification workflow.
- Added a fast contract test that prevents required reset, lint, type-parity, behavioural,
  reconciliation, browser, diagnostic, and cleanup checks from silently drifting out of the gate.
- Implementation is complete; a successful Finance verification workflow run is still required
  before this item can be marked `COMPLETE`.

---

# Programme B — Festival Canonical Performance Completion

The booking/contracts foundation exists. The next work should complete canonical performance authority rather than extending legacy festival writes.

## PR B1 — Canonical festival performance sessions

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Add canonical performance-session records derived from confirmed festival contracts/slots.
- Define session lifecycle states.
- Link stage, slot, band, edition, setlist, and authoritative participants.
- Add safe player/organiser read APIs.
- Prevent duplicate performance sessions for the same confirmed slot.

### Acceptance criteria

- Every confirmed canonical slot can resolve to one authoritative performance session.
- Legacy participant tables are not used as new write authority.
- Session creation is idempotent.

### Implementation notes

- Enforced one canonical session per stage slot in addition to the existing one-session-per-contract constraint.
- Session creation now snapshots canonical active band members immediately and keeps the lock-based constructor private.
- Added a permission-checked player/organiser projection that omits private readiness and contract-economic data.
- Extended the database harness to cover the read API, slot uniqueness, and internal-constructor privileges.

---

## PR B2 — Festival performance readiness and arrival authority

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Implement authoritative readiness checklist.
- Validate gear requirements.
- Validate technical riders against stage resources.
- Validate travel and arrival windows.
- Validate soundcheck windows.
- Add stage changeover buffers.
- Add performer/crew conflicts.
- Add countdowns for soundcheck/performance.
- Add late/no-show states and penalties.

### Acceptance criteria

- A performance cannot start if hard requirements are unmet.
- Warnings distinguish advisory issues from blockers.
- Late/no-show resolution is server-authoritative and audit logged.

### Dependencies

- PR B1.

### Implementation notes

- Added a server-authoritative requirement ledger with explicit advisory and blocking outcomes.
- Re-evaluate arrival, equipment/rider compatibility, soundcheck, changeover, performer and crew conflicts at the point a performance starts, so a stale readiness lock cannot bypass blockers.
- Added permission-checked countdowns and an idempotent operator/worker no-show resolver that records settlement-facing penalty evidence in the canonical event stream.

---

## PR B3 — Canonical festival performance resolution

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Resolve festival song/performance outcomes server-side.
- Consume canonical audience snapshots and performance inputs.
- Apply rivalry, sponsor, media, readiness, crew, gear, and setlist modifiers only from authoritative facts.
- Remove unsafe client-side settlement authority from the live performance loop.
- Keep any presentation mini-game cosmetic or bounded to pre-authorised inputs.

### Acceptance criteria

- Refreshing, closing, replaying, or using multiple tabs cannot alter the outcome.
- One performance session resolves once.
- Outcome rows are immutable or versioned after settlement.

### Dependencies

- PRs B1–B2.

### Implementation notes

- Replaced the browser-callable calculator with a permission-checked operator/worker resolution boundary.
- Resolution serialises on the canonical session, freezes audience, readiness, setlist, crew, gear and incident evidence, and converges retries or multiple tabs on one live outcome.
- Unsupported rivalry, sponsor, media and presentation inputs remain explicitly neutral rather than accepting client-provided score modifiers.
- Final outcomes, per-song outcomes, audience snapshots and the resolution input ledger are immutable; the canonical event stream records the input hash and resolved outcome.

---

## PR B4 — Festival settlement and career effects ([#1638](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1638))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Apply pending financial and career effects exactly once.
- Settle artist payouts, agreed merch shares, sponsor effects, fame, fans, reputation, and relevant progression.
- Add cancellation/no-show penalties and contract refunds.
- Expose detailed player-facing settlement breakdown.
- Add organiser-facing settlement/reconciliation view.

### Acceptance criteria

- Financial settlement reconciles to contract terms.
- Career effects are idempotent.
- A completed festival performance has a complete audit trail from contract to settlement.

### Dependencies

- PR B3 and Finance Programme A.

### Implementation notes

- Added one replay-safe `settle_festival_edition` boundary that prepares, applies and reconciles the edition settlement before completion.
- Artist guarantees, performance bonuses, agreed `merch_share_percent`, organiser cancellation kill fees and applicable band cancellation/no-show deposit refunds now post through canonical Finance transactions with stable idempotency keys.
- Finalised performance proposals now mutate bounded band fame/fan state, festival reputation, sponsor health and relevant checked-in performer XP exactly once, with before/after application evidence retained.
- Added permission-checked player performance settlement and organiser edition reconciliation projections, while removing raw settlement tables from the broad authenticated read surface.
- Added settlement-source immutability, completed-request replay hardening and a Vitest database-contract regression suite covering finance authority, signed terms, career idempotency and permissions.
- Settlement deliberately fails closed for non-USD editions until the shared Finance journal supports correct multi-currency posting; ticket bonuses remain neutral until canonical per-band ticket-bonus evidence exists.

---

## PR B5 — Festival organiser lifecycle and audit hardening ([#1639](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1639))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Complete canonical draft/publish/postpone/cancel edition state machine.
- Add festival-specific admin/organiser audit log.
- Add regional blackout validation.
- Add server-side application rule checks such as genre/reputation requirements.
- Complete canonical application → contract → slot propagation.
- Consolidate remaining organiser/admin management surfaces around canonical data.

### Acceptance criteria

- Edition lifecycle transitions are validated server-side.
- Postponement/cancellation triggers correct player notifications and refunds where required.
- Organiser actions are traceable.

### Dependencies

- PRs B1–B4 for final lifecycle integration.

### Implementation notes

- Added server-enforced regional blackout rules for city, region and country windows, with platform-admin override restricted to otherwise-legal lifecycle transitions and a mandatory recorded reason.
- Lifecycle options now derive from the same canonical transition validator used by mutation; direct status writes are guarded so browser, worker and admin paths cannot skip the edition state graph.
- Postponement moves affected contracts to amendment-required state and pauses live ticket sales; cancellation releases reservations, marks contracts for settlement, cancels public launch artefacts, queues eligible refund obligations and notifies ticket holders and performers.
- Added server-side application eligibility checks for artist type, fame limits, genre rules and active band-member counts.
- Added a replay-safe accepted band booking finaliser that creates the canonical active contract, immutable version, confirmed stage slot and reservation, together with an organiser scheduling queue/UI. Solo/NPC accepted bookings remain visible but fail closed until the canonical performance-contract model supports non-band artists.
- Consolidated organiser/admin evidence into an immutable festival audit stream with a permission-checked edition projection and before/after inspection UI.
- Added regression coverage for lifecycle graph parity, blackout override safety, cancellation/refund consequences, application rules, contract/slot propagation and organiser surfaces; the existing schedule-workspace tests isolate the finaliser so its React Query boundary cannot break unrelated timeline tests.

---

## PR B6 — Festival ticket tiers, vendors and operational analytics closure ([#1641](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1641))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Complete ticket tier inventory authority and dynamic pricing rules.
- Complete sold/remaining and revenue metrics.
- Complete vendor/food/merch stall assignment and revenue-share configuration.
- Complete attendance/revenue/satisfaction/performance dashboards.
- Ensure ticket, vendor, and settlement values reconcile with finance ledgers.

### Acceptance criteria

- Ticket inventory cannot oversell.
- Vendor settlements are authoritative.
- Dashboard numbers agree with canonical sales/settlement tables.

### Dependencies

- Finance Programme A and PR B4.

---

## PR B7 — Festival performer collaboration, invitations and fan voting ([#1644](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1644))

**Priority:** P2  
**Status:** COMPLETE

### Scope

- Add server-projected direct artist invitations.
- Add guest/featured artist support.
- Add canonical rivalry objectives.
- Add fan voting for eligible open slots.
- Finish repertoire-backed setlist picker and realtime invalidation.
- Add lineup change and performance reminder notifications.

### Acceptance criteria

- Collaboration participants have explicit accepted obligations.
- Fan voting cannot bypass organiser eligibility rules.
- Setlist selection is repertoire-backed and persisted canonically.

### Dependencies

- PR B1.

---

# Programme C — Festival Attendee Mini-Game

This programme extends the modern ticket system. It must not reuse the legacy attendee model as write authority.

## PR C1 — Festival wristbands and memorabilia inventory ([#1645](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1645))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Create inventory representation for issued festival wristbands/memorabilia.
- Link wristband to authoritative issued admission ticket and edition.
- Prevent duplication through retries or multiple admission products.
- Display wristband in inventory and festival ticket wallet.

### Acceptance criteria

- Buying a valid admission ticket creates exactly one attendee lifecycle and one eligible wristband representation.
- Add-ons do not create duplicate attendee lifecycles/wristbands.

### Implementation notes

- Wristband issuance now follows canonical admission-backed attendance creation rather than waiting for check-in.
- Memorabilia links directly to the authoritative admission ticket, edition, launch, and attendance row, with uniqueness at attendee/edition and ticket/item boundaries.
- Existing ticketed attendees are reconciled; add-ons/upgrades cannot create attendance or wristbands.
- The existing Inventory → Festival Keepsakes surface shows the same collectible projected into the festival ticket wallet.
- Purchase success invalidates ticket, attendance, check-in, and memorabilia caches together, and focused regression coverage protects the C1 authority contract.

---

## PR C2 — Festival check-in, readiness and leave lifecycle ([#1646](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1646))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Add authoritative festival check-in/check-out lifecycle.
- Validate ticket, attendee, edition, and entry window server-side.
- Add readiness projection for travel/location and admission.
- Add leave/re-entry rules.
- Expose clear player states for not-ready, ready, checked-in, left, and completed.

### Acceptance criteria

- A ticket cannot be checked in twice.
- Add-ons cannot check in independently.
- Check-in state survives refresh/reconnect.

### Implementation notes

- Added replay-safe canonical check-in and leave RPCs that serialise on the admission-backed attendance row and enforce edition entry/leave windows.
- Check-in now validates issued admission ownership, canonical attendance linkage, active launch/edition state, and player city before mutating attendance.
- Leaving records a durable `left_at`; re-entry is explicitly unavailable for this phase rather than silently creating a second attendance lifecycle.
- Added a permission-checked readiness projection with stable not-ready/ready/checked-in/left/completed states and countdown metadata.
- Wired readiness, check-in and leave controls into the attendee dashboard with loading/error/retry states and focused regression coverage.

---

## PR C3 — Festival attendee needs, mood and safety simulation ([#1648](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1648))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Add bounded attendee needs/mood state.
- Model food, drink, toilet, rest, shelter, and crowding effects.
- Add deterministic/scheduled simulation ticks.
- Add safety incidents and recovery actions.
- Keep attendee simulation isolated from canonical performance scoring authority.

### Acceptance criteria

- Needs state is server-authoritative and replay-safe.
- Safety incidents cannot be farmed through refresh/retry.
- Simulation does not mutate artist performance outcomes.

### Implementation notes

- Added canonical attendee state and idempotent simulation tick processing over checked-in attendance.
- Added deterministic incident generation/recovery with bounded effects and one application per simulation window.
- Attendee dashboard now shows current needs, mood, safety and available recovery actions.
- No artist performance score/outcome mutation path is touched by attendee simulation.

---

## PR C4 — Festival attendee actions and mini-game interactions ([#1650](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1650))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Add player actions for food/drink/rest/toilet/shelter/navigation/social moments.
- Add cooldowns and bounded effects.
- Add deterministic costs/rewards where applicable.
- Integrate with festival site/stage/vendor data without creating a second festival model.

### Acceptance criteria

- Repeated submissions cannot duplicate action effects or costs.
- Actions respect current attendance lifecycle and site availability.

### Implementation notes

- Added one server-authoritative attendee action boundary with idempotency keys and per-action cooldowns.
- Actions validate checked-in state, edition lifecycle, site facilities/vendor availability and current needs before applying bounded effects.
- Paid actions post through the existing finance path; replayed submissions converge without duplicate charge/effect.
- Attendee dashboard exposes contextual action controls and cooldown/recovery feedback.

---

## PR C5 — Festival attendee progression, collectibles and history ([#1651](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1651))

**Priority:** P2  
**Status:** COMPLETE

### Scope

- Add bounded attendee XP/recognition from completed festival attendance.
- Add collectible/history views for attended festivals and wristbands.
- Add achievements for attendance milestones.
- Keep progression rewards bounded and idempotent.

### Acceptance criteria

- Completing the same attendance cannot award progression twice.
- Festival history derives from canonical attendance/ticket records.

### Implementation notes

- Added replay-safe completion/progression settlement keyed to canonical attendance.
- Added attendance-history projection and collectible linkage to issued wristbands.
- Added bounded festival-attendance achievements and focused duplicate-award regression coverage.

---

# Programme D — Social and Community Completion

## PR D1 — Block/report and social safety foundation ([#1653](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1653))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Add player block/report primitives.
- Enforce blocks across friendship, messages, relationship requests, social discovery, and future social systems.
- Add moderation-safe report evidence references.
- Add rate limits/abuse controls for social requests.

### Acceptance criteria

- A blocked user cannot create new social requests/messages through alternate routes.
- Existing sensitive social surfaces respect block state.
- Reports are traceable without exposing private moderation data to players.

---

## PR D2 — Friendship and direct social interaction closure ([#1654](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1654))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Verify/fix friend request/accept/remove lifecycle.
- Add block-aware discovery.
- Ensure chat and profile links use canonical friendship state.
- Add useful empty/loading/error states.

### Acceptance criteria

- Friendship state remains consistent across profiles, chat, and friends pages.
- Refresh/reconnect does not show contradictory states.

### Dependencies

- PR D1.

---

## PR D3 — Relationship lifecycle and consent hardening ([#1656](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1656))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Make relationship requests/accept/decline/end server-authoritative.
- Enforce mutual consent and block state.
- Add cooldowns for repeated requests.
- Add audit/history where appropriate.
- Prevent stale or parallel requests creating contradictory active relationships.

### Acceptance criteria

- One player cannot force relationship state on another.
- Parallel/retried requests converge safely.

### Dependencies

- PR D1.

---

## PR D4 — Marriage/divorce lifecycle and family-state integration ([#1657](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1657))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Add proposal/acceptance/marriage lifecycle.
- Add divorce/separation lifecycle.
- Integrate spouse state with family records and shared family systems.
- Add idempotent state transitions and history.

### Acceptance criteria

- Marriage requires explicit acceptance.
- Divorce cannot duplicate settlements/state transitions.

### Dependencies

- PR D3 and Finance Programme A for any financial consequences.

---

## PR D5 — Children and co-parent foundation ([#1660](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1660))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Add canonical child/family records.
- Add parent/co-parent permissions.
- Add age and development lifecycle basics.
- Add family overview surfaces.
- Keep child playability age-gated.

### Acceptance criteria

- Parentage and permissions are server-authoritative.
- Child lifecycle cannot be advanced through browser clock manipulation.

### Dependencies

- PR D4.

---

## PR D6 — Social venues and group activities ([#1662](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1662))

**Priority:** P1  
**Status:** COMPLETE

### Scope

- Add canonical social venue/activity sessions.
- Add invitations, attendance, leave lifecycle, cooldowns and bounded effects.
- Integrate existing city venues/locations rather than creating duplicate venue authority.
- Add block/report enforcement.

### Acceptance criteria

- Attendance is authoritative and cannot be duplicated.
- Social effects are bounded and idempotent.

### Dependencies

- PRs D1–D3.

---

## PR D7 — Community events and local scenes ([#1665](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1665))

**Priority:** P2  
**Status:** COMPLETE

### Scope

- Add scheduled community events tied to cities/scenes.
- Add participation and bounded rewards.
- Add scene/community history.
- Integrate existing venue/event systems where practical.

### Acceptance criteria

- Event participation is replay-safe.
- Rewards cannot be farmed through repeated submissions.

### Dependencies

- PR D6.

---

## PR D8 — Groups, clubs and communities ([#1668](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1668))

**Priority:** P2  
**Status:** COMPLETE

### Scope

- Add player-created social groups/communities.
- Add membership roles and moderation permissions.
- Add group feeds/events/discovery.
- Enforce block/report and rate-limit rules.

### Acceptance criteria

- Group moderation actions are traceable.
- Removed/banned users cannot bypass membership state through alternate routes.

### Dependencies

- PR D1 and D7.

---

## PR D9 — Player service marketplace ([#1671](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1671))

**Priority:** P2  
**Status:** COMPLETE

### Scope

- Add player service listings for eligible activities.
- Add booking/contract/payment lifecycle.
- Add completion/cancellation/dispute states.
- Add verified reputation signals.
- Keep financial settlement server-authoritative.

### Acceptance criteria

- Contract templates reuse one authoritative lifecycle.
- Escrow cannot be released twice.
- Reputation signals are derived from verified interactions.

### Dependencies

- Finance Programme A.

---

## PR D10 — Mentoring and player-led education

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add mentor opt-in profiles and discovery.
- Add mentorship request/accept/leave lifecycle.
- Add milestone-based mentor/mentee rewards.
- Add player-led classes tied to existing education/skills.
- Add beginner-safe defaults, pricing limits, block/report integration, and anti-farming caps.

### Acceptance criteria

- Mentor rewards depend on verified learning progress.
- New players can leave without penalty.

### Dependencies

- PRs D1–D3 and D9.

---

## PR D11 — Rivalries, communities and seasonal social competition

**Priority:** P2  
**Status:** PARTIAL

### Scope

- Add opt-in player/band rivalries.
- Add rivalry goals and history.
- Add contextual leaderboards.
- Add fan/community structures where appropriate.
- Add seasonal competitions and historical recognition.
- Add anti-boosting protections.

### Acceptance criteria

- Rivalry mechanics cannot be used for harassment.
- Competition rewards are prestige/cosmetic/bounded rather than pay-to-win.

### Dependencies

- Social safety PRs D1–D3.

---

# Programme E — Tour Operations Completion

## PR E1 — Tour HQ live Supabase integration

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Wire Tour HQ to live tour operation records across all tour detail routes.
- Persist/apply tour templates.
- Persist crew schedules, equipment manifests, merchandise plans, sponsor obligations, logistics events, and reports through existing RLS-safe paths.
- Remove demo/derived-only gaps where canonical data exists.

### Acceptance criteria

- Opening the same live tour from all supported routes shows consistent Tour HQ state.
- Mutations persist and survive refresh/reconnect.

---

## PR E2 — Advanced tour demand and disruption simulation

**Priority:** P2  
**Status:** DEFERRED

### Scope

- Add regional demand decay and oversaturation.
- Add weather modifiers to fatigue/logistics risk.
- Expand ferry/flight/customs disruption events without requiring external realtime markets.
- Feed tour completion into future booking/festival confidence.

### Dependencies

- PR E1.

---

# Programme F — Gig Viewer Closure

The viewer has had significant later implementation. Do not redesign it again without first closing the earlier plan against the current code.

## PR F1 — Living Venue phases 0–3 closure audit

**Priority:** P1  
**Status:** COMPLETE

### Scope

Audit and explicitly mark implemented/partial/missing for:

- contain-fit at required viewport sizes;
- wide/stage-focus/auto camera modes;
- seven venue archetypes and deterministic variations;
- path graphs and service-point reachability;
- deterministic representative crowd caps;
- bar activity;
- merchandise activity;
- staff queues/service loops;
- seek/restart/fast playback reconstruction;
- reduced-motion equivalents;
- demo/player renderer parity.

### Acceptance criteria

- Produce updated status matrix in the Living Venue plan.
- Create only evidence-backed follow-up tickets for actual gaps.

### Closure evidence

- `docs/gigs/implementation/LIVING_VENUE_F1_CLOSURE_AUDIT.md` records the evidence-backed status matrix.
- All eleven F1 contracts are implemented in the shared `GigViewerShell` → `GigCanvas` → `CanvasRenderer` path.
- `VenueSceneRegistry` now contains descriptor v2 with all seven archetypes, three deterministic variants each, distributed services and route graphs; the full 21-descriptor registry is covered by executable validation tests.
- `VenueActivity` covers deterministic bar/merchandise visits, staff service/restocking, alternate return positions, ambient/aggregate/event-replay evidence and timestamp reconstruction for seek/restart/speed changes.
- Reduced Motion, representative crowd caps, player/admin renderer parity and viewer no-mutation authority are covered by focused tests.
- No evidence-backed Phase 0–3 gap remains, so no F2 corrective ticket is created from this audit.
- Repository-wide CI currently reaches TypeScript checking after successful dependency installation but is blocked by unrelated pre-existing errors outside the Gig Viewer surface; this is recorded as a repository gate issue, not an F1 product gap.

---

## PR F2 — Close verified Living Venue gaps

**Priority:** P1  
**Status:** DEFERRED

### Scope

- Fix only gaps confirmed by PR F1.
- Preserve implemented later phases: environment packs, evidence inspector, ambience, performance tiers, DPR caps, quality controls, hidden-tab pause, keyboard accessibility, and no-mutation gates.

### Dependencies

- PR F1.

### Closure note

- F1 found no Phase 0–3 implementation gaps. Keep F2 deferred unless a new reproducible viewer defect or regression provides fresh evidence.

---

# Programme G — Family and Dynasty Completion

## PR G1 — Child development, inheritance and parenting decisions

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Add bounded child skill potential/inheritance model.
- Add child traits and upbringing focus.
- Add age-bracket development events.
- Add schooling/mentor/life-event choices.
- Add co-parent decision queue and conflict resolution.
- Add parent-child bond/co-parent harmony effects.
- Preserve age-gated playability.

### Acceptance criteria

- Inheritance affects growth potential more than immediate power.
- Both parents' authorised decisions are traceable.
- Child progression is scheduled/idempotent.

---

## PR G2 — Dynasty, family tree and legacy progression

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add persistent family tree.
- Add family legacy page/hall of records.
- Add bounded inherited social capital.
- Add dynasty milestones and historical recognition.
- Preserve historical records after character death/retirement.

### Acceptance criteria

- Family history remains queryable across generations.
- Legacy bonuses are bounded and cannot create runaway power.

### Dependencies

- PR G1.

---

# Programme H — Verification and Beta Closure

## PR H1 — Cross-system executable verification matrix

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Maintain a single verification matrix for finance, festivals, tours, social, family, gigs, progression, and admin-critical paths.
- Add browser E2E for high-risk player journeys.
- Add database behavioural harnesses for authoritative mutations.
- Add reconciliation and idempotency checks.
- Add release-gate documentation and ownership.

### Acceptance criteria

- Critical beta journeys have executable coverage.
- Known verification gaps are visible and cannot be mistaken for complete implementation.

---

## PR H2 — Legacy/dead-path cleanup after canonical verification

**Priority:** P1  
**Status:** DEFERRED

### Scope

- Remove legacy writes only after canonical replacements are verified.
- Remove orphaned components/RPCs/tables where safe.
- Preserve compatibility reads where historical data still depends on them.
- Update docs and architecture maps.

### Dependencies

- Relevant programme verification/closure PRs.
