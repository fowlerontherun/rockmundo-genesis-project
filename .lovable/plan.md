
# Fix Music Charts - Separate Tabs with Dedicated Chart Data

## Overview
Completely restructure the charts page to use separate tabs with dedicated, working chart data for each tab. The current system has a mismatch between what the edge function generates and what the frontend queries, causing charts to show "No Data Available."

## Root Cause Analysis

### Database Content vs Frontend Queries

| Chart Type | What DB Has | What Frontend Queries (Singles) | What Frontend Queries (Albums) |
|------------|-------------|----------------------------------|--------------------------------|
| Combined | `combined` only | `combined_single` | `combined_album` |
| Streaming | `streaming`, `streaming_single`, `streaming_album`, `streaming_ep` | `streaming_single` ✅ | `streaming_album` ✅ |
| Radio | `radio_airplay` only | `radio_airplay_single` ❌ | `radio_airplay_album` ❌ |
| Digital | `digital_sales`, `digital_sales_single`, `digital_sales_album`, `digital_sales_ep` | `digital_sales_single` ✅ | `digital_sales_album` ✅ |
| CD | `cd_sales`, `cd_sales_single` only | `cd_sales_single` ✅ | `cd_sales_album` ❌ |
| Vinyl | `vinyl_sales`, `vinyl_sales_single` only | `vinyl_sales_single` ✅ | `vinyl_sales_album` ❌ |
| Cassette | No entries exist | `cassette_sales_single` ❌ | `cassette_sales_album` ❌ |

### Problems
1. **Combined chart**: Edge function code exists for `combined_single`/`combined_album`/`combined_ep` but entries are NOT in DB (code may not be deployed)
2. **Radio chart**: No scoped variants generated (only base `radio_airplay`)
3. **Physical sales**: Only `_single` variants exist for CD/Vinyl, no `_album` or `_ep`
4. **Cassette**: No data at all

## Solution: Simplify to Working Charts

### Part 1: Restructure Frontend to Query What Exists

Change the query strategy in `useCountryCharts.ts` to:
1. For "All" and "Singles" categories: Query BOTH the base type AND the `_single` variant
2. For "Albums" category: Query the `_album` variant, falling back to base type entries that have `entry_type='album'`
3. For "EPs" category: Query the `_ep` variant, falling back to entries with release_type='ep'

### Part 2: Fix Edge Function to Generate All Required Types

Add missing scoped variants to the edge function:
1. Radio: Generate `radio_airplay_single`, `radio_airplay_album`, `radio_airplay_ep`
2. CD Sales: Generate `cd_sales_album`, `cd_sales_ep`
3. Vinyl Sales: Generate `vinyl_sales_album`, `vinyl_sales_ep`
4. Cassette Sales: Generate `cassette_sales_single`, `cassette_sales_album`, `cassette_sales_ep`
5. Record Sales: Generate `record_sales_album`, `record_sales_ep`
6. Ensure `combined_single`/`combined_album`/`combined_ep` are inserted (code exists but may not execute)

### Part 3: Simplify the Tabs UI

Reorganize the charts page into cleaner tabs that map to what data exists:
- **Top 50** (Combined): Official chart combining streams + sales
- **Streaming**: Ranked by weekly streams
- **Digital Sales**: Digital download sales
- **Physical Sales** (merged CD, Vinyl, Cassette): Physical format sales
- **Radio Airplay**: Radio plays and listeners

Remove confusing release category selector when viewing charts that don't have album data.

## Implementation Details

### File 1: `src/hooks/useCountryCharts.ts`

**Changes:**
- Fix query to include base chart types alongside scoped types
- For singles: Query `[chartType, `${chartType}_single`]`
- For albums: Query `[`${chartType}_album`]` with fallback
- For all: Query all variants

```typescript
// Updated chartTypeFilter logic
if (releaseCategory === "all") {
  // Query ALL variants plus base type
  chartTypeFilter = [chartType, `${chartType}_single`, `${chartType}_ep`, `${chartType}_album`];
} else if (releaseCategory === "single") {
  // Query both base type AND single variant (base often contains singles)
  chartTypeFilter = [chartType, `${chartType}_single`];
} else {
  // Query specific category
  chartTypeFilter = [`${chartType}_${releaseCategory}`];
}
```

### File 2: `supabase/functions/update-music-charts/index.ts`

**Add radio airplay scoped variants (after line 900):**
```typescript
// Radio airplay - single entries (all radio plays are for singles currently)
const radioSingleEntries = radioEntries.map(entry => ({
  ...entry,
  chart_type: "radio_airplay_single",
}));
chartEntries.push(...radioSingleEntries);
```

**Add CD/Vinyl sales album variants:**
- Aggregate CD/Vinyl sales by release_id for albums
- Create `cd_sales_album`, `vinyl_sales_album` entries

**Ensure combined_single/album/ep entries are generated:**
- Verify the code at lines 621-718 is being executed
- Add logging to debug if entries fail insertion

### File 3: `src/pages/CountryCharts.tsx`

**Simplify chart type tabs:**
```typescript
const CHART_TYPES = [
  { value: "combined", label: "Top 50", icon: <BarChart3 />, description: "Official combined chart" },
  { value: "streaming", label: "Streaming", icon: <Radio />, description: "Streaming plays" },
  { value: "digital_sales", label: "Digital", icon: <Download />, description: "Digital downloads" },
  { value: "physical_sales", label: "Physical", icon: <Disc />, description: "CD, Vinyl, Cassette" },
  { value: "radio_airplay", label: "Radio", icon: <Radio />, description: "Radio airplay" },
];
```

**Add "physical_sales" as a combined chart type** that queries:
- `cd_sales`, `cd_sales_single`, `vinyl_sales`, `vinyl_sales_single`, `cassette_sales`, `cassette_sales_single`

**Show release category selector only for chart types that have album data:**
- Streaming: Has album/EP data
- Digital: Has album/EP data
- Combined: Should have album/EP data
- Physical/Radio: Default to singles only

### File 4: Migration - No Schema Changes Needed
The existing `chart_entries` table structure supports all required data.

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCountryCharts.ts` | Fix chartTypeFilter to query base types + scoped types |
| `src/pages/CountryCharts.tsx` | Simplify tabs, add physical_sales type, conditionally show category selector |
| `supabase/functions/update-music-charts/index.ts` | Add missing scoped variants for radio and physical sales |
| `src/components/VersionHeader.tsx` | Bump to v1.0.528 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Execution Order

1. **Frontend First**: Fix `useCountryCharts.ts` to query what exists - this will immediately make streaming, digital, CD, and vinyl charts work for singles
2. **Simplify UI**: Update `CountryCharts.tsx` with cleaner tabs and conditional category selector
3. **Backend**: Update edge function to generate missing scoped variants
4. **Deploy**: Deploy edge function and manually trigger chart generation
5. **Verify**: All chart types should now display data

## Version Update
- Bump to **v1.0.528**
- Changelog: "Charts: Fixed data display by querying correct chart types, simplified tabs to Top 50/Streaming/Digital/Physical/Radio, and updated edge function to generate all required scoped variants"
