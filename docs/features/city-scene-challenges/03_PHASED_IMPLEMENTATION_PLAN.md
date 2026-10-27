# RockMundo — City Scene Challenges
## 03. Phased Implementation Plan

**Status:** Proposed — no code changes or live database migrations applied  
**Approach:** Deliver an auditable vertical slice, then broaden activities and visual identity.  
**Target repository:** `fowlerontherun/rockmundo-genesis-project`  
**Starting assumption:** React/TypeScript frontend and Supabase Postgres, RPCs, migrations, Edge Functions, scheduled processing.

---

## 1. Outcomes and release gates

The first public release must support **daily + weekly + monthly** challenges for every eligible city, with an attractive City Scene Board, verified contributions and idempotent rewards. Fancy visuals are **not** a substitute for correct accounting.

### Definition of Done for playable V1

1. Three daily, three weekly and one monthly campaign are created, rotated and archived reliably, for all supported cities.
2. A known-good subset of existing actions produces cross-cadence contributions once, with detailed audit records.
3. Everyone in a city sees the same server totals; each player sees only authorised personal details.
4. Participation and completion rewards apply once and only once through existing canonical progression functions.
5. The board shows usable posters, month reveal stages, timelines, contributor rankings and interaction CTAs.
6. UTC cycle boundaries, delayed source events, travelling characters, inactive cities, two characters on one account, retries, refund/cancellation and concurrent claims are handled safely.
7. Production has feature flags, health visibility, recovery scripts, rollback plans and measurable uptake.

## 2. Repository reuse map (reviewed 27 October 2026)

These file references are starting points, not proof that each workflow is healthy in production. Complete runtime/schema verification is still necessary.

| Need | Existing candidate | Strategy |
|---|---|---|
| Band jam sessions | `src/components/jam-sessions/JamSessionsEnhanced.tsx`, `src/pages/JamSessions.tsx`, `docs/band-jam-sessions.md` | Read finalised attendance / completion, not booking |
| Band rehearsals | `src/pages/Rehearsals.tsx`, `src/components/performance/RehearsalsTab.tsx`, `supabase/migrations/20260831153000_active_rehearsal_sessions.sql` | Reuse only with server-confirmed completion; known prior session reliability concerns |
| Social activities | `src/features/social-activities/catalog.ts`, `src/pages/SocialActivities.tsx`, `docs-social-activities.md` | Existing idempotent completion and relationship event infrastructure makes a good later adapter |
| Music scene / city identity | `src/types/city-projects.ts`, `src/components/city/CityProjectsPublicView.tsx` | Use city model; do not mutate unrelated mayor projects |
| City scene (underground) | `docs/underground/CITY_SCENE_REFINEMENTS.md`, `src/features/underground/CityScenePanel.tsx` | Avoid conflating underground-specific reputation with this public challenge score |
| Social/privacy | `docs/social/SOCIAL_SYSTEM_AUDIT.md`, `src/pages/Relationships.tsx` | Reuse public-safe profile checks, block/privacy and notifications |
| Community reward UI | `src/features/community-rewards/CommunityRewards.tsx` | Existing module is primarily referrals; reuse patterns but keep scene rewards logically separate |
| Player activity and news | Existing Today’s News, Inbox and notifications hooks | Use controlled integration, no feed spam |
| Finance/accounting | Canonical financial account ledgers documented in `docs/finance/FINANCE_PHASE8B10_BAND_TREASURY_REHEARSAL_AUDIT.md` | V1 awards no cash; if adding it later, never read/write deprecated band balance mirror |
| Gigs / post-gig | Existing gig completion systems and related tests | Do not award for pending/stuck gigs; known historic post-gig processing bugs require verification |
| UI portraits | Existing active avatar portrait output | Enforce fallback for head-and-shoulders render |

## 3. Delivery phases

### Phase 0 — Audit, contracts, art direction and safety baseline

**Deliverables:** `SOURCE_AUDIT.md`, event contract, reward grant mapping, source health matrix, art wireframes, feature flags, data migration dry-run.

**Tasks:**
- [ ] Identify deployed Supabase project and reconcile local migration state with production (no assumptions from filenames).
- [ ] Catalogue existing challenge/quest/reward infrastructure to avoid a duplicate subsystem.
- [ ] Map reliable server completion states for gig, promotion, jam and rehearsal; note delayed actions and cancellation/reversal semantics.
- [ ] Confirm canonical active profile -> user account -> band membership -> city foreign keys and current-city source.
- [ ] Audit existing scheduler ownership, missed runs, cron permissions and retry behavior before adding a new job.
- [ ] Confirm XP/fame, achievement and notification grant APIs; compare proposed sample rewards with current progression rates.
- [ ] Test source event volume for one-player, five-player, 20-player and busy-city cases to calibrate goals/caps.
- [ ] Define complete privacy policy for public feed, avatars, rankings and opt-out.
- [ ] Produce approved poster template + 25/50/75/100% reveal sketches; confirm icon set and colour tokens.
- [ ] Add `city_scene_challenges_enabled` (global and optionally city-level) and `city_scene_rewards_enabled` server-side gates.

**Acceptance:** Every enabled action has a named trusted source, canonical validation rule, stable source ID and test fixture; source health is known; default reward amounts approved; no production migration applied blindly.

**Depends on:** Existing code only.  
**Risk:** Source completion paths may have known bugs; mark them disabled instead of building on unreliable states.

### Phase 1 — DB contract, cycles and idempotent contribution pipeline

**Deliverables:** Minimal schema migrations, server functions/event adapters, migrations tests, simulator, reconciliation procedure.

**Tasks:**
- [ ] Add template, cycle, objective, affiliation, contribution, entitlement/claim, milestone tables (or reuse a compatible existing generic subsystem).
- [ ] Add unique constraints and RLS; index `(city_id,cadence,starts_at,ends_at)` and source-event dedupe keys.
- [ ] Build curated template catalogue with 3 daily / 3 weekly / 1 monthly campaign and safe source fallback rotation.
- [ ] Create cycles at UTC boundaries idempotently; include `N` active-population snapshot and immutable targets.
- [ ] Implement event adapters in an independently testable service or security-definer function with hardened permission checks.
- [ ] First adapter: choose the **least error-prone currently deployed completed event** found in Phase 0; don't pre-commit to gig if its job is broken.
- [ ] Record character, owner account, band and city from authoritative source records, not untrusted client fields.
- [ ] Apply daily city affiliation/point cap and unique dedupe; credit matching active daily/weekly/monthly objectives exactly once.
- [ ] Aggregate leaderboard/counters through transactional updates or consistent read aggregation.
- [ ] Build catch-up processor for source events finalised late (credit cycle by source event time, enforce bounded lookback).
- [ ] Unit tests for collision, rollback, replay and concurrent event processing.

**Acceptance tests:**
- Replay the same event 100 times: one contribution per relevant objective.
- Two character profiles on the same account cannot claim twice.
- Switching cities cannot award multiple city boards the same UTC day.
- At month boundary, a late finalised event is assigned to the correct prior period if within documented grace window.
- Same-band self-interaction cannot produce cross-band bonus.
- Disabled/invalid event adapter awards zero.

**Deployment:** Apply migration only after staging reconciliation; no mass historical backfill without dry run.

### Phase 2 — Playable Scene Board for all cadences

**Deliverables:** Scene Board route, read APIs, 3 cadence tabs, source-safe action CTA links, loading/empty states, entry-point tile.

**Tasks:**
- [ ] New feature module `src/features/city-scene-challenges/` with `types.ts`, `api.ts`, `hooks.ts`, components and test fixtures.
- [ ] Add City Scene Board under city hub/menu using existing navigation conventions.
- [ ] Add city hero, active monthly campaign, daily/weekly/monthly tabs, card progress, countdown and user contribution snippet.
- [ ] Add contextual 'do the activity' links to real existing pages, not manual self-reported completion.
- [ ] Add personal history timeline with no false-positive optimistic reward.
- [ ] Connect to live aggregate refresh; debounce realtime or use safe refetch on board opening / source completion.
- [ ] Mobile companion read view, compatible claim link / action fallback for desktop-only flows.
- [ ] Add full empty/error/source-disabled/fallback imagery states.
- [ ] Ensure all cards show **what counts and what doesn't**.

**Acceptance:** A new city with one eligible account and a large city both get appropriate targets and a complete board. Cards match server totals after refresh and progress works across all three cadences.

### Phase 3 — Safe rewards, social hooks and recognition

**Deliverables:** Reward entitlements, claim RPC, contributor leaderboard, privacy-safe feed, Today's News/inbox notices, opt-out control.

**Tasks:**
- [ ] Add atomic entitlement evaluator (participant threshold, city completion threshold, period expiry).
- [ ] Call existing authoritative progression-grant functions with immutable grant IDs. Do **not** write to wallets from the browser.
- [ ] Enforce account/cycle/reward uniqueness; retryable failure transitions.
- [ ] Add personal rewards panel with `Locked`, `Ready`, `Claimed`, `Expired` states.
- [ ] Calculate top-contributor rankings from audited ledger (player/band/cadence) with deterministic ties.
- [ ] Honour profile privacy, block/mute and anonymous contributor display.
- [ ] Add feed events for true completions; deduplicate announcements by objective/milestone.
- [ ] Add targeted Today's News block and claim inbox deep links; avoid notification storms.
- [ ] Add source adapters for the remaining audited, stable action types and template health rotation.

**Acceptance tests:**
- Concurrent claims do not double-credit XP or fame.
- Reward transaction failure can be resumed without losing entitlement or double credit.
- Hidden player does not appear by name/photo in public leaderboard or scene feed.
- A refunded/invalidated qualifying transaction is excluded or compensated according to source policy.
- Private account details do not surface through public RPC response.

### Phase 4 — Visual signature: poster wall, reveal and archive

**Deliverables:** Polished scene-themed hub, month poster template, reveal transitions, responsive avatar cards, completed poster gallery, badge art.

**Tasks:**
- [ ] Implement shared `ScenePoster` component taking `city`, `campaign theme`, `progress` and `art version`.
- [ ] Add torn-paper/tape/sticker backgrounds, tasteful city-specific motifs and consistent RockMundo purple accents.
- [ ] Provide four reveal checkpoints (25/50/75/100), with accessible percentage label.
- [ ] Add a one-time, reduced-motion-safe milestone transition; avoid autoplay audio.
- [ ] Add contributor avatar and band visuals using head-and-shoulders fallback rendering.
- [ ] Build previous-month poster archive on city scene page, with stable month/year identity.
- [ ] Add poster-only Share Studio fallback if an avatar-dependent share fails.
- [ ] Add automated visual regression checks for poster progress thresholds, no-media states and screen widths.

**Acceptance:** All 4 poster stages render; archive remains correct across month rollover; portraits do not crash; under modest bandwidth the board stays functional before artwork finishes loading.

### Phase 5 — Optional expansions, not launch blockers

- [ ] Cross-city rivalry with population-normalised comparison and rankings, not winner-takes-all giant cash rewards.
- [ ] Mayor curated-theme selection and editorial messages with server guardrails.
- [ ] Seasonal/community special challenges (Halloween, Christmas, festivals) reusing same cycle machinery.
- [ ] World Scene Map pins and city glows using existing map system.
- [ ] More sophisticated band discovery and collaboration recommendations.
- [ ] Achievements/collectibles for long-term local contribution streaks, **without punishment for missed days**.

## 4. Suggested PR decomposition

Small-to-medium PRs should allow review and reduce migration/risk pileup:

| PR | Contents | Merge gate |
|---|---|---|
| 1 | Docs + audited event/reward contracts + design tokens | Design review |
| 2 | SQL schema/RLS/indexes + cycle generator and simulator | Migration dry-run + DB tests |
| 3 | First reliable action adapter + idempotent contribution ledger | Replay, duplicate/alt/city tests |
| 4 | Board read RPC + frontend route/cards/CTA + feature-flag gating | Unit + mobile smoke + CI |
| 5 | Rewards/claims, leaderboard, feed and inbox | Concurrency, privacy and ledger tests |
| 6 | Poster renderer + mural stages + archive + avatar fallback | Visual regression + accessibility |
| 7 | Remaining action adapters + production diagnostics/rollout | Source-specific integration checks |

If CI is blocked by unrelated baseline lint drift (previous RockMundo issue #4569), identify and isolate that baseline issue rather than concealing failures or broad-disabling checks. New files must pass lint/typecheck and scoped tests regardless.

## 5. Proposed module boundaries

```text
src/features/city-scene-challenges/
  api.ts                     # RPC wrappers, typed public/personal payloads
  types.ts                   # Cadence, source action, milestone, entitlement
  useSceneBoard.ts           # Safe refetch/realtime reconciliation
  components/
    CitySceneBoard.tsx
    ScenePoster.tsx
    SceneChallengeCard.tsx
    ChallengeDetail.tsx
    MySceneContributions.tsx
    SceneRewardPanel.tsx
    SceneLeaderboard.tsx
    SceneCommunityFeed.tsx
    SceneHistoryGallery.tsx
  __tests__/
    scene-board.test.tsx
    scene-poster.test.tsx
supabase/migrations/
  <creation-date>_city_scene_challenges_foundation.sql
  <creation-date>_city_scene_challenges_rewards.sql
supabase/functions/  # or existing secure scheduling/event infrastructure
  ... scene-cycle reconciliation / event consumer (only if needed)
docs/city-scene-challenges/
  01_FEATURE_SPEC.md
  02_UI_UX_SCREEN_BREAKDOWN.md
  03_PHASED_IMPLEMENTATION_PLAN.md
```

Migration file timestamp must match its real creation/deployment order; never make a fictitious future-dated migration. Validate actual repository path/module/router conventions before creating these files.

## 6. Back-end pseudo-flow / integration contracts

### Cycle creation

```text
scheduler (existing preferred)
  -> ensure_cycle(city, cadence, period) with UNIQUE(city,cadence,starts_at)
  -> snapshot eligible active accounts N
  -> choose enabled templates from audited available action sources
  -> build 3 daily / 3 weekly / 1 monthly campaign objectives
  -> freeze scaling and theme version
  -> optionally reconcile prior completed/expired cycles
```

### Contribution

```text
canonical_game_action_completed(source_type, source_id)
  -> fetch FINAL server-owned event data
  -> validate outcome, actor/account, city, band, anti-abuse rules
  -> resolve one city affiliation per account per UTC day
  -> find matching cycles by COMPLETED-AT UTC (not ingestion time)
  -> for each eligible objective:
       INSERT UNIQUE(objective, source_type, source_id, account)
       update progress in same transaction
       issue one milestone row at thresholds
  -> refresh aggregate reads / publish tiny notification event
```

### Claim

```text
claim_scene_reward(account, cycle, reward_key)
  -> verify caller owns account and entitlement exists
  -> lock unique claim / ledger entry
  -> call existing authoritative XP/fame/achievement award path
  -> persist grant reference and terminal claimed state
  -> return existing receipt if retrying
```

Consider rewarding automatically rather than requiring manual claim if the existing grant system provides safe entitlements and ledger consistency. UI can still show 'reward earned' and historical receipts.

## 7. Detailed test matrix

| Scenario | Expected result |
|---|---|
| Completed jam, duplicate webhook | Only one credited event/participant/objective |
| Jam booked but not completed | Zero points |
| Cancelled gig or delayed post-gig processor | Zero until valid finish; then correct original-cycle credit |
| Same player uses two characters | Account cap/claim uniqueness enforced |
| Player travels Portsmouth -> London same day | First eligible day's affiliation governs credits; no dual farm |
| Genuine two-account different-band collaboration | Bounded co-op bonus where permitted |
| Two profiles from same account / own band | No co-op bonus |
| City of one active player | Goals possible via qualifying solo actions, avoiding mandatory co-op |
| City with zero active players | Safe starter targets, no fake claimed rewards |
| Source adapter goes unhealthy | Remove from future templates; existing objectives need admin recovery plan |
| Event lands just after UTC rollover | Matches cycle by source completion timestamp |
| Scheduler runs 3x during cutover | One cycle only |
| 2 concurrent reward claims / browser reload | Single canonical grant with stable receipt |
| Claim partly fails before ledger commit | Retryable idempotent recovery, no phantom success |
| Private player makes qualifying action | Aggregate increments, private identity withheld |
| Malicious client changes city or sends points | Server rejects/ignores client-supplied authority |
| Poster art 25/50/75/100 + month rollover | Correct static/animated stage, archive intact |
| Small Android portrait screen | Readable card layout and touch targets |
| Reduced-motion preference | No movement required to interpret the state |
| Missing avatar/poster or Share Studio null | Fallback with no crash |
| Network disconnect/reconnect | Data refreshes from server without local double count |
| Reward expiry after grace period | Claims closed predictably; no duplicate grant |

### Safety/performance/security checks
- Role-based access for template/admin endpoints; fail-closed on unauthorised RPC.
- No unrestricted RLS reads for private history, account links or social details.
- Load tests for simultaneous city board viewers, burst of gig completions, 100 cities × all cadences.
- Measure feed queries; paginate and aggregate, no N+1 profile fetches.
- Keep animation GPU/lightweight and avoid layout shifts during loads.
- Run migration dry-run, repeat migration where safe, targeted DB integration tests, end-to-end reward test and UI smoke tests.

## 8. Rollout and recovery

1. **Staging:** Seed curated posters and synthetic events; prove cutover and claims with fake awards only.
2. **Shadow processing:** Flag contributions on but rewards off; compare expected verified events with stored contributions for at least several complete daily cycles.
3. **Small pilot:** Enable for limited eligible test cities; observe success rates, fraud, support load and source-health.
4. **Broad release:** Turn on all enabled cities after confirmed cap/reward balance, mobile acceptance, migration verification.
5. **Monthly turnover:** Test first end-of-month cutover in staging and prepare on-call reconciliation runbook.
6. **Recovery:** Flags can stop new contributions/reward grants independently; leave accumulated ledger append-only for audit; undo erroneous rewards only through documented canonical correction procedure.

**Operational dashboard:** active cycles per city, missing/duplicated cycles, source adapter status, event lag, rejects by reason, unreconciled reward grants, failed claims, milestone count, scene page errors and avatar render fallbacks.

## 9. Priority and dependencies

| Priority | Critical dependency | Can work in parallel? |
|---|---|---|
| P0 | Validate deployed schema, source completion, rewards | Yes: art direction and UI prototypes |
| P0 | Cycle + ledger + anti-abuse | No: reward logic depends on it |
| P0 | Board for all three cadences | Yes alongside event adapter after read-contract freeze |
| P0 | One canonical XP/fame grant and dedupe | No: needs ledger |
| P1 | Multi-source adapters | Yes by source once event contract defined |
| P1 | Poster reveal, avatar fallbacks, news integration | Yes after board schema/contracts |
| P2 | Deep city flavour and rivalry map | Only after reliable V1 usage signals |

## 10. Project-specific risks to track

1. **Existing broken activities:** Rehearsals, university auto-attendance, recording and other completions have had known issues. Include only trusted source adapters; don't tie scene system health to unresolved work.
2. **Cron/scheduler inconsistency:** Payroll and sales issues show why reliable lifecycle reconciliation matters; avoid unnecessary extra schedules and make all jobs idempotent.
3. **Migration drift:** Inspect applied migrations and RPC signatures in target Supabase instance first, particularly creation timestamps and function ownership.
4. **Reward economy:** XP can already be gained from numerous systems; do not amplify passive gain unchecked.
5. **Avatars/media:** Other game surfaces have head-and-shoulders failures; make fallback mandatory and decouple render from contributions.
6. **Small cities vs large cities:** Freeze scaled goals and monitor completion distribution; no raw inter-city 'winner' multiplier in V1.
7. **Alt/social collusion:** Avoid trading points through reciprocal spam. Only bona fide finalised interactions and bounded daily account credit.
8. **Open PR conflicts and CI drift:** Split PRs and require clean, scoped validation at every phase.

## 11. Hand-off checklist for implementation agent

- [ ] Read three City Scene Challenges docs and current `main` code.
- [ ] Verify production database/Supabase and migration state before SQL writes.
- [ ] Record source-of-truth table/function for each enabled gameplay event.
- [ ] Add docs/contracts PR (no gameplay behaviour change) before data migration.
- [ ] Plan and execute schema/adapter/UI/rewards PR sequence with tests.
- [ ] Validate against production-like data using staging, no unapproved mass backfill.
- [ ] Enable via feature flags and measure release health.
- [ ] Update in-game help/wiki and admin operational runbook before wide rollout.
- [ ] Keep new code compatible with RockMundo Live V1 UI/version banner and existing company/social privacy infrastructure.

**Recommended first engineering action:** Audit deployed canonical game-action completion, reward-grant and scheduler paths, then implement an end-to-end thin slice: one completed event -> daily/weekly/monthly scene ledger -> board progress -> once-only personal reward -> mural milestone.
