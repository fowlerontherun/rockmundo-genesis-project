# RockMundo Consolidated Implementation Backlog

_Last updated: 2026-08-24_

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

## PR B4 — Festival settlement and career effects

**Priority:** P0  
**Status:** NOT STARTED

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

---

## PR B5 — Festival organiser lifecycle and audit hardening

**Priority:** P1  
**Status:** PARTIAL

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

---

## PR B6 — Festival ticket tiers, vendors and operational analytics closure

**Priority:** P1  
**Status:** PARTIAL

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

## PR B7 — Festival performer collaboration, invitations and fan voting

**Priority:** P2  
**Status:** PARTIAL

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

## PR C1 — Festival wristbands and memorabilia inventory

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Create inventory representation for issued festival wristbands/memorabilia.
- Link wristband to authoritative issued admission ticket and edition.
- Prevent duplication through retries or multiple admission products.
- Display wristband in inventory and festival ticket wallet.

### Acceptance criteria

- Buying a valid admission ticket creates exactly one attendee lifecycle and one eligible wristband representation.
- Add-ons do not create duplicate attendee lifecycles/wristbands.

---

## PR C2 — Festival check-in, readiness and leave lifecycle

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Implement `ready_to_check_in` eligibility.
- Implement server-authoritative check-in.
- Implement early leave.
- Implement completion, cancellation, and refund lifecycle handling.
- Add time/location/edition checks where required.

### Acceptance criteria

- Browser clients cannot directly mutate attendee lifecycle rows.
- Invalid, refunded, or wrong-edition tickets cannot check in.
- State transitions are idempotent and audited.

### Dependencies

- PR C1.

---

## PR C3 — Festival Mode shell and reduced game UI

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Introduce Festival Mode when attendee state becomes `attending`.
- Replace normal gameplay navigation with a reduced festival-specific navigation set.
- Preserve access to essential account/support functions.
- Add desktop and mobile festival shells.
- Add reliable exit/return behaviour.

### Acceptance criteria

- A checked-in attendee consistently enters Festival Mode.
- Refresh/reconnect restores Festival Mode correctly.
- Leaving/completing the festival restores normal UI.

### Dependencies

- PR C2.

---

## PR C4 — Festival scheduling locks and activity authority

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Block incompatible normal activities while attending a festival.
- Prevent new gigs/rehearsals/recordings/travel that conflict with attendance.
- Define allowed festival-only activities.
- Release locks when the attendee leaves/completes/cancels.

### Acceptance criteria

- Festival attendance cannot create impossible schedule state.
- Existing committed activities are handled predictably before check-in.

### Dependencies

- PR C2.

---

## PR C5 — Festival day planner and stage schedule

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Build per-day attendee schedule.
- Let players choose bands/stages to watch.
- Include travel time between stages/areas.
- Include food, drink, rest, camping, VIP, vendor, and free-time blocks.
- Detect timetable conflicts.
- Show consequences/trade-offs before committing a plan.

### Acceptance criteria

- The player can build a feasible festival day.
- Overlapping activities are blocked or explicitly resolved.
- The plan persists across reconnects.

### Dependencies

- PR C3.

---

## PR C6 — Festival attendee condition simulation

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Add bounded festival-specific condition dimensions such as energy, hydration, hunger, comfort, mood, and inspiration where appropriate.
- Reuse Wellness systems rather than creating incompatible duplicate health authority.
- Apply camping, weather/environment, food/drink, rest, crowd, and activity effects.

### Acceptance criteria

- Condition changes are server-authoritative or derived from authoritative scheduled activity completion.
- Festival stats cannot be spam-click farmed.
- Festival effects feed back into normal Wellness cleanly after attendance.

### Dependencies

- PR C5.

---

## PR C7 — Festival social and random events

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Add festival-specific random/social event pools.
- Support band encounters, friendships, relationships, inspiration, vendor interactions, camping events, nightlife/afterparty events, and safe substance/alcohol consequence hooks using existing event/wellness rules.
- Add player choice and delayed outcome support.
- Respect blocking/privacy and social safety.

### Acceptance criteria

- Events are rate-limited, idempotent, and context-appropriate.
- Rewards/outcomes cannot be claimed repeatedly by refresh.

### Dependencies

- PR C6 and Social Programme D foundations.

---

## PR C8 — Festival attendee rewards and festival-owner boosts

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Grant bounded attendee XP/AP and special experience rewards.
- Add inspiration/skill booster unlock hooks.
- Add relationship/friendship outcomes from verified shared attendance.
- Make real-player attendance contribute a bounded positive signal to festival success/owner outcomes.
- Prevent attendance/reward farming with alt/repeat/cap controls.

### Acceptance criteria

- Rewards settle once at appropriate milestones/completion.
- Player attendance boosts use verified checked-in attendance, not ticket count alone.
- Festival organiser boost values are explainable and capped.

### Dependencies

- PRs C2–C7 and Festival settlement PR B4.

---

# Programme D — Social Safety, Communication and MMO Foundations

## PR D1 — Complete authoritative friendship/block lifecycle

**Priority:** P0  
**Status:** PARTIAL

### Scope

- Add authoritative accept, decline, remove, block, and unblock RPCs.
- Centralise relationship permission helpers.
- Apply block checks to profile actions, DMs, invites, band recruitment, gifts/transfers, social media interactions, and relevant shared contexts.
- Add cooldowns and audit logs.

### Acceptance criteria

- A blocked player cannot bypass the block through another direct social action.
- Direct table mutation is not required for lifecycle changes.

---

## PR D2 — Global mute/ignore, rate limiting and abuse controls

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Add dedicated mute/ignore semantics distinct from blocking.
- Add server-side rate limits/cooldowns for DMs, friend requests, invites, mentions, follows, chat, gifts, and recruitment actions.
- Add abuse telemetry and admin visibility.

### Acceptance criteria

- Repetitive contact spam is rate-limited across surfaces.
- Mute/ignore works without implying a block.

### Dependencies

- PR D1.

---

## PR D3 — Unified reporting and moderation evidence

**Priority:** P0  
**Status:** PARTIAL

### Scope

- Add report support for DMs, chat, profiles, invites, bands, companies, and other player-generated social content.
- Create unified moderation queue/evidence bundles.
- Preserve Twaater-specific moderation while integrating it with common reporting primitives.
- Add moderator audit trail.

### Acceptance criteria

- Reports contain sufficient server evidence for moderation review.
- Reported users/content can be traced without exposing private data to reporters.

### Dependencies

- PR D1.

---

## PR D4 — Group conversations and communication consolidation

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Add reusable group conversations for bands, companies, labels, tours, events, festivals, and communities.
- Support game-object context attachments such as contracts, gigs, offers, and deadlines.
- Consolidate unread/actionable counts into the Inbox direction where practical.
- Preserve direct messages as private player conversations.

### Acceptance criteria

- Group membership/permissions derive from authoritative game relationships.
- Leaving/removal/blocking behaviour is defined.
- Inbox/actionable communication is not duplicated across multiple notification surfaces.

### Dependencies

- PRs D1–D3.

---

## PR D5 — Band objectives, contribution and lineup authority

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Add band shared objectives and progress.
- Expand verified contribution tracking.
- Complete lineup mutation/finalisation.
- Add correction/dispute paths.
- Connect attendance/contribution to bounded chemistry/cohesion changes.
- Add role/permission matrix for band operations.

### Acceptance criteria

- Contribution comes from verified gameplay events.
- Members can see why contribution/chemistry changed.
- Lineup state used for gigs/rehearsals is authoritative.

---

## PR D6 — Collaboration contracts and session musicians

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Add guest features, co-writing, royalty splits, production credits, and temporary tour/session participation.
- Add session-musician contracts with explicit obligations and payouts.
- Reuse generic contract primitives where possible.

### Acceptance criteria

- All parties explicitly accept obligations/splits.
- Settlement is server-authoritative and idempotent.

### Dependencies

- PR D5 and contract foundation PR D9.

---

## PR D7 — Player company job boards and hiring pipeline

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Add structured job postings.
- Add applications, shortlist, offer, acceptance, rejection, and withdrawal.
- Add skill/location/reputation requirements.
- Add block/report protections.
- Add read-only labour market salary/reference analytics.

### Acceptance criteria

- Company hiring has a complete auditable lifecycle.
- Applicant/employer permissions are server-enforced.

---

## PR D8 — Employment contracts, escrow and disputes

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Add employment terms, salary, bonuses, trial periods, duties, duration, termination, and dispute rules.
- Add escrow/reserved funds where appropriate.
- Connect verified tasks to existing gameplay systems.
- Add non-payment and breach outcomes.

### Acceptance criteria

- High-value rewards do not rely on manual self-report alone.
- Payments and disputes are auditable.

### Dependencies

- PR D7 and PR D9.

---

## PR D9 — Generic social contract, escrow and trust framework

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Define reusable contract envelope for gigs, employment, management, sponsorship, teaching, mentoring, production, loans, royalties, collaborations, and event organisation.
- Add parties, terms, deliverables, deadlines, payments, cancellation, penalties, and visibility.
- Add escrow/settlement hooks.
- Add structured disputes and server evidence.
- Add reputation dimensions based on verified contract behaviour.
- Add verified endorsements/references.

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
**Status:** NEEDS VERIFICATION

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

---

## PR F2 — Close verified Living Venue gaps

**Priority:** P1  
**Status:** DEFERRED

### Scope

- Fix only gaps confirmed by PR F1.
- Preserve implemented later phases: environment packs, evidence inspector, ambience, performance tiers, DPR caps, quality controls, hidden-tab pause, keyboard accessibility, and no-mutation gates.

### Dependencies

- PR F1.

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
- Add public wedding/birth/coming-of-age announcements with privacy controls.
- Add dynasty milestones and intergenerational history.

### Dependencies

- PR G1.

---

# Programme H — Jam Sessions 2.0

The existing jam system should be extended, not replaced wholesale.

## PR H1 — Jam slot engine, mood, fatigue and session roles

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Add authoritative jam session slots.
- Add dynamic setlist focus actions.
- Add mood and synergy calculations.
- Add individual fatigue.
- Add venue traits.
- Add producer/sound-tech/roadie session roles.
- Add optional session challenges.
- Add slot-by-slot result/analytics cards.

### Acceptance criteria

- Sessions continue asynchronously when players are offline.
- Slot resolution is idempotent.
- Repeated refresh cannot reroll results.

---

## PR H2 — Jam spectators, reputation, contracts and gifted-song rewards

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add spectator/scout presence.
- Add fan polls.
- Add jam city reputation tiers.
- Add jam residency contracts.
- Add band diary recaps/highlights.
- Add NPC mentor cameo events.
- Add rare server-authoritative gifted-song drop with weekly cap.

### Dependencies

- PR H1 and Social contract foundation D9.

---

# Programme I — Generic Domain Event Framework

This programme should begin only after immediate gameplay/finance stability work.

## PR I1 — Domain event schema foundation

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add append-only `domain_events`.
- Add related-entity index table.
- Add event naming/version/category constraints.
- Add idempotency keys, correlation and causation IDs.
- Add privacy-aware visibility.
- Add RLS and retention guidance.

### Acceptance criteria

- Events are append-only for normal application roles.
- Duplicate retried events can be prevented by idempotency.

---

## PR I2 — Shared event publisher and typed registry

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add shared publisher helper.
- Add typed event registry/version validation.
- Add blocked/sensitive payload field rules.
- Add retry/dead-letter handling for non-critical events.

### Dependencies

- PR I1.

---

## PR I3 — Gameplay, career and performance emitters

**Priority:** P2  
**Status:** NOT STARTED

### Scope

Start with stable authoritative events:

- random events;
- career milestones;
- gigs;
- major events;
- tours;
- releases;
- selected finance/audit events.

Preserve existing source-of-truth tables and feeds.

### Dependencies

- PR I2.

---

## PR I4 — Event admin viewer and downstream consumers

**Priority:** P2  
**Status:** NOT STARTED

### Scope

- Add admin event search by player/band/entity/correlation/time.
- Add failed publish inspection.
- Add initial consumers for achievements, notifications, analytics, or player timelines where useful.
- Ensure consumers are replay-safe/idempotent.

### Dependencies

- PR I3.

---

# Programme J — Record Label Advanced Strategy

Core labels/contracts/releases/royalty surfaces already exist. This programme is advanced depth rather than rebuilding the label system.

## PR J1 — Advanced deal types, masters and territories

**Priority:** P2  
**Status:** PARTIAL

### Scope

- Finish traditional/360/distribution/profit-share contract depth.
- Add master ownership choices.
- Add territory/right scoping.
- Add development contracts.
- Add contract fulfilment/renegotiation/breach hooks.

---

## PR J2 — Label market strategy and corporate structure

**Priority:** P3  
**Status:** NOT STARTED

### Scope

- Add sub-labels/imprints.
- Add parent-label resource sharing.
- Add label market share and specialisation.
- Add mergers/acquisitions/partnerships.
- Add contract-transfer rules.

### Dependencies

- PR J1 and generic contract maturity.

---

## PR J3 — Advanced royalty audits and cross-media label economics

**Priority:** P3  
**Status:** PARTIAL

### Scope

- Add royalty audit requests.
- Add underpayment/delayed statement penalties.
- Add sync/licensing and eligible merch/tour shares for applicable deals.
- Expand label P&L and campaign analytics.

### Dependencies

- PR J1.

---

# Programme K — Media System Advanced Depth

Existing TV/podcast/radio surfaces and facilities should be extended rather than replaced.

## PR K1 — Media production and contract depth

**Priority:** P2  
**Status:** PARTIAL

### Scope

- Add structured show/episode production workflow.
- Add pre-production/rehearsal/post-production tasks.
- Add appearance contract negotiation and add-ons.
- Add media training effects.
- Add facility/staff contribution to quality.

---

## PR K2 — Media reach, analytics, sponsors and syndication

**Priority:** P2  
**Status:** PARTIAL

### Scope

- Add Media Reach Score.
- Add audience segmentation and sentiment.
- Add sponsor/ad revenue splits.
- Add syndication/rebroadcast/VOD rules.
- Add comparative analytics and buzz decay.
- Connect media buzz to gigs/releases/social outcomes.

### Dependencies

- PR K1.

---

# Programme L — Achievements Expansion

## PR L1 — Professional career achievement chains

**Priority:** P2  
**Status:** NOT STARTED

### Scope

Add event-driven achievement tracks for:

- producers;
- engineers;
- managers;
- venue/business operators;
- songwriter-for-hire careers.

### Acceptance criteria

- Criteria depend on durable authoritative credits and quality metrics.
- Reward settlement remains idempotent.

### Dependencies

- Relevant profession systems and preferably Domain Event Programme I.

---

# Programme M — Wellness Future Expansion

The current lifestyle/burnout/routine baseline should remain authoritative.

## PR M1 — Retreats, holidays and family/relationship routines

**Priority:** P2  
**Status:** DEFERRED

### Scope

- Add holidays/retreats.
- Add family routines.
- Add relationship routines.
- Connect to scheduling and lifestyle recovery.

---

## PR M2 — Lifestyle reputation, sponsorship and career longevity

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add sponsor lifestyle expectations.
- Add press/scandal hooks.
- Add seasonal mood modifiers.
- Add career longevity outcomes.
- Add lifestyle achievements.

### Dependencies

- Media/social consequence systems.

---

# Programme N — DikCok Advanced Expansion

The current DikCok MVP/feed/create/challenge/analytics systems exist. Only advanced roadmap work belongs here.

## PR N1 — Advanced creator collaboration

**Priority:** P2  
**Status:** DEFERRED

### Scope

- Creator Guilds.
- Story Chains.
- Producer Mode.
- Duet/remix depth.
- Interactive polls.
- Fan missions.

---

## PR N2 — DikCok live ops and premium depth

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Live premieres.
- Sponsored trends.
- Premium band analytics/placements.
- Geo trends.
- Cross-game challenges.
- Music Discovery Radio.
- Advanced editing/AR/AI suggestions where technically justified.

### Dependencies

- Social safety and moderation foundations.

---

# Programme O — Long-Horizon RP Expansion

These PRs are intentionally post-beta. They should reuse the generic event, social safety, contract, family, and finance foundations above.

## PR O1 — Unified consequence ledger and reputation graph

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add consequence ledger/projection architecture.
- Add contextual reputation entities/edges.
- Add decay/confidence.
- Add explainability UI showing why reputation changed.

### Dependencies

- Domain Event Programme I.

---

## PR O2 — City Governance 2.0

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add expanded offices/powers.
- Add policy snapshots/votes.
- Add city budgets and approval.
- Add manifesto/debate/campaign finance systems.
- Connect policy to permits, events, nightlife and local economy.

### Dependencies

- PR O1 and finance/event foundations.

---

## PR O3 — Social narrative, rumours and PR response engine

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add audience segments.
- Add narrative cards from authoritative facts.
- Add rumour lifecycle.
- Add PR response choices and delayed consequences.
- Add social/media propagation.

### Dependencies

- PR O1 and Social Programme D.

---

## PR O4 — Legal roleplay and breach/arbitration depth

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Expand generic contracts into legal clauses.
- Add breach detection.
- Add arbitration/settlement flows.
- Add litigation-style delayed risk where appropriate.

### Dependencies

- Social contract PR D9.

---

## PR O5 — Player-created structured RP events

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add showcase/charity/rivalry/wedding/community event builder.
- Add access/role/reward/sponsor controls.
- Add organiser trust thresholds.
- Add optional canonisation/history workflow.

### Dependencies

- Social safety, contracts, finance, and event framework.

---

## PR O6 — Opt-in AI-assisted narrative tooling

**Priority:** P3  
**Status:** DEFERRED

### Scope

- Add assistive interview-question drafts.
- Add factual event recap drafts.
- Add tabloid/media copy drafts based only on authoritative events.
- Require player/admin approval before publication.
- Never let AI generate mechanical outcomes.

### Dependencies

- PR O3 and moderation foundations.

---

# Programme P — Navigation, Documentation and Release Quality

## PR P1 — Canonical documentation/status cleanup

**Priority:** P1  
**Status:** NOT STARTED

### Scope

- Mark historical/outdated plans as `Superseded`, `Historical`, or `Reference` where appropriate.
- Correct misleading document names/content mismatches.
- Add links from historical plans to current canonical audits.
- Ensure the Festival Attendee implementation plan/reference is valid or consolidate it into the existing architecture/backlog documents.
- Make this file the canonical cross-domain implementation index.

### Acceptance criteria

- A contributor can determine current status without reading every historical MD.
- Old SQLite/microservice assumptions are clearly labelled when no longer current.

---

## PR P2 — Navigation/hub refactor completion audit

**Priority:** P1  
**Status:** PARTIAL

### Scope

- Verify completion of Music, Band, World, Social, Business, Career, Media, Schedule, and Home hub migration work.
- Audit admin routes for consistent route-level protection.
- Consolidate remaining duplicate Social entry points/aliases where safe.
- Complete logical breadcrumb metadata.
- Preserve legacy deep links through redirects.
- Verify mobile quick-action navigation versus desktop-only deep gameplay rules.

### Acceptance criteria

- Every route has a clear module owner.
- Admin routes are consistently protected.
- Back-button/deep-link behaviour is stable.

---

## PR P3 — Critical journey automated test suite

**Priority:** P0  
**Status:** PARTIAL

### Scope

Add/complete automated tests for:

- signup/login/session recovery;
- character creation;
- dashboard/next action;
- songwriting;
- recording;
- release;
- gig completion;
- band basics;
- low health/energy recovery;
- inbox/notifications;
- mobile dashboard/quick actions;
- admin bug visibility.

### Acceptance criteria

- Core beta journeys run in CI.
- Known recently fixed regressions have targeted tests.

---

## PR P4 — Route smoke and UI state test matrix

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Build route inventory test matrix.
- Verify auth, new-player, existing-player, and mobile behaviour.
- Verify loading/empty/error states.
- Detect crash/hang/404 regressions.
- Add browser back/forward navigation coverage.

### Acceptance criteria

- No beta-core route silently hangs or presents an unhandled missing-data state.

---

## PR P5 — Economy, reward and concurrency exploit suite

**Priority:** P0  
**Status:** NOT STARTED

### Scope

Test and harden:

- double-click submissions;
- refresh after reward;
- same action in multiple tabs;
- back button after purchase/action;
- failed-request retry;
- client-side value tampering;
- duplicate XP/money/AP grants;
- negative/impossible balances/state.

### Acceptance criteria

- High-value actions are idempotent and server validated.
- Exploit attempts do not corrupt state or duplicate rewards.

---

## PR P6 — Error telemetry and player-safe diagnostics

**Priority:** P0  
**Status:** PARTIAL

### Scope

- Capture route, safe profile reference, error code/message, stack, browser/device, timestamp, and correlation ID.
- Avoid secrets/private content.
- Standardise player-safe error copy and retry actions.
- Preserve user form state after recoverable failure.
- Add admin search/diagnostic surface.

### Acceptance criteria

- High-impact failures can be diagnosed without asking players for raw database details.
- Known RPC/schema errors surface as actionable product messages.

---

## PR P7 — Beta engineering quality gate refresh

**Priority:** P1  
**Status:** NOT STARTED

### Scope

Re-measure and then improve:

- test coverage toward 60%+ focused on critical paths;
- ESLint warnings toward zero;
- accessibility toward 95%+;
- error handling toward 95%+;
- duplicate code toward below 8%;
- production readiness toward 90%+.

Do not rely on July 2026 snapshot numbers without rerunning current metrics.

### Acceptance criteria

- Updated `PROJECT_HEALTH.md` contains current measured values and evidence.
- Release gate commands are documented and green.

### Dependencies

- PRs P3–P6.

---

# Suggested execution order

The following order minimises rework and keeps authoritative foundations ahead of dependent feature depth.

## Wave 1 — Current blockers and data safety

1. A1 — Rehearsal/recording finance integration.
2. A2 — Atomic booking/refund/obligation repair.
3. A3 — Band treasury UX.
4. D1 — Friendship/block lifecycle.
5. D2 — Mute/rate limits.
6. D3 — Unified reporting/moderation.
7. P3 — Critical journey tests.
8. P4 — Route smoke tests.
9. P5 — Economy/concurrency exploit tests.
10. P6 — Error telemetry.
11. A4 — Finance E2E closure.

## Wave 2 — Finish festival authority

12. B1 — Performance sessions.
13. B2 — Readiness/arrival authority.
14. B3 — Performance resolution.
15. B4 — Settlement/effects.
16. B5 — Organiser lifecycle/audit.
17. B6 — Ticket/vendor/analytics closure.
18. B7 — Collaboration/fan voting.

## Wave 3 — Festival attendee gameplay

19. C1 — Wristbands/inventory.
20. C2 — Check-in/leave lifecycle.
21. C3 — Festival Mode.
22. C4 — Scheduling locks.
23. C5 — Day planner.
24. C6 — Attendee condition simulation.
25. C7 — Social/random events.
26. C8 — Rewards and organiser boosts.

## Wave 4 — Finish existing partially built systems

27. E1 — Tour HQ live integration.
28. F1 — Gig Viewer closure audit.
29. F2 — Close verified viewer gaps.
30. P2 — Navigation/hub closure audit.
31. G1 — Child development/parenting.
32. H1 — Jam Sessions 2.0 core.
33. D4 — Group conversations.
34. D5 — Band objectives/contributions/lineups.

## Wave 5 — Social MMO depth

35. D9 — Generic contracts/escrow/trust.
36. D6 — Collaboration/session-musician contracts.
37. D7 — Job boards/hiring.
38. D8 — Employment contracts/disputes.
39. D10 — Mentoring/classes.
40. D11 — Rivalries/seasonal social competition.
41. H2 — Jam spectators/reputation/contracts.
42. G2 — Dynasty/legacy.
43. E2 — Advanced tour simulation.

## Wave 6 — Platform integration foundation

44. I1 — Domain event schema.
45. I2 — Publisher/registry.
46. I3 — Initial emitters.
47. I4 — Admin viewer/consumers.
48. L1 — Professional achievements.

## Wave 7 — Advanced music/media/social depth

49. J1 — Advanced label deals.
50. J2 — Label market/corporate strategy.
51. J3 — Royalty audits/cross-media economics.
52. K1 — Media production depth.
53. K2 — Media reach/sponsors/syndication.
54. M1 — Retreats/family routines.
55. N1 — DikCok creator collaboration.

## Wave 8 — Long-horizon post-beta RP

56. O1 — Consequence/reputation graph.
57. O2 — Governance 2.0.
58. O3 — Narrative/rumour/PR engine.
59. O4 — Legal roleplay.
60. O5 — Player-created RP events.
61. O6 — AI-assisted narrative.
62. M2 — Lifestyle reputation/longevity.
63. N2 — DikCok live-ops/premium depth.

## Continuous documentation/release work

- P1 — Documentation/status cleanup should begin early and be maintained continuously.
- P7 — Re-run project health gates after each major wave and before wider beta expansion.

---

# Features that should not be rebuilt from old plans

The following areas already have substantial implementations and should only receive the scoped follow-up PRs above:

- Core DikCok feed/create/challenges/analytics.
- Core record label contracts/releases/royalty surfaces.
- Wellness lifestyle/routines/burnout baseline.
- Basic marriage/child planning/family timeline.
- Basic jam-session capability.
- Current live gig/living venue viewer later phases.
- Current festival booking/contracts/audience projections.
- Current tour deterministic operations engine.
- Current achievements catalogue/evaluator foundations.

Historical plans for these systems remain useful for ideas but are not proof that the entire system is unimplemented.

---

# Definition of fully implemented

A consolidated PR/programme should only be marked complete when all relevant items below are true:

- Database migrations are clean and replayable.
- RLS and permissions are tested.
- Authoritative mutations are server-side.
- Idempotency is proven for retriable/high-value actions.
- Player UI has loading, empty, error, success, and retry states.
- Mobile/desktop behaviour matches product scope.
- Relevant navigation routes are accessible and protected.
- Notifications/inbox integration exists where an action requires follow-up.
- Finance/reward effects reconcile to source-of-truth records.
- Browser refresh/back/multiple-tab behaviour cannot duplicate effects.
- Unit/integration/SQL/E2E tests cover critical paths.
- Admin/support diagnostics exist for failure-prone systems.
- The related MD status and this backlog are updated.

---

# Maintenance rule

When a PR closes:

1. Change its status in this file.
2. Link the merged PR number next to the heading.
3. Update any canonical domain audit/implementation plan.
4. If follow-up work is discovered, add a new narrowly scoped PR entry rather than silently expanding an existing one.
5. Do not reopen superseded legacy architecture without an explicit ADR or migration reason.
