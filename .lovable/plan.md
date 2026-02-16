

## Remove In-Game Month Name, Show Day Number Only

### Overview

Replace all month name displays (e.g., "January 15, Year 1") with just the day number (e.g., "Day 15, Year 1") across all calendar UI components. Bump to **v1.0.757**.

### Changes

**1. GameDateWidget** (`src/components/calendar/GameDateWidget.tsx`)
- Line 36: Change `{calendar.monthName} {calendar.gameDay}, Year {calendar.gameYear}` to `Day {calendar.gameDay}, Year {calendar.gameYear}`

**2. EnhancedGameDateWidget** (`src/components/calendar/EnhancedGameDateWidget.tsx`)
- Line 105: Change `{calendar.monthName} {calendar.gameDay}` to `Day {calendar.gameDay}`

**3. LocationHeader** (`src/components/location/LocationHeader.tsx`)
- Line 115: Change `{calendar.seasonEmoji} {calendar.monthName}, Yr {calendar.gameYear}` to `{calendar.seasonEmoji} Day {calendar.gameDay}, Yr {calendar.gameYear}`

**4. SeasonalEventsCalendar** (`src/pages/SeasonalEventsCalendar.tsx`)
- Line ~100: Change the current season display from `{calendar.monthName}, Year {calendar.gameYear}` to `Day {calendar.gameDay}, Year {calendar.gameYear}`

**5. Version bump**
- `src/components/VersionHeader.tsx` -- bump to `1.0.757`
- `src/pages/VersionHistory.tsx` -- add entry: "Simplified in-game date display to show day number instead of month name"

### Files modified
- `src/components/calendar/GameDateWidget.tsx`
- `src/components/calendar/EnhancedGameDateWidget.tsx`
- `src/components/location/LocationHeader.tsx`
- `src/pages/SeasonalEventsCalendar.tsx`
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

