# Festival Feature Expansion Tasks

> **Canonical festival-domain audit notice (2026-07-16):** This task list predates the canonical festival-domain audit in [`docs/festivals/CURRENT_STATE_AUDIT.md`](festivals/CURRENT_STATE_AUDIT.md). Implementation should now follow that audit and the proposed ADR in [`docs/architecture/ADR-FESTIVAL-DOMAIN-CANONICALISATION.md`](architecture/ADR-FESTIVAL-DOMAIN-CANONICALISATION.md). Do **not** add further writes to legacy festival tables such as `game_events` festival rows or `festival_participants` except for explicitly documented compatibility/projection work. Schema-dependent tasks are blocked until the canonical migration begins. Status labels below are repository-grounded and conservative: a component name alone is not treated as proof of completion.

Below are 50 actionable tasks to implement the previously outlined festival experience enhancements across player, admin, social, and systems layers.

1. **Status: partially implemented — negotiation UI/hook exists, but acceptance is browser-random and not canonical.** Add a contract negotiation UI for festival applications with sliders for payout split, exposure bonus, and optional merch cut.
2. **Status: blocked by canonical migration — contract terms need canonical application/contract tables and server validation.** Persist negotiated contract terms in the application submission payload and validate server-side.
3. **Status: partially implemented — projection components/utilities exist, but not authoritative.** Display projected fame/finance impacts of different contract configurations before submitting an application.
4. **Status: blocked by canonical migration — requires contract lifecycle and server settlement.** Integrate cancellation/no-show clauses into contract terms with penalties and refunds reflected in player stats.
5. **Status: partially implemented — conflict hook/component exists as advisory checks.** Implement schedule conflict detection between festivals, tours, rehearsals, and travel commitments before applying.
6. **Status: partially implemented — warning UI exists; alternative slots are not authoritative.** Surface conflict warnings and suggested alternative slots when conflicts are detected.
7. **Status: partially implemented — stage/slot UIs exist, but source tables are hybrid.** Add lineup availability indicators per slot/stage/time on the player festival page.
8. **Status: partially implemented — setlist UI exists.** Build a setlist editor UI that lets players pick songs with time/stamina budgets per slot.
9. **Status: blocked by canonical migration — legacy `updateSetlist` does not persist setlists.** Connect the setlist editor to the existing `updateSetlist` functionality and persist per-slot setlists.
10. **Status: partially implemented — validation UI exists in places, persistence remains blocked.** Show setlist length/time validation errors inline during editing.
11. **Status: still required — no confirmed canonical recommendation service.** Add energy/genre-based slot recommendations based on band profile and festival audience data.
12. **Status: partially implemented — crowd projection UI exists.** Provide crowd-size projections per stage/time and display them in the slot selection UI.
13. **Status: still required — checklist is not authoritative.** Implement a performance readiness checklist (gear, travel, soundcheck) per confirmed slot.
14. **Status: still required — no canonical penalty service.** Add countdown timers for soundcheck and performance windows with late/no-show penalties.
15. **Status: still required — no authoritative gear block for festival performance.** Implement gear requirement validation and block performances if requirements are unmet.
16. **Status: partially implemented — schedule conflict checks exist but not booking authority.** Add travel time calculations between scheduled events and enforce arrival windows.
17. **Status: still required.** Create collaboration support allowing featured artists/guest spots in festival performances.
18. **Status: partially implemented — rivalry tables/cards exist but scoring authority remains client-side/unclear.** Introduce rivalry objectives (e.g., outperform rival band) affecting performance scoring.
19. **Status: partially implemented — live loop exists but is client-authoritative.** Build a live performance minigame loop for "Perform Now" that feeds performance metrics into rewards.
20. **Status: partially implemented — outcomes display exists; settlement is unsafe client-side.** Surface fame/payment/merch outcomes immediately after performance with detailed breakdowns.
21. **Status: partially implemented — history/reviews tables and cards exist; server authority missing.** Store post-show reviews and highlight reels linked to performances for reputation effects.
22. **Status: partially implemented — lineup/stage details display from hybrid sources.** Display festival lineup details (bands, stages, times) on the player page using existing lineup fetchers.
23. **Status: partially implemented — history views exist but data is incomplete across flows.** Add history view with past performance metrics, rewards, and reviews for each festival participation.
24. **Status: partially implemented — tickets/attendance/projection UI exists.** Integrate ticket/attendance projections into the player-facing festival selection UI.
25. **Status: partially implemented — lifecycle controls exist, but no canonical edition state machine.** Implement admin draft/publish/postpone/cancel states for festivals with state transition rules.
26. **Status: partially implemented — admin edit paths exist across legacy/dedicated screens.** Add admin controls to toggle `is_active`, capacity limits, and participant caps per stage.
27. **Status: partially implemented — admin edit dialog exists in legacy admin.** Build an admin edit dialog prefilled with festival data and wire it to an update mutation.
28. **Status: partially implemented — payouts/finances can be edited in hybrid admin/detail tools.** Provide admin forms to configure rewards/payout structures per slot and per stage.
29. **Status: partially implemented — slots can assign bands, but not via canonical participant/contract model.** Implement admin ability to assign bands/slots with payouts using the existing add participant mutation.
30. **Status: partially implemented — bulk review panel exists.** Enable bulk application review actions (approve/deny/waitlist) with rubric scoring.
31. **Status: blocked by canonical migration — accepted applications do not consistently propagate to slots/contracts/player views.** Connect application decisions to participant statuses and propagate to player-facing views.
32. **Status: still required — no confirmed server-side rule check.** Add automatic rule checks (genre fit, reputation threshold) before admin approval.
33. **Status: partially implemented — application queue screen exists but is not registered as a route.** Create a moderation queue with filtering/sorting for pending applications.
34. **Status: still required — no festival-specific audit log confirmed.** Implement audit logging for admin actions on festivals and applications.
35. **Status: still required — no authoritative regional blackout validation confirmed.** Add blackout window validation to prevent overlapping festivals in the same region.
36. **Status: blocked by canonical migration — needs edition lifecycle, refunds and ledger.** Integrate postponement/cancellation logic with refund handling for payouts and tickets.
37. **Status: partially implemented — ticket table/hook exists, but tier inventory authority is incomplete.** Implement ticket tier management with dynamic pricing and inventory tracking per festival.
38. **Status: partially implemented — finance views exist but summary and ledger overlap.** Add UI for ticket sales metrics (sold/remaining) and revenue splits per stage/vendor.
39. **Status: partially implemented — merch components/tables exist; vendor/stall authority missing.** Support merch/food stall slot assignments and revenue sharing configuration.
40. **Status: partially implemented — owner/finance dashboards exist in pieces.** Build dashboards for attendance, revenue, satisfaction, and performance metrics.
41. **Status: still required — no authoritative changeover validation confirmed.** Add changeover buffer scheduling and validation between consecutive stage slots.
42. **Status: partially implemented — staff exists; crew conflict resolution not confirmed.** Implement crew/engineer assignment and conflict resolution for stages and times.
43. **Status: still required — no authoritative tech rider validation confirmed.** Validate tech riders and gear requirements against available resources before approvals.
44. **Status: partially implemented — offer trigger/notifications exist; reminders/lineup change flow incomplete.** Add notifications/hooks for lineup changes, slot times, and performance reminders.
45. **Status: still required.** Introduce fan voting for open slots with weighted results influencing lineup decisions.
46. **Status: requires verification — poster/flyer generation was not confirmed in active festival routes.** Generate shareable lineup posters/flyers and embed them on festival detail pages.
47. **Status: partially implemented — map view exists.** Add map view of festivals with travel costs and suggested tour routing.
48. **Status: partially implemented — sponsorship tables/hooks exist but are not canonical.** Integrate sponsorships/brand alignments affecting rewards and audience mood.
49. **Status: partially implemented — duplicate checks exist client-side; server anti-cheat still required.** Add anti-cheat checks to prevent duplicate applications and enforce participant caps.
50. **Status: blocked by canonical migration — admin screens should be consolidated after authority model is introduced.** Consolidate the two admin festival screens into a single lifecycle management interface.

### Canonical booking/contracts PR

- [x] Add edition-scoped applications, offers, immutable revisions, contracts, signatures, setlists and audit events.
- [x] Add safe public edition read function and public lineup projection.
- [x] Keep legacy participant flows as compatibility data pending performance-session migration.
- [ ] Add canonical performance sessions, readiness and settlement in later PRs.


- [x] Harden canonical booking contracts and setlists with idempotency, authority helpers, reservations, immutable versions, schedule integration and behavioural harness coverage.

## Canonical booking UI migration

- `/festivals` is now the canonical player booking hub for discovery, applications, offers, contracts and preparation.
- `/festivals/:festivalId/manage` uses the canonical booking workspace for organiser review queues.
- Performance sessions and settlement remain deferred to a later PR.

## Canonical booking UI hardening checkpoint

- [x] Split PR #1195 booking UI scaffold into focused booking modules.
- [x] Add stable deliberate-action idempotency key handling for booking mutations.
- [x] Replace raw offer/contract JSON summaries with readable booking terms sections.
- [ ] Complete server-projected direct invitations, repertoire-backed setlist picker and realtime invalidation before performance-session work.

## PR: audience simulation and performance outcomes

- Added canonical audience generations, aggregate cohorts, stage crowd snapshots, immutable performance audience snapshots, song outcomes, performance outcomes, fan conversion proposals, pending effects, media/sponsor outcomes, highlights and public projections.
- Effects are stored as pending application only; financial and career settlement remains deferred.

## Festival stabilisation gate

Further festival expansion should remain paused until the stabilisation harness, clean migration chain, and owner/admin route smoke tests pass in CI or a developer environment with Supabase CLI support.
