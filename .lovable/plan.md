

## Game World Year System, Player Aging, Seasons, and Christmas #1

### Overview

Overhaul the in-game calendar to use a **fixed epoch** (January 1, 2026) instead of per-player creation dates, unify all players into the same game timeline, add visible seasonal effects globally, display season/year in the header bar, introduce seasonal random events, and create a **Christmas Number One** achievement system with boosted holiday sales.

### 1. Fixed Epoch Calendar (January 2026 = Game Year 1)

**Current problem**: The calendar is relative to each player's `profileCreatedAt` date, meaning every player is in a different game year/month. This makes shared events, seasons, and achievements impossible to synchronize.

**New system**:
- Fixed epoch: **January 1, 2026** = Game Year 1, Month 1, Day 1
- 1 game year = 4 real-world months (120 real days) -- already the default config
- 1 game month = 10 real days -- already the default config  
- Real-world day-of-day timing is preserved (morning/afternoon/evening stays real)
- All players share the same in-game date at all times
- Update `calculateInGameDate()` in `src/utils/gameCalendar.ts` to use the fixed epoch instead of `characterCreatedAt`
- Update `useGameCalendar` hook to no longer require `profileCreatedAt`
- Update `game_calendar_config` admin page to document the epoch

### 2. Player Aging

- Players already have `calculateInGameAge(initialAge, currentGameDate)` which adds `gameYear - 1` to their starting age
- This will now work globally since all players share the same game year
- On each game year rollover, the character ages by 1
- Display current age on the character profile page (already partially done)

### 3. Season Display in Header Bar

- Modify `VersionHeader.tsx` to include the current season emoji, month name, and game year
- Example: `❄ Winter | January, Year 1 | v1.0.753`
- Import and use `useGameCalendar` in the header component
- Keep it compact so it doesn't crowd the bar

### 4. Global Seasonal Visual Effects

- **Currently exists** but is never mounted: `SeasonalBackground.tsx` has snowfall, leaves, blossoms, and sparkle particles with CSS animations
- Mount `SeasonalBackground` in `Layout.tsx`, passing the current season from `useGameCalendar`
- Add a user setting toggle to disable seasonal effects (performance)
- Add spring-specific decorations (currently only summer and winter have special decorations)
- Add autumn-specific decorations
- Ensure the CSS animations (`animate-snowfall`, `animate-leaf-fall`, `animate-blossom-float`) exist in `tailwind.config.ts` or `index.css`

### 5. Christmas Sales Boost and Christmas Number One Achievement

**Sales boost**:
- In `generate-daily-sales` edge function, detect when the in-game month is December (month 12)
- Apply a progressive multiplier: 1.5x in early December, 2.0x in the week before Christmas (days 20-25), 2.5x on Christmas Day (day 25)
- Add a `christmas_sales_boost` config key to `game_balance_config` for admin tuning

**Christmas Number One**:
- New DB table `christmas_number_ones` to record the top-selling release on December 25th each game year
- The `generate-daily-sales` function checks on game day 25 of month 12 and records the #1 selling release
- New achievement/badge: "Christmas Number One" displayed on release cards and player profile
- A notification/celebration when a player's release achieves Christmas #1
- Display a "Christmas Charts" section on the Charts page during December showing the race

### 6. Seasonal Random Events

Add a `season` column to the `random_events` table (nullable -- null means all-season). Seed with seasonal events:

**Winter events**:
- "Snowbound Studio" -- studio snowed in, forced day off or pay for clearing
- "Christmas Market Gig" -- offered a pop-up market performance
- "New Year's Resolution" -- choose a stat to boost for the month
- "Heating Bill" -- unexpected expense or busk indoors

**Spring events**:
- "Festival Season Approaches" -- early bird festival application bonus
- "Spring Cleaning" -- find old equipment or lose junk
- "Pollen Allergy" -- vocalist health issue, rest or push through
- "Cherry Blossom Tour" -- special Japan tour opportunity

**Summer events**:
- "Heatwave" -- outdoor gig attendance boost or equipment damage risk
- "Summer Anthem" -- chance for a song to go viral on playlists
- "Beach Party Gig" -- casual paid gig opportunity
- "Tour Bus Breakdown" -- travel delay or costly repair

**Autumn events**:
- "Back to School" -- university courses discounted
- "Halloween Special" -- horror-themed gig with bonus fans
- "Award Season Buzz" -- nomination rumour, fame boost
- "Rainy Day Blues" -- write a melancholy hit or lose motivation

Update the random event trigger logic to filter by current season when selecting events.

### Technical Details

**Files to modify:**
- `src/utils/gameCalendar.ts` -- change `calculateInGameDate` to use fixed epoch (Jan 1, 2026), remove `characterCreatedAt` param
- `src/hooks/useGameCalendar.ts` -- simplify to not need `profileCreatedAt`, use epoch-based calculation
- `src/components/VersionHeader.tsx` -- add season/year display, bump to v1.0.753
- `src/components/Layout.tsx` -- mount `SeasonalBackground` with current season
- `src/components/calendar/SeasonalBackground.tsx` -- add spring and autumn decorations
- `src/components/calendar/GameDateWidget.tsx` -- update to use new epoch-based hook
- `supabase/functions/generate-daily-sales/index.ts` -- add Christmas sales multiplier logic
- `src/pages/VersionHistory.tsx` -- add changelog

**Files to create:**
- None strictly required, but may create `src/components/header/SeasonYearDisplay.tsx` for the header widget

**Database migrations:**
- Add `season` column (nullable text) to `random_events` table
- Create `christmas_number_ones` table (id, game_year, release_id, band_id, total_sales, crowned_at)
- Seed ~16 seasonal random events
- Add `christmas_sales_boost` keys to `game_balance_config`

**Edge function changes:**
- `generate-daily-sales`: compute current game month from epoch, apply Christmas multiplier, check for Christmas #1 on Dec 25

