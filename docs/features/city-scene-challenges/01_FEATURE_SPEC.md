# RockMundo — City Scene Challenges
## 01. Full Feature Design Specification

**Status:** Implementation-ready proposal — not yet deployed  
**Version:** 1.0 / 27 October 2026  
**Product:** RockMundo Live V1  
**Feature owner:** Game systems / community experience  
**Working route:** `/city/scene-challenges` (verify current routing conventions before implementation)

> **One-sentence pitch:** Every city's music scene comes alive through daily, weekly and monthly challenges that musicians complete together using authentic in-game actions, unlocking personal rewards, shared milestones and a visually evolving city poster/mural.

---

## 1. Product goals and non-goals

### Goals
1. Increase meaningful reasons to return daily, weekly and monthly without adding repetitive click-grinding.
2. Generate player-to-player discovery, support and shared accomplishment beyond members of a single band.
3. Strengthen city identity and recognition without making famous cities automatically unbeatable.
4. Reuse the existing gigs, tours, rehearsal/jam sessions, social activities, releases, PR, cities, profiles, achievements, notifications and reward infrastructure.
5. Make contribution, progress, outcomes and community stories unmistakably visible.
6. Support asynchronous play, solo musicians and mobile companion browsing.

### Non-goals for first release
- No new complex music minigame, standalone scene currency, 3D environment or free-text user-generated challenge editor.
- No global city-vs-city cash competition or reward-bearing direct player voting at launch.
- No automatic rewriting of city treasury, mayor powers, band finances or chart formulas.
- No unverified reward for sending invitations, button clicks, views, low-effort likes or cancelled activities.

## 2. Player experience

**Entry:** The player sees a “Your City Scene” tile on city and Today’s News surfaces with the current city's theme artwork, next reward, progress and time remaining. Selecting it opens the Scene Board.

**First visit:** A brief three-step introduction: (1) Play as normal; (2) real completed actions add to city goals; (3) earn participation rewards and help unlock the city's poster/mural. No forced tutorial after dismissal.

**Typical session:** Player sees 3 daily, 3 weekly and 1 monthly challenge; reviews the nearest completion; clicks “Find a gig”, “Discover local bands” or “Join a jam”, completes the existing activity; returns to see “+2 Scene Points”, progress animation, a contributor feed entry and next reward state.

**Monthly climax:** Community reaches thresholds; portions of a unique monthly city campaign poster reveal at 25%, 50%, 75% and 100%. Completion produces a finished city poster, Hall of Fame entry, optional profile badge and citywide celebration in Today's News. Rejected/invalid actions produce no contributions.

### Three overlapping challenge cadences

| Cadence | Default volume | Character of goals | Reward emphasis | Reset |
|---|---:|---|---|---|
| Daily | 3 goals per city | Simple, achievable, varied | Small personal XP/local fame; scene contribution | Every day 00:00 UTC |
| Weekly | 3 goals per city | Multi-day cooperative objectives | Higher personal XP/fame, feature spotlight | Monday 00:00 UTC |
| Monthly | 1 umbrella campaign with 3 stages/objectives | Narrative city-wide identity | Badge/poster, City Hall of Fame, optional restrained temporary perk | First day of month 00:00 UTC |

**Time policy:** All cycles use UTC (server authoritative); the UI shows remaining time converted to the user's locale. Start/end values are stored explicitly and use half-open intervals `[starts_at, ends_at)`; all rewards are determined using server event completion timestamps, not browser time.

## 3. Challenge catalogue and rules

### V1 qualified action types

| Key | Qualifying event | Validation | Suggested default scene points | MVP? |
|---|---|---|---:|---|
| `gig_promote_other` | Genuine promotional action for another local band’s scheduled gig | Existing server-confirmed PR action; destination gig exists; not own band; per-event/target cooldown | 1 | Yes, after source audit |
| `jam_complete` | A completed jam with distinct real musicians | Verified completed session and attendance; not just a booking or invite | 2 | Yes, if completion source reliable |
| `rehearsal_complete` | Completed band rehearsal | Confirmed canonical completion plus eligible participant; no duplicated lineups | 1 | Yes, after attendance validation |
| `gig_complete` | Band member participates in a finished gig in city | Finished gig + finalised attendance/lineup; no cancelled gig | 2 | Yes, after attendance validation |
| `release_support_other` | Valid promotion of another band’s new release | Real existing promotion workflow/event, non-own-band; not a bare like/view | 1 | Phase 3 if source reliable |
| `social_activity_complete` | Attend a completed shared activity with another eligible player | Canonical completed social activity + accepted attendance; costs untouched | 1 | Phase 3 if source reliable |
| `merch_support_other` | Buy fulfilled local artist merchandise | Settled non-refunded transaction, not own band; max one credited purchase per artist/cycle | 1 | Later, not MVP |
| `bob_participate` | Participate in a completed city Battle of the Bands event | Server-settled BoB participation | 2 | Later, not MVP |

Only **audited, reliable** source events may be enabled. If a source is unhealthy (e.g., rehearsal completion or gig processing), disable that adapter and substitute an available challenge template. Do not attempt to award from speculative joins or front-end analytics events.

### Template examples

**Daily:**
- *Spread the Word* — The city completes 8 verified promotions of other bands' gigs.
- *Backstage Connections* — The city completes 4 qualifying jam sessions with different musicians.
- *Ready to Rock* — The city completes 5 verified rehearsals.

**Weekly:**
- *Support Your Scene* — Combined 40 verified cross-band promotional contributions.
- *Band Together* — Complete 25 verified cooperative rehearsals and jams.
- *Live Music Revival* — Have 12 local gig performances finish successfully.

**Monthly:** *Portsmouth: Make Some Noise* (campaign theme selected from an admin-curated catalogue):
- Stage 1, *Get the Posters Up* — reach scene contribution threshold (25%).
- Stage 2, *Fill the Rooms* — reach threshold (50% and 75%).
- Stage 3, *Take the Stage* — achieve full target (100%) for finished commemorative artwork and recognition.

Names, target quantities and rewards are examples; the system must calculate actual target size once per cycle from eligible recent unique local participants.

### Meaningful choices, not chores
- Every challenge card links to the relevant existing gameplay page rather than exposing an empty “Contribute” button.
- A single valid event may count toward compatible daily, weekly and monthly goals, but must never count more than once for the same goal and participant.
- At least two of the day's three offered templates should be achievable by novice/solo characters through open systems; rotation should prevent three expensive or time-gated challenges at once.
- Prioritise cross-band interaction templates over self-promotional templates. Players can join group challenges even if their band is inactive.
- Templates must be weighted by local eligibility (venues, number of active bands, available jam sessions) and active source health.

## 4. City identity, eligibility and fairness

### Scene affiliation
- Players visibly join the scene for the **city where their active character currently resides**.
- At the first eligible contribution of each UTC day, set a **daily scene affiliation** for that active player account. Subsequent travel cannot award contributions in additional cities on the same day. Players can still view other city boards.
- Keep the contributing character profile and band metadata for display, but enforce one aggregated daily contribution cap per **account**, not per alt character. Rewards are likewise account-constrained, while a configurable selected character receives applicable character XP/fame.
- Touring players may contribute to the scene of the city they are physically in when their daily affiliation is first set; home-city history is preserved separately.
- Server must confirm verified event city matches affiliated city; city cannot be passed by an untrusted client.
- Character and band privacy/block settings apply to all public name, profile and avatar display. Anonymous contribution still advances the community counter where permitted.

### Dynamic targets
To prevent low-population cities from being locked out, define `N = max(1, count of eligible distinct player accounts with qualifying city activity in the previous 14 days)`; snapshot at cycle creation. Initial *illustrative* defaults:
- Daily scene-wide target: `max(4, round(3 × N))` total qualifying contribution points across the day's chosen goals.
- Weekly scene-wide target: `max(12, round(10 × N))`.
- Monthly campaign target: `max(40, round(35 × N))`.

For a cycle with multiple objectives, distribute aggregate targets by template weight and freeze the objective target for the entire cycle. For larger N, later tune saturation; do not silently recalculate mid-cycle. Use a trailing-14-day measure excluding invalidated activity, bots and known duplicate accounts.

### Caps and social bonus
- Proposed **account cap:** 5 credited scene points/day across all source actions in a city; each event may still progress overlapping cadences, but the ledger must record separate accounting per objective and avoid twice granting the same point on retries.
- A verified interaction with **another independently controlled player account and a different band** earns a visible +1 scene point bonus, bounded by the 5-point cap. Do not grant bonus for self-alts, same account, or pure invitations.
- Optionally cap any single source category at 60% of a cycle's overall progress to encourage varied play; do not introduce this restriction without displaying it clearly to users.
- When N is very small, scale goals to solo-friendly achievable levels; never make another active player mandatory to receive base rewards.
- No reward for buying the same cheap item repeatedly, paying a colluding account, or cancelling/rebooking.

**Balancing note:** The total daily cap and target values are provisional. Phase 0 must simulate against anonymised recent event volumes, including one-player, five-player and high-population cities, and adjust targets so most engaged cities can succeed but not instantly on rollover.

## 5. Progress and reward model

### Separate counters
1. **Community progress:** per-objective and per-cycle totals; drives poster reveal, public milestones and community unlocks.
2. **Personal contribution:** valid points earned by player and chosen band, for ranking and personal eligibility.
3. **Personal claim status:** earned, claimable, claimed, expired; unrelated to client button state.

### Recommended reward policy (configurable sample values)

| Reward | Eligibility | Example grant | Restrictions |
|---|---|---|---|
| Daily participation | At least 2 valid points in that daily cycle | 100 character XP + 5 local fame | Claim once/account/day/city affiliation |
| Daily city completion | Daily shared objectives reached, player contributed | 50 additional XP | No reward if player added nothing |
| Weekly participation | At least 8 valid points within weekly window | 350 XP + 25 local fame | Once per week |
| Weekly community completion | City meets weekly threshold and player eligible | 1 featured scene spotlight entry + modest XP | No cash windfall |
| Monthly participation | At least 20 valid points within month | 1,000 XP + 75 local fame | Once per month |
| Monthly completed campaign | City reaches 100%, personal eligibility met | Commemorative badge + collectible city poster + Hall of Fame placement | Cosmetics/recognition lead, not power creep |

- Values above are **design placeholders**, not approved balance numbers; compare them with RockMundo's current XP/AP/fame rates before deployment.
- Do not introduce a new spendable token in V1. City scene points are score/progress, not an economic currency.
- Mayor-controlled treasuries are **not charged** by these rewards. Use existing canonical XP/fame/achievement grant paths and existing authorised finance ledger if cash is ever introduced later.
- Design optional community effect as **visual spotlights and discovery placement** rather than gig-ticket-sale multipliers or chart manipulation in V1.
- All rewards claimed via atomic server-side action with unique account/cycle/reward key; no double claims.
- Rewards become claimable when objectively earned; allow a **7-day claim grace period** after reset, then archive expired rewards. Add inbox reminder before expiry; if reward storage supports automatic reliable entitlement, consider auto-grant instead of manual claiming.

### Milestone reveal
At 25%, 50%, 75%, 100% of a monthly campaign:
- Show a one-time mural/poster reveal layer.
- Publish a privacy-safe community milestone in activity feed / Today's News.
- At 100% issue eligible campaign badge and store the completed poster as a permanent historical artefact.
- Milestone animations must be deterministic from server state and not replay on every refresh.

## 6. Social and civic loops

- **Local artist discovery:** each card offers a contextual filtered list of nearby bands, gigs or sessions, not just a progress bar.
- **Contributor feed:** “A Portsmouth band helped promote a local show” for private profiles; identified attribution only when privacy settings permit.
- **Rankings:** tabs for players and bands (individual, recent, and all-period), with “First-time contributor”, “Local supporter”, and “Most helpful collaborator” callouts. Rankings are a display of validated activity, not a separate reward faucet.
- **Mayor role (later):** suggest or vote on curated campaign themes and publish non-binding editorial messages; cannot set reward payouts, tamper with goals or select favourite winners.
- **Today’s News:** daily snapshot, milestone events, campaign reveal and featured community moments; avoid message spam and dedupe by milestone ID.
- **Band identity:** credit a contributor's active eligible band at event time; prevent transferring points between bands by switching membership afterwards.
- **World map (later):** show city scene strength normalised to eligible active population, alongside raw totals to avoid large-city dominance.

## 7. Integrity, moderation and security

- Server-authoritative verification from existing finalised source-event records. Never award directly from client clicks, chat messages, follows, session creation or unconfirmed reservations.
- Each source event must expose stable source type, ID, eligible actor, city, completion timestamp and supporting actor/band data.
- Unique dedupe: `(challenge_objective_id, source_type, source_event_id, account_id)`; robust upsert `ON CONFLICT DO NOTHING` or equivalent in an audited transaction.
- Reject activity that is reversed/refunded/invalidated and implement carefully scoped compensating adjustments.
- One account/day/city affiliation plus source caps and per-target cooldowns; no fake referrals or alt-account loops.
- RLS: public read only of aggregated progress and privacy-safe summaries; per-account private claim/contribution history; admin-managed templates; server-only contribution writes.
- Provide report/block/mute controls for featured activity, no player text injected into posters without moderation.
- No sensitive status in public feed: health, cost details, personal finances, private social relationships, exact online presence or hidden location.
- Add event processing/audit logs, metrics for rejected events, processing delays, duplicate attempts, reward grants and anomalous point volumes.

## 8. Data and integration proposal

### Minimal persistent model

| Table (proposed) | Purpose / important columns |
|---|---|
| `scene_challenge_templates` | `id`, `slug`, `cadence`, `title`, `description`, `action_type`, `goal_rule`, `reward_config`, `art_theme`, `weight`, `enabled`, `version` |
| `scene_challenge_cycles` | `id`, `city_id`, `cadence`, `starts_at`, `ends_at`, `active_population_snapshot`, `theme_slug`, `status`, `target_total`, `total_earned`, `version` |
| `scene_challenge_objectives` | `id`, `cycle_id`, `template_id`, `target_points`, `earned_points`, `status`, `source_health_snapshot` |
| `scene_contributions` | `id`, `objective_id`, `account_id`, `profile_id`, `band_id`, `city_id`, `source_type`, `source_event_id`, `source_completed_at`, `points`, `bonus_reason`, `created_at`, `invalidated_at`; unique dedupe index |
| `scene_scene_affiliations` | `account_id`, `date_utc`, `city_id`, `profile_id` with uniqueness on `(account_id, date_utc)` |
| `scene_reward_claims` | `id`, `account_id`, `profile_id`, `cycle_id`, `reward_key`, `status`, `entitled_at`, `claimed_at`, `expires_at`, `grant_reference`, unique `(account_id,cycle_id,reward_key)` |
| `scene_milestones` | `cycle_id`, `percent_threshold`, `reached_at`, `art_version`, `announcement_id`; unique `(cycle_id,percent_threshold)` |

These are proposed names and not claims about deployed schema. Determine whether a common challenge/reward table already solves the need before adding new entities. Aggregate materialised totals must be derived from the canonical contribution ledger or updated in the same transaction.

### Event ingestion flow

1. Existing game subsystem finalises a genuine action (e.g. rehearsal `completed`).
2. Reliable adapter enqueues a typed event, including the canonical source ID and authoritative event timestamp.
3. Server validates city, profile/account, completion, duplication, action-specific limits, eligibility and affiliation.
4. Transaction inserts contribution rows for matching active daily, weekly, monthly objectives, updates counters and emits milestone entitlements only once.
5. UI receives a safe progress refresh via existing realtime or poll-on-open mechanism.
6. Reward-claim RPC transactionally validates entitlement, grants via canonical progression path and marks claim settled.

Avoid a new independent cron if existing scheduler can safely create cycles; given RockMundo's prior scheduling/migration drift, check deployed jobs/functions before adopting or replacing scheduler ownership. Provide a reconciliation command to backfill missed cycle creation, repeat without duplication, and process delayed events for their original timestamped cycle.

### Proposed server contract

- `get_scene_board(city_id, at?)`: publicly safe aggregate active cycles, objectives, timers, art state, top public contributors; personalised call adds entitlement/claim information for the caller only.
- `get_scene_contribution_history(profile_id, filters)`: only authorised viewer can see private specifics.
- `claim_scene_reward(cycle_id, reward_key)`: owner-only atomic claim, idempotent grant.
- `scene_process_completed_action(source_type, source_id)`: **server-only**, verified source adapter; never exposed as trust-client RPC.
- `scene_reconcile_cycles(start, end)`: privileged, idempotent operational recovery.

## 9. Notifications and messaging

- At scene entry: “Your city is 72% towards this month’s scene poster.”
- At validated action: “+2 Scene Points — Backstage Connections.”
- On milestone: one announcement and optional subscription-controlled notification.
- On personal reward: inbox item with claim deep-link; deduped by `reward_claim_id`.
- At weekly/monthly expiry: one digest, not a notification for every objective.
- Accessible language; no pressure messages for missed days or streak loss.

## 10. Admin controls and analytics

Admin view must support: curated template catalogue, enabling/disabling flaky source actions, theme rotation, staged campaign preview, target scaling snapshot, reward config, dry-run simulation, event rejection audit, rollback/reconcile and city-specific visibility.

Suggested measurements (guarded with baseline before/after or controlled rollout):
- 1-day / 7-day / 30-day returning active players and active minutes (do not reward idle time).
- Distinct contributors per city/cycle, goal completion rate by city size, % of contributors taking cross-band actions.
- Number of newly connected distinct bands per active player; share of cross-band participation.
- Time to first contribution and first claimed reward.
- Suspected duplicate events, reward grants mismatches, points per account distribution, failures per source adapter.
- Number of claim-expiry complaints and source health interruptions.

**Early tuning target (hypothesis, not promise):** 50–75% of cities with at least two regular players can complete a daily board on typical days; weekly and monthly campaigns have a mix of partial and full completions. Validate from actual distributions.

## 11. Launch acceptance criteria

- [ ] 3 daily + 3 weekly + 1 monthly campaign per eligible city with safe fallback templates.
- [ ] Server creates and resolves daily/weekly/monthly cycles exactly once despite retries and downtime.
- [ ] Each verified event credits the correct city/account and all compatible active cadences exactly once.
- [ ] Cross-band bonuses only apply to verifiably distinct players/bands; multi-character/cross-city exploits prevented.
- [ ] Rewards granted once via canonical progression ledger, including concurrent double-click and retry scenarios.
- [ ] Previous month mural and Hall of Fame continue to display after cycle expiry.
- [ ] Low population or temporarily faulty source does not make all offered challenges unachievable.
- [ ] Public feed, names, avatars and leaderboards comply with existing privacy/block settings.
- [ ] Frontend visual states cover loading, empty, failed, claimed, completed, expired and reconnect.
- [ ] Challenge entry works from city and news views; mobile companion can view progress and claims safely.
- [ ] Repeated events after source reversal are adjusted or excluded by documented policy.
- [ ] Docs, ops dashboard, tests and safe feature flag/rollback are delivered.

## 12. Decisions recommended before implementation

1. Use **City Scene Challenges** for navigation and **City Scene Board** for main screen; no separate spendable currency.
2. Launch all three cadences together; 3 daily / 3 weekly / 1 monthly campaign is manageable and varied.
3. Use automated completion from existing gameplay, not manual “submit contribution” buttons.
4. Prioritise poster reveal, city news and cosmetic legacy as the monthly main reward; keep XP/fame secondary.
5. Treat reliable server-side action sources and idempotent rewards as launch blockers, not polish tasks.
