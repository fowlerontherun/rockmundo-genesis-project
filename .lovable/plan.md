

# v1.0.736 — PR Offers Fix, Modeling Rework, Radio Station Expansion

This plan addresses four major areas: broken PR offer generation, stuck modeling contracts, radio station coverage gaps, and station branding.

---

## 1. Fix PR Offers for Podcasts, Newspapers, and Magazines

**Root cause:** The `generate-pr-offers` edge function queries columns that don't exist on these tables, causing silent failures:
- `podcasts` table uses `podcast_name` (not `name`) and has no `min_fans_required`
- `newspapers` table has no `min_fans_required` or `cooldown_days`
- `magazines` table has no `min_fans_required`

**Fix:** Update the edge function's SELECT queries to use correct column names and stop selecting non-existent columns:
- Podcasts: select `podcast_name` instead of `name`, drop `min_fans_required`
- Newspapers: drop `min_fans_required` and `cooldown_days` from SELECT
- Magazines: drop `min_fans_required` from SELECT
- Update the outlet name fallback for podcasts to use `podcast_name`

---

## 2. Modeling System Rework

**Problems identified:**
- 17 accepted contracts are stuck with past shoot dates and no completion logic
- `hasActiveContract` blocks all new offers indefinitely since nothing ever completes
- No edge function or process exists to complete modeling contracts and pay out rewards

**Fixes:**

### a) Add completion logic to `process-daily-updates`
Add a modeling contract completion step that:
- Finds all `accepted` contracts where `shoot_date` is in the past
- Marks them as `completed`, sets `completed_at`
- Awards the `compensation` to the player's cash balance
- Awards `fame_boost` to the player's fame
- Logs a `band_earnings` entry if applicable

### b) Bulk-fix existing stuck contracts
Run a migration to complete all 17 stuck contracts (shoot_date before today), set `completed_at = now()`, and credit the players.

### c) Improve the one-active-contract rule
Change the `hasActiveContract` check to only block if there's a contract with a **future** `shoot_date` that hasn't been completed. Past-date accepted contracts shouldn't block.

---

## 3. Radio Stations for All Cities

**Current state:** 175 stations across 70 cities, but 64 cities have zero stations.

**Plan:**
- Seed 2-3 radio stations per missing city (128-192 new stations)
- Use realistic, unique names instead of "City FM" patterns (e.g., "The Hive 101.5" for Manchester, "Radio Sunshine" for Lisbon)
- Add a `logo_url` column to `radio_stations` via migration
- Each station gets varied `station_type`, `quality_level`, `listener_base`, and genre mixes appropriate to the city's music culture

### Rename generic "City FM" stations
- Update all ~50 stations named "[City] FM" with creative, realistic names (e.g., "Buenos Aires FM" becomes "Radio Tango 98.3", "Cairo FM" becomes "Nile Beats Radio")

---

## 4. Radio Station Logos

- Add `logo_url` column to the `radio_stations` table
- For well-known real stations already in the database (e.g., BBC Radio 1, Capital FM, Jazz FM, Classic FM), set their logo URLs to publicly available logos or placeholder branded images
- Create an edge function `generate-radio-logos` that uses Lovable AI image generation to create logos for stations without one
- The function would generate simple, professional radio station logo images and store them in Supabase storage
- This can be triggered from the admin panel or run as a batch process

---

## Technical Details

### Files to modify:
1. **`supabase/functions/generate-pr-offers/index.ts`** — Fix podcast/newspaper/magazine column name mismatches
2. **`supabase/functions/process-daily-updates/index.ts`** — Add modeling contract completion step
3. **`src/components/modeling/ModelingOffersPanel.tsx`** — Fix `hasActiveContract` to ignore past-date contracts
4. **New migration** — Add `logo_url` to `radio_stations`, seed stations for 64 missing cities, rename generic stations, bulk-complete stuck modeling contracts
5. **New edge function: `generate-radio-logos/index.ts`** — AI logo generation for stations
6. **Version files** — Bump to v1.0.736

### Database changes:
```text
ALTER TABLE radio_stations ADD COLUMN logo_url text;

-- Bulk-complete stuck modeling contracts
UPDATE player_modeling_contracts 
SET status = 'completed', completed_at = now() 
WHERE status = 'accepted' AND shoot_date < CURRENT_DATE;

-- Seed ~190 new stations for 64 cities without any
-- Rename ~50 generic "City FM" stations
```

### Estimated scope:
- 5-6 files modified/created
- 1 large SQL migration (station seeding + renames + modeling fix)
- 1 new edge function for AI logo generation

