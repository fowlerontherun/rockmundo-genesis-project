# RockMundo Steam Release Master Plan

**Document status:** Draft master plan  
**Last updated:** 30 August 2026  
**Product:** RockMundo — persistent online music-career simulation  
**Recommended route:** Steam Playtest → Steam Early Access → version 1.0  
**Planning status values:** Not started / In progress / Blocked / Complete / Deferred  
**Priorities:** P0 = release blocker, P1 = required for a credible launch, P2 = desirable or post-launch

---

## 1. Purpose

This document is the single master plan for making RockMundo ready to release on Steam. It covers product scope, game stability, the desktop client, Steamworks integration, backend and database readiness, security, quality assurance, legal and commercial work, store preparation, launch operations, and post-release support.

This is a release-readiness plan, not a promise to ship every idea ever proposed for RockMundo. Every feature shown on the Steam store page must be present and working in the release build. Any unfinished feature must either be completed, clearly labelled as planned, or removed from the launch build and store claims.

## 2. Recommended release strategy

RockMundo should not go directly from the current web beta to a paid Steam release. The safest route is:

1. **Stabilise a complete core game loop** outside Steam.
2. **Package RockMundo as a proper desktop application** that starts, updates, authenticates, and closes cleanly through Steam.
3. **Run a limited Steam Playtest** to validate installation, account linking, desktop behaviour, backend capacity, and retention without exposing the main product to paid reviews.
4. **Release into Steam Early Access** only when the current build is enjoyable and worth its launch price in its present state.
5. **Move to version 1.0** when the advertised feature set is complete, balanced, scalable, and supported operationally.

Steam Early Access is appropriate only if player feedback will still influence RockMundo’s development. It must not be used merely as a substitute for final bug testing.

### 2.1 Decisions that must be made before implementation is locked

| ID | Decision | Recommended starting position | Owner | Due | Status |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | Release route | Steam Playtest, then Early Access | Product | TBD | Not started |
| DEC-002 | Business model | Choose paid Early Access + cosmetic purchases, or free-to-play + cosmetics; do not combine unclear subscription and purchase models | Product/Finance | TBD | Not started |
| DEC-003 | Early Access launch price | Set a price justified by the current build, with a documented path to the 1.0 price | Product/Finance | TBD | Not started |
| DEC-004 | Steam account experience | New Steam players receive a RockMundo account automatically; existing players can securely link one existing account | Product/Engineering | TBD | Not started |
| DEC-005 | Supported platforms | Windows first; Steam Deck/SteamOS support assessed after the desktop-client spike | Engineering | TBD | Not started |
| DEC-006 | Controller target | Full controller support for Steam Deck if achievable; otherwise clearly declare keyboard/mouse requirements | Product/Engineering | TBD | Not started |
| DEC-007 | Launch languages | English at minimum; select additional store and in-game languages from demand and support capacity | Product/Community | TBD | Not started |
| DEC-008 | Wipe policy | Decide whether Playtest/Early Access progress persists, partially resets, or is wiped; disclose before players join | Product | TBD | Not started |
| DEC-009 | Existing beta migration | Define entitlement, account, character, currency, and cosmetic treatment for current players | Product/Engineering | TBD | Not started |
| DEC-010 | Online-only policy | RockMundo remains server-authoritative and online-only; communicate outages and maintenance gracefully | Product/Operations | TBD | Not started |

## 3. Release principles

- **No data belonging to the wrong character, account, or band may ever be displayed or mutated.**
- **The server is authoritative** for time, money, XP, AP, rewards, charts, travel, activities, inventory, purchases, and achievements.
- **Every financial and reward operation is idempotent and auditable.** Retries must not duplicate money, XP, items, or entitlements.
- **No unfinished feature is advertised as available.**
- **No critical path ends in a raw database, RLS, Edge Function, HTTP, or JavaScript error.**
- **The game must explain why an action is unavailable and what the player can do next.**
- **Steam users must receive a desktop-quality experience**, not an unexplained browser window wrapped in an executable.
- **A rollback path is required for every client, backend, database, economy, and store release.**
- **Cosmetic monetisation must remain non-pay-to-win** if that remains RockMundo’s public promise.

## 4. Definition of Steam-release-ready

RockMundo is ready to release only when all of the following are true:

- [ ] The launch feature set and Early Access roadmap are approved and frozen.
- [ ] Every P0 and P1 launch item in this plan is complete or explicitly removed from launch scope.
- [ ] There are zero open Severity 1 or Severity 2 defects.
- [ ] All core journeys pass on a clean Steam installation and a clean RockMundo account.
- [ ] Multiple-character isolation tests pass with no cross-character data leakage.
- [ ] The economy reconciliation report has no unexplained balance differences.
- [ ] Steam authentication, ownership checks, account linking, and unlink/recovery flows pass security testing.
- [ ] Steam Wallet purchases, fulfilment, refunds, duplicate callbacks, and fraud controls pass end-to-end testing if purchases are enabled.
- [ ] A restore drill proves production data can be recovered within the agreed RPO and RTO.
- [ ] Load and soak tests show that the backend can handle the planned launch concurrency with headroom.
- [ ] Monitoring, alerting, status communication, support tooling, and on-call ownership are active.
- [ ] The release candidate has completed a representative Steam Playtest and its launch-blocking findings are resolved.
- [ ] The Steam store page and build have passed Valve review.
- [ ] The Coming Soon page has been public for at least Steam’s minimum period.
- [ ] Legal, tax, bank, content, AI-content, age-rating, privacy, and company details are complete.
- [ ] The go/no-go meeting records a unanimous go from Product, Engineering, QA, Operations, Community/Support, and Commercial/Legal owners.

## 5. Release gates

| Gate | Outcome | Exit evidence |
| --- | --- | --- |
| G0 — Strategy approved | Release route, price model, audience, platform, scope, and wipe policy are decided | Signed decision log and launch-scope document |
| G1 — Core game stable | A player can complete the core solo and band career loops without critical failure or data leakage | Automated test report, regression report, economy reconciliation, accepted bug list |
| G2 — Desktop client ready | The game installs and runs through Steam like a desktop product | Clean-machine test evidence, security review, crash and performance results |
| G3 — Steam integration ready | Authentication, ownership, overlay, achievements, input, purchases, branches, and depots work as scoped | Steamworks integration test report |
| G4 — Playtest passed | Real Steam users can install, play, pay if enabled, report issues, and return without operational failure | Playtest report, retention funnel, support themes, capacity results |
| G5 — Store and compliance ready | Store claims match the build and all required commercial/content data is approved | Store asset pack, copy sign-off, content survey, legal sign-off |
| G6 — Valve approved | Store presence and near-final build are accepted | Steamworks shows both as ready for release |
| G7 — Operational go | Team can launch, observe, support, rollback, and recover | Approved launch runbook, rota, rollback rehearsal, status page |
| G8 — Early Access launched | Release is live and stable | Launch checklist, health dashboard, incident log |
| G9 — Version 1.0 ready | Early Access exit criteria and promised 1.0 scope are satisfied | 1.0 scope report, player feedback closure, Valve/store updates |

---

## 6. Workstream A — Product, scope, and programme control

### A1. Define the launch product

- [ ] **A-001 (P0):** Write a one-paragraph Steam positioning statement: audience, fantasy, core loop, and why RockMundo is different.
- [ ] **A-002 (P0):** Define the minimum Early Access experience that is enjoyable today, independent of future promises.
- [ ] **A-003 (P0):** Create a launch feature inventory with one of four outcomes for every system: ship, finish, hide, or defer.
- [ ] **A-004 (P0):** Define the first-session journey from Steam install to the player’s first meaningful music-career success.
- [ ] **A-005 (P0):** Define the returning-player daily and weekly loops.
- [ ] **A-006 (P0):** Define the solo-player, band-member, band-leader, and community/social launch journeys.
- [ ] **A-007 (P0):** Decide how much content is needed at launch: cities, venues, NPCs, skills, genres, songs, jobs, events, companies, clothing, equipment, and achievements.
- [ ] **A-008 (P0):** Define what “version 1.0” means and what player feedback can change during Early Access.
- [ ] **A-009 (P1):** Create an Early Access roadmap expressed as themes and outcomes, avoiding guaranteed dates for uncertain features.
- [ ] **A-010 (P1):** Define launch success metrics: installs, activation, tutorial completion, D1/D7/D30 retention, crashes, error rate, support contacts, reviews, wishlists, and conversion.

### A2. Establish delivery control

- [ ] **A-011 (P0):** Name one accountable release owner and an owner for each workstream.
- [ ] **A-012 (P0):** Convert this plan into an actively maintained delivery board with dependencies, dates, owners, evidence, and status.
- [ ] **A-013 (P0):** Create a release risk, assumption, issue, and dependency log.
- [ ] **A-014 (P0):** Establish weekly release-readiness reviews using gates G0–G9.
- [ ] **A-015 (P0):** Define change control for launch scope, database changes, economy changes, and store claims.
- [ ] **A-016 (P1):** Set code-freeze, content-freeze, economy-freeze, and release-candidate dates.
- [ ] **A-017 (P1):** Maintain a decision log for price, wipe policy, platform support, monetisation, and account migration.

---

## 7. Workstream B — Current-state audit and backlog closure

### B1. Establish the actual baseline

- [ ] **B-001 (P0):** Obtain a clean clone of the production repository and document branch, hosting, database, Edge Function, scheduler, and deployment topology.
- [ ] **B-002 (P0):** Produce a complete route/page/system inventory and identify inaccessible, duplicate, orphaned, hidden, or admin-only features.
- [ ] **B-003 (P0):** Run TypeScript, lint, unit, integration, build, dependency, and dead-code checks; record the baseline rather than relying on old error counts.
- [ ] **B-004 (P0):** Compare the live database schema, functions, policies, scheduled jobs, and seed/reference data with the application’s assumptions.
- [ ] **B-005 (P0):** Catalogue all direct production database changes in an auditable release SQL/change log with pre-checks, post-checks, and rollback steps.
- [ ] **B-006 (P0):** Inventory all environment variables and secrets by environment without copying secret values into documentation.
- [ ] **B-007 (P0):** Map every external dependency, quota, rate limit, cost, owner, and failure mode.
- [ ] **B-008 (P0):** Identify all placeholder, mock, hard-coded, or admin-seeded content still visible to players.
- [ ] **B-009 (P1):** Record current production performance, availability, error rate, database size, storage use, job duration, and active users.

### B2. Mandatory regression register from prior player reports

The following are verification targets from earlier reports. They are not automatically considered unresolved; each requires a fresh reproduction attempt, automated regression coverage, and closure evidence.

| ID | Area to verify | Required outcome | Priority |
| --- | --- | --- | --- |
| REG-001 | Multiple characters | Activities, notifications, travel, location, balances, bands, and inbox content always use the active/owning character | P0 |
| REG-002 | Recurring reloads/SSE | No periodic page reload interrupts play; reconnect is silent, bounded, and state-safe | P0 |
| REG-003 | Travel | Players can book travel; location gates activities and shows correctly; optional automatic show travel cannot create impossible schedules | P0 |
| REG-004 | Shows | Same-day booking, venue/time-gap rules, travel feasibility, cancellation, and penalties are consistently enforced and explained | P0 |
| REG-005 | Personal banking | Accounts open correctly; deposits, withdrawals, and transfers reconcile with character funds | P0 |
| REG-006 | Band finances | Band balances, transactions, deposits, expenses, and member permissions load and reconcile | P0 |
| REG-007 | Recording payments | Band funds are the default, personal funds can be selected where allowed, and a payment is taken exactly once | P0 |
| REG-008 | Songwriting | Pages do not return 406 or hang; co-authors, splits, band visibility, invitations, and permissions work | P0 |
| REG-009 | Recording/rehearsal/jams | Required tables exist; past bookings are blocked; duration, attendance, roles, locks, outcomes, and feedback are correct | P0 |
| REG-010 | Releases/streaming/charts | A song can be released without SQL errors; streams, sales, royalties, charts, and finances update once and on time | P0 |
| REG-011 | XP/AP spending | Spending cannot return unexplained Edge Function errors or double-apply after retry | P0 |
| REG-012 | PR/self-promotion | Offers can be selected when eligible; expired, busy, or invalid choices explain why; RLS permits legitimate actions only | P1 |
| REG-013 | Open Mic/Battle of the Bands | Entry, song selection, performance, rewards, cooldowns, history, and achievements work without reload loops | P1 |
| REG-014 | Bands and touring crew | Members and touring musicians can be hired/removed and their availability, pay, roles, and contribution are correct | P1 |
| REG-015 | Festivals | Setup, configuration validation, stages, invitations, scheduling, operation, settlement, and history work end to end | P1 or remove from launch |
| REG-016 | Gear/stage equipment | Ownership, condition, assignment, transport, requirements, and gig effects are consistent | P1 |
| REG-017 | Companies/admin recovery | Owned companies appear correctly; admin navigation and recovery tools are accessible only to authorised staff | P1 |
| REG-018 | Responsive navigation | Desktop, handheld, and mobile-style layouts scroll and navigate reliably without trapping content | P1 |

### B3. Core system acceptance suites

- [ ] **B-010 (P0):** Account creation, authentication, sign-out, session expiry, password/account recovery, and account deletion.
- [ ] **B-011 (P0):** Character creation, unique names, switching characters, location, health, wellness, lifestyle, and activity state.
- [ ] **B-012 (P0):** XP/AP earning and spending, skills, mastery, unlocks, caps, and daily grants.
- [ ] **B-013 (P0):** Songwriting, co-writing, rights, royalty splits, repertoire, covers, permissions, and song history.
- [ ] **B-014 (P0):** Practice, lessons, tutorials, university/tutor routes, rehearsals, jam sessions, and time blocking.
- [ ] **B-015 (P0):** Recording booking, studio capacity, attendance, session musicians, producers, payment source, quality, and completion.
- [ ] **B-016 (P0):** Releases, formats, streaming, sales, royalties, charts, awards, and World Pulse updates.
- [ ] **B-017 (P0):** Band creation, membership, roles, permissions, chemistry, finances, equipment, invitations, leaving, and dissolution.
- [ ] **B-018 (P0):** Shows, setlists, preparation, venues, ticketing, outcomes, cancellations, rewards, and history.
- [ ] **B-019 (P0):** Travel, routes, transport, time zones, arrival, costs, tour planning, and impossible-schedule prevention.
- [ ] **B-020 (P0):** Personal money, banking, band money, companies, expenses, tax/fees if applicable, and transaction history.
- [ ] **B-021 (P1):** Open mics, Battle of the Bands, festivals, tours, sponsors, NPC events, and seasonal systems included in launch.
- [ ] **B-022 (P1):** Mail, notifications, friends, chat, Twaater, moderation, blocking, attachments, and live updates.
- [ ] **B-023 (P1):** Cosmetics, avatars, clothing, instruments, inventory, gifting if allowed, and purchase entitlement.
- [ ] **B-024 (P0):** Admin balancing, content management, moderation, player recovery, transaction inspection, and audit logging.

---

## 8. Workstream C — Desktop client and distribution architecture

### C1. Desktop architecture spike

- [ ] **C-001 (P0):** Evaluate Electron, Tauri, or another maintained desktop shell against the current frontend, Steamworks bridge support, install size, memory, controller handling, overlay support, code signing, and team skills.
- [ ] **C-002 (P0):** Build a disposable proof of concept that launches RockMundo through Steam, initialises the Steamworks API, returns the SteamID/auth ticket, supports the overlay, and survives sleep/resume.
- [ ] **C-003 (P0):** Confirm the chosen Steamworks bridge is actively maintained, supports the target operating systems and architecture, and can be securely built in CI.
- [ ] **C-004 (P0):** Document trust boundaries among the desktop shell, web UI, backend, database, and Steam APIs.
- [ ] **C-005 (P0):** Decide whether the shell loads packaged UI assets, remote assets, or a hybrid; document outage, rollback, cache, and version-compatibility behaviour.
- [ ] **C-006 (P0):** Do not place privileged database keys, Steam publisher keys, payment secrets, or service-role credentials in the client.

### C2. Build the production client

- [ ] **C-007 (P0):** Provide a signed 64-bit Windows executable and installer/depot payload.
- [ ] **C-008 (P0):** Start directly from the Steam Play button without requiring a terminal, browser, manual prerequisite, or administrator rights.
- [ ] **C-009 (P0):** Implement single-instance behaviour, safe relaunch, clean shutdown, and update/restart messaging.
- [ ] **C-010 (P0):** Support windowed, maximised, and borderless/fullscreen modes as appropriate; persist safe display settings.
- [ ] **C-011 (P0):** Support DPI scaling, text scaling, 16:9, 16:10, ultrawide, small laptop displays, and multi-monitor movement.
- [ ] **C-012 (P0):** Add explicit loading, offline, maintenance, expired-session, incompatible-client, and backend-unavailable screens.
- [ ] **C-013 (P0):** Handle desktop sleep/resume, network changes, Steam going offline, temporary API loss, and clock drift without duplicated actions.
- [ ] **C-014 (P0):** Open permitted external links in the system browser with confirmation and an allowlist; prevent arbitrary navigation inside the privileged shell.
- [ ] **C-015 (P0):** Apply a restrictive Content Security Policy, navigation policy, IPC allowlist, dependency isolation, and secure local storage.
- [ ] **C-016 (P0):** Remove development tools, source maps containing sensitive context, test credentials, debug menus, and local AppID overrides from the shipping depot.
- [ ] **C-017 (P0):** Store logs in an appropriate per-user location and provide a privacy-safe “copy support information” flow.
- [ ] **C-018 (P0):** Add crash capture, client version, build ID, correlation ID, and user-consented diagnostics without recording private messages or secrets.
- [ ] **C-019 (P1):** Add native notifications only where they provide value and respect opt-out/quiet settings.
- [ ] **C-020 (P1):** Add an in-client version, licence, privacy, support, accessibility, and server-status screen.
- [ ] **C-021 (P1):** Test uninstall/reinstall behaviour and ensure no credentials or unnecessary personal data remain on shared computers.

### C3. Build and release engineering

- [ ] **C-022 (P0):** Create reproducible release builds from a protected tag/commit.
- [ ] **C-023 (P0):** Add CI stages for type checking, tests, build, signing, software-composition analysis, packaging, malware scan, and artifact checksums.
- [ ] **C-024 (P0):** Separate development, test, Steam Playtest, staging, Early Access, and production configuration.
- [ ] **C-025 (P0):** Ensure a test client cannot connect to or mutate production by accident.
- [ ] **C-026 (P0):** Define semantic client versions and a minimum-supported-version policy between client and backend.
- [ ] **C-027 (P0):** Create a one-command or controlled-pipeline promotion process from internal branch to Playtest/staging to default Steam branch.
- [ ] **C-028 (P0):** Prove rollback to the previous Steam build and compatible backend/database state.
- [ ] **C-029 (P1):** Measure update sizes and structure packaged files to avoid unnecessarily large Steam patches.
- [ ] **C-030 (P1):** Keep restricted SDK/build credentials out of the public repository and distribute only permitted runtime components.

---

## 9. Workstream D — Steamworks onboarding and integration

### D1. Partner and application setup

- [ ] **D-001 (P0):** Create/verify the Steamworks partner under the correct legal entity.
- [ ] **D-002 (P0):** Complete company identity, bank, tax, beneficial-owner, address, and payment information.
- [ ] **D-003 (P0):** Pay the Steam Direct app fee and record the date that starts Steam’s waiting period.
- [ ] **D-004 (P0):** Secure Steamworks accounts with MFA and least-privilege roles; create a dedicated build account.
- [ ] **D-005 (P0):** Create the RockMundo AppID and Steam Playtest child AppID.
- [ ] **D-006 (P0):** Configure packages, depots, launch options, supported operating systems, executable paths, and installation directories.
- [ ] **D-007 (P0):** Create protected internal, QA, Playtest, release-candidate, and default branches with an access policy.
- [ ] **D-008 (P0):** Create SteamPipe app/depot build configuration and securely automate uploads with SteamCMD.
- [ ] **D-009 (P0):** Test fresh install, update, branch switch, repair/verify files, rollback, uninstall, and reinstall.

### D2. Steam identity and account ownership

- [ ] **D-010 (P0):** Authenticate the Steam user using a Steam auth ticket and validate it server-side; never trust a client-supplied SteamID alone.
- [ ] **D-011 (P0):** Verify app ownership/entitlement where the commercial model requires it.
- [ ] **D-012 (P0):** Define a one-to-one SteamID-to-RockMundo-account link unless a reviewed design justifies otherwise.
- [ ] **D-013 (P0):** Build secure flows for new-account creation, existing-account linking, duplicate detection, cancellation, recovery, and support-assisted unlinking.
- [ ] **D-014 (P0):** Require recent authentication and clear warnings before any destructive link/unlink action.
- [ ] **D-015 (P0):** Prevent a compromised RockMundo session from linking an attacker’s Steam account and vice versa.
- [ ] **D-016 (P0):** Define what happens when a Steam refund, ownership loss, game ban, community ban, RockMundo suspension, or deleted account is encountered.
- [ ] **D-017 (P0):** Preserve existing web players’ characters and purchases when they link to Steam.
- [ ] **D-018 (P1):** Add privacy-respecting display-name/avatar use and a player control for what Steam identity is visible in RockMundo.

### D3. Steam platform features

- [ ] **D-019 (P0):** Initialise and shut down Steamworks reliably; handle Steam client absence with a clear supported/unsupported path.
- [ ] **D-020 (P1):** Confirm Steam Overlay works in all relevant display modes.
- [ ] **D-021 (P1):** Map an initial set of meaningful RockMundo achievements to Steam achievements.
- [ ] **D-022 (P1):** Decide whether achievements are user-level or character-level; make server-side eligibility authoritative and syncing idempotent.
- [ ] **D-023 (P1):** Backfill eligible achievements for linked existing players without granting the wrong account’s progress.
- [ ] **D-024 (P1):** Add rich presence that exposes only suitable information, such as career activity or band, with privacy controls.
- [ ] **D-025 (P1):** Configure Steam Input or an official controller layout if controller support is claimed.
- [ ] **D-026 (P1):** Invoke Steam’s on-screen keyboard for text entry on handheld/controller flows where required.
- [ ] **D-027 (P2):** Evaluate Steam leaderboards only for statistics that cannot be trivially manipulated and will not reward unhealthy play.
- [ ] **D-028 (P2):** Evaluate Steam Cloud for local preferences only. Character and world progress should remain on RockMundo’s authoritative servers.
- [ ] **D-029 (P2):** Defer trading cards, badges, soundtrack, DLC, Workshop, and community items until the core launch is stable unless there is a commercial reason to include them.

### D4. Steam Wallet and purchases

- [ ] **D-030 (P0 if monetised):** Use Steam Wallet for all purchases initiated by Steam customers; do not link Steam players to an external checkout that bypasses it.
- [ ] **D-031 (P0):** Decide the Steam catalogue: cosmetic item, bundle, in-game currency, recurring subscription, or no purchases at Early Access launch.
- [ ] **D-032 (P0):** Define regional prices, taxes, currency rounding, display price, cancellation, refunds, and customer-support responsibility.
- [ ] **D-033 (P0):** Implement server-side order initiation, Steam authorisation, finalisation, fulfilment, receipt, and reconciliation.
- [ ] **D-034 (P0):** Make purchase finalisation and item fulfilment idempotent across retries, duplicate notifications, client crashes, and delayed callbacks.
- [ ] **D-035 (P0):** Implement refund/revocation handling that does not create negative inventories or exploitable currency transfers.
- [ ] **D-036 (P0):** Add fraud controls for gifting, trading, valuable items, new accounts, unusual velocity, region mismatch, and chargebacks.
- [ ] **D-037 (P0):** Reconcile Steam transaction reports against RockMundo entitlements and finance records every day.
- [ ] **D-038 (P0):** Test successful, cancelled, declined, pending, duplicate, refunded, reversed, and timed-out transactions in Steam’s test environment.
- [ ] **D-039 (P1):** Define cross-platform entitlement rules so Steam and web customers are treated fairly without violating Steam requirements.

### D5. Steam Deck and SteamOS

- [ ] **D-040 (P1):** Test the Windows build under Proton before claiming Steam Deck support.
- [ ] **D-041 (P1):** Support 1280×800/1280×720 without clipped controls, inaccessible modals, hover-only actions, or unreadable tables.
- [ ] **D-042 (P1):** Ensure the smallest text remains legible and offer text scaling/contrast controls.
- [ ] **D-043 (P1):** Ensure every launch-critical flow can be completed using the declared input method.
- [ ] **D-044 (P1):** Target a responsive UI and stable frame rate for the gig viewer and any animated experiences.
- [ ] **D-045 (P1):** Test suspend/resume, on-screen keyboard, Wi-Fi loss, dock/undock, resolution change, and touch input.
- [ ] **D-046 (P2):** Request/review the Steam Deck compatibility result and resolve avoidable “Playable” findings after the main launch blockers are closed.

---

## 10. Workstream E — Backend, database, economy, and live-world readiness

### E1. Character, account, and ownership integrity

- [ ] **E-001 (P0):** Define the authoritative ownership chain for user → account → character → band/company/festival → activity/notification/transaction.
- [ ] **E-002 (P0):** Require explicit character context for every character-scoped query, mutation, subscription, notification, cache key, and background job.
- [ ] **E-003 (P0):** Eliminate unsafe “first character”, stale local-storage, global active-character, or user-only filters from character-scoped code.
- [ ] **E-004 (P0):** Add database constraints and RLS tests preventing one character/account from reading or mutating another’s private data.
- [ ] **E-005 (P0):** Verify band, company, festival, mail, finance, inventory, and admin ownership separately; do not infer them from the current UI character.
- [ ] **E-006 (P0):** Add correlation IDs and actor/character/target IDs to audit logs for every sensitive mutation.

### E2. Time, activities, travel, and scheduling

- [ ] **E-007 (P0):** Use server time as authoritative and standardise storage in UTC with explicit city/local-time presentation.
- [ ] **E-008 (P0):** Create a single conflict engine for travel, shows, rehearsals, recording, jobs, wellness, events, and multi-member band activities.
- [ ] **E-009 (P0):** Make booking and completion atomic so concurrent requests cannot double-book a player, room, venue, or studio slot.
- [ ] **E-010 (P0):** Make completion workers idempotent and recoverable after timeout, crash, or duplicate scheduler invocation.
- [ ] **E-011 (P0):** Prevent bookings in the past and handle daylight-saving changes, leap days, clock drift, and long-running sessions.
- [ ] **E-012 (P0):** Define missed, cancelled, abandoned, delayed, and invalidated activity outcomes.
- [ ] **E-013 (P0):** Reconcile any scheduled item stuck in pending/running/complete-but-unrewarded states.
- [ ] **E-014 (P1):** Prove the scheduler can run reliably within hosting limits or move critical world jobs to a suitable durable worker/queue.

### E3. Money, rewards, and economy

- [ ] **E-015 (P0):** Use an immutable or append-only ledger for all personal, band, company, event, royalty, and purchase-value movements.
- [ ] **E-016 (P0):** Require a unique idempotency key and source reference for every money, XP, AP, fan, fame, item, and entitlement grant.
- [ ] **E-017 (P0):** Prevent negative balances and unauthorised spending with database-level checks where appropriate.
- [ ] **E-018 (P0):** Reconcile displayed balances against ledger entries and identify legacy discrepancies before migration/launch.
- [ ] **E-019 (P0):** Audit all reward paths for duplicate completion, refresh, retry, multi-tab, multi-client, and scheduler exploits.
- [ ] **E-020 (P0):** Audit royalty splits, cover permissions, band splits, fees, rounding, unclaimed shares, and recipient changes.
- [ ] **E-021 (P0):** Create admin tools to inspect, explain, correct, and audit a transaction without editing balances invisibly.
- [ ] **E-022 (P1):** Run economy simulations for inflation, money sinks/sources, progression speed, market manipulation, and new-player affordability.
- [ ] **E-023 (P1):** Define economic emergency controls, including pausing a reward path or purchase catalogue without taking the whole game offline.

### E4. Reliability and scale

- [ ] **E-024 (P0):** Define launch CCU, daily active user, request, connection, storage, job, mail, chart, and transaction forecasts with at least 2× tested headroom.
- [ ] **E-025 (P0):** Load-test authentication, character switch, dashboard, notifications, charts, travel, show booking, activity completion, and purchase fulfilment.
- [ ] **E-026 (P0):** Soak-test live subscriptions/SSE/WebSockets, reconnect behaviour, background jobs, and memory/connection leakage.
- [ ] **E-027 (P0):** Add bounded retries, exponential backoff, circuit breakers, timeouts, and dead-letter/recovery handling where applicable.
- [ ] **E-028 (P0):** Review database indexes and query plans for the highest-volume and slowest production queries.
- [ ] **E-029 (P0):** Set capacity and spend alerts before database, hosting, realtime, storage, email, or function quotas are exhausted.
- [ ] **E-030 (P0):** Add maintenance mode, read-only mode where safe, feature flags, kill switches, and a version compatibility response.
- [ ] **E-031 (P0):** Make external dependency failures degrade gracefully rather than corrupting state or trapping the player.

### E5. Backup, recovery, and environment management

- [ ] **E-032 (P0):** Define production recovery point objective (RPO) and recovery time objective (RTO).
- [ ] **E-033 (P0):** Enable and verify automated database backups and point-in-time recovery where available.
- [ ] **E-034 (P0):** Back up required object storage, configuration, reference data, and secrets metadata—not only database tables.
- [ ] **E-035 (P0):** Run a restore drill into an isolated environment and verify account, character, finance, inventory, and activity integrity.
- [ ] **E-036 (P0):** Document rollback for application code, Edge Functions, database SQL changes, reference data, scheduler jobs, and Steam builds.
- [ ] **E-037 (P0):** Refresh staging with sanitised representative data and prevent production messages, payments, or notifications from firing there.
- [ ] **E-038 (P1):** Define world reset, partial repair, and player compensation procedures before they are needed.

---

## 11. Workstream F — Security, privacy, trust, and safety

### F1. Application and infrastructure security

- [ ] **F-001 (P0):** Complete a threat model covering desktop shell, authentication, account linking, RLS, purchases, economy exploits, admin tools, chat/mail, and supply chain.
- [ ] **F-002 (P0):** Review every RLS policy and security-definer function for least privilege and secure search paths.
- [ ] **F-003 (P0):** Rotate exposed, shared, old, or developer secrets and establish environment-specific secret ownership.
- [ ] **F-004 (P0):** Remove privileged keys and sensitive endpoints from client bundles, logs, source maps, public repositories, and error messages.
- [ ] **F-005 (P0):** Rate-limit and abuse-protect authentication, account recovery, social actions, file attachments, bookings, rewards, and purchases.
- [ ] **F-006 (P0):** Add dependency, licence, secret, static-analysis, and known-vulnerability scans to CI with blocking severity rules.
- [ ] **F-007 (P0):** Perform an independent penetration/security review before the paid release.
- [ ] **F-008 (P0):** Review admin RBAC, enforce MFA, log sensitive actions, and prevent admins from silently impersonating or changing value.
- [ ] **F-009 (P0):** Define vulnerability disclosure, triage, patch, and emergency credential-rotation procedures.

### F2. Privacy and player rights

- [ ] **F-010 (P0):** Create a data inventory identifying purpose, legal basis, location, processor, retention, and access for each personal-data category.
- [ ] **F-011 (P0):** Publish accurate privacy notice, terms of service, EULA if used, cookie/local-storage explanation, and contact details.
- [ ] **F-012 (P0):** Implement data export, correction, account deletion, Steam unlinking, and retention/anonymisation procedures.
- [ ] **F-013 (P0):** Minimise telemetry and obtain consent where required; never capture passwords, auth tickets, payment data, or private message bodies in analytics.
- [ ] **F-014 (P0):** Define age policy, child-safety controls, and age-rating/content declarations for a social online game.
- [ ] **F-015 (P0):** Execute appropriate processor/data-processing agreements and document international transfers.
- [ ] **F-016 (P1):** Publish an accessibility statement and a clear route for privacy, safety, and accessibility requests.

### F3. Community safety and user-generated content

- [ ] **F-017 (P0):** Provide report, block, mute, and appeal flows for player names, band names, posts, chat, mail, and attachments.
- [ ] **F-018 (P0):** Define prohibited content and conduct rules with graduated sanctions and staff guidance.
- [ ] **F-019 (P0):** Give moderators sufficient context and audit history without exposing unrelated private data.
- [ ] **F-020 (P0):** Scan/validate attachments, enforce type and size limits, and prevent executable or active-content delivery.
- [ ] **F-021 (P0):** Protect against spam, harassment, impersonation, ban evasion, botting, and bulk account creation.
- [ ] **F-022 (P1):** Create moderation coverage, escalation contacts, response targets, evidence retention, and serious-incident procedures.

---

## 12. Workstream G — Quality assurance, performance, and accessibility

### G1. Test strategy and automation

- [ ] **G-001 (P0):** Create a traceable test matrix linking every launch requirement and store claim to acceptance evidence.
- [ ] **G-002 (P0):** Add unit tests for rules, calculations, time conflicts, rewards, royalties, balances, and permissions.
- [ ] **G-003 (P0):** Add integration tests for database functions, RLS, Edge Functions, schedulers, Steam auth, and purchases.
- [ ] **G-004 (P0):** Add end-to-end tests for the first session, daily loop, songwriting-to-release loop, band-to-show loop, travel, finance, social, and account recovery.
- [ ] **G-005 (P0):** Run every character-scoped E2E journey with two characters under one account and with two separate accounts.
- [ ] **G-006 (P0):** Add concurrency and idempotency tests using duplicate clicks, parallel clients, retries, delayed callbacks, and scheduler replays.
- [ ] **G-007 (P0):** Create deterministic test clocks and fixtures for multi-day activities, chart cycles, biweekly events, seasons, and cancellations.
- [ ] **G-008 (P0):** Add contract tests between client versions and backend APIs.
- [ ] **G-009 (P0):** Block release builds on failed required tests, type errors, severe vulnerabilities, missing configuration, or unsigned artifacts.

### G2. Desktop and compatibility matrix

- [ ] **G-010 (P0):** Test every operating system/version explicitly claimed on the Steam store page.
- [ ] **G-011 (P0):** Test clean non-admin machines, new Windows profiles, Unicode paths/usernames, low disk space, and antivirus/firewall interaction.
- [ ] **G-012 (P0):** Test common resolutions, DPI levels, window sizes, multi-monitor changes, and integrated/low-end graphics within declared requirements.
- [ ] **G-013 (P0):** Test keyboard/mouse and every controller type claimed; ensure focus and shortcuts cannot strand the UI.
- [ ] **G-014 (P0):** Test offline launch, backend outage, DNS failure, slow/unstable network, Steam outage, and recovery.
- [ ] **G-015 (P0):** Test sleep/resume, hibernate, clock change, daylight-saving change, backgrounding, and multiple open sessions.
- [ ] **G-016 (P0):** Test install, upgrade over multiple versions, corrupt-cache recovery, file verification, rollback, uninstall, and reinstall.
- [ ] **G-017 (P1):** Test Proton and Steam Deck if the store page or roadmap claims support.

### G3. Performance and stability targets

Final numerical targets should be agreed after the baseline, but the release must include targets for:

- [ ] **G-018 (P0):** Cold start to usable login/home screen.
- [ ] **G-019 (P0):** P50/P95/P99 navigation and API response times for critical journeys.
- [ ] **G-020 (P0):** Crash-free sessions and unhandled client-error rate.
- [ ] **G-021 (P0):** Memory, CPU, GPU, network, and disk use over a two-hour representative session.
- [ ] **G-022 (P0):** Realtime reconnection and stale-state recovery time.
- [ ] **G-023 (P0):** Scheduler completion lag and duplicate/missed job rate.
- [ ] **G-024 (P0):** Backend error rate, database saturation, and queue depth at planned CCU plus headroom.
- [ ] **G-025 (P1):** Stable and visually acceptable gig-viewer performance on minimum hardware and Steam Deck target resolution.

Suggested initial service objectives for validation, to be confirmed after measurement:

| Measure | Initial target |
| --- | --- |
| Crash-free desktop sessions | ≥ 99.5% during Playtest; improve before 1.0 |
| Successful critical API requests | ≥ 99.9%, excluding validated player errors |
| P95 ordinary read response | ≤ 750 ms under planned launch load |
| P95 critical mutation response | ≤ 1.5 s under planned launch load |
| Duplicate financial/reward grants | 0 |
| Cross-account/character leakage | 0 |
| Unexplained ledger variance | £/$0 and 0 in-game currency |

### G4. Accessibility and usability

- [ ] **G-026 (P0):** Make all critical flows keyboard accessible with visible focus and logical order.
- [ ] **G-027 (P0):** Ensure readable contrast, scalable text, zoom/resizing, and no information conveyed by colour alone.
- [ ] **G-028 (P0):** Add reduced-motion controls for animated backgrounds, gig scenes, flashes, and parallax effects.
- [ ] **G-029 (P0):** Ensure errors identify the affected action in plain language and are announced appropriately to assistive technology where supported.
- [ ] **G-030 (P1):** Add volume controls, mute, captions/transcripts for meaningful spoken content, and independent music/effects controls if audio is included.
- [ ] **G-031 (P1):** Review time pressure, precision actions, flashing content, and controller-only interactions for accessibility alternatives.
- [ ] **G-032 (P1):** Run usability sessions with new players who have never seen RockMundo.

### G5. Bug policy

| Severity | Definition | Launch rule |
| --- | --- | --- |
| Sev 1 | Security/privacy breach, data loss/corruption, payment/economy exploit, cross-account leak, widespread outage | Zero open; stop release immediately |
| Sev 2 | Core journey blocked, repeated crash, incorrect money/reward, cannot authenticate/install/update, major moderation failure | Zero open |
| Sev 3 | Material non-core defect with workaround or significant polish/accessibility issue | Must be fixed or explicitly accepted with owner and date |
| Sev 4 | Minor visual/copy issue with negligible player impact | May be deferred and tracked |

---

## 13. Workstream H — Game content, UX, rights, and polish

### H1. First-time and returning-player experience

- [ ] **H-001 (P0):** Make install → Steam sign-in → account link/create → character create/select → tutorial seamless.
- [ ] **H-002 (P0):** Teach the core loop through play: develop skills, create music, form/join a band, prepare, perform, record, release, and grow.
- [ ] **H-003 (P0):** Always show the active character, current city, current activity, time remaining, available money/AP/XP, and the consequence of major actions.
- [ ] **H-004 (P0):** Replace blank pages and raw failures with useful loading, empty, unavailable, eligibility, recovery, and retry states.
- [ ] **H-005 (P0):** Explain scheduling conflicts, travel feasibility, missing skills, insufficient money, permissions, expired offers, and cooldowns before confirmation.
- [ ] **H-006 (P1):** Provide a “what should I do next?” path without removing the open-ended music-career fantasy.
- [ ] **H-007 (P1):** Review navigation, terminology, information density, mobile-derived layouts, and deep-link/back behaviour for desktop use.
- [ ] **H-008 (P1):** Ensure notifications lead to the correct character and actionable page and can be marked read without losing important state.

### H2. Content and presentation

- [ ] **H-009 (P0):** Remove placeholder art, developer text, debug values, inconsistent currency, typos, broken images, and inaccessible controls.
- [ ] **H-010 (P0):** Apply consistent RockMundo visual identity, typography, icons, button hierarchy, feedback, and animation.
- [ ] **H-011 (P0):** Verify enough balanced launch content exists to avoid obvious repetition or progression dead ends.
- [ ] **H-012 (P0):** Seed and validate NPC bands, venues, studios, companies, festivals/events, jobs, sponsors, charts, products, equipment, and cities required by launch scope.
- [ ] **H-013 (P0):** Ensure every advertised system has an understandable entry point, complete loop, history/outcome, and support/admin path.
- [ ] **H-014 (P1):** Improve the gig viewer to the quality level shown in marketing while keeping it performant and optional/reduced-motion friendly.
- [ ] **H-015 (P1):** Create coherent sound design and music only if rights, volume control, download size, and performance are acceptable.

### H3. Intellectual property and content rights

- [ ] **H-016 (P0):** Complete clearance for the RockMundo name, logo, domains, and relevant trademarks in launch territories.
- [ ] **H-017 (P0):** Maintain provenance/licences for all artwork, fonts, icons, code, audio, music, avatars, 3D assets, writing, and purchased asset packs.
- [ ] **H-018 (P0):** Remove unlicensed real songs, lyrics, recordings, artist likenesses, logos, venue branding, or other protected material.
- [ ] **H-019 (P0):** Define player terms for user-created band/song names, text, posts, mail, and uploaded attachments.
- [ ] **H-020 (P0):** Inventory AI-assisted content that ships to players and retain enough provenance to complete Steam’s AI-content disclosure accurately.
- [ ] **H-021 (P1):** Review parody, references, fictional brands, sponsor content, and user-generated content processes with suitable legal advice.

---

## 14. Workstream I — Store presence, commercial setup, and marketing

### I1. Store positioning and copy

- [ ] **I-001 (P0):** Write and approve the short description, long description, About This Game section, feature bullets, developer/publisher names, and franchise data.
- [ ] **I-002 (P0):** State clearly that RockMundo is a persistent online game and disclose any third-party RockMundo account requirement.
- [ ] **I-003 (P0):** Ensure every screenshot, trailer scene, feature bullet, platform icon, controller claim, and language claim is present in the reviewed build.
- [ ] **I-004 (P0):** Complete the Early Access questionnaire with the current state, reason for Early Access, expected development direction, pricing approach, and community involvement.
- [ ] **I-005 (P0):** Avoid firm promises for uncertain features or dates; sell the value of the build players can buy now.
- [ ] **I-006 (P0):** Select at least five accurate Steam tags and aim for a well-ordered set of up to twenty relevant tags.
- [ ] **I-007 (P0):** Enter accurate system requirements derived from tested minimum and recommended hardware, not guesses.
- [ ] **I-008 (P0):** Declare supported languages separately for interface, audio, and subtitles.
- [ ] **I-009 (P1):** Localise the store page for selected priority regions even if the first game build is English-only, without overstating in-game support.
- [ ] **I-010 (P1):** Create a FAQ covering online requirement, accounts, current beta players, wipes, Early Access, monetisation, platforms, support, and accessibility.

### I2. Store art and media

- [ ] **I-011 (P0):** Create original key art and a readable RockMundo logo suitable for Steam’s required crops.
- [ ] **I-012 (P0):** Produce all current required store capsules and library assets from Valve’s templates.
- [ ] **I-013 (P0):** Ensure base capsules contain only permitted artwork, game name, and official subtitle—no reviews, awards, discount copy, or unrelated promotion.
- [ ] **I-014 (P0):** Supply at least five high-resolution widescreen screenshots showing real gameplay and UI, not concept art or marketing text.
- [ ] **I-015 (P0):** Produce a gameplay-led trailer; this is mandatory for a credible Early Access submission and must represent the current build.
- [ ] **I-016 (P1):** Produce captioned/localised trailer versions or subtitle tracks for priority languages.
- [ ] **I-017 (P1):** Capture clean footage of character creation, songwriting, bands, live shows, recording, releases/charts, travel/tours, and social/world systems that actually ship.
- [ ] **I-018 (P1):** Create press kit assets, transparent logos, brand guidance, screenshots, fact sheet, contact details, and approved description.

Current required store-image checkpoints include a 920×430 header capsule, 462×174 small capsule, 1232×706 main capsule, and 748×896 vertical capsule. Always use the latest Steam templates at production time because specifications can change.

### I3. Pricing and commercial operations

- [ ] **I-019 (P0):** Choose paid, free-to-play, or subscription structure and model player value, conversion, churn, taxes, refunds, and server cost.
- [ ] **I-020 (P0):** Submit launch pricing in all supported Steam currencies and review Valve’s regional recommendations.
- [ ] **I-021 (P0):** Decide whether to use a launch discount and schedule it consistently with Steam pricing rules and any Early Access price plan.
- [ ] **I-022 (P0):** Publish a clear non-pay-to-win/cosmetics policy if that remains the product commitment.
- [ ] **I-023 (P0):** Model backend cost per active player and prove the business remains sustainable under conservative sales and high usage.
- [ ] **I-024 (P1):** Define treatment for founders/beta players, complimentary keys, press/creator keys, giveaways, and abuse controls.
- [ ] **I-025 (P1):** Prepare monthly Steam finance reconciliation, accounting, VAT/tax, refunds, and revenue-recognition procedures.

### I4. Audience and community launch plan

- [ ] **I-026 (P0):** Publish the Coming Soon page as soon as the brand, copy, screenshots, and trailer are honest and stable enough to build wishlists.
- [ ] **I-027 (P0):** Configure the Steam Community Hub, discussion categories, moderation rules, support link, announcements, and pinned FAQs.
- [ ] **I-028 (P0):** Create an owner and response plan for Steam reviews, discussions, bug reports, social channels, and support email.
- [ ] **I-029 (P1):** Build a wishlist campaign around development updates, feature spotlights, playtest recruitment, festivals/events where eligible, and community stories.
- [ ] **I-030 (P1):** Use Steam Playtest sign-ups for a controlled cohort and publish clear test windows, scope, known issues, reset policy, and feedback routes.
- [ ] **I-031 (P1):** Prepare creator/press outreach, embargo/key policy, preview build, talking points, gameplay capture guidance, and contact list.
- [ ] **I-032 (P1):** Prepare release-day announcement, trailer, patch notes, roadmap, known issues, support message, and status-page links.
- [ ] **I-033 (P1):** Set UTM links and reporting so external campaigns can be evaluated without collecting unnecessary personal data.

---

## 15. Workstream J — Legal, compliance, and company readiness

- [ ] **J-001 (P0):** Confirm which legal entity owns and publishes RockMundo and ensure contracts/IP assignments support that ownership.
- [ ] **J-002 (P0):** Complete Steamworks distribution, tax, banking, and payment onboarding under that entity.
- [ ] **J-003 (P0):** Obtain appropriate legal review of terms, privacy notice, EULA if used, community rules, virtual items/currency, subscriptions, refunds, and account termination.
- [ ] **J-004 (P0):** Complete Steam’s general content, mature-content, and generative-AI content survey accurately.
- [ ] **J-005 (P0):** Complete required age-rating questionnaires and regional declarations for all intended territories.
- [ ] **J-006 (P0):** Review UK GDPR/data-protection obligations and obligations in other launch regions, including player-rights workflows and processors.
- [ ] **J-007 (P0):** Review consumer law implications of Early Access, virtual currency, recurring payments, service shutdown, maintenance, and material feature changes.
- [ ] **J-008 (P0):** Review online-safety/user-generated-content duties and maintain reporting, moderation, escalation, and record-keeping procedures.
- [ ] **J-009 (P0):** Verify licences and notices for third-party software and assets; ship required attribution notices.
- [ ] **J-010 (P0):** Arrange suitable cyber, professional, public/product, and business insurance based on legal advice and risk appetite.
- [ ] **J-011 (P1):** Create a service sunset and player-communication policy for a persistent online game.
- [ ] **J-012 (P1):** Establish document retention for contracts, consent, moderation, purchases, refunds, tax, and security incidents.

---

## 16. Workstream K — Observability, support, and live operations

### K1. Monitoring and alerting

- [ ] **K-001 (P0):** Build health dashboards for login, active sessions, character load, API errors/latency, database, realtime connections, scheduled jobs, payments, and critical game loops.
- [ ] **K-002 (P0):** Add business-integrity alerts for duplicate rewards, ledger variance, negative balances, stuck activities, missed charts, purchase mismatch, and cross-character anomalies.
- [ ] **K-003 (P0):** Add client release/crash monitoring segmented by build, OS, hardware class, and Steam branch.
- [ ] **K-004 (P0):** Set actionable thresholds, owners, escalation paths, and quiet/aggregation rules so alerts are noticed and trusted.
- [ ] **K-005 (P0):** Publish a player-facing status page for game, authentication, realtime, payments, and planned maintenance.
- [ ] **K-006 (P0):** Use privacy-safe correlation IDs so support can connect a player-visible error to backend logs.
- [ ] **K-007 (P1):** Track funnel and retention analytics from install through activation and core loops without turning telemetry into a release blocker if consent is unavailable.

### K2. Support and admin operations

- [ ] **K-008 (P0):** Create support categories and response targets for login, linking, lost progress, purchases, refunds, bans, harassment, bugs, and accessibility.
- [ ] **K-009 (P0):** Write support playbooks and safe admin actions for each category, including when not to change player data.
- [ ] **K-010 (P0):** Give support read-only diagnostic views and controlled, audited repair actions.
- [ ] **K-011 (P0):** Prepare templates for outages, known issues, purchase delays, maintenance, data repair, compensation, and security notices.
- [ ] **K-012 (P0):** Define handoff and escalation among community moderators, support, engineering, payments, privacy, and security.
- [ ] **K-013 (P1):** Create a searchable known-issues and troubleshooting guide for players and staff.

### K3. Incident and release operations

- [ ] **K-014 (P0):** Create incident severity definitions, commander role, communications cadence, decision authority, and post-incident review process.
- [ ] **K-015 (P0):** Write runbooks for authentication outage, database degradation, realtime storm, scheduler failure, payment mismatch, economy exploit, data leak, and bad client release.
- [ ] **K-016 (P0):** Rehearse rollback, maintenance mode, secret rotation, payment pause, feature kill switch, and database restore.
- [ ] **K-017 (P0):** Staff an on-call/launch rota appropriate to the expected player base for at least launch day and the first weekend.
- [ ] **K-018 (P0):** Define who has authority to pause the release, roll back, disable purchases, close registrations, or take the world into maintenance.
- [ ] **K-019 (P1):** Schedule blameless post-launch reviews at 24 hours, 7 days, and 30 days.

---

## 17. Workstream L — Playtest, Valve review, and release execution

### L1. Internal and closed testing waves

- [ ] **L-001 (P0):** Internal alpha: staff complete all core journeys on development/staging with debug visibility.
- [ ] **L-002 (P0):** Closed beta: invited current players use the release candidate under production-like conditions.
- [ ] **L-003 (P0):** Steam internal branch test: clean accounts validate Steam install, launch, identity, overlay, update, and uninstall.
- [ ] **L-004 (P0):** Steam Playtest wave 1: small cohort focused on installation, onboarding, account linking, first-session usability, and support flow.
- [ ] **L-005 (P0):** Steam Playtest wave 2: larger cohort focused on retention, world activity, concurrency, economy, social safety, and operations.
- [ ] **L-006 (P0):** For each wave, define hypotheses, cohort size, duration, entry/exit criteria, telemetry, survey, support coverage, and wipe policy.
- [ ] **L-007 (P0):** Close every Sev 1/2 finding and document decisions on Sev 3 findings before moving to paid Early Access.

### L2. Valve submission readiness

- [ ] **L-008 (P0):** Complete every Steamworks release checklist item and verify that supported feature boxes match the build.
- [ ] **L-009 (P0):** Submit the store presence for review at least seven business days before it needs to go public, allowing time for corrections.
- [ ] **L-010 (P0):** Upload a near-final build to the intended branch and submit it for review at least seven business days before launch.
- [ ] **L-011 (P0):** Supply Valve reviewers with any required test account, instructions, server availability, and explanation of online-only flows.
- [ ] **L-012 (P0):** Keep reviewer access stable and monitor authentication/backend health during the review window.
- [ ] **L-013 (P0):** Resolve all Valve feedback and re-submit with enough schedule contingency.
- [ ] **L-014 (P0):** Confirm the store page and build both show “Ready for release.”
- [ ] **L-015 (P0):** Verify the public Coming Soon page has satisfied Steam’s minimum two-week period and the app-fee waiting period has elapsed.

### L3. Go/no-go checklist

- [ ] **L-016 (P0):** Release candidate commit/tag/build ID and database/reference-data versions are frozen and recorded.
- [ ] **L-017 (P0):** Production backups and restore evidence are current.
- [ ] **L-018 (P0):** No open Sev 1/2 defects; accepted Sev 3 list is published internally with owner and mitigation.
- [ ] **L-019 (P0):** Capacity, quota, cost, monitoring, alerting, and status page are green.
- [ ] **L-020 (P0):** Steam authentication, ownership, Wallet, achievements, branches, depots, and store settings pass final smoke tests.
- [ ] **L-021 (P0):** Pricing, packages, release date/time, discount, territories, and supported languages are correct.
- [ ] **L-022 (P0):** Store copy, screenshots, trailer, Early Access answers, system requirements, and support URLs match the release candidate.
- [ ] **L-023 (P0):** Support, moderation, engineering, database, commercial, and communications owners are available.
- [ ] **L-024 (P0):** Rollback, maintenance, purchase-disable, registration-disable, and compensation plans are ready.
- [ ] **L-025 (P0):** Launch announcement, patch notes, known issues, FAQ, and community posts are scheduled and approved.
- [ ] **L-026 (P0):** Named decision-makers record Go or No-Go and unresolved risks.

### L4. Release-day runbook

- [ ] **L-027 (P0):** Begin enhanced monitoring before release and confirm dashboards/alerts using synthetic transactions.
- [ ] **L-028 (P0):** Verify backup completion, branch/build, database state, feature flags, prices, and support rota.
- [ ] **L-029 (P0):** Release during a staffed window, not immediately before an unattended night/weekend.
- [ ] **L-030 (P0):** Perform clean-account purchase/install/launch/account/create/play/purchase smoke tests after release.
- [ ] **L-031 (P0):** Monitor activation, auth failure, API latency/error, database saturation, jobs, purchases, crashes, support volume, and reviews continuously.
- [ ] **L-032 (P0):** Publish a fast acknowledgement for material incidents and keep the status page current.
- [ ] **L-033 (P0):** Use pre-agreed thresholds to pause purchases, registrations, a feature, or the service rather than improvising.
- [ ] **L-034 (P1):** Capture launch decisions and incidents in a timeline for the 24-hour review.

---

## 18. Workstream M — Early Access operations and version 1.0

- [ ] **M-001 (P0):** Publish a sustainable update cadence and communicate changes through Steam Events/Announcements and in-game notices.
- [ ] **M-002 (P0):** Keep the Early Access questionnaire and roadmap accurate as plans and delivered scope change.
- [ ] **M-003 (P0):** Maintain a public known-issues list and avoid implying that uncommitted ideas are guaranteed.
- [ ] **M-004 (P0):** Review feedback using evidence: frequency, severity, affected cohort, retention impact, support cost, and product fit.
- [ ] **M-005 (P0):** Use beta branches for risky client/backend changes and preserve rollback compatibility.
- [ ] **M-006 (P0):** Continue economy reconciliation, moderation, capacity planning, restore drills, dependency patching, and security review.
- [ ] **M-007 (P1):** Publish major updates with clear player value, screenshots/trailer where useful, patch notes, and monitoring plans.
- [ ] **M-008 (P1):** Track review themes and respond constructively without promising fixes before investigation.
- [ ] **M-009 (P0):** Define 1.0 exit criteria for content completeness, stability, scale, balance, UX, accessibility, support, and player trust.
- [ ] **M-010 (P0):** Plan any 1.0 price change early enough to comply with Steam discount/pricing timing rules.
- [ ] **M-011 (P0):** Run a full 1.0 release candidate, regression, Playtest/beta, store refresh, and go/no-go process.
- [ ] **M-012 (P1):** Treat version 1.0 as a new launch campaign with updated trailer, screenshots, press, community, and post-launch roadmap.

---

## 19. Candidate launch-scope framework

This table is a starting point for the G0 scope workshop. “Required” means the system must either work end to end or be removed from the advertised launch experience.

| Capability | Early Access recommendation | Release treatment |
| --- | --- | --- |
| Accounts, characters, names, switching | Required | Complete and hardened |
| Skills, XP/AP, practice, wellness | Required | Complete core progression; defer nonessential depth if necessary |
| Songwriting, repertoire, co-writing, splits | Required | Complete and auditable |
| Bands, roles, chemistry, finances | Required | Complete core band loop |
| Rehearsal/jams/recording | Required | Complete scheduling, attendance, payment, and outcome loop |
| Releases, streaming, sales, royalties, charts | Required | Complete and reconciled |
| Shows, setlists, venues, gig outcomes | Required | Complete core performance loop |
| Travel and tours | Required | Enforce location/time; advanced transport depth may be phased |
| Banking and personal/band finances | Required if visible | Simplify rather than ship an unreliable complex flow |
| Mail, notifications, friends, social | Required if visible | Include safety, isolation, and moderation controls |
| Cosmetics/avatar store | Optional at first Playtest; required if monetised | Steam Wallet and entitlement controls before paid availability |
| Open Mic/Battle of the Bands | Strong launch feature | Ship only if reliable and balanced |
| Festivals | Ship, finish, or hide decision required | Do not advertise a partly working management flow |
| Companies | Ship, simplify, or hide decision required | Ownership and finance must be correct if visible |
| Gig visual viewer | Strong differentiator | Marketing must show actual launch quality and performance |
| World Pulse/NPC world simulation | Strong launch feature | Scheduled updates must be reliable and explainable |
| RockMundo FM/Twaater | Optional differentiators | Rights, moderation, and performance review required |
| Advanced vehicles, sponsors, festival depth | Candidate Early Access roadmap | Avoid firm promises or dates until scoped |

## 20. Indicative delivery sequence

This sequence is a planning framework, not a committed date. A detailed estimate requires the current-state audit, named team capacity, and an agreed launch scope. Workstreams overlap where dependencies allow.

| Phase | Indicative dedicated-team duration | Main outcomes |
| --- | --- | --- |
| 0. Strategy and audit | 2–3 weeks | G0 decisions, real baseline, scope, risks, architecture spike |
| 1. Core stability and integrity | 6–10 weeks | Character isolation, core loops, finance/economy, scheduler, automated tests |
| 2. Desktop and Steam integration | 5–8 weeks, overlapping phase 1 | Desktop client, auth/linking, SteamPipe, overlay, achievements, input, Wallet if used |
| 3. Operational hardening | 3–5 weeks | Security, privacy, moderation, load/soak, backup/restore, monitoring, support |
| 4. Store and Steam Playtest | 4–6 weeks | Coming Soon, store assets, Playtest waves, fixes, launch evidence |
| 5. Valve review and launch | 2–3 weeks with contingency | Near-final build, review, go/no-go, release, early-life support |

**Initial range:** approximately 20–30 weeks for a suitably staffed team after scope agreement. A solo or part-time delivery model is likely to take materially longer. Do not set a public launch date until G2 and the first Steam Playtest have passed.

## 21. Critical path

1. Decide business model, Early Access scope, account migration, platform, and wipe policy.
2. Complete current-state audit and resolve character/data/economy integrity risks.
3. Prove the desktop/Steamworks architecture.
4. Complete the dependable core career loop and automated regression suite.
5. Complete Steam authentication/account linking and Steam Wallet integration if monetised.
6. Prove production capacity, security, backup/restore, moderation, and support operations.
7. Publish an honest Coming Soon page and run Steam Playtest waves.
8. Resolve Playtest blockers and freeze a near-final release candidate.
9. Pass Valve store/build review and final operational go/no-go.
10. Release during a staffed window and run enhanced support through the first 30 days.

## 22. Required release evidence and documents

- [ ] Approved launch scope and decision log
- [ ] Architecture and environment diagram
- [ ] Desktop/Steam integration design
- [ ] Database schema/function/RLS audit and direct-change register
- [ ] Economy source/sink model and reconciliation report
- [ ] Threat model and security review report
- [ ] Data inventory, privacy notice, terms/EULA, and community rules
- [ ] Content/IP/AI provenance register
- [ ] Automated test report and manual compatibility matrix
- [ ] Load, soak, performance, and capacity report
- [ ] Accessibility review
- [ ] Backup/restore drill report and disaster-recovery runbook
- [ ] Monitoring/alert catalogue and incident runbooks
- [ ] Support/moderation playbooks and rota
- [ ] Steam store copy, asset pack, trailer, Early Access FAQ, and content survey
- [ ] Steam Playtest plan and findings report
- [ ] Valve review evidence
- [ ] Release, rollback, go/no-go, and launch-day runbooks
- [ ] 24-hour, 7-day, and 30-day post-launch reviews

## 23. Steam timing and rule checkpoints

The following official constraints must be included in the release schedule:

- Steam currently charges a **US$100 equivalent Steam Direct fee per app**.
- For initial titles, Steam documents a **30-day waiting period after paying the app fee** before release.
- A new product must have a public **Coming Soon page for at least two weeks** before release.
- Valve says store-page and product-build reviews typically take **3–5 business days**, but recommends allowing **at least seven business days for each** so feedback can be addressed.
- The reviewed build must start on every supported operating system, contain every selected/advertised feature, and use **Steam Wallet for in-game transactions** made by Steam customers.
- Steam requires at least **five gameplay screenshots** and requires capsule art with a readable product name/logo.
- The content survey covers general/mature content and shipped or live-generated AI content.

## 24. Official Steamworks references

Specifications and policies should be checked again immediately before submission.

- [Steamworks onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)
- [Steam Direct fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- [Valve review process](https://partner.steamgames.com/doc/store/review_process)
- [Coming Soon pages](https://partner.steamgames.com/doc/store/coming_soon)
- [Steam Early Access](https://partner.steamgames.com/doc/store/earlyaccess)
- [Steam Playtest](https://partner.steamgames.com/doc/features/playtest)
- [Uploading builds with SteamPipe](https://partner.steamgames.com/doc/sdk/uploading)
- [Graphical asset overview](https://partner.steamgames.com/doc/store/assets)
- [Store asset specifications](https://partner.steamgames.com/doc/store/assets/standard)
- [Graphical asset rules](https://partner.steamgames.com/doc/store/assets/rules)
- [Content survey and generative-AI disclosure](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)
- [Steam user authentication and ownership](https://partner.steamgames.com/doc/features/auth)
- [Steam microtransactions](https://partner.steamgames.com/doc/features/microtransactions)
- [Steam stats and achievements](https://partner.steamgames.com/doc/features/achievements)
- [Steam Input](https://partner.steamgames.com/doc/features/steam_controller)
- [Steam Deck and SteamOS compatibility](https://partner.steamgames.com/doc/steamhardware/compat)
- [Steam pricing](https://partner.steamgames.com/doc/store/pricing)
- [Steam localisation](https://partner.steamgames.com/doc/store/localization)
- [Steam tags](https://partner.steamgames.com/doc/store/tags)
- [Steam marketing tools](https://partner.steamgames.com/doc/marketing/tools)

---

## 25. Immediate next actions

These are the first actions to start the programme:

1. [ ] Approve or change the recommended Playtest → Early Access → 1.0 route.
2. [ ] Decide the Steam business model and treatment of existing beta players.
3. [ ] Complete decisions DEC-001 through DEC-010.
4. [ ] Make the current RockMundo repository and deployment environments available for the baseline audit.
5. [ ] Produce the launch feature inventory and mark every system ship/finish/hide/defer.
6. [ ] Re-test REG-001 through REG-018 against the current live build and repository.
7. [ ] Run the desktop architecture proof of concept and choose the shell/Steamworks bridge.
8. [ ] Start Steamworks onboarding and pay the app fee early so its waiting period does not become the critical-path blocker.
9. [ ] Create the active delivery board from this plan with owners and target gates.
10. [ ] Do not announce a public release date until core stability, desktop readiness, and the first Steam Playtest provide credible evidence.
