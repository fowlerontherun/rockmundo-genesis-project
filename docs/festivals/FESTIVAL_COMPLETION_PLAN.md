# RockMundo Festival Completion Plan

**Status:** Active living plan  
**Owner:** RockMundo project  
**Created:** 23 August 2026  
**Last updated:** 23 August 2026  
**Baseline:** `main` after merged PR #1614  
**Overall completion:** In progress  
**Next implementation target:** Authoritative attendee check-in / leave repository alignment

> This document is the single source of truth for completing RockMundo's modern Festival functionality. It must be updated after every future Festival PR we create until the Definition of Complete in this document is satisfied.

---

## 1. Working rule for all future Festival PRs

Every Festival PR must do all of the following before the Festival work is considered complete:

1. Link to this document in the PR body.
2. State which plan item(s) it implements.
3. Update the relevant checklist in this document in the same PR whenever practical.
4. Add the PR to the **PR Progress Register** below.
5. Update **Current State**, **Known Risks / Debt**, and **Next PR** if the change affects them.
6. Record any production-first Supabase migration or reconciliation work.
7. Keep server-authoritative gameplay, finance, attendance, rewards and settlement logic out of browser-only calculations.
8. Do not declare the Festival programme complete until the end-to-end completion gate in section 15 passes.

If a Festival PR merges without updating this document, the next Festival PR must reconcile the plan before adding new functionality.

---

## 2. Product vision

RockMundo Festivals should operate as a complete connected game system rather than a collection of setup screens.

There are four equally important player experiences:

1. **Festival owner** — found and improve a Festival company, plan an annual edition, book acts, sell tickets, run the event, make or lose money, gain reputation and progress the company.
2. **Attendee** — buy a ticket, travel to the Festival, check in, receive a wristband, enter a reduced Festival Mode, plan each day, watch bands, eat, drink, camp, socialise, attend after-parties, experience events and earn meaningful character rewards.
3. **Performing artist/band** — apply or be invited, negotiate/accept a booking, prepare, perform using the canonical gig engine, gain extra value from real player attendees and receive the agreed fee/outcomes.
4. **World/admin simulation** — NPC attendance, real-player attendance, demand, sponsorship, operating quality, weather/events, finances, settlement, history and balancing all interact consistently and remain observable to admins.

The final system should feel like a temporary **Festival mini-game inside RockMundo**, while still feeding the normal economy, wellness, relationships, skills, fame, fans, companies and band systems.

---

## 3. Definition of Complete

Festival functionality is complete only when all of the following are true.

### Festival company / owner

- [x] Festival exists as a modern Festival company type.
- [x] Company setup and annual edition planning exist.
- [x] Eleven upgrade categories and licence/capacity rules exist.
- [x] Annual plan exposes the intended simplified player choices.
- [x] Ticket price and ticket quantity are owner-controlled while demand is game-driven.
- [x] Automatic sponsorship and budget forecasting exist.
- [x] Exact-edition lineup applications/invitations/offers/bookings exist.
- [x] At least one real player act is required before launch; NPCs may fill remaining slots.
- [x] Festival currency is edition-aware across planning and runtime.
- [ ] Owner can take an edition from planning through launch, live operation, completion and results with no dead end or legacy workflow required.
- [ ] Festival finances reconcile correctly from pre-event forecast through final settlement.
- [ ] Owner progression/reputation/upgrades respond to actual Festival results and real-player engagement.
- [ ] Completed editions become durable read-only history.

### Public / ticket buyer

- [x] Modern public Festival launch and ticketing foundation exists.
- [x] Admission purchases create authoritative character attendee lifecycle rows.
- [x] Wristband memorabilia model exists.
- [x] Server-authoritative check-in eligibility/readiness exists.
- [ ] Public discovery clearly shows dates, city, lineup, price, ticket availability, camping/VIP options and relevant Festival quality information.
- [ ] Character can buy the intended ticket types/add-ons without duplicate or contradictory flows.
- [ ] Ticket lifecycle correctly covers valid, used, cancelled/refunded and completed-event cases.

### Attendee mini-game

- [ ] Character can check in only when physically eligible and the ticket becomes used atomically.
- [ ] Successful check-in issues exactly one wristband and puts the character into `attending` state.
- [ ] Festival attendance blocks incompatible normal activities/scheduling for the Festival period.
- [ ] While attending, the normal game navigation is replaced/reduced by Festival Mode.
- [ ] Festival Mode has Festival Home, My Day, Stages, Food & Drink, Activities, Friends/Social, Campsite, Map, Character and Leave Festival.
- [ ] Player can plan the day in time blocks and change plans where rules allow.
- [ ] Player can watch acts and the activity resolves against the real Festival timetable.
- [ ] Player can eat, drink, explore, socialise, camp and attend after-parties.
- [ ] Festival condition stats are functional: Energy, Hunger, Hydration, Mood, Intoxication and Social.
- [ ] Camping quality affects recovery.
- [ ] Festival-specific random events exist and can have meaningful short/long-term outcomes.
- [ ] Alcohol integrates with wellness/lifestyle trade-offs.
- [ ] Drug-related content is event/choice based rather than a shop, with uncertain outcomes and meaningful downside risk.
- [ ] Social choices can alter relationships and create contacts/memories.
- [ ] Attendance grants balanced XP/AP and optional inspiration/skill-learning effects without becoming a mandatory farming exploit.
- [ ] Player receives an end-of-Festival recap and persistent Festival history.
- [ ] Leaving early is supported and forfeits future event rewards appropriately.

### Performing bands/artists

- [x] Player acts can be invited/booked in modern edition planning.
- [ ] Festival booking blocks the performer schedule at the correct times.
- [ ] Festival performances use the canonical gig performance engine rather than a duplicate performance model.
- [ ] A player attending their own band's Festival returns correctly to Festival Mode after performing.
- [ ] Real player audience members watching a real player band provide capped, transparent bonuses to crowd/fame/fan/performance outcomes.
- [ ] Performance fees and outcomes settle exactly once.

### Festival economy and owner benefit

- [ ] Real-player attendance counts materially more than equivalent simulated/NPC attendance without making NPC simulation irrelevant.
- [ ] Real-player ticket, food, drink and merchandise spending feeds authoritative Festival/company finances.
- [ ] Engagement tracks more than check-in: acts watched, food/drink purchases, activities, social/after-party participation and satisfaction.
- [ ] Engagement influences Festival reputation, future demand, sponsor/vendor interest and owner/company progression.
- [ ] Exploit controls prevent multi-account or repeated-action farming from dominating Festival outcomes.

### Admin / operations / quality

- [ ] Admin can inspect live Festival state, attendance, sales, bookings, runtime status, settlement and failure diagnostics.
- [ ] Admin balancing exists for key Festival reward and simulation parameters.
- [ ] Legacy Festival routes/RPCs/tables are either retired, archived or explicitly retained for a documented reason.
- [ ] Mobile/responsive Festival pages are usable, including the simplified attendee UI.
- [ ] Festival accessibility, loading/error states and empty states are complete.
- [ ] Full end-to-end certification passes with no Festival-specific type, lint, security, migration, contract or integration failures.

---

## 4. Current State — 23 August 2026

### Strong / implemented foundations

The modern Festival replacement already contains substantial functionality and should be completed rather than restarted:

- Festival company ownership and company integration.
- Annual Festival editions and planning.
- Eleven upgrade categories and progression metadata.
- Licence-controlled usable capacity/stages/acts/day while allowing infrastructure to be built ahead.
- Simplified annual plan with environmental policy and clear capacity projections.
- Server-owned ticket-demand forecast.
- Automatic sponsorship and pre-event budget forecast.
- Exact-edition artist applications, invitations, offers and confirmed bookings.
- Requirement for at least one confirmed player act before launch, with NPC filler for unused slots.
- Edition-aware currency throughout the recent owner/runtime surfaces.
- Simplified permit model; manual mayor permit workflow is not part of the intended product.
- Authoritative attendee lifecycle created from modern admission tickets.
- Check-in readiness based on Festival dates, location, travel state and valid admission.
- Festival wristband/memorabilia storage and Inventory Manager surface.

### Most important unfinished boundary

The Festival attendee system has reliable **read authority** but does not yet have the complete repository-backed **entry/exit + Festival Mode runtime** on `main`.

PRs #1613 and #1614 deliberately stopped before the actual check-in mutation and Festival Mode.

Any production-first check-in/leave SQL already applied outside `main` must be reconciled into canonical migrations and the repository before building further attendee functionality.

### Known system-level debt

- The Festival replacement architecture still documents legacy retirement as incomplete.
- The repository has had parallel Festival implementations and old runtime callers; active-caller inventory/certification must remain part of completion work.
- Recent Festival gates have sometimes exposed unrelated stale assertions or repository migration bootstrap failures. We must distinguish real Festival regressions from unrelated global CI debt rather than hiding either.
- Finance behaviour must be verified end-to-end at settlement, not assumed correct because forecasts render.

---

## 5. Completion workstreams

### Workstream A — Attendee authority and Festival Mode foundation

Goal: make Festival attendance a reliable character state that the rest of the mini-game can trust.

- Authoritative check-in mutation.
- Atomic ticket `valid -> used` transition.
- Idempotent wristband issuance.
- Authoritative leave-early mutation.
- Automatic completion transition after Festival end.
- Attendance/schedule conflict locking.
- Reduced Festival Mode route/layout/nav while `attending`.
- Safe recovery if an attendee reconnects, changes device, or refreshes mid-Festival.

### Workstream B — Festival day planner and clock

Goal: give the attendee meaningful time-based choices rather than a single Attend button.

- Festival-local clock and day number.
- 30/60/90 minute planning blocks.
- Planned activity queue/timeline.
- Go Now / Change Plans actions.
- Conflict rules with performance times and critical character state.
- Missed-activity outcomes.
- Multi-day persistence and day rollover.

### Workstream C — Festival locations and activities

Goal: build the mini-game's playable locations/actions.

Core locations:

- Main Stage
- Secondary/Dance/genre stages where the edition actually has them
- Food Court
- Bars / beer tent
- Market / merchandise
- Campsite
- VIP area where entitled
- After-party
- Medical area

Core activities:

- Watch act
- Eat
- Drink
- Explore
- Socialise
- Rest
- Sleep/camp
- Play guitar/campfire activity where appropriate
- Visit after-party

The map should initially be clickable navigation, not a walking simulator.

### Workstream D — Character Festival condition simulation

Goal: make decisions have consequences.

Authoritative temporary Festival stats:

- Energy
- Hunger
- Hydration
- Mood
- Intoxication
- Social

Actions and time should modify these stats. They should connect to existing wellness/lifestyle systems where possible rather than inventing duplicate permanent health models.

Camping recovery baseline target for balancing:

- basic camping: ~60%
- premium camping: ~85%
- VIP/glamping: ~95%

Exact values remain balance/config data, not hard-coded product promises.

### Workstream E — Music experience and performer integration

Goal: make watching bands and playing Festivals matter musically.

Attendee side:

- Watch an act from the real edition timetable.
- Gain genre exposure/familiarity.
- Chance of inspiration or temporary learning boosts.
- Track memorable/favourite performances.

Performer side:

- Festival slot becomes a real schedule commitment.
- Reuse the canonical gig engine/viewer.
- Festival-specific venue/crowd modifiers only; do not fork core performance scoring.
- Real attendees watching are counted as a capped positive signal.
- Player performer who is also attending returns to the mini-game after their performance.

### Workstream F — Food, drink, merchandise and Festival economy

Goal: turn attendee activity into real economic gameplay.

- Generated/edition-backed food and drink options.
- Price, queue and quality effects from Festival upgrades/operating quality.
- Purchases debit the attendee exactly once.
- Festival/company receives the correct revenue or commission exactly once.
- Merchandise purchases integrate with existing merch/inventory rules where possible.
- Every transaction is auditable and idempotent.
- Spending contributes to engagement and owner results.

### Workstream G — Social, relationships and random events

Goal: make Festivals socially distinct from ordinary activities.

Social actions should support:

- hang out
- watch together
- buy a drink/food where appropriate
- dance
- campsite/campfire interaction
- after-party interaction
- introduce/contact/friendship opportunities
- flirting/relationship development through existing relationship rules

Festival random-event catalogue should ultimately include broad categories:

- social
- music
- chaos
- weather
- health
- romance
- opportunity/networking
- campsite
- after-party

Target: at least 100 event variants over time, but build the engine and a smaller certified starter catalogue before bulk content expansion.

Drug-related experiences must only appear as contextual random-event choices with uncertain benefits and meaningful risks; they are not a Festival shop/catalogue.

### Workstream H — Rewards, memories and progression

Goal: make attendance worthwhile without creating an optimal mandatory grind.

Rewards may include:

- Festival-day XP
- completion AP
- genre discovery XP
- songwriting/performance inspiration
- temporary skill-learning modifiers
- relationship/social gains
- rare/capped experience unlocks
- achievements

Persistent memories:

- wristband keepsake
- Festival attended history
- days attended
- acts watched
- favourite/memorable performance
- people met
- genres discovered
- standout random event
- spend/reward recap where appropriate

All rewards must be server-authoritative, idempotent and capped against replay farming.

### Workstream I — Real-player engagement and owner benefit

Goal: make real attendance valuable to Festival owners and the wider world.

Create an authoritative Festival engagement model combining:

- unique real attendees
- check-in/completion
- acts watched
- activity participation
- food/drink/merch spend
- social/after-party activity
- satisfaction/outcomes

NPC attendance remains important for simulation and finances, but real-player participation receives a configurable multiplier/weight.

Owner benefits should include some combination of:

- Festival reputation
- future ticket-demand lift
- sponsorship/vendor attractiveness
- Festival/company XP/progression
- performer interest
- company valuation/health metrics where those exist canonically

Real-player engagement bonuses must be capped and based on unique characters/meaningful actions rather than spam clicks.

### Workstream J — Runtime, settlement, owner results and history

Goal: close the loop from planning to a finished annual edition.

- Launch readiness remains server authoritative.
- Runtime uses the final timetable, ticket sales, attendance and operating inputs.
- Revenue/cost lines reconcile to ledger entries.
- Artist fees settle correctly.
- Ticket, sponsorship, food/drink, merchandise and operating costs reconcile exactly once.
- Results expose attendance, engagement, satisfaction, financial result, reputation/progression effects and notable event outcomes.
- Completed edition snapshot is immutable/versioned.
- Next annual edition starts from correct persistent Festival company state.

### Workstream K — Public discovery and travel integration

Goal: make it obvious how a normal character finds and attends Festivals.

Public Festival pages should expose:

- name/artwork
- city/country
- dates/duration
- vibe/type
- lineup/headliners
- ticket products and price
- capacity/tickets left where appropriate
- camping/VIP availability
- Festival reputation/quality indicators
- real-player attendee count where product-safe
- relevant travel guidance/state

Calendar/travel rules should prevent impossible check-ins while still allowing advance ticket purchase.

### Workstream L — Admin, balancing, observability and legacy retirement

Goal: leave a maintainable production system.

Admin capabilities:

- inspect Festival company/edition state
- inspect launch readiness blockers
- ticket sales and issued tickets
- attendee lifecycle/check-in state
- bookings and performance status
- runtime/settlement state
- finance lines
- engagement/reward diagnostics
- stuck-state recovery tools with audit logging

Balancing/config:

- ticket demand inputs
- NPC attendance
- real-player weighting
- reward caps
- engagement thresholds
- temporary stat rates
- random-event weights
- owner progression effects

Legacy retirement:

- identify every remaining legacy route/RPC/table caller
- remove or archive only when modern parity is demonstrated
- preserve settled historical data
- remove duplicate navigation and dead player-facing flows
- update Festival active-caller inventory after retirement changes

---

## 6. Planned PR sequence from current `main`

The numbering below is a **logical Festival sequence**, not predicted GitHub PR numbers. Scope may be split further if a PR becomes too large.

### Festival Completion PR 1 — Check-in / leave authority

**Status:** Next

Scope:

- Reconcile any production-first attendee mutation SQL into canonical repo migrations.
- Add authenticated server-authoritative check-in RPC.
- Revalidate eligibility inside the mutation transaction.
- Mark admission ticket used atomically.
- Transition attendee to `attending`.
- Ensure one wristband exists.
- Add leave-early RPC and state transition.
- Wire public Festival UI actions.
- Add contract/security/idempotency tests.

Done when a valid character can buy -> travel -> check in -> receive wristband -> leave, and no browser-only mutation can bypass the rules.

### Festival Completion PR 2 — Festival Mode shell + schedule lock

Scope:

- Route/layout guard based on authoritative `attending` state.
- Reduced navigation.
- Festival home status panel.
- Block incompatible standard scheduled activities while attending.
- Restore normal navigation after leave/completion.
- Reconnect/refresh recovery.

### Festival Completion PR 3 — Festival clock + My Day planner

Scope:

- Festival-local time/day.
- Planner timeline.
- 30/60/90 minute activity blocks.
- Plan/change/go-now rules.
- Persistence and day rollover.
- Performer slot auto-insertion for attending performers.

### Festival Completion PR 4 — Map + activity framework

Scope:

- Clickable Festival map/navigation.
- Stage/food/bar/campsite/VIP/after-party/medical location model.
- Generic server-authoritative activity-start/activity-complete framework.
- Time consumption and missed-plan handling.

### Festival Completion PR 5 — Condition stats + camping/recovery

Scope:

- Energy, Hunger, Hydration, Mood, Intoxication, Social.
- Time decay/recovery.
- Rest/sleep/camping actions.
- Camping entitlement/quality effects.
- Wellness integration.

### Festival Completion PR 6 — Food, drink and attendee commerce

Scope:

- Food/drink catalogue derived from edition/quality/upgrades.
- Purchase actions.
- Character effects.
- Exact-once finance flow to Festival/company.
- Queue/price/quality simulation.
- Engagement contribution.

### Festival Completion PR 7 — Watch bands + gig engine integration

Scope:

- Stage timetable attendee view.
- Watch-act action.
- Canonical gig viewer/performance integration.
- Attending performer flow.
- Genre exposure/inspiration hooks.
- Real-attendee audience identity captured for later bonuses.

### Festival Completion PR 8 — Social Festival gameplay

Scope:

- See attending friends/players with privacy-safe rules.
- Hang out/watch together/dance/campfire/after-party actions.
- Relationship/contact integration.
- Social stat interactions.

### Festival Completion PR 9 — Festival random-event engine + starter catalogue

Scope:

- Contextual event eligibility and weighted selection.
- Choice/outcome framework.
- Starter event set across social/music/weather/health/romance/opportunity/campsite/after-party.
- Alcohol/drug-related narrative choices using existing wellness/risk concepts.
- Idempotency and anti-reroll protection.

### Festival Completion PR 10 — XP/AP/inspiration/achievements

Scope:

- Balanced attendance/day/completion rewards.
- Inspiration/temporary learning effects.
- Genre discovery rewards.
- Achievement integration.
- Anti-farm caps.
- No reward granted twice after retries/reloads.

### Festival Completion PR 11 — Real-player engagement and owner boosts

Scope:

- Engagement score/model.
- Real vs NPC weighting.
- Owner/company reputation/progression effects.
- Future demand/sponsor/vendor signals.
- Unique-attendee and action anti-abuse controls.
- Owner-facing engagement report.

### Festival Completion PR 12 — Real audience performer bonuses

Scope:

- Capped bonus when real attendees actually watch a real player act.
- Integrate crowd/fame/fans/performance XP without replacing canonical gig scoring.
- Performer view/report explains the effect.
- Prevent friend/multi-account click spam from dominating outcomes.

### Festival Completion PR 13 — Completion, recap and attendee history

Scope:

- Automatic `completed` transition after event.
- Final Festival reward settlement.
- End-of-Festival recap.
- Persistent acts/events/people/genre memory data.
- Festival history profile view.
- Wristband collection presentation.

### Festival Completion PR 14 — Owner settlement, results and annual progression certification

Scope:

- End-to-end finance reconciliation.
- Artist fee settlement.
- Final attendance/engagement/satisfaction result.
- Owner/company progression.
- Immutable edition history.
- Next-year planning continuity.
- Failure/retry/reconciliation cases.

### Festival Completion PR 15 — Public discovery, travel and UX completion

Scope:

- Complete public Festival card/page information.
- Ticket/camping/VIP clarity.
- Travel/check-in guidance.
- Calendar integration.
- Mobile/responsive attendee flow.
- Empty/loading/error states.
- Accessibility pass.

### Festival Completion PR 16 — Admin operations and balancing

Scope:

- Admin Festival dashboard/diagnostics.
- Stuck lifecycle and settlement observability.
- Audited recovery actions.
- Balance/config surfaces for rewards, attendance, engagement and event weighting.

### Festival Completion PR 17 — Legacy retirement + final certification

Scope:

- Regenerate complete Festival caller inventory.
- Remove/disable duplicate legacy player routes and RPCs where parity exists.
- Archive/preserve required historical data.
- Remove dead navigation.
- End-to-end test matrix.
- Security/RLS/privilege review.
- Migration/reconciliation verification.
- TypeScript/lint/build/Festival gate.
- Mobile smoke tests.
- Mark this document complete only after all completion criteria pass.

---

## 7. Cross-system rules that must not be broken

1. **One source of truth per concept.** Do not create a second Festival ticket, performance, finance, relationship, wellness or scheduling engine if an authoritative RockMundo system already exists.
2. **Character-level attendance.** Festival attendance belongs to the active character/profile, not merely the account.
3. **Server authority.** Check-in, activity completion, rewards, spending, engagement, performance bonuses and settlement must be validated server-side.
4. **Exact-once money/rewards.** Every debit, credit, reward and settlement step must be idempotent.
5. **Edition scope.** Runtime/ticket/lineup/result data belongs to the exact annual edition, not merely the Festival company.
6. **Company persists, edition resets.** Upgrades/reputation/company balance persist. Annual dates, lineup, tickets, runtime and results belong to the edition.
7. **Real players matter, NPCs still matter.** Real engagement boosts the Festival but cannot make a Festival with no simulated audience/economy nonsensical.
8. **No forced Festival grind.** XP/AP/buffs should reward participation without making Festivals compulsory for optimal character progression.
9. **Performance engine reuse.** Festivals adapt the canonical gig engine; they do not fork it.
10. **Historical results never silently recompute.** Settled editions use immutable/versioned snapshots.

---

## 8. Attendee state machine target

```text
no ticket
   |
   v
 ticketed
   |
   | eligibility satisfied + explicit check-in
   v
 attending
   |        \
   |         \ explicit early departure
   |          v
   |       left_early
   |
   | Festival ends / authoritative completion
   v
 completed

Exceptional terminal/alternate paths:
- cancelled
- refunded
```

`ready_to_check_in` may remain a derived readiness condition rather than a persisted lifecycle state if that keeps authority simpler. The product should not require a database state transition merely to say that check-in is currently allowed.

---

## 9. Festival Mode target navigation

While authoritative attendance = `attending`, replace the normal broad game navigation with:

- **Festival Home**
- **My Day**
- **Stages**
- **Food & Drink**
- **Activities**
- **Friends / Social**
- **Campsite**
- **Festival Map**
- **My Character**
- **Leave Festival**

Essential character safety/account actions may remain accessible even when full gameplay navigation is reduced.

---

## 10. Minimum attendee gameplay loop

A successful final implementation should support a flow similar to:

1. Find Festival in World Festivals.
2. Buy weekend + camping ticket.
3. Travel to host city.
4. Check in on Festival day.
5. Receive wristband in Festival Keepsakes.
6. Enter Festival Mode.
7. Plan breakfast, stage acts, food, social time and evening headliner.
8. Make choices as energy/hunger/hydration/mood/intoxication/social state changes.
9. Spend money at Festival vendors.
10. Watch real/NPC bands using the actual timetable.
11. Experience social/random events.
12. Decide whether to rest or attend an after-party.
13. Sleep/recover based on camping quality.
14. Repeat for later Festival days.
15. Complete or leave early.
16. Receive recap, XP/AP/inspiration/achievement progress and persistent memories.
17. Festival owner receives the economic/engagement benefit of the real attendee.

---

## 11. Testing strategy

Every new Festival slice should add the narrowest useful automated coverage and preserve the existing Festival integration gates.

Required layers by final completion:

### Database / RPC

- authenticated ownership/character authority
- anon privilege denial
- RLS/private-table boundaries
- idempotency
- optimistic concurrency where used
- exact-edition scoping
- finance exact-once semantics
- reward exact-once semantics
- check-in/travel/date rules
- state transition legality
- settlement retry behaviour

### TypeScript contracts

- strict response parsers
- malformed/missing data rejection
- currency handling
- lifecycle enum handling
- legacy payload rejection where modern contract is mandatory

### UI

- owner workflow progression
- ticket purchase/readiness/check-in
- Festival Mode gating
- planner/activity state
- performer transitions
- recap/history
- mobile/reduced navigation

### End-to-end scenarios

At minimum certify:

1. Owner creates/plans/launches/completes a small Festival.
2. Character buys ticket, travels, checks in, attends and completes.
3. Character leaves early.
4. Attendee is also a performing band member.
5. Festival contains a real player act watched by real players.
6. Festival has zero real attendees but completes through NPC simulation.
7. Ticket is refunded/cancelled before check-in.
8. Festival is cancelled.
9. Finance/reward retry does not double-pay.
10. Multi-day Festival survives logout/login and day rollover.

---

## 12. Security and abuse controls

- No direct authenticated writes to core attendee/runtime/reward/settlement tables unless intentionally protected by RLS and the action is safe.
- Prefer narrow SECURITY DEFINER RPCs with fixed `search_path` and explicit authority checks.
- Do not trust client-provided cost, reward, elapsed time, engagement score, attendance weight or outcome values.
- Rate-limit or deduplicate repeatable Festival actions where they affect rewards/engagement.
- Count meaningful unique participation rather than raw click volume.
- Real-player owner boosts must be capped/configurable.
- Social visibility/actions must follow existing privacy/blocking rules.

---

## 13. Known Risks / Debt Register

| Risk / debt | Current state | Planned resolution |
|---|---|---|
| Attendee check-in/leave may have production-first SQL not yet represented on `main` | Open | Completion PR 1 reconciles canonical + production migrations before Festival Mode |
| Legacy Festival callers/routes remain | Open | Maintain active-caller inventory; retire in Completion PR 17 |
| Festival finance correctness has been changed across several migrations | Needs end-to-end proof | Completion PRs 6 and 14 reconcile attendee spend + final settlement |
| Global CI/Festival gate has previously surfaced stale unrelated assertions | Open repo debt | Keep Festival-specific failures separate; do not mask unrelated failures |
| Large attendee mini-game scope could create one oversized subsystem PR | Managed | Use the bounded PR sequence in section 6 |
| Rewards/real-player weighting could be farmed | Not yet implemented | Server authority, unique-character weighting, caps and idempotency in PRs 10–12 |
| Festival random events could duplicate generic random-event systems | Design risk | Reuse shared event/outcome primitives where practical; Festival owns eligibility/catalogue only |
| Mobile Festival UI can become too complex | Open | Festival Mode intentionally reduced; dedicated responsive completion in PR 15 |

---

## 14. PR Progress Register

This register tracks recent Festival work that forms the baseline for the completion programme.

| GitHub PR | Status | Contribution to completion |
|---|---|---|
| #1596 | Merged | Repaired exact-edition directory contract |
| #1597–#1599 | Merged | Licence duration/capacity rules and upgrade usage metadata |
| #1600 | Merged | Licence operating ceilings and artist search reliability |
| #1601 | Merged | Annual capacity/licence UX and environmental policy |
| #1602 | Merged | Server-authoritative ticket demand |
| #1603 | Merged | Automatic sponsorship and budget forecast |
| #1604–#1605 | Merged | Exact-edition lineup workflow and certification inventory |
| #1607 | Merged | Simplified automatic Festival permit model |
| #1608–#1611 | Merged | Edition-aware runtime/owner currency and security cleanup |
| #1612 | Merged | Launch authority; one confirmed player act required, NPC filler retained |
| #1613 | Merged | Character attendee lifecycle foundation |
| #1614 | Merged | Check-in readiness and wristband keepsakes |
| Completion PR 1 | Not started in repo | Check-in / leave authority and production reconciliation |

Future Festival PRs must append or update this table.

---

## 15. Final Festival completion gate

Do not change this document to **Complete** until all are true:

- [ ] Every Definition of Complete checkbox is either complete or explicitly removed by a documented product decision.
- [ ] Owner can complete one full annual Festival lifecycle without admin/database intervention.
- [ ] Normal character can complete one full attendee lifecycle including ticket, travel, check-in, Festival Mode, activities and recap.
- [ ] Player band can perform at a Festival and receive correct performance/financial outcomes.
- [ ] Real attendee activity visibly affects the Festival/owner in a balanced way.
- [ ] NPC-only Festival still simulates and settles correctly.
- [ ] Finance reconciliation proves no duplicated/missing ticket, vendor, sponsorship, artist fee or settlement transactions.
- [ ] Reward reconciliation proves no duplicated XP/AP/buff/achievement awards.
- [ ] Immutable completed-edition history is stable.
- [ ] Admin diagnostics can identify and recover genuinely stuck Festival state.
- [ ] Legacy player-facing Festival duplication is retired or documented.
- [ ] Festival-specific automated tests pass.
- [ ] Festival & Touring Integration Gate passes for current intended contracts.
- [ ] TypeScript passes.
- [ ] Relevant lint passes without new errors.
- [ ] Production migrations/reconciliation state matches canonical repository intent.
- [ ] Mobile attendee experience is usable.
- [ ] Final manual smoke test is recorded in this document.

When this gate passes, change the header status to **Complete**, record the final PR and date, and move any genuinely optional future enhancements into a separate post-completion roadmap.

---

## 16. Next PR

**Festival Completion PR 1 — Authoritative check-in / leave authority**

Immediate goals:

1. Audit `main` against any already-applied production attendee mutation functions.
2. Reconcile production-first SQL into canonical migrations and migration history.
3. Implement/verify `check_in` and `leave_early` RPC contracts.
4. Consume admission ticket on successful check-in.
5. Verify wristband issuance occurs exactly once from the `attending` transition.
6. Wire frontend actions and cache invalidation.
7. Add focused database, contract and UI tests.
8. Update this document in that PR.

Festival Mode should not be built until this authority layer is merged and stable.

---

## 17. Change log

### 23 August 2026 — Initial living plan

- Created the unified completion plan from the modern Festival replacement architecture and the current merged implementation baseline through PR #1614.
- Recorded the attendee mini-game product direction.
- Added owner, attendee, performer, economy, admin and legacy-retirement completion criteria.
- Established the rule that this document is updated after every future Festival PR until completion.
- Set authoritative check-in / leave repository alignment as the next implementation slice.
