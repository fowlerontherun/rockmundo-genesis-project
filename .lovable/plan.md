

## Seasonal Events Calendar, Seasonal Effects Rework, UI Reorganization, and Character Age Display

### Overview

Four changes bundled into **v1.0.756**:
1. New **Seasonal Events Calendar** page showing upcoming season-specific events and holidays
2. Seasonal background effects play only for the **first 10 seconds** after login, then fade out
3. Move **season/year info** from the header bar into the **LocationHeader** on the dashboard (alongside city and local time)
4. Show **character age** on the My Character profile overview panel

---

### 1. Seasonal Events Calendar Page

A new page at `/seasonal-events` that:
- Fetches all `random_events` where `season` is not null, grouped by season
- Highlights the **current season** tab by default using `useGameCalendar`
- Shows each event as a card with title, description, and the two choice previews (option A / option B text)
- Marks events the player has already encountered (via `player_events` join)
- Displays a seasonal progress indicator (how far through the current season)
- Includes a "Season Calendar" showing all four seasons with their date ranges in game months

**New file:** `src/pages/SeasonalEventsCalendar.tsx`
**Route:** Add lazy-loaded route `/seasonal-events` in `src/App.tsx`

---

### 2. Seasonal Effects -- First 10 Seconds Only

Currently `SeasonalBackground` runs permanently with animated particles. Change it to:
- Accept a `durationMs` prop (default 10000)
- Use a `useState` + `useEffect` timer that sets `visible = false` after the duration
- Apply a CSS opacity transition (fade out over 2 seconds) when the timer expires
- Once fully faded, render nothing to save performance
- Reset the timer when the season changes (so if the season changes mid-session, effects replay briefly)

**File modified:** `src/components/calendar/SeasonalBackground.tsx`

---

### 3. Move Season/Year from Header to LocationHeader

- **Remove** the `calendar` data and season display from `src/components/VersionHeader.tsx` (the `useGameCalendar` hook call and the season emoji/month/year span)
- **Add** season and year info into `src/components/location/LocationHeader.tsx`:
  - Import `useGameCalendar`
  - Display alongside the local time row: `Season emoji | Month Name, Year X`
  - Style it consistently with the existing Clock/time display

**Files modified:**
- `src/components/VersionHeader.tsx` -- remove calendar display, keep version/beta/VIP/radio only
- `src/components/location/LocationHeader.tsx` -- add season/year info row

---

### 4. Character Age on Profile

- In `src/pages/MyCharacterEdit.tsx`, in the "Profile overview" card (right sidebar), add the character's current in-game age
- Import `useGameCalendar` and `calculateInGameAge` from `@/utils/gameCalendar`
- Read `(profile as any)?.age` as the initial age
- Calculate current age using `calculateInGameAge(initialAge, calendarData)`
- Display as: `Age: 23` below the existing "Lifetime XP" line

**File modified:** `src/pages/MyCharacterEdit.tsx`

---

### 5. Version Bump and Changelog

- `src/components/VersionHeader.tsx` -- bump to `1.0.756`
- `src/pages/VersionHistory.tsx` -- add entry for v1.0.756

---

### Technical Details

**Files to create:**
- `src/pages/SeasonalEventsCalendar.tsx`

**Files to modify:**
- `src/components/calendar/SeasonalBackground.tsx` -- add fade-out timer logic
- `src/components/VersionHeader.tsx` -- remove season display, bump version
- `src/components/location/LocationHeader.tsx` -- add season/year info
- `src/pages/MyCharacterEdit.tsx` -- add age display
- `src/App.tsx` -- add `/seasonal-events` route
- `src/pages/VersionHistory.tsx` -- add changelog

**No database migrations needed** -- all data (`random_events.season`, `profiles.age`) already exists.

**Edge function change:**
- `supabase/functions/trigger-random-events/index.ts` -- add season filtering: compute current game season from epoch, then filter eligible events to include only events where `season IS NULL` (all-season) or `season = currentSeason`. This ensures seasonal events only trigger during their correct season.

