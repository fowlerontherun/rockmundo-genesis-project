# RockMundo Festival Completion Plan

**Status:** Active living plan  
**Created:** 23 August 2026  
**Last updated:** 23 August 2026  
**Baseline:** `main` after merged PR #1624  
**Overall completion:** In progress  
**Current Festival PR:** #1625 — Festival condition stats + Eat/Drink/Explore/Rest  
**Next planned slice:** Watch Band + timetable integration + inspiration

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
- [x] PR #1620: automatic `attending → completed` transition after the Festival-local event window ends.
- [x] PR #1620: stale/missing schedule lock or wristband state can self-repair safely for a genuinely checked-in character.
- [x] PR #1620: reconnect/focus/open-session reconciliation returns the UI to authoritative attendance state.
- [x] PR #1623: Festival Home shows authoritative Festival-local day/time and next planned activity.
- [x] PR #1623: Day planner supports 30/60/90-minute blocks, overlap-safe changes, missed-plan history and multi-day planning.
- [x] PR #1625: temporary Festival condition state exists for Energy, Hunger, Hydration, Mood, Intoxication and Social.
- [x] PR #1625: Eat/Drink/Explore/Rest resolve server-side only during their planned time window.
- [x] PR #1625: successful activity resolution is exact-once and persists before/effect/after state.
- [x] PR #1625: completed blocks continue to occupy timeline time and cannot be overlap-stacked.
- [x] PR #1625: Food & Drink and Activities are functional Festival Mode destinations.
- [ ] My Day/Stages/Food & Drink/Activities/Social/Campsite/Map/Character become functional views. **My Day, Food & Drink and Activities are functional; remaining views are intentionally deferred.**
- [ ] Watching an act resolves against the real Festival timetable.
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
- [ ] Safe audited admin stuck-state recovery exists.
- [ ] Key Festival balance parameters are configurable.
- [ ] Legacy routes/RPCs/tables are retired, archived or explicitly retained with reason.
- [ ] Mobile Festival experience is fully usable.
- [ ] Accessibility/loading/error/empty states are complete.
- [ ] Full Festival type/lint/security/migration/contract/integration certification passes.

---

## 4. Current state

### Stable foundations

The modern replacement already has Festival company ownership, annual editions, upgrades/licence ceilings, simplified planning, server-driven ticket demand, sponsorship/budget forecasting, player-act booking, NPC filler, simplified permits, edition-aware currency, public launch/ticketing, attendee lifecycle, readiness, wristbands, authoritative check-in/leave, Festival Mode and an authoritative day planner.

### PR #1618 — Festival Mode + schedule reservation — merged

Added the reduced Festival shell and server-owned shared-calendar reservation.

Production migrations:
- `20260823173737_festival_mode_schedule_lock`
- `20260823174030_enforce_festival_schedule_reservation`

Canonical migrations:
- `20291218255000_festival_mode_schedule_lock.sql`
- `20291218255100_enforce_festival_schedule_reservation.sql`

### PR #1620 — automatic completion + reconnect recovery — merged

Added Festival-local completion, five-minute cron reconciliation, safe stale-state repair and reconnect/focus recovery.

Production migration:
- `20260823175735_festival_attendee_completion_recovery`

Canonical migration:
- `20291218255200_festival_attendee_completion_recovery.sql`

Production cron:
- `festival-attendee-completion` — `*/5 * * * *`

### PR #1623 — Festival clock + basic day planner — merged

Added Festival-local time/day metadata, persistent 30/60/90-minute My Day blocks, conflict-safe planning, missed/cancelled history and multi-day UI.

Production migrations:
- `20260823180812_festival_day_planner`
- `20260823190432_festival_day_planner_indexes`

Canonical migrations:
- `20291218255300_festival_day_planner.sql`
- `20291218255400_harden_festival_day_planner.sql`
- `20291218255500_festival_day_planner_indexes.sql`

Certification note: temporary diagnostics showed no Festival planner lint errors; unrelated repository-wide lint baseline drift and a generated/local Supabase migration-state issue remain separate debt.

### PR #1625 — condition stats + Eat/Drink/Explore/Rest — in progress

This slice adds:

- one temporary server-authoritative condition overlay per attendee/edition;
- Energy, Hunger, Hydration, Mood, Intoxication and Social values, all bounded 0–100;
- compatibility seeding from permanent profile wellness without requiring the newer production `profiles.hydration` column;
- server-side condition evolution in 30-minute elapsed-time ticks;
- exact-once Eat/Drink/Explore/Rest resolution during the activity's own live planner window;
- immutable before/effect/after activity result records;
- `completed` planner history;
- consumed-time protection so completed blocks still prevent overlap stacking;
- Festival Home condition display;
- functional Food & Drink and Activities destinations;
- My Day `Do now` execution for active executable blocks;
- strict frontend parsers and focused regression tests.

Production migration:
- `20260823201547_festival_condition_activities`

Canonical migration:
- `20291218255600_festival_condition_activities.sql`

At introduction production had 205 profiles, one modern Festival edition, zero attendee rows and zero planner rows. After migration there are zero condition/resolution rows, as expected. New direct table grants to `anon`/`authenticated` are absent; public RPC execute is limited to authenticated/service-role callers and internal helpers are not browser-callable.

The `Drink` activity in this slice represents basic hydration only. It does not purchase alcohol or increase Intoxication; commercial drink choices and permanent lifestyle effects remain a later bounded slice.

---

## 5. Remaining workstreams

### A. Attendance lifecycle + recovery

- [x] Automatic completion when the Festival-local event window ends. **PR #1620**
- [x] Mark schedule reservation completed/released at completion. **PR #1620**
- [x] Reconcile safe inconsistent `attending` state with missing lock/wristband/used-ticket marker. **PR #1620**
- [x] Preserve authoritative historical check-in/completion timestamps and idempotent completion. **PR #1620**
- [x] Keep refresh/relogin/focus driven by server reconciliation rather than browser date calculations. **PR #1620**

### B. Festival clock + day planner

- [x] Festival-local day/time. **PR #1623**
- [x] 30/60/90-minute activity blocks. **PR #1623**
- [x] Timeline / next activity / safe future-plan changes. **PR #1623**
- [x] Missed activity state/history rules. **PR #1623**
- [x] Multi-day planning/rollover representation. **PR #1623**
- [x] Eat/Drink/Explore/Rest activity resolution. **PR #1625**
- [ ] Watch Act resolution waits for timetable authority.

### C. Locations + activities

Locations: actual edition stages, food court, bars, market/merch, campsite, VIP, after-party and medical.

- [x] Basic Food & Drink destination for planned Eat/Drink execution. **PR #1625**
- [x] Basic Activities destination for planned Explore/Rest execution. **PR #1625**
- [ ] Stage timetable destination.
- [ ] Campsite/VIP/after-party/medical destinations.
- [ ] Initial clickable Festival Map.

### D. Temporary Festival condition simulation

- [x] Energy, Hunger, Hydration, Mood, Intoxication and Social temporary state. **PR #1625**
- [x] Server-side elapsed-time drift. **PR #1625**
- [x] Bounded Eat/Drink/Explore/Rest effects. **PR #1625**
- [ ] Camping/sleep recovery.
- [ ] Alcohol/lifestyle integration.

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
- Condition effects from concrete purchased items.
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
2. **Festival Mode shell + schedule lock/unlock** — #1618 merged.
3. **Automatic attendee completion + stale-state/reconnect recovery** — #1620 merged.
4. **Festival clock + basic day planner** — #1623 merged.
5. **Condition stats + Eat/Drink/Explore/Rest** — #1625 in progress.
6. **Watch Band + timetable integration + inspiration** — next.
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
- One temporary Festival condition row per attendee/edition.
- One immutable activity resolution per executable planner item.
- Admission ticket is consumed once; recovery may only move `valid → used`, never restore reusable admission.
- Festival schedule reservation cannot be forged/deleted by the player.
- Recovery never cancels unrelated normal commitments to recreate a Festival lock.
- Festival plan creation/cancellation is server-authoritative and scoped to the active character's own attending lifecycle.
- Plan retries are idempotent; overlapping planned blocks cannot be created concurrently.
- Completed blocks continue to consume their original timeline window.
- Activity resolution cannot run before a block starts and cannot apply effects after its block ends.
- Real audience counts unique eligible attendees once per performance.
- Engagement/rewards have per-attendee/event/day caps and diminishing returns where needed.
- Owners receive aggregate engagement, not unrestricted private attendee state.
- Admin repair operations require authority + audit logging.

---

## 8. Required end-to-end journeys

### Attendee happy path
Discover → buy admission → travel → eligibility → check in → ticket used → wristband → schedule reserved → Festival Mode → plan → execute Eat/Drink/Explore/Rest → later watch/socialise/camp → complete → recap/history → normal UI restored.

### Leave early
Check in → complete some Festival activity → Leave early → confirm → Festival reservation released → future Festival plans cancelled → completed rewards retained → completion reward reduced/withheld → normal UI restored.

### Performer attendee
Attend → own Festival slot appears → canonical gig performance → return to Festival Mode → fatigue/outcomes applied.

### Owner
Plan → player act confirmed → tickets → launch → NPC/real attendees → runtime → settlement → engagement/progression → immutable history → next annual edition.

### Failure/abuse
Wrong city; travelling; not started/finished/cancelled; invalid ticket; schedule conflict; duplicate check-in; direct RPC against another attendee; direct overlapping schedule insert; stale missing Festival lock; missing wristband; relog/reconnect at Festival end; duplicate completion; duplicate rewards; overlapping/concurrent planner writes; completed-block overlap stacking; execute activity early; execute after window; duplicate activity resolution; plan outside Festival window; finance retry; settlement retry.

---

## 9. Known risks / debt

- Legacy Festival code still exists and must not become a second active path.
- Production-first Festival migrations must always be reconciled into canonical repo migrations.
- Some older scheduling subsystems may not yet use the canonical schedule table consistently; later integration certification must find remaining bypasses.
- Finance must be verified against ledgers through final settlement rather than trusted from forecasts alone.
- Ticket consumption currently uses status/update timestamp; dedicated `used_at` can be considered during ticket-lifecycle hardening.
- Production permanent wellness is not fully synchronized with repository wellness migrations: `profiles.hydration` is currently absent. PR #1625 intentionally tolerates this rather than coupling Festival Mode to an unrelated rollout.
- Basic Eat/Drink effects are non-commercial placeholders; the later Festival economy must replace/extend them with concrete vendor choices without double-applying effects.
- Intoxication exists now for a stable condition contract, but PR #1625 intentionally provides no alcohol source.
- Real-player engagement/reward multipliers require explicit caps before rollout.
- Project-wide Supabase performance-advisor warnings pre-date the attendee programme and should be handled separately unless a Festival-specific regression appears.
- The repository-wide ESLint error count recently drifted above its stored baseline outside Festival planner files; this remains separate cleanup debt.
- Festival database lifecycle CI has surfaced a generated/local migration named `20291218194417_festival_track_ownership.sql` that is absent from the checked-in failing tree and current `main`; do not patch unrelated Festival migrations to compensate for it.

---

## 10. PR Progress Register

| PR | Status | Scope | Plan impact |
|---|---|---|---|
| #1613 | Merged | Character attendee foundation | Ticketed attendee lifecycle |
| #1614 | Merged | Check-in readiness + wristbands | Eligibility + memorabilia |
| #1615 | Merged | Living completion plan | Programme tracker created |
| #1616 | Merged | Authoritative check-in / leave | First writable attendee lifecycle boundary |
| #1617 | Merged | Tracker reconciliation | Plan aligned after #1616 |
| #1618 | Merged | Festival Mode + schedule reservation | Reduced attendee shell + server-owned schedule lock |
| #1620 | Merged | Automatic completion + reconnect recovery | Server completion, safe stale-state repair and reconnect convergence |
| #1621 | Merged | Tracker reconciliation | Plan aligned after #1620 merged ahead of its documentation commit |
| #1623 | Merged | Festival clock + basic day planner | Authoritative Festival clock, persistent My Day timeline and conflict-safe planning |
| #1624 | Merged | Planner merge/certification cleanup | Restored normal lint wrapper and reconciled #1623 tracker state |
| #1625 | **In progress** | Festival conditions + basic activities | Temporary condition simulation and exact-once Eat/Drink/Explore/Rest |

Every later Festival PR must update this register.

---

## 11. Next planned slice

### Festival Completion PR 6 — Watch Band + timetable integration + inspiration

Target scope:

- Expose the authoritative Festival timetable/stages to attendees.
- Bind `watch_act` planner blocks to a real scheduled Festival performance rather than free text.
- Reject impossible watch blocks that do not overlap the selected performance window.
- Resolve a watched act exactly once against the authoritative booking/performance identity.
- Feed the watch outcome into Festival Mood/Social/Energy/Hydration with bounded server-owned effects.
- Add genre exposure/familiarity and a capped inspiration/temporary-learning chance without introducing general XP/AP rewards yet.
- Distinguish real player acts from NPC filler while preserving one timetable model.
- Add the functional Stages Festival Mode destination.
- Preserve compatibility with a future attendee-performing-own-set path.
- Add focused timetable, identity, overlap, idempotency and inspiration-cap tests.
- Update this plan/register in the same PR.

No commercial F&B/merch economy, random events, social relationship progression, after-parties, broad XP/AP rewards, owner engagement multipliers or performer audience bonuses in that slice.

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
