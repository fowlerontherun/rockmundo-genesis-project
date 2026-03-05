

## Plan: Tour Route Map in Tour Details (v1.0.873)

### What
Add a visual route map inside the tour details dialog showing the geographic path between tour cities, rendered as an SVG overlay on a flat world map image. Each city gets a numbered pin, connected by lines in tour order.

### Implementation

#### 1. Create `TourRouteMap` component (`src/components/tours/TourRouteMap.tsx`)
- Accept array of `{ cityName, country, lat, lng, index, status }` points
- Use the existing `projectCoordinates` from `src/utils/mapProjection.ts` to convert lat/lng to x/y on a flat equirectangular map
- Render as an SVG with:
  - A dark background rectangle styled as a simple world outline (or use a public domain equirectangular SVG map as background)
  - Polyline connecting cities in order (dashed, colored by status — green for completed, primary for upcoming)
  - Numbered circle markers at each city with tooltips showing city name + country
  - Current/active gig highlighted with a pulsing ring
- Responsive: fills container width, ~250px height

#### 2. Fetch city coordinates in TourManager
- The tour venues query already fetches `city_id` and cities with `name, country`
- Extend the cities query to also fetch `latitude, longitude` from the `cities` table
- Pass coordinates array to `TourRouteMap`

#### 3. Insert map into tour details dialog
- Place the `TourRouteMap` between the tour overview grid and the "Tour Dates & Venues" section
- Only render when there are 2+ venues with valid coordinates
- Wrapped in a Card with a "Route Map" header

#### 4. Version bump to 1.0.873

### Files to modify
- **New**: `src/components/tours/TourRouteMap.tsx`
- **Edit**: `src/pages/TourManager.tsx` — extend cities query for lat/lng, add TourRouteMap to dialog
- **Edit**: `src/components/VersionHeader.tsx`, `src/pages/VersionHistory.tsx`

