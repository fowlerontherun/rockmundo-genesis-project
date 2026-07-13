# Player analytics design

## Goals

Player analytics should help players understand progress, preparation and outcomes without exposing hidden formulas, random seeds, private member data or unsupported causal claims.

## Concepts

### Current state

The player’s present skills, attributes, role readiness, sharpness, mastery, active goals and nearby milestones. Current state answers: “Where am I now?”

### Progression history

Time-based changes to skills, attributes, mastery ranks, sharpness and role readiness. Progression history answers: “How did I change?” It uses snapshots and bounded event summaries rather than raw unbounded lifetime queries.

### Activity history

The activities that generated progression, such as self-practice, lessons, university, rehearsal, jam sessions, songwriting, recording, gigs, teaching, mentoring, workshops and band plans. Activity efficiency is contextual and should not reduce the game to a single XP-per-hour score.

### Outcome history

Completed songwriting, recording and gig results. Drafts, previews and uncompleted records are excluded. Songwriting, recording and gig histories use persisted breakdowns and calculation versions only; legacy incomplete records are labelled rather than recalculated.

### Contribution history

Privacy-safe summaries of band, teaching, mentoring, professional and achievement contributions. Band views aggregate contribution without exact private member attributes, XP balances or shaming leaderboards.

### Trend

A direction derived from multiple observations over time. Minimum sample rules are:

- 0-1 observations: show result/no data, not a trend.
- 2 observations: comparison with low confidence.
- 3-5 observations: early indication.
- 6+ compatible observations: normal trend.

Trend copy must say “suggests”, “is associated with” or “coincided with” unless an authoritative preview calculation supports a stronger statement.

### Comparison

A safe comparison against the player’s own history, role targets or privacy-approved aggregate cohorts. Self-comparison is default. Comparisons reject incompatible systems and warn when scoring versions differ.

## Supported ranges

Supported ranges are `7d`, `30d`, `90d`, `6m`, `1y` and `career`. UTC game-day boundaries are used consistently. `6m`, `1y` and `career` views should prefer snapshots or pre-aggregated data.

## Snapshot strategy

`player_progression_snapshots` stores one compact daily/event snapshot per profile/date with:

- total unlocked skills;
- total skill levels;
- role readiness summary;
- attribute summary;
- mastery summary;
- sharpness summary;
- balance/calculation version.

Snapshots support trend calculations without rewriting history. They intentionally omit raw hidden inputs and fields that can be derived efficiently.

## Authoritative services

Server-side services/RPCs should expose bounded, authorised analytics:

- `getPlayerProgressionSummary(profileId, range)` / `get_player_progression_summary`;
- `getPlayerSkillHistory(profileId, skillId, range)`;
- `getPlayerAttributeHistory(profileId, attributeKey, range)`;
- `getPlayerOutcomeHistory(profileId, systemKey, range)`;
- `getPlayerActivityEfficiency(profileId, range)`;
- `getPlayerRoleTrend(profileId, roleKey, range)` / `get_player_role_trend`;
- `getPlayerContributionSummary(profileId, range)`.

All services validate profile ownership or feature-specific visibility. Browsers must not load all raw lifetime events and aggregate them client-side.

## Skill and attribute history

Skill history distinguishes normal skill XP, mastery XP and maintenance/recovery events. Attribute history shows value changes, upgrade dates, AP spent, AP source summary, related skills and estimated role-readiness movement only where an authoritative preview supports it.

## Outcome history

- Songwriting: completed projects, score trends, craft/attribute/genre/collaboration/completion/polish breakdowns and legacy-incomplete labels.
- Recording: completed masters, final master quality, performer execution, production, engineering, studio quality, rehearsal readiness, role coverage and source-song quality separation.
- Gigs: completed gigs, technical performance, stage performance and audience response as separate trends plus setlist flow, readiness, equipment/crew, venue fit and fan/reputation deltas.

## Role readiness

Role readiness is contextual. Supported roles compare current and historical readiness against beginner, competent, strong, advanced and elite target bands. The system must not create a universal overall character rating.

## Mastery and maintenance

Mastery analytics show eligibility dates, mastery XP source, rank progression, challenges and measurable perk use. Maintenance analytics show sharpness, rust periods, recovery sessions and comeback bonus use. Temporary rust is labelled as recoverable, not permanent loss.

## Teaching and band analytics

Teaching analytics separate teacher and student views and never expose private student progression publicly. Band analytics show aggregate role coverage, rehearsal readiness, gig/recording/songwriting readiness, goal completion and attendance consistency without exact private member values.

## Personal bests and timeline

Personal bests include highest songwriting score, recording quality, technical gig score, audience response, fan gain, role readiness, skill XP week, teaching rating and sharpness recovery. The progression timeline includes meaningful events only and filters out minor XP transactions.

## Recommendations

Recommendations require repeated evidence, accessible actions and dismissal state checks. Confidence is based on sample size, recency, consistency, calculation-version stability and directness of evidence. Labels are Low, Moderate or High confidence.

## Peer benchmark privacy

Peer benchmarks require anonymised aggregates, minimum cohort size, opt-out compliance, no named players, no hidden skills and no small-group inference. Direct named-player stat comparison remains out of scope.

## Charts, tables and accessibility

Charts are used only when they improve comprehension. Every important chart has an accessible text summary and a table/list alternative with date, activity, result, contributors, XP, calculation version and links where useful. Axes must not be misleading.

## Export

Players may export their own safe progression summary as CSV, with JSON reserved for future structured history if existing patterns support it. Exports validate ownership, exclude hidden internal fields, enforce date limits, create audit rows and should be rate limited.

## Telemetry

Telemetry tracks analytics page opens, time range changes, chart views, comparisons, recommendation actions/dismissals, history item opens, export requests, band analytics views and personal-best views. Metadata must avoid private values.

## Data-quality warnings

Player-facing warnings are simple: incomplete legacy data, scoring changed, not enough data, partial analytics unavailable. Admin diagnostics may include snapshot freshness, failed queries, duplicate events, negative XP, unknown versions, spikes, export activity and missing indexes.

## Follow-up analytics and personalisation work

- Build full React dashboard/drill-down pages using the service contract.
- Add materialized peer benchmark cohorts after privacy review.
- Add scheduled snapshot jobs and admin freshness monitors.
- Add richer recommendation routing to accessible in-game actions.
