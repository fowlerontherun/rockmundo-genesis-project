# RockMundo Festival Completion Plan

**Status:** Active living plan  
**Created:** 23 August 2026  
**Last updated:** 23 August 2026  
**Baseline:** `main` after merged PR #1617  
**Overall completion:** In progress  
**Current Festival PR:** #1618 — Festival Mode shell + schedule reservation  
**Next planned slice:** Automatic attendee completion + stale-state/reconnect recovery

> This is the single source of truth for completing RockMundo Festivals. Every Festival PR must update this file and the PR Progress Register until the final certification gate passes.

---

## 1. Rule for every Festival PR

Every Festival PR must:

1. Link to this plan in its PR body.
2. State which plan item it implements.
3. Update the relevant checkboxes/status here.
4. Add/update its row in the **PR Progress Register**.
5. Record production-first Supabase migrations/reconciliation.
6. Keep attendance, scheduling, finance, rewards and settlement server-authoritative.
7. Preserve/add focused regression coverage.
8. Keep scope bounded and avoid reviving legacy Festival gameplay.
9. Update the next planned slice.
10. Leave this document accurate when the PR merges; if it does not, the next Festival PR must reconcile it first.

---

## 2. Final product vision

Festivals must connect four experiences:

- **Owner:** create/upgrade a Festival company, plan the annual edition, book acts, sell tickets, operate the event, settle finances, gain reputation/progression and retain history.
- **Attendee:** buy a ticket, travel, check in, receive a wristband, enter a reduced Festival Mode, plan days, watch acts, eat/drink, camp, socialise, attend after-parties, experience events and gain balanced progression.
- **Performer:** apply/be invited, accept a booking, prepare, perform through the canonical gig engine, receive the agreed fee/outcomes and benefit from genuine player audiences.
- **World/admin:** NPC attendance, real-player engagement, sponsors/vendors, event quality, finances, settlement, immutable history, balancing and diagnostics work consistently.

Festival attendance should feel like a temporary mini-game inside RockMundo, not a passive wait timer.

---

## 3. Definition of Complete

### Owner / Festival company

- [x] Modern Festival company type and annual editions.
- [x] Eleven upgrade categories.
- [x] Licence ceilings for usable capacity/stages/acts while allowing infrastructure investment ahead.
- [x] Simplified annual-plan choices.
- [x] Owner ticket price/quantity with server-driven demand.
- [x] Automatic sponsorship + pre-event budget forecast.
- [x] Exact-edition artist applications/invitations/offers/bookings.
- [x] At least one confirmed player act required; NPC filler can fill remaining slots.
- [x] Edition-aware currency across recent owner/runtime surfaces.
- [ ] Planning → launch → live runtime → settlement → results works with no dead ends/legacy dependency.
- [ ] Forecast and final finances reconcile exactly to ledger entries.
- [ ] Real-player engagement affects Festival/company progression.
- [ ] Completed editions become durable read-only history.

### Public / ticket buyer

- [x] Modern public Festival launch/ticket foundation.
- [x] Admission purchase creates character attendee lifecycle.
- [x] Wristband memorabilia model.
- [x] Server-authoritative check-in readiness.
- [ ] Discovery clearly exposes dates/city/lineup/tickets/camping/VIP/quality.
- [ ] Ticket/add-on lifecycle covers purchase, use, cancellation/refund and completed events.

### Attendee mini-game

- [x] Character-level authoritative attendee lifecycle.
- [x] Readiness checks date, city, travel state and valid admission.
- [x] PR #1616: check-in consumes ticket and enters `attending` atomically.
- [x] PR #1616: one wristband issued on successful check-in.
- [x] PR #1616: authoritative/idempotent leave-early mutation.
- [x] PR #1618: check-in rejects overlapping normal schedule commitments.
- [x] PR #1618: successful check-in creates server-owned shared-calendar Festival reservation.
- [x] PR #1618: normal overlapping schedule writes are blocked at the database boundary.
- [x] PR #1618: leaving early releases the Festival schedule reservation.
- [x] PR #1618: `attending` globally activates a reduced responsive Festival Mode shell.
- [x] PR #1618: refresh/back/mobile/desktop paths remain inside Festival Mode while authoritative state is `attending`.
- [ ] Automatic `attending → completed` transition after Festival end.
- [ ] Stale/missing lock or wristband state can self-repair safely.
- [ ] Festival Home evolves to show live Festival day/time and next activity.
- [ ] My Day/Stages/Food & Drink/Activities/Social/Campsite/Map/Character become functional views.
- [ ] Day planner supports 30/60/90-minute blocks and conflict-safe changes.
- [ ] Watching an act resolves against the real Festival timetable.
- [ ] Eat/drink/explore/socialise/rest/camp/after-party activities work.
- [ ] Festival condition stats work: Energy, Hunger, Hydration, Mood, Intoxication, Social.
- [ ] Camping quality affects recovery.
- [ ] Festival random events support choices/consequences.
- [ ] Alcohol connects to wellness/lifestyle trade-offs.
- [ ] Drug-related experiences are contextual risk/reward events, never a simple shop.
- [ ] Social choices connect to relationships/contacts/memories.
- [ ] Balanced XP/AP/inspiration/temporary learning rewards exist with anti-farm caps.
- [ ] End-of-Festival recap and persistent attendance history exist.

### Performing bands/artists

- [x] Player acts can be invited/booked in modern planning.
- [ ] Festival booking blocks performer schedule correctly.
- [ ] Festival performance uses the canonical gig engine/viewer.
- [ ] An attendee performing their own set returns to Festival Mode afterward.
- [ ] Genuine real-player watchers provide capped crowd/fame/fan/performance bonuses.
- [ ] Performance fees/outcomes settle exactly once.

### Economy / real-player owner benefit

- [ ] NPC attendance and real attendance are separate authoritative metrics.
- [ ] Real attendees provide meaningful but capped additional engagement weight.
- [ ] Attendee food/drink/merch spending feeds Festival/company finances exactly once.
- [ ] Engagement measures meaningful activity rather than click volume.
- [ ] Engagement influences reputation, future demand, sponsor/vendor appeal and company progression.
- [ ] Anti-exploit controls cover repeated-action and multi-account farming.

### Admin / operations / quality

- [ ] Admin can inspect Festival company/edition/readiness/tickets/attendees/bookings/runtime/settlement.
- [ ] Safe audited stuck-state recovery exists.
- [ ] Key Festival balance parameters are configurable.
- [ ] Legacy routes/RPCs/tables are retired, archived or explicitly retained with reason.
- [ ] Mobile Festival experience is fully usable.
- [ ] Accessibility/loading/error/empty states are complete.
- [ ] Full Festival type/lint/security/migration/contract/integration certification passes.

---

## 4. Current state

### Stable foundations

The modern replacement already has Festival company ownership, annual editions, upgrades/licence ceilings, simplified planning, server-driven ticket demand, sponsorship/budget forecasting, player-act booking, NPC filler, simplified permits, edition-aware currency, public launch/ticketing, attendee lifecycle, readiness, wristbands and authoritative check-in/leave.

### PR #1618 — Festival Mode + schedule reservation

This slice adds:

- global Festival Mode when the active character is `attending`;
- a responsive reduced shell shared by desktop/mobile;
- Festival Home and visible-but-disabled future Festival navigation areas;
- one canonical `player_scheduled_activities.activity_type = 'festival_attendance'` reservation for the remaining event window;
- check-in blocker `schedule_conflict` rather than silently cancelling existing commitments;
- matching Festival-performance exception so the attendee's own Festival set can later coexist;
- RLS preventing direct creation/update/delete of Festival reservation rows;
- table-boundary trigger preventing direct overlapping normal schedule writes;
- early-leave cancellation of the reservation.

Production migrations:

- `20260823173737_festival_mode_schedule_lock`
- `20260823174030_enforce_festival_schedule_reservation`

Canonical migrations:

- `20291218255000_festival_mode_schedule_lock.sql`
- `20291218255100_enforce_festival_schedule_reservation.sql`

At introduction production had zero attendee rows and zero existing Festival schedule reservation rows.

---

## 5. Remaining workstreams

### A. Attendance lifecycle + recovery

- Automatic completion when the Festival-local date passes the edition end.
- Mark schedule reservation completed/released at completion.
- Reconcile inconsistent `attending` rows with missing lock/wristband/ticket state.
- Preserve idempotency and immutable historical timestamps.
- Keep refresh/relogin driven by server state.

### B. Festival clock + day planner

- Festival-local day/time.
- 30/60/90-minute activity blocks.
- Timeline / next activity / Go Now / Change Plans.
- Missed activity rules.
- Multi-day rollover.

### C. Locations + activities

Locations: actual edition stages, food court, bars, market/merch, campsite, VIP, after-party and medical.

Activities: watch act, eat, drink, explore, socialise, rest, sleep/camp, campfire/music and after-party.

Initial Festival Map is clickable navigation, not a walking simulator.

### D. Temporary Festival condition simulation

Authoritative stats: Energy, Hunger, Hydration, Mood, Intoxication, Social.

Reuse existing wellness/lifestyle effects where practical instead of duplicating permanent health systems.

### E. Music + performer integration

- Watch acts from real timetable.
- Genre exposure/familiarity.
- Inspiration/temporary learning chances.
- Performer schedule commitment.
- Canonical gig engine/viewer.
- Return to Festival Mode after own set.
- Capped genuine-player audience bonus.

### F. Food/drink/merch economy

- Festival vendor catalogue/quality/queues from setup/upgrades.
- Exact-once attendee debit and Festival/company revenue/commission.
- Condition effects.
- Spend contributes to engagement/results.

### G. Social + random events

Social actions include hanging out, watching together, food/drinks, dancing, campsites/campfires, after-parties, contacts/friendship/flirting via existing relationship rules.

Random-event categories: social, music, chaos, weather, health, romance, networking, campsite and after-party. Build a certified starter catalogue first, then expand toward 100+ variants.

### H. Rewards + memories

- Festival-day XP and completion AP.
- Genre discovery/inspiration.
- Temporary learning modifiers.
- Relationship/social rewards.
- Achievement hooks.
- Wristbands + permanent Festival history.
- End recap.
- Server-authoritative reward idempotency/caps.

### I. Real-player engagement + owner benefit

Engagement combines unique real attendees, completion, acts watched, activities, spend, social/after-party activity and satisfaction/outcomes.

Owner effects can include reputation, future demand, sponsor/vendor appeal, company XP/progression and performer interest. All multipliers/caps remain configurable.

### J. Runtime / settlement / history

- Final timetable + attendance feed runtime.
- Ledger-backed revenue/cost reconciliation.
- Artist fees settle once.
- Ticket/sponsorship/F&B/merch/operating lines settle once.
- Results include attendance, engagement, satisfaction, finances and progression.
- Immutable versioned edition snapshot.

### K. Public discovery + travel

Improve browser/detail page and travel guidance while allowing advance ticket purchase but rejecting impossible check-in.

### L. Admin / balancing / legacy retirement

Add diagnostics/recovery/balance controls, maintain active-caller inventory, retire/archive duplicate legacy flows only after modern parity, and preserve settled legacy history.

---

## 6. Logical Festival completion PR sequence

1. **Check-in / leave authority** — #1616 merged.
2. **Festival Mode shell + schedule lock/unlock** — #1618 in progress.
3. **Automatic attendee completion + stale-state/reconnect recovery** — next.
4. **Festival clock + basic day planner**.
5. **Condition stats + Eat/Drink/Explore/Rest**.
6. **Watch Band + timetable integration + inspiration**.
7. **Food/drink/merch authoritative economy**.
8. **Camping + sleep/recovery**.
9. **Social attendee actions + relationships**.
10. **Random-event engine + starter Festival catalogue**.
11. **After-parties + higher-risk night loop**.
12. **XP/AP/buffs/memories + Festival recap**.
13. **Real-player engagement + owner benefits**.
14. **Performer schedule/gig integration + real-audience bonus**.
15. **Owner runtime/settlement/history end-to-end hardening**.
16. **Public discovery/mobile/admin polish**.
17. **Legacy retirement + final Festival certification**.

Do not jump to rewards/random events before attendance lifecycle, Festival Mode, scheduling and activity authority are stable.

---

## 7. Security / anti-exploit rules

- Character identity comes from server current-profile authority.
- Browser cannot choose reward amounts, condition deltas, owner bonuses or settlement results.
- Ticket purchase/check-in/activity/reward/settlement mutations are server authoritative.
- Financial mutations are idempotent and ledger-backed.
- One attendee lifecycle and one wristband per character/edition.
- Admission ticket is consumed once.
- Festival schedule reservation cannot be forged/deleted by the player.
- Real audience counts unique eligible attendees once per performance.
- Engagement/rewards have per-attendee/event/day caps and diminishing returns where needed.
- Owners receive aggregate engagement, not unrestricted private attendee state.
- Admin repair operations require authority + audit logging.

---

## 8. Required end-to-end journeys

### Attendee happy path
Discover → buy admission → travel → eligibility → check in → ticket used → wristband → schedule reserved → Festival Mode → plan/watch/eat/drink/socialise/camp → complete → recap/history → normal UI restored.

### Leave early
Check in → complete some Festival activity → Leave early → confirm → Festival reservation released → future Festival plans cancelled → completed rewards retained → completion reward reduced/withheld → normal UI restored.

### Performer attendee
Attend → own Festival slot appears → canonical gig performance → return to Festival Mode → fatigue/outcomes applied.

### Owner
Plan → player act confirmed → tickets → launch → NPC/real attendees → runtime → settlement → engagement/progression → immutable history → next annual edition.

### Failure/abuse
Wrong city; travelling; not started/finished/cancelled; invalid ticket; schedule conflict; duplicate check-in; direct RPC against another attendee; direct overlapping schedule insert; duplicate rewards; finance retry; relog mid-event; settlement retry.

---

## 9. Known risks / debt

- Legacy Festival code still exists and must not become a second active path.
- Production-first Festival migrations must always be reconciled into canonical repo migrations.
- Some older scheduling subsystems may not yet use the canonical schedule table consistently; later integration certification must find remaining bypasses.
- Finance must be verified against ledgers through final settlement rather than trusted from forecasts alone.
- Ticket consumption currently uses status/update timestamp; dedicated `used_at` can be considered during ticket-lifecycle hardening.
- Real-player engagement/reward multipliers require explicit caps before rollout.

---

## 10. PR Progress Register

| PR | Status | Scope | Plan impact |
|---|---|---|---|
| #1613 | Merged | Character attendee foundation | Ticketed attendee lifecycle |
| #1614 | Merged | Check-in readiness + wristbands | Eligibility + memorabilia |
| #1615 | Merged | Living completion plan | Programme tracker created |
| #1616 | Merged | Authoritative check-in / leave | First writable attendee lifecycle boundary |
| #1617 | Merged | Tracker reconciliation | Plan aligned after #1616 |
| #1618 | **In progress** | Festival Mode + schedule reservation | Reduced attendee shell + server-owned schedule lock |

Every later Festival PR must update this register.

---

## 11. Next planned slice

### Festival Completion PR 3 — automatic completion + recovery

Target scope:

- Server-authoritative transition from `attending` to `completed` once the Festival-local event window has ended.
- Release/complete the associated `festival_attendance` schedule reservation.
- Preserve `checked_in_at`; set `completed_at` exactly once.
- Reconcile/repair safe stale state such as missing schedule reservation or wristband for a genuinely attending character.
- Never recreate a valid admission ticket after it has been consumed.
- Ensure refresh/relogin after completion returns to normal RockMundo UI.
- Add focused lifecycle/recovery tests.
- Update this plan/register in the same PR.

No day planner or rewards in that slice.

---

## 12. Final certification gate

Festivals become **Complete** only when:

- all Definition-of-Complete items are resolved or explicitly removed by product decision;
- attendee, performer and owner end-to-end journeys pass;
- Festival financial ledger reconciliation passes;
- migration/RLS/security checks pass;
- Festival TypeScript/lint/tests pass;
- active-caller inventory has no accidental legacy gameplay callers;
- mobile Festival experience is usable;
- admin diagnostics/recovery exist;
- completed edition history is immutable;
- this file is changed to **Status: Complete** with final PR number and certification evidence.
