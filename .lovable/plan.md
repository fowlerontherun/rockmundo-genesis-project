

# Band Popularity & Fame Map Page (v1.1.188)

## Summary
Create a dedicated standalone page at `/band-fame-map` accessible from the Band Hub that shows a band's popularity and fame across every country and city, with full demographic breakdowns. This extends the existing `FameFansOverview` and `RegionalFameBreakdown` components into a richer, full-page experience.

## What Already Exists
- `FameFansOverview` component (countries, cities, demographics tabs) — embedded in BandManager "Fame" tab
- `RegionalFameBreakdown` component — collapsible country/city drill-down
- `BandFameDisplay` component — fame progress and recent events
- `band_country_fans`, `band_city_fans`, `band_demographic_fans` tables already exist with all needed data

## No Database Changes Needed
All required tables and data structures already exist.

## New Files

### 1. `src/pages/BandFameMap.tsx` — Full-page fame analytics
- **PageHeader** with back link to `/hub/band`
- **Band selector** dropdown (reuses existing primary band pattern) for players with multiple bands
- **Summary row**: Global fame score, total fans, countries reached, cities played, fame tier badge
- **Tabbed sections** (horizontally scrollable on mobile):
  - **World Overview**: Top 10 countries by fame as progress bars, top 10 by fans, performed vs spillover ratio
  - **All Countries**: Full sortable list (by fame or fans) with flag, fame bar, fan tier breakdown (casual/dedicated/superfan icons), performed badge, expandable city drill-down per country
  - **All Cities**: Flat list of all cities sorted by fans or fame, showing city name, country, gig count, fan breakdown
  - **Demographics**: Age group distribution with percentage bars, per-country demographic breakdowns (select a country to see its demo split)
  - **Fame History**: Recent fame events timeline from `band_fame_events` table

### 2. `src/pages/hubs/BandHub.tsx` — Add new tile
- Add `{ icon: Globe, labelKey: "nav.bandFameMap", path: "/band-fame-map", imagePrompt: "A world map with glowing heat spots showing band popularity across different countries and cities" }`

### 3. Hub tile image
- Generate `public/hub-tiles/band-fame-map.png`

## Files to Modify

- **`src/App.tsx`** (or routes file) — Add route for `/band-fame-map` pointing to `BandFameMap`
- **`src/pages/hubs/BandHub.tsx`** — Add tile
- **`src/components/VersionHeader.tsx`** — Bump to 1.1.188
- **`src/pages/VersionHistory.tsx`** — Add changelog entry
- **Translation keys** — Add `nav.bandFameMap` label ("Fame Map" or "Popularity Map")

## Technical Details

- Reuses existing queries from `FameFansOverview` pattern (band_country_fans, band_city_fans, band_demographic_fans, band_fame_events)
- Country sorting toggle: by fame vs by fans
- City list shows all cities (not capped at 20 like current component)
- Demographics tab adds a country filter dropdown so players can see per-country age breakdowns
- Uses `useQuery` with `react-query` for all data fetching
- Mobile-first: scrollable tabs, compact cards, horizontal scroll for tables

## Implementation Order
1. Create `BandFameMap.tsx` page with all tabs
2. Add route
3. Add BandHub tile + generate image
4. Version bump + changelog

