

# Streaming Hub — Audit & Redesign Plan

## Problems found

### Real bugs (data won't show / wrong numbers)

1. **Solo releases hidden everywhere.** `StreamingMyReleasesTab`, `PlaylistsTab`, and `useStreaming` early-return `[]` when the user has no bands — so any release made as a solo artist (no band) never appears, even though the data exists. Filter must be `user_id.eq.<id>` OR `band_id.in.(...)`, not band-only.

2. **Wrong column names breaking analytics queries.**
   - `useStreaming.ts` orders `streaming_analytics_daily` by `date` — actual column is `analytics_date`.
   - `MusicStats.tsx` selects `stream_count` — actual column is `daily_streams`.
   Both silently fail or return 0.

3. **Double-counted "Total Streams / Revenue" on overview.** `StreamingNew` (and similar) sum `daily_streams` across all analytics rows for all time — but `total_streams` already lives on `song_releases` as the running total. Use the parent table per the existing `song-revenue-attribution-logic` memory.

4. **Profile vs user ID mismatch.** `StreamingMyReleasesTab` is called with `profileId` but uses it as `userId` inside; `band_members` is keyed on `profile_id` (correct), but `song_releases.user_id` is the account `userId`. Solo-filter must use the real userId, not profileId.

### UX problems

5. **Two competing pages**: `StreamingNew.tsx` (unused but routed-around) and `StreamingPlatforms.tsx` (the live one). Confusing, drift risk.
6. **5 tabs** with two near-duplicate analytics tabs ("Overview" + "Analytics"). Users don't know which to click.
7. **No clear entry action.** The Platforms tab is the default but there's no obvious "Release a song to streaming" CTA — you have to go to Release Manager.
8. **Take Down has no undo / re-release path.** Once down, the song silently disappears.
9. **Stats cards in `EnhancedPlatformCard` always show $0 / 0** for users with releases on platforms that don't have a `platform_id` link (older data uses `platform_name` text only).
10. **No per-release time-series view.** Users see aggregates only — can't tell which release is trending up.

## Proposed redesign

### Single page: `/streaming-platforms` — 3 tabs (down from 5)

```text
┌───────────────────────────────────────────────────────────┐
│ Streaming Platforms                  [+ Release to Stream]│
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │ Streams  │ Revenue  │ Releases │ Listeners│  ← KPI strip│
│ └──────────┴──────────┴──────────┴──────────┘             │
│ [ My Music ] [ Platforms ] [ Analytics ]                  │
└───────────────────────────────────────────────────────────┘
```

- **My Music** (default): list of releases grouped by song. Each card shows total streams/revenue, per-platform breakdown, 7-day sparkline, and actions (Take Down / View Detail / Submit to Playlist).
- **Platforms**: existing `EnhancedPlatformCard` grid, fixed to read from corrected stats and including the playlist count.
- **Analytics**: merged view = top KPIs + streams-over-time line + revenue bar + demographics + projections + platform comparison. (Drops the duplicate "Overview" tab.)

### Header CTA: "Release to Stream"
Opens a single dialog: pick a released song → pick platforms (multi-select) → confirm. Wraps `useStreaming.releaseToStreaming` in a loop. No more dead-end "go to Release Manager" message — only show that fallback if the user has zero released songs.

### Bug fixes to ship with the redesign
- Fix solo-release filter in `StreamingMyReleasesTab`, `PlaylistsTab`, `useStreaming`, `DetailedAnalyticsTab` → use `(user_id.eq.<userId>,band_id.in.(...))` and skip the bands clause when there are no bands instead of returning early.
- Fix column names: `analytics_date` (not `date`), `daily_streams` (not `stream_count`).
- Source aggregate stats from `song_releases.total_streams` / `total_revenue`, not by re-summing daily rows.
- Pass `userId` (account) where userId is needed and `profileId` where bands lookup is needed — stop conflating them.
- Delete `StreamingNew.tsx` to remove drift.

### Version bump
Bump banner + history to **v1.1.194** with summary: "Streaming hub overhaul — fixed solo-artist data filters, corrected analytics column names, merged duplicate analytics tab, added inline Release-to-Stream dialog, removed dead StreamingNew page."

## Files I'll touch
- `src/pages/StreamingPlatforms.tsx` — collapse to 3 tabs, add header CTA + KPI strip.
- `src/components/streaming/StreamingMyReleasesTab.tsx` — fix filter, add sparkline, accept both `userId` and `profileId`.
- `src/components/streaming/DetailedAnalyticsTab.tsx` — fix filter, rename props clearly.
- `src/components/streaming/PlaylistsTab.tsx` — fix filter (move into Analytics or keep as small section under My Music — TBD per your call below).
- `src/components/streaming/EnhancedPlatformCard.tsx` — stat fallbacks for legacy `platform_name` rows.
- `src/hooks/useStreaming.ts` — fix `analytics_date`, fix solo filter.
- `src/components/statistics/MusicStats.tsx` — fix `daily_streams` column.
- `src/pages/StreamingNew.tsx` — delete.
- New: `src/components/streaming/ReleaseToStreamDialog.tsx` — multi-platform release flow.
- `VersionHeader.tsx` + `VersionHistory.tsx` — v1.1.194.

## Two quick decisions before I build

1. **Playlists tab** — keep as its own tab, fold into "My Music" as a section, or fold into "Analytics"?
2. **Sparklines on each release card** — add now (extra query per render group, but fast) or skip for v1?

