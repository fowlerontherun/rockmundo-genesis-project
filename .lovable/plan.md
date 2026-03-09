

## Fix: Chart Sales Figures Showing Wrong Values (v1.1.028)

### Root Cause

Two bugs in the sales chart display:

1. **Both columns show the same number.** The "Total" column uses `getTotalValue()` which returns `entry.weekly_plays` — identical to the "Weekly" column. For sales charts, the second column should show all-time cumulative sales (`plays_count` from DB), not repeat the weekly figure.

2. **All-time cumulative sales lost during aggregation.** In `useCountryCharts.ts`, the aggregation replaces `plays_count` with the weekly aggregate value (line 479: `plays_count: agg.totalPlays`), discarding the original all-time cumulative `plays_count` stored by the edge function.

### Fix

**`src/hooks/useCountryCharts.ts`:**
- Track the original `plays_count` (all-time cumulative) from the DB entry through aggregation
- Set `plays_count` on the output to the original all-time value from the latest entry, not the weekly aggregate

**`src/pages/CountryCharts.tsx`:**
- Fix `getTotalValue()` to return `entry.plays_count` (all-time cumulative) for sales chart types, keeping `entry.weekly_plays` for the weekly column
- Update the "Total" column label for sales types to say "All-Time Sales" instead of repeating the time period

**`src/hooks/useCountryCharts.ts` (getMetricLabels):**
- Change the `total` label for sales chart types to "All-Time" or "Total Sales"

**Version files:** Bump to v1.1.028 with changelog entry.

### Files to Change

1. `src/hooks/useCountryCharts.ts` — Preserve all-time `plays_count` through aggregation; fix metric labels
2. `src/pages/CountryCharts.tsx` — Fix `getTotalValue()` to return cumulative sales
3. `src/components/VersionHeader.tsx` — Bump version
4. `src/pages/VersionHistory.tsx` — Add changelog

