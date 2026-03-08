
Goal: make every chart option (type + time range + release category + country) use trustworthy sales/streaming data, and capture enough detail for analytics.

What I found (from code + DB):
1) Streaming capture is mostly failing:
- `cron_job_runs` shows `update-daily-streams` running hourly with ~297–308 errors/run and only 1–5 successful updates.
- Root cause likely in `update-daily-streams`: writing decimal `dailyRevenue` into integer `song_releases.total_revenue`, causing per-release update failures.
2) Country charts are effectively not country charts:
- `chart_entries` currently has only `country='all'`.
- In `update-music-charts`, dedupe key omits country (`song/chart/date`), so regional rows are collapsed away.
3) Chart option values are mixed/incorrect in multiple paths:
- `useCountryCharts` single/all filters merge base + scoped chart types, contaminating category-specific views.
- Daily transform sorts streaming by `plays_count` (all-time) instead of `weekly_plays` (period).
- Range query hard limit (`limit(1000)`) can truncate monthly/yearly/all-category datasets.
- `combined_album` / `combined_ep` currently use streams-only (sales not included), inconsistent with combined formula.
- Sales in chart generation are attributed as full units to every track on a release (no track-count split), inflating song-level sales.
4) Streaming detail is too coarse for “detailed analytics”:
- One daily row per song-release with one random region/age-group per run is not enough for reliable demographic/region breakdowns.

Implementation plan (concise):
Phase 1 — Stabilize data capture (backend)
1. Fix `update-daily-streams` unit handling:
- Keep `song_releases.total_streams` integer-safe.
- Convert revenue writes to integer dollars/cents consistently (no decimal-to-integer writes).
2. Make daily analytics idempotent:
- Replace blind insert with `upsert` on `(song_release_id, analytics_date, platform_id)` and deterministic accumulation strategy.
- If hourly cadence is kept, convert generator to hourly increments and aggregate to daily once; otherwise move to daily schedule.
3. Improve failure semantics:
- Treat high per-run error ratio as failed run in `cron_job_runs` and store top error samples in `result_summary`.

Phase 2 — Correct chart generation logic
4. Fix regional preservation in `update-music-charts`:
- Include `country` in dedupe key.
- Recompute trends/weeks using inserted deduped set only.
5. Correct scope/category math:
- Generate true `*_single`, `*_ep`, `*_album` sets (no leakage from base type).
- For combined album/EP, include both stream units and sales units.
6. Correct song-level sales attribution:
- Divide release-format sales across tracks when producing song charts (align with existing song analytics attribution logic).

Phase 3 — Fix chart option rendering
7. `useCountryCharts`:
- Use strict chart-type filters per selected release category.
- Fix streaming daily sort to use `weekly_plays`.
- Remove truncation risk via pagination or server-side aggregate endpoint.
8. UI value semantics:
- Explicitly separate “Period value” and “All-time value” labels.
- Ensure “Total” column matches selected mode (not duplicated period value unless intentionally labeled).
9. History dialog:
- Query by actual entry chart type (`streaming_album`, etc.) for album/EP rows.

Phase 4 — Increase analytics detail
10. Expand streaming fact capture:
- Record per-day splits by region and age-group (deterministic weighted breakdown rather than single random bucket).
- Keep a compact aggregate table/materialized view for fast UI reads.
11. Add reconciliation views:
- Daily checks comparing `release_sales` + `streaming_analytics_daily` vs generated `chart_entries` totals per chart option.

Validation plan (must pass before release):
- SQL assertions:
  - country coverage exists beyond `all`.
  - no large error_count/low processed_count pattern in `cron_job_runs`.
  - combined charts reconcile with formula for sampled rows.
  - single/ep/album options return disjoint expected populations.
- UI checks:
  - every chart option (Top50/Streaming/Digital/Physical/Radio × daily/weekly/monthly/yearly × single/all/ep/album × country) returns consistent values.
  - no option shows identical values when filters should differ.

Rollout/backfill:
1) Deploy capture fixes.
2) Rebuild affected recent data window (recommend 30–90 days) by rerunning daily streams/sales generation and then `update-music-charts`.
3) Verify reconciliation queries, then expose updated charts.

Open product decision needed before implementation:
- Should charts show period-only values by default, or period + all-time side-by-side (with a toggle)? I recommend explicit toggle to avoid future ambiguity.
