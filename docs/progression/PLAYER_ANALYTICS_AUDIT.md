# Player analytics audit

## Scope reviewed

Repository search covered player statistics, analytics, progression history, skill XP, attribute points, outcome breakdowns, performance history, trends, comparisons, charts, snapshots, leaderboards and profile stats across `src`, `docs` and `supabase`.

## Current player statistics pages

- The dashboard Skills & Attributes surface is the current player-facing progression surface. It focuses on current state and spending actions rather than historical analytics.
- Existing profile and social pages display public identity, fame, level and privacy-related profile sections, but not a full private progression history.
- Existing finance and campaign analytics components are business/marketing oriented and should not become the foundation for player progression analytics.

## Current charts

- Charts exist for finance, FM, festivals, city/population and campaign analytics, but there is no canonical reusable player-progression chart model with table alternatives.
- Some live/festival components render moment-to-moment trend indicators from local arrays. These are presentation helpers, not authoritative historical trends.

## Current progression history

- XP wallets and daily XP grants exist for progression accounting.
- Skill spending is stored in `skill_progress`; attribute state is stored in `player_attributes`; wallet state is stored in `player_xp_wallet`.
- There is no complete player-facing timeline that distinguishes normal skill XP, mastery XP, maintenance/sharpness recovery and attribute spending.
- `profile_daily_snapshots` currently supports daily fame/fans/cash inbox deltas, not progression readiness snapshots.

## Current data sources

Authoritative or semi-authoritative sources found:

| Area | Source | Notes | Authoritative for analytics? |
| --- | --- | --- | --- |
| XP earnings | `profile_daily_xp_grants`, `player_xp_wallet` | Server functions cap daily grants and update wallet balances. | Yes for earned wallet deltas; incomplete as skill-specific history. |
| Skill state | `skill_progress` | Updated by progression function. | Yes for current skill state; history is limited. |
| Attribute state | `player_attributes` | Updated by progression function. | Yes for current attributes; needs spend history/snapshots. |
| Songwriting outcome | songwriting outcome docs and completion components | New model requires stored breakdowns; legacy records may be incomplete. | Yes only when persisted breakdown/version exists. |
| Recording outcome | `recording_sessions.outcome_breakdown`, quality/version fields | Completion function persists structured breakdowns. | Yes for completed masters. |
| Gig outcome | gig outcome calculator and outcome documentation | Technical, stage and audience response are separate concepts. | Yes when completion persisted fields exist. |
| Band contribution | band contribution helpers/docs | Aggregate contribution model exists but should remain privacy-safe. | Partially; needs analytics projection. |
| Achievements | achievement feature/tests | Earned badges/titles are historical milestones. | Yes for earned milestones. |

## Current aggregation logic

- Progression handlers aggregate daily XP grants server-side for daily activity processing.
- Recording and gig outcome calculators compute breakdowns at completion time, then persisted rows become the only safe historical analytics source.
- Several UI components perform local summary calculations over already-loaded rows. These are acceptable for small lists but should not be extended to raw lifetime analytics.

## Retention periods

- No explicit progression analytics retention policy was found.
- Proposed policy: retain raw authoritative outcome rows according to each subsystem; retain daily progression snapshots for career-length trend views; cap raw event reads to bounded ranges and pagination.

## Privacy behaviour

- Many Supabase-facing systems rely on profile ownership, band membership or RLS conventions.
- Current analytics-specific privacy is missing because analytics tables and exports did not exist.
- Direct named-player comparison is not supported and should remain out of scope.

## Performance issues and risks

- No central service currently prevents unbounded raw lifetime history queries.
- Existing chart components are not tied to a bounded analytics query contract.
- Without snapshots, career trends would require joining current state, XP grants, outcomes, bands, teaching and achievements repeatedly.

## Misleading or unclear statistics

- Current state can look like lifetime progress, because the UI lacks explicit separation between current values, historical deltas and outcome results.
- Gig quality can be misunderstood if technical performance, stage performance and audience response are merged.
- Recording quality can be misleading if source-song quality is not separated from recording execution.
- A single overall player rating would be misleading and is intentionally avoided.

## Missing indexes

- A progression snapshot table needs `(profile_id, snapshot_date desc)`.
- Export audit and telemetry need `(profile_id, started_at/created_at desc)`.
- Any future raw-event history table should have `(profile_id, occurred_at desc, category)` or narrower equivalent indexes.

## Duplicate data

- Wallet lifetime/balance fields overlap older `xp_balance`/`lifetime_xp` compatibility fields.
- Some components duplicate small trend or summary calculations locally rather than using a shared analytics model.

## Unavailable historical breakdowns

- Legacy songwriting projects, recordings and gigs may have final scores without the newer breakdown or calculation-version fields.
- Mastery, maintenance and sharpness history is not available as a single normalized player analytics feed.
- Teaching/mentoring outcomes are available in feature-specific records but not normalized for private student-safe analytics.

## Legacy-data limitations

- Completed legacy outcomes must remain visible, but analytics should label incomplete breakdowns instead of recalculating them with newer formulas.
- Scores spanning formula versions need warnings and optional filtering.
- Historical values must not be rewritten.

## Known bugs / follow-up risks

- Analytics exports need rate limiting beyond basic audit rows before broad release.
- Admin diagnostics need a richer read-only view once aggregation jobs are scheduled.
- Generated Supabase types must be regenerated after applying the migration.

## Follow-up analytics and personalisation work

- Add background snapshot generation from authoritative daily and completion events.
- Add privacy-approved peer benchmark materialized aggregates with minimum cohort enforcement.
- Add full UI dashboard and drill-down pages once server APIs are wired to live data.
