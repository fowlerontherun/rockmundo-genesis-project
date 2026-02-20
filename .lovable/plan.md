
## Fix Chart Display and Nerf Old Release Sales/Streams - v1.0.841

### Problem 1: Charts Show Same Values for "Weekly" and "Total"

**Root Cause:** In `update-music-charts`, sales chart entries set both `plays_count` and `weekly_plays` to the same weekly sales number (line 558-559). The UI's `getTotalValue()` reads `total_sales`, which is mapped from `plays_count` -- so "Weekly" and "Total" display identical numbers.

For streaming charts, it's slightly different: `plays_count` = total all-time streams, `weekly_plays` = weekly streams. But in the UI, `getTotalValue()` for non-combined charts returns `entry.total_sales`, which is also mapped from `plays_count` (the weekly sales figure for sales charts).

**Fix:**
- In `update-music-charts`, for sales chart entries: set `plays_count` to the **all-time cumulative sales** for that song (fetched from `releases.total_units_sold` or summed from `release_sales`), and keep `weekly_plays` as the weekly figure
- In `useCountryCharts.ts`, ensure `total_sales` maps to the correct cumulative figure

### Problem 2: Old Releases Never Decline in Sales or Streams

**Root Cause:** Both edge functions give every active release the same base sales/streams regardless of how long ago it was released:
- `update-daily-streams`: Base streams = random 100-5000/day with no age factor
- `generate-daily-sales`: Base sales = config-driven random range with only a first-week boost (1.5x), then flat 1.0x forever. Hype decays but base sales do not.

This means "Christmas Mother Cluckers" gets the same daily streams and sales months after release as it did in week 2.

**Fix:** Add an **age decay multiplier** to both functions:
- Week 1: 1.5x boost (already exists for sales)
- Week 2-4: 1.0x (no change)
- Month 2: 0.7x
- Month 3: 0.5x
- Month 4+: 0.35x
- Month 6+: 0.2x (long tail -- songs never fully die but drastically reduce)

This mirrors real-world music economics where most songs see 80%+ of their lifetime sales/streams in the first few weeks.

### Technical Changes

**1. `supabase/functions/update-daily-streams/index.ts`**
- After calculating `baseStreams` (line 100), fetch or compute the release age from `song_releases.created_at`
- Apply an age decay multiplier before the final `dailyStreams` calculation
- Formula: `ageDecay = daysSinceRelease <= 7 ? 1.5 : daysSinceRelease <= 30 ? 1.0 : daysSinceRelease <= 60 ? 0.7 : daysSinceRelease <= 90 ? 0.5 : daysSinceRelease <= 180 ? 0.35 : 0.2`
- Add `created_at` to the song_releases SELECT query

**2. `supabase/functions/generate-daily-sales/index.ts`**
- Replace the binary `firstWeekBoost` (line 280) with the same graduated age decay curve
- The existing `daysSinceRelease` calculation (line 279) already provides the needed data
- Apply the decay multiplier in the `calculatedSales` formula (line 282-284)

**3. `supabase/functions/update-music-charts/index.ts`**
- For sales chart entries (lines 548-567), fetch cumulative all-time sales per song from `release_sales` (summing all `quantity_sold` without the 7-day filter) and set `plays_count` to the cumulative total
- Keep `weekly_plays` as the weekly figure (current behavior)
- Same fix for scoped entries, album entries, and EP entries

**4. `src/hooks/useCountryCharts.ts`**
- Verify `total_sales` mapping correctly uses `plays_count` (which will now be cumulative for sales charts)
- No changes expected if the chart generation fix is done correctly

**5. Version bump**
- `src/components/VersionHeader.tsx`: Update to v1.0.841
- `src/pages/VersionHistory.tsx`: Add changelog entry documenting both the chart display fix and the sales/stream age decay nerf
