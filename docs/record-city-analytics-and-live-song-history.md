# Record City Analytics and Live Song History Plan

## Goal

Give an artist or band two trustworthy answers from the existing release and gig data:

1. **Where are records being bought and streamed?** Show complete city-level sales and streaming breakdowns for a selected record over daily, weekly, monthly and yearly calendar periods.
2. **How often is each song played live?** Show the most recent completed live performance and the lifetime number of completed live performances, with enough history to verify both values.

This plan treats those figures as reporting over canonical sale, stream and completed-performance facts. It must not infer a city from a band's home, a release country, a listener region, a gig booking, or the time at which the report is viewed.

## Current-state findings and constraints

- `ReleaseAnalyticsDialog` already provides release-level overview, sales and streaming surfaces. Sales are aggregated through `get_release_sales_breakdown`, while streaming totals currently come from lifetime `song_releases` counters. This is the primary record-level entry point to extend.
- `StreamingRevenueDashboard` and `DetailedAnalyticsTab` already consume `streaming_analytics_daily`, but their geographic dimension is `listener_region`; a region is not a reliable city identifier.
- `release_sales` is the physical/digital sales fact and `streaming_analytics_daily` is the daily streaming fact. Neither original schema guarantees a canonical `city_id`, so historical city attribution cannot be claimed until the write paths and backfill rules are audited.
- `gig_song_performances` is the song-level performance fact. The repository contains legacy shapes keyed directly by `gig_id` and newer outcome-oriented consumers, so the implementation must reconcile deployed schema variants before adding an aggregate.
- A play counts only after the associated gig has a canonical completed outcome. A song merely appearing in a planned setlist, live session, rehearsal, cancelled gig or abandoned simulation does not count.

## Product behavior

### Record analytics

Add a **Cities** view to the existing release analytics experience. It should combine sales and streams without blending their units:

- KPI cards: units sold, sales gross/net, streams, streaming revenue, and reporting coverage.
- Metric selector: `Sales`, `Streams`, or `Revenue`; revenue retains separate sales and streaming columns in tables and exports.
- Period selector: `Daily`, `Weekly`, `Monthly`, `Yearly`.
- Previous/next period controls and a labelled active range.
- City table: city, country, units, sales gross/net, streams, streaming revenue, share of the selected metric, and change from the preceding equivalent period.
- Trend chart grouped by period bucket and a map/top-cities chart when the existing visualization stack supports it.
- Per-song and per-format drill-downs beneath a selected city, so record totals can be reconciled to the underlying songs, platforms and formats.
- CSV export of the fully filtered result, not only the visible page.

The table must support search, metric sorting, pagination and an explicit `Unknown city` row. Unknown data remains in totals and coverage calculations rather than being silently discarded.

### Period semantics

- Use UTC for persisted reporting buckets and display the precise UTC date range in the UI and export metadata.
- `Daily` is 00:00:00 through 23:59:59.999 UTC.
- `Weekly` is ISO week, Monday through Sunday UTC.
- `Monthly` is a UTC calendar month.
- `Yearly` is a UTC calendar year.
- The active period is a half-open range `[period_start, period_end)` in APIs to prevent boundary double-counting.
- A comparison uses the immediately preceding period of the same kind. When its denominator is zero, show `New` rather than an infinite percentage.
- Period totals are sums of facts inside the range; monthly and yearly values are not projections.

### Geography semantics

- Store `city_id` as a foreign key to `cities`; return the canonical city name and country by joining at query time.
- Capture the consumer/listener city at generation time. Do not substitute the artist's location, band's home city, release territory or streaming platform region.
- Facts with no defensible city use `city_id = NULL` and aggregate under `Unknown city`.
- If simulation presently produces only country/region demand, city allocation must be added to the authoritative generator using the same seeded/deterministic rules used for the source fact. Never randomly redistribute already-persisted totals when a report is requested.
- Keep the captured `city_id` immutable if a city is later renamed; reports naturally show the current canonical display name while exports retain the ID.

### Live song history

Add live-performance summary fields to each row in `BandRepertoire` and to `SongDetailDialog`:

- **Times played live**: lifetime count of distinct completed gig performances for the song and performing act.
- **Last played**: completed gig date/time, venue and city, linked to the gig report when the viewer is authorised.
- Never-played state: `Never played live` and a count of `0`.
- A **Live history** section: newest first, with gig date, venue, city, setlist position, performance score and crowd response.
- Paginate history rather than loading every gig with the repertoire list.

Count at most one live play per `(gig_id, song_id)`, even if retry or replay processing produced duplicate rows. Medleys and reprises remain one play unless the canonical performance model later introduces separately identified performance segments. Covers count for the song that was actually referenced by the canonical performance row; rehearsals and NPC-only simulated mentions do not count.

## Data and migration design

### Add canonical location to source facts

After auditing every writer, add nullable geography to both source fact tables:

```sql
alter table public.release_sales
  add column if not exists city_id uuid references public.cities(id);

alter table public.streaming_analytics_daily
  add column if not exists city_id uuid references public.cities(id);
```

The existing streaming uniqueness key may currently collapse all geography for a song/platform/day. Replace it only after deduplicating existing rows with a key that includes city while still allowing one unknown-city fact:

```text
(song_release_id, analytics_date, platform_id, coalesce(city_id, NIL_UUID))
```

Use a matching unique expression index or a normalized non-null reporting location key. Add query indexes covering date and joins:

- `release_sales (release_format_id, sale_date, city_id)`
- `streaming_analytics_daily (song_release_id, analytics_date, city_id, platform_id)`
- canonical gig performance relation `(song_id, gig_id)` or `(song_id, gig_outcome_id)`, according to the deployed schema audit

All sales and stream generators, admin boost tools, imports and correction jobs must write `city_id` in the same transaction as the fact. Reject invalid city IDs; allow null only when the source genuinely lacks city resolution.

### Historical-data policy

Create a one-off audit report before migration that gives row and value coverage by source and date. Backfill only when city can be deterministically recovered from immutable source metadata. Mark the rest unknown.

Do not use a band's current/home city as a backfill. Do not expand one regional aggregate into several city rows. Publish coverage alongside results:

```text
city_coverage_pct = metric value attached to a city / total metric value
```

Coverage is calculated separately for sales and streams because their historical completeness may differ. The UI should warn when either selected metric is below an agreed threshold (proposed: 95%).

### Server-side reporting RPC

Add one stable, paginated RPC such as `get_release_city_analytics` with:

```text
p_release_id uuid
p_period_kind text  -- day | week | month | year
p_period_start date
p_metric text       -- sales | streams | revenue
p_city_search text default null
p_sort text default metric_desc
p_limit integer default 50
p_offset integer default 0
```

The RPC must:

1. authorise access to the requested solo/band release using the existing release ownership rules;
2. resolve release formats for sales and release songs to `song_releases` for streams;
3. aggregate each source server-side before joining them by city, avoiding a sales-by-streams fan-out;
4. return current and previous-period values, total row count, selected-period grand totals and coverage totals;
5. use integer/minor-unit arithmetic for money and `bigint` for counts;
6. return zero-filled values when a city exists in only one source;
7. apply deterministic ordering with `city_id` as a tie-breaker; and
8. use the same query for CSV export, with a bounded export limit or asynchronous export job.

Add a second RPC such as `get_song_live_history(p_song_id, p_limit, p_offset)` returning `total_plays`, `last_played_at`, last-gig context, paginated history and total rows. Its SQL should select canonical completed gigs first, deduplicate by gig/song, and use `count(*) over ()` or a separate aggregate so pagination cannot change the lifetime count.

For repertoire lists, add a batched `get_band_song_live_stats(p_band_id)` RPC rather than one query per song. It returns one row per song with lifetime count and last completed gig context. Solo ownership should receive an equivalent actor-scoped path if solo gigs are supported.

### Row-level security and privacy

- Security-definer reporting functions must set a safe `search_path`, fully qualify relations, validate enum-like inputs and repeat the current owner/band-member authorisation checks before reading facts.
- Preserve existing privacy: an authorised artist may see its own city analytics and live detail; public song viewers receive only fields already intended to be public.
- Do not expose listener/player identities or city-level rows so small that they violate the game's privacy rules. If real-player activity contributes to analytics, define and test a suppression threshold before launch.
- Grant RPC execution only to the intended authenticated role and test cross-band, former-member and unauthenticated access.

## Front-end implementation

### Record cities view

Create a focused hook and components rather than growing the existing dialog query function:

- `useReleaseCityAnalytics`: owns period, date, metric, sort, search and page query keys; keeps prior results during pagination.
- `ReleaseCityAnalyticsTab`: loading, error, empty and low-coverage states plus filters and summary.
- `ReleaseCityTrendChart`: accessible tooltip and tabular fallback.
- `ReleaseCityBreakdownTable`: sortable/paginated city rows with sales and stream units clearly labelled.
- `ReleaseCityDrilldown`: lazy-load song/platform/format detail for one city.
- `exportReleaseCityAnalyticsCsv`: includes release ID/title, timezone, range, filters, coverage and generated timestamp.

Synchronise filters to URL/search parameters when the analytics surface supports deep linking. Format money through existing release money utilities, use locale-aware count formatting, and never label a projected value as an actual monthly/yearly total.

### Song live statistics

- Load all repertoire summary values in one request and merge them by `song_id`.
- In `SongDetailDialog`, fetch history only while the live-history section is open.
- Use semantic `<time>` values and show both an absolute date and a relative label where helpful.
- Provide skeletons that do not temporarily render `0` or `Never played` while data is loading.
- If the last gig has been removed or is no longer viewable, retain the valid aggregate/date but omit the link and private context.

## Delivery phases

### Phase 1 — Audit and definitions

- Catalogue all sale, stream and gig-performance write paths, including edge functions, admin tools, imports, retries and festival settlement.
- Confirm the deployed `gig_song_performances` relation and canonical completed-gig timestamp.
- Measure historical city coverage and agree on privacy/suppression rules.
- Lock period, revenue and completed-play definitions with product stakeholders.

**Exit:** a checked-in audit lists every writer, deployed column shape, recoverable backfill source and baseline coverage.

### Phase 2 — Canonical fact capture

- Add nullable `city_id`, constraints and indexes.
- Update every authoritative sales/stream writer and its idempotency key.
- Deterministically backfill recoverable facts, retain unknown facts and reconcile totals before/after migration.

**Exit:** new facts always carry a valid city or an intentional unknown reason, and global totals have not changed.

### Phase 3 — Reporting APIs

- Implement period-boundary helpers and both reporting RPCs.
- Add batched repertoire summary RPC.
- Add authorisation, pagination, comparison and query-plan tests.

**Exit:** RPC results reconcile exactly to source facts for daily, ISO-weekly, monthly and yearly fixtures.

### Phase 4 — User interface

- Add the record Cities view, charts, table, drill-down and CSV export.
- Add live count/last-played summary and lazy live history to repertoire/song detail.
- Cover responsive layout, keyboard use, screen-reader names, empty/error/unknown states and low-coverage messaging.

**Exit:** a user can answer both product questions without consulting an admin screen or adding totals manually.

### Phase 5 — Rollout and observability

- Gate the feature while backfill and query performance are verified.
- Record RPC latency, error rate, export failures, unknown-city share and reconciliation drift.
- Roll out first to internal/admin accounts, then a small artist cohort, then all eligible artists.
- Document rollback: disable UI flag while preserving additive columns and source facts.

**Exit:** production p95 latency and coverage meet targets for two reporting cycles with no reconciliation drift.

## Acceptance criteria

1. An authorised user can select a release and view city-level sales and streams for any daily, ISO-weekly, monthly or yearly calendar period.
2. Changing period or date updates KPIs, chart, table, comparison and export to the exact same half-open UTC range.
3. City rows reconcile to displayed grand totals, including the `Unknown city` row; sales units and streams are never added into a single count.
4. Sales revenue and streaming revenue remain independently auditable, use consistent money units, and sum correctly when `Revenue` is selected.
5. The selected release includes all and only its formats and songs; the server query does not duplicate facts when a release has multiple songs, formats or platforms.
6. Results are not truncated by PostgREST row limits, and pagination/sorting are deterministic.
7. Historical unknown geography is labelled and coverage percentages are visible; no report-time random or home-city attribution occurs.
8. Each repertoire song shows a lifetime completed-live-play count and most recent completed performance, or a clear never-played state.
9. Planned setlists, rehearsals, cancelled gigs, incomplete live sessions and retry duplicates do not increase the live count.
10. Opening live history shows newest-first verifiable gig rows; the first row agrees with `last_played_at` and pagination does not alter `total_plays`.
11. Unauthorised users cannot obtain another act's private analytics through the UI or direct RPC calls.
12. Existing lifetime release totals and gig outcome reports remain unchanged after migration and backfill.

## Test plan

### Database and contract tests

- Seed sales and streams in two cities plus unknown geography across UTC day, ISO-week, month and year boundaries; assert exact buckets and previous-period deltas.
- Seed a multi-song, multi-format release and prove aggregation has no join fan-out.
- Reconcile RPC sales to `release_sales`, streams to `streaming_analytics_daily`, and money in minor units.
- Verify the city-aware stream uniqueness rule permits separate cities but rejects retry duplicates, including `city_id IS NULL`.
- Seed completed, cancelled, scheduled, retried and duplicate performance rows; assert only distinct completed gig/song pairs count.
- Test RLS/RPC access for owner, current band member, unrelated user, former member and anonymous role.
- Run `EXPLAIN (ANALYZE, BUFFERS)` against high-volume fixtures and set an initial p95 target (proposed: under 500 ms for the first 50 city rows).

### Front-end tests

- Hook tests for query keys, period navigation, race-free filter changes, pagination and errors.
- Component tests for all period labels, `New` comparison, unknown city, low coverage, never played, loading skeleton and unavailable gig link.
- CSV snapshot tests verifying range, timezone, filters, coverage and untruncated rows.
- Accessibility tests for filters, chart alternative, sortable headers, dialog focus and live-history pagination.
- Playwright journey: open a record, switch to Cities, change each period, select a city, export, then open a repertoire song and verify last-played/history consistency.

### Migration and rollout checks

- Before/after reconciliation of total units, streams and revenue.
- Writer coverage test that fails when any known fact-insertion path omits city attribution handling.
- Metrics/alerts for rising unknown-city share, RPC errors, slow queries and disagreement between summary and detail.

## Out of scope for the first release

- Forecasting future sales or streams.
- Real-world IP geolocation or exact listener locations.
- Retroactively inventing city detail from country/region aggregates.
- Public global city leaderboards.
- Counting rehearsals, soundchecks or planned setlists as live plays.
- Editing canonical gig history from the analytics UI.

## Open decisions to resolve during Phase 1

1. Whether city analytics are private to current act members or whether a reduced public view is desirable.
2. Whether release `Revenue` should default to gross sales plus gross streaming payout, or artist net after label/distribution splits; both must remain separately named and auditable.
3. Whether festival performances use the same canonical completed outcome as ordinary gigs or require an adapter into the performance fact.
4. The minimum city-cell privacy threshold if real-player behavior is represented.
5. How much historical unknown-city coverage is acceptable for general availability.
