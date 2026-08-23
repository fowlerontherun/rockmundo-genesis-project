# RockMundo Festival Completion Plan

**Status:** Active living plan  
**Created:** 23 August 2026  
**Last updated:** 23 August 2026  
**Baseline:** `main` after merged PR #1615  
**Overall completion:** In progress  
**Current Festival PR:** #1616 — authoritative attendee check-in / leave  
**Next planned slice:** Festival Mode shell + schedule lock/unlock

> This is the single source of truth for completing RockMundo Festivals. Every Festival PR must update this document and the PR Progress Register until the final certification gate passes.

---

## 1. Working rule for every Festival PR

Before a Festival PR is considered complete it must:

1. Link to this document in the PR body.
2. State which plan item(s) it implements.
3. Update the relevant checklist/status here.
4. Add itself to the **PR Progress Register**.
5. Update **Current State**, **Known Risks / Debt**, and **Next planned slice** where relevant.
6. Record any production-first Supabase migration/reconciliation.
7. Keep finance, attendance, scheduling, rewards and settlement server-authoritative.
8. Preserve/add focused regression coverage.
9. Avoid reopening retired/legacy Festival gameplay unless explicitly required.
10. Keep the PR bounded; split large scopes instead of hiding multiple systems in one change.

If a Festival PR merges without updating this file, the next Festival PR must reconcile it before adding new functionality.

---

## 2. Product vision

Festivals are a connected RockMundo game system with four experiences:

- **Festival owner:** found and upgrade a Festival company, plan an annual edition, book acts, sell tickets, run the event, make/lose money, build reputation and progress the company.
- **Attendee:** buy a ticket, travel, check in, receive a wristband, enter Festival Mode, plan each day, watch bands, eat/drink, camp, socialise, attend after-parties, experience events and earn balanced rewards.
- **Performing artist/band:** apply/be invited, accept a booking, prepare and perform through the canonical gig engine, receive fees/outcomes and benefit from genuine player audiences.
- **World/admin simulation:** NPC attendance, real-player engagement, sponsors, vendors, weather/events, finances, settlement, immutable history and diagnostics all interact consistently.

The attendee experience should feel like a temporary **Festival mini-game inside RockMundo**, not a passive “Attend → wait → collect reward” activity.

---

## 3. Definition of Complete

### Festival company / owner

- [x] Modern Festival company type exists.
- [x] Company setup and annual edition planning exist.
- [x] Eleven upgrade categories exist.
- [x] Licence rules cap usable capacity/stages/acts without preventing infrastructure investment ahead.
- [x] Simplified annual-plan choices exist.
- [x] Ticket price and quantity are owner-controlled while demand is server-driven.
- [x] Automatic sponsorship and budget forecasting exist.
- [x] Exact-edition applications/invitations/offers/bookings exist.
- [x] At least one confirmed player act is required before launch; NPCs can fill remaining slots.
- [x] Festival currency is edition-aware across recent owner/runtime surfaces.
- [ ] Owner can go planning → launch → live runtime → settlement → results without dead ends/legacy dependency.
- [ ] Forecast and final Festival finances reconcile exactly.
- [ ] Real player engagement affects owner/company progression.
- [ ] Completed editions become durable read-only history.

### Public / ticket buyer

- [x] Modern public Festival launch/ticket foundation exists.
- [x] Admission purchase creates authoritative character attendee lifecycle.
- [x] Wristband memorabilia model exists.
- [x] Server-authoritative check-in eligibility exists.
- [ ] Discovery page fully communicates lineup, dates, city, ticket availability, camping/VIP and Festival quality.
- [ ] Ticket/add-on lifecycle is complete for purchase, use, cancellation/refund and completed events.

### Attendee mini-game

- [x] Authoritative attendee lifecycle exists.
- [x] Readiness checks Festival date, city, travel state and ticket validity.
- [x] **PR #1616:** check-in atomically consumes the admission ticket and enters `attending`.
- [x] **PR #1616:** successful check-in issues exactly one wristband through the existing trigger.
- [x] **PR #1616:** player can leave early through an authoritative/idempotent mutation.
- [ ] Automatic completion transition after Festival end.
- [ ] Festival attendance blocks incompatible normal scheduling.
- [ ] `attending` activates reduced Festival Mode navigation/layout.
- [ ] Festival Home/My Day/Stages/Food & Drink/Activities/Social/Campsite/Map/Character/Leave views exist.
- [ ] Day planner supports 30/60/90-minute blocks and conflict-safe plan changes.
- [ ] Player can watch real timetable performances.
- [ ] Player can eat, drink, explore, socialise, rest, camp and attend after-parties.
- [ ] Festival condition stats work: Energy, Hunger, Hydration, Mood, Intoxication, Social.
- [ ] Camping quality affects recovery.
- [ ] Festival random events support choices and consequences.
- [ ] Alcohol connects to wellness/lifestyle trade-offs.
- [ ] Drug-related content is contextual event/choice based, never a simple shop, with meaningful downside risk.
- [ ] Social choices affect relationships/contacts/memories through existing systems.
- [ ] Balanced XP/AP/inspiration/temporary learning rewards exist with anti-farm caps.
- [ ] End-of-Festival recap/history exists.

### Performing bands/artists

- [x] Player acts can be invited/booked in modern edition planning.
- [ ] Festival booking blocks performer schedule correctly.
- [ ] Festival performance uses the canonical gig performance engine.
- [ ] Performer who is also attending returns to Festival Mode after their set.
- [ ] Genuine player watchers provide capped atmosphere/fame/fan/performance bonuses.
- [ ] Performance fees/outcomes settle once.

### Economy / owner benefit

- [ ] NPC and real attendance remain separate authoritative metrics.
- [ ] Real-player attendance carries meaningful but capped additional engagement weight.
- [ ] Attendee food/drink/merch spending feeds Festival/company finances.
- [ ] Engagement tracks meaningful activity, not click spam.
- [ ] Engagement influences reputation, future demand, sponsor/vendor appeal and Festival/company progression.
- [ ] Exploit controls cover repeated actions/multi-account farming.

### Admin / operational quality

- [ ] Admin can inspect Festival company/edition/readiness/tickets/attendees/bookings/runtime/settlement.
- [ ] Admin has safe, audited stuck-state recovery tools.
- [ ] Key Festival balance parameters are configurable.
- [ ] Legacy Festival routes/RPCs/tables are retired, archived or explicitly retained with reason.
- [ ] Mobile/responsive Festival pages and Festival Mode are usable.
- [ ] Accessibility/loading/error/empty states are complete.
- [ ] Final Festival-specific type/lint/security/migration/contract/integration gates pass.

---

## 4. Current State — 23 August 2026

### Strong implemented foundations

- Festival company ownership and finance integration.
- Annual editions/planning.
- Eleven-category upgrades and licence ceilings.
- Server-driven ticket demand.
- Automatic sponsorship and owner budget forecast.
- Exact-edition player artist booking workflow.
- NPC filler after one confirmed player act.
- Simplified permit model.
- Edition-aware currency.
- Modern public launch/ticket system.
- Character attendee lifecycle from issued admission tickets.
- Server-derived check-in readiness.
- Wristband keepsakes in Inventory Manager.

### Current implementation — PR #1616

PR #1616 establishes the first writable attendee lifecycle boundary:

- `check_in_to_festival(uuid)` is server authoritative.
- Active character ownership is revalidated.
- Admission ticket is locked/revalidated.
- Festival launch/edition dates are revalidated in Festival-local time.
- Character must not be travelling and must be in the Festival city.
- Ticket changes `valid → used` in the same transaction as attendance `ticketed/ready_to_check_in → attending`.
- Existing attendance trigger issues one wristband.
- Repeated check-in returns the existing state but rejects inconsistent reusable-ticket state.
- `leave_festival_early(uuid)` changes only `attending → left_early` and is idempotent.
- Public Festival page exposes Check in and confirmed Leave early actions.
- Cache refresh covers attendance, eligibility, ticket wallet and memorabilia.

Production migration applied:

`20260823172648_harden_festival_attendee_checkin_leave`

Canonical repository migration:

`20291218254500_festival_attendee_checkin_leave.sql`

---

## 5. Completion workstreams

### A — Attendance authority + Festival Mode

- Check-in / leave authority. **PR #1616**
- Automatic completion after Festival end.
- Schedule block/unblock.
- Festival Mode route/layout/nav.
- Refresh/reconnect recovery.

### B — Day planner + Festival clock

- Festival-local day/time.
- 30/60/90-minute activity slots.
- Planned timeline.
- Go Now / Change Plans.
- Missed activity rules.
- Multi-day rollover.

### C — Locations + core activities

Locations: stages, food court, bars, market/merch, campsite, VIP, after-party, medical.

Activities: watch act, eat, drink, explore, socialise, rest, sleep/camp, campfire/music, after-party.

Initial map is clickable navigation, not a walking simulator.

### D — Festival condition simulation

Authoritative temporary stats:

- Energy
- Hunger
- Hydration
- Mood
- Intoxication
- Social

Connect effects to existing wellness/lifestyle systems where possible.

### E — Music + performer integration

- Watch real edition timetable.
- Genre familiarity/exposure.
- Inspiration/temporary learning chances.
- Performer schedule commitment.
- Canonical gig viewer/engine integration.
- Return to Festival Mode after own set.
- Capped genuine player-audience bonus.

### F — Food/drink/merch economy

- Vendor catalogue/quality/queues driven by Festival setup/upgrades.
- Exact-once player debit and Festival/company revenue/commission.
- Condition effects.
- Spending feeds engagement/results.

### G — Social + random events

Social actions: hang out, watch together, food/drinks, dance, campsite/campfire, after-party, contacts/friendship/flirting through existing relationship rules.

Random event categories: social, music, chaos, weather, health, romance, networking, campsite, after-party.

Build a smaller certified starter catalogue first, then expand toward 100+ variants.

### H — Rewards + memories

- Daily Festival XP.
- Completion AP.
- Genre discovery/inspiration.
- Temporary learning modifiers.
- Relationships/social rewards.
- Achievement hooks.
- Wristbands and permanent Festival history.
- End recap.
- Server-authoritative reward idempotency/caps.

### I — Real-player engagement + owner benefit

Engagement sources:

- unique real attendees
- check-in/completion
- acts watched
- activities
- attendee spend
- social/after-party activity
- satisfaction/outcomes

Owner effects may include reputation, next-edition demand, sponsor/vendor appeal, Festival/company XP and performer interest. All are configurable/capped.

### J — Runtime/settlement/history

- Final timetable and attendance feed runtime.
- Ledger-backed revenue/cost reconciliation.
- Artist fees settle once.
- Ticket/sponsor/F&B/merch/operating lines settle once.
- Results include attendance, engagement, satisfaction, finances and progression effects.
- Immutable versioned edition snapshot.

### K — Public discovery/travel

- Strong Festival browser/detail surface.
- Travel guidance.
- Advance purchase allowed while impossible check-in is blocked.
- Correct cancellation/refund messaging.

### L — Admin/balancing/legacy retirement

- Diagnostics and safe recovery.
- Balance configuration.
- Active-caller inventory.
- Retire/archive duplicate legacy flows after modern parity.
- Preserve settled legacy history.

---

## 6. Planned Festival completion PR sequence

Logical sequence; scopes may be split further if needed.

1. **Check-in / leave authority** — **PR #1616, in progress**.
2. **Festival Mode shell + schedule lock/unlock**.
3. **Automatic attendee completion + reconnect recovery**.
4. **Festival clock + basic day planner**.
5. **Condition stats + basic Eat/Drink/Explore/Rest**.
6. **Watch Band + timetable integration + inspiration**.
7. **Food/drink/merch authoritative economy**.
8. **Camping + sleep/recovery**.
9. **Social attendee actions + relationships**.
10. **Random-event engine + starter Festival catalogue**.
11. **After-parties + higher-risk night loop**.
12. **XP/AP/buffs/memories + Festival recap**.
13. **Real-player engagement model + owner benefits**.
14. **Performer schedule/gig integration + real-audience bonus**.
15. **Owner runtime/settlement/history end-to-end hardening**.
16. **Public discovery/mobile/admin polish**.
17. **Legacy retirement + full Festival certification**.

Do not jump ahead to random events/rewards before Festival Mode, scheduling and activity authority are stable.

---

## 7. Security and authority rules

- Character identity comes from server current-profile authority.
- Browser never supplies reward amounts, condition deltas, owner bonuses or settlement results.
- Ticket purchase/check-in/activity/reward/settlement mutations are server authoritative.
- Financial mutations are idempotent and ledger-backed.
- Sensitive tables remain RLS protected; direct table writes are not a substitute for RPC authority.
- Authenticated users can only mutate their own attendee lifecycle through narrow RPCs.
- Festival owners see aggregate attendee/engagement data, not unrestricted private player state.
- Admin recovery operations require explicit authority and audit logging.

---

## 8. Anti-exploit rules

- One attendee lifecycle per character + edition.
- One wristband per attendee + edition.
- Admission ticket consumed once.
- One meaningful reward per resolved activity/event where relevant.
- Real-player audience counts unique eligible attendees once per performance.
- Engagement rewards are capped per attendee/event/day.
- Repeat identical activities can have diminishing/no extra reward.
- Owner progression cannot be inflated through raw click volume.

---

## 9. Required end-to-end test journeys

### Attendee happy path

Discover → buy admission → travel → eligibility opens → check in → ticket used → wristband appears → Festival Mode → plan day → watch/eat/drink/socialise/camp → complete event → recap/history → normal navigation restored.

### Leave early

Check in → complete some activities → choose Leave early → confirm → future plans cancelled → completed rewards preserved → completion reward withheld/reduced → normal scheduling restored.

### Performer attendee

Buy/hold admission → attend Festival → performer slot appears automatically → preparation/performance uses canonical gig engine → return to Festival Mode → performance fatigue/outcomes applied.

### Owner

Plan annual edition → confirm player act → tickets → launch → real/NPC attendees → runtime → settlement → engagement/reputation/progression → immutable results/history → next annual edition.

### Failure/abuse

- wrong city
- still travelling
- not started / finished / cancelled Festival
- invalid/used/refunded ticket
- duplicate check-in
- direct RPC against another attendee ID
- duplicate reward request
- finance retry
- attendee refresh/relogin mid-event
- settlement retry

---

## 10. Known risks / debt

- Legacy Festival code still exists and must not become a second active path again.
- Production-first Festival migrations require repository reconciliation discipline.
- Global repo CI sometimes exposes unrelated stale touring/migration assertions; Festival failures must be separated from unrelated debt, not hidden.
- Finance must be certified against ledger entries through final settlement, not inferred from UI forecasts.
- `festival_issued_tickets` currently tracks consumption through `status`/`updated_at`; a dedicated use timestamp can be considered in the later full ticket-lifecycle hardening if useful.
- Real-player engagement/reward systems will need explicit caps before rollout.

---

## 11. PR Progress Register

| PR | Status | Scope | Plan impact |
|---|---|---|---|
| #1613 | Merged | Character attendee foundation | Added ticketed attendee lifecycle |
| #1614 | Merged | Check-in readiness + wristband keepsakes | Added eligibility + memorabilia |
| #1615 | Merged | Living Festival completion plan | Established this programme tracker |
| #1616 | **In progress** | Authoritative check-in / leave | Completes first attendee mutation boundary |

Every later Festival PR must add/update its row here.

---

## 12. Next planned slice

After #1616 is merged and certified:

### Festival Completion PR 2 — Festival Mode shell + schedule lock/unlock

Target scope:

- Detect authoritative `attending` state globally.
- Introduce Festival Mode route/layout/navigation.
- Restrict normal deep gameplay while attending.
- Create Festival Home shell with Festival/time/next-state information.
- Add authoritative schedule/activity block for the Festival attendance period.
- Release locks on `left_early` and later `completed`.
- Preserve permitted Festival performer activity.
- Make refresh/relogin return the player to Festival Mode.
- Update this document and progress register in the same PR.

No day planner, rewards or random events in that slice.

---

## 13. Final certification gate

Festivals are only **Complete** when:

- all Definition-of-Complete checkboxes are resolved or explicitly removed by product decision;
- owner, attendee and performer happy paths pass end to end;
- Festival financial ledger reconciliation passes;
- migration/RLS/security checks pass;
- Festival-focused TypeScript/lint/tests pass;
- active-caller inventory shows no accidental legacy gameplay callers;
- mobile Festival experience is usable;
- admin diagnostics exist;
- completed edition history is immutable;
- this document's status is changed to **Complete** with final PR number and certification evidence.
