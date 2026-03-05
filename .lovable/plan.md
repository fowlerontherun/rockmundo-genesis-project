

## Plan: Geographic Route Optimization + Tour Details Fix (v1.0.872)

### Problem 1: Tour venues are not geographically ordered
When auto-booking travel, venues are selected by capacity-fit only — no geographic ordering. A world tour might zigzag between continents instead of completing all nearby gigs first.

### Problem 2: Tour details show blank ratings and income
The tour details dialog fetches `gig_outcomes` data correctly, but the venue list rows show `0` for revenue and no ratings for completed gigs. Investigation shows the data mapping logic looks correct in the query — the issue is likely that `gig_outcomes` fields (`overall_rating`, `ticket_revenue`) are not being populated, OR the gig matching (by `venue_id|date` key) is failing due to date format mismatches between `tour_venues.date` and `gigs.scheduled_date`.

---

### Implementation

#### 1. Geographic Route Optimization (`src/hooks/useTourWizard.ts`)

After selecting venues by capacity-fit (lines 247-280), apply a **nearest-neighbor** geographic sort:

- Fetch city coordinates (latitude/longitude) for all matched venue cities
- Starting from `state.startingCityId` (or first venue), greedily pick the nearest unvisited city using Haversine distance
- Group venues by country first, then sort within each country group geographically — this ensures all USA gigs complete before moving to South America, etc.
- The algorithm: sort venues by country (grouped by continent), then within each country cluster apply nearest-neighbor ordering
- Re-assign dates from `generateTourSchedule` after reordering

Also apply geographic ordering when user manually selects venues (`state.selectedVenueIds`).

#### 2. Fix Tour Details Ratings/Income Display (`src/pages/TourManager.tsx`)

- Debug the `dayKey` matching between `tour_venues.date` and `gigs.scheduled_date` — `tour_venues.date` is a plain date string (`2026-03-10`) while `gigs.scheduled_date` may be a full timestamp. The `format(new Date(iso), "yyyy-MM-dd")` call could produce different results depending on timezone. Fix by normalizing both to `YYYY-MM-DD` substring.
- Also ensure `gig_outcomes.ticket_revenue` is being read — verify the field name matches the DB column. The query selects `ticket_revenue, net_profit` which should work.
- Display `net_profit` from outcomes when available as the revenue figure.

#### 3. Version bump
- Update `VersionHeader.tsx` to v1.0.872
- Add changelog entry to `VersionHistory.tsx`

### Technical Details

**Nearest-neighbor with country grouping algorithm:**
```text
1. Group venues by country
2. Order country groups by continent proximity to starting city
3. Within each country, sort by nearest-neighbor from entry point
4. Concatenate all groups into final ordered list
5. Assign dates sequentially with rest days
```

**Date matching fix:**
```typescript
// Current: format(new Date(iso), "yyyy-MM-dd") — timezone-sensitive
// Fix: iso.substring(0, 10) for plain date strings, 
//      or normalize both sides consistently
```

### Files to modify:
- `src/hooks/useTourWizard.ts` — add geographic sorting after venue selection
- `src/pages/TourManager.tsx` — fix date key matching for gig outcomes display
- `src/components/VersionHeader.tsx` — version bump
- `src/pages/VersionHistory.tsx` — changelog

