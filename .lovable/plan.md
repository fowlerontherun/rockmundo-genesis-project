

# Territory-Based Distribution System (v1.0.865)

## Overview
This update adds country-level territory selection to both **physical releases** and **streaming distribution**. Players choose which countries to release in, pay distance-based distribution costs, and all sales/streams/charts become territory-aware.

---

## 1. New Database Table: `release_territories`

Tracks which countries a release is distributed to (for both physical sales and streaming).

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid PK | |
| release_id | uuid FK -> releases | |
| country | text | Country name (matches cities.country / band_country_fans.country) |
| distance_tier | text | 'domestic', 'regional', 'continental', 'intercontinental' |
| cost_multiplier | numeric | 1.0 / 1.5 / 2.5 / 4.0 |
| distribution_cost | integer | Total cost in cents for this territory |
| is_active | boolean DEFAULT true | Can disable territory later |
| created_at | timestamptz | |

RLS: Users can manage territories for releases they own (via release -> band -> band_members or release.user_id).

Also adds `home_country` text column to the `releases` table for quick distance-tier lookups.

---

## 2. Distance Tier Pricing

Based on the band's home city region vs the target country's region (using `cities.region`):

| Tier | Rule | Physical Multiplier | Digital/Streaming Multiplier |
|------|------|---------------------|------------------------------|
| Domestic | Same country | 1.0x | 1.0x |
| Regional | Same region (e.g. both Europe) | 1.5x | 1.1x |
| Continental | Adjacent regions | 2.5x | 1.2x |
| Intercontinental | Far regions (e.g. Europe -> Asia) | 4.0x | 1.3x |

Region adjacency map:
- Europe <-> Middle East, Africa
- North America <-> Central America, Caribbean, South America
- Asia <-> Oceania, Middle East
- Everything else = intercontinental

---

## 3. Release Wizard Changes

### New Step 4: "Territory Selection" (wizard becomes 5 steps)

**New component: `TerritorySelectionStep.tsx`**
- Lists all countries from the `cities` table, grouped by region
- Each country shows a distance tier badge and per-country cost
- "Select All in Region" buttons per region group
- Home country auto-selected and marked as "Domestic"
- Running cost total at the bottom
- Base distribution cost: $50/country for physical, $10/country for digital/streaming, multiplied by tier

### Updated `CreateReleaseDialog.tsx`:
- Add step 4 (territories) between format selection (step 3) and streaming platforms (step 5)
- Store `selectedTerritories` state with country + tier + cost
- Total cost now includes territory distribution fees
- Save territories to `release_territories` table on submit
- Cache band's home country from their home city

### Updated `StreamingDistributionStep.tsx`:
- Now receives selected territories and only distributes to streaming platforms **in those territories**
- Shows which countries streaming will be active in

---

## 4. Sales Engine Updates (`generate-daily-sales`)

Currently sales use a single `regionalMultiplier` from the first `band_country_fans` entry. This changes to **per-territory sales generation**:

1. Fetch `release_territories` for each release
2. For each active territory:
   - Look up `band_country_fans` for that specific country
   - Calculate country-specific fame multiplier
   - Generate sales scaled by that country's fame, fans, and performance history
   - Record the `country` on each `release_sales` row (column already exists)
3. Physical stock is shared globally (decremented from same pool)
4. **Spillover**: Countries adjacent to active territories get 10% passive sales even without a territory entry
5. Releases with NO territories (legacy) continue using current global logic

---

## 5. Streaming Updates (`update-daily-streams`)

Currently streams are generated globally with random regions. This changes to:

1. Check `release_territories` for the release's parent release
2. Generate streams weighted by territory -- more streams in countries where the band has fame/fans
3. The `listener_region` on `streaming_analytics_daily` now maps to actual territory countries
4. Countries without a territory entry get minimal spillover streams (10%)

---

## 6. Charts Integration (`update-music-charts`)

The chart system already supports per-region charts via `listener_region`. With territory-aware streaming:
- Regional charts will naturally reflect where songs are actually distributed
- Songs only distributed in the UK won't appear on US charts (unless spillover)
- The `country` field on `release_sales` feeds into sales-based chart calculations

No structural changes needed to the charts engine -- it will automatically pick up the territory-filtered data.

---

## 7. Streaming Charts (`simulate-streaming-charts`)

This function generates simulated platform charts. It will be updated to:
- Weight chart positions by territory presence -- songs distributed in more countries rank higher
- Regional chart entries (US, UK, etc.) only include songs distributed to that region's territories

---

## 8. Auto-Distribute Streaming (`auto-distribute-streaming`)

When manufacturing completes and auto-distribution triggers:
- Only create `song_releases` entries for platforms in the selected territories
- Each `song_release` gets tagged with the territory's country

---

## Technical File Changes Summary

| File | Change |
|------|--------|
| **New migration SQL** | Create `release_territories` table + RLS; add `home_country` to releases |
| **New: `TerritorySelectionStep.tsx`** | Country picker grouped by region with cost breakdown |
| **Edit: `CreateReleaseDialog.tsx`** | 5-step wizard, territory state, save territories on submit |
| **Edit: `StreamingDistributionStep.tsx`** | Receives territories, shows country context |
| **Edit: `generate-daily-sales/index.ts`** | Per-territory sales loop with country-specific fame |
| **Edit: `update-daily-streams/index.ts`** | Territory-weighted stream generation |
| **Edit: `auto-distribute-streaming/index.ts`** | Territory-aware distribution |
| **Edit: `simulate-streaming-charts/index.ts`** | Territory-weighted chart positions |
| **Edit: `VersionHeader.tsx`** | Bump to 1.0.865 |
| **Edit: `VersionHistory.tsx`** | Add changelog |

### Backward Compatibility
- Existing releases without territories default to global behavior (current logic unchanged)
- The territory step pre-selects the band's home country
- No data migration needed for existing releases

