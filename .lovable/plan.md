

# Weather System Implementation

## Overview
Add a realistic climate and weather system to every city. Weather changes with the in-game seasons, is displayed on the dashboard alongside the season info, and can affect travel disruptions and genre popularity.

## What Players Will See

**On the Dashboard / LocationHeader:**
- Current weather condition with emoji and temperature next to the existing season display (e.g., "Winter -- 5C Rainy")
- Weather updates each time the page loads based on the city's climate type and current season

**During Travel:**
- Weather-based disruption warnings when booking travel (storms delay flights, snow cancels routes, etc.)

**Genre Popularity:**
- Certain weather/season combos slightly boost or dampen genre popularity (e.g., rainy weather boosts Blues/Jazz streams, sunny weather boosts Pop/Reggae)

---

## Climate Types

Each city gets a `climate_type` based on its real-world geography:

| Climate Type | Example Cities | Characteristics |
|---|---|---|
| `tropical` | Bangkok, Kingston, Manila | Hot year-round, rainy seasons, no snow |
| `arid` | Dubai, Cairo, Phoenix | Very hot summers, mild winters, rare rain |
| `mediterranean` | Barcelona, Rome, LA | Warm dry summers, mild wet winters |
| `oceanic` | London, Dublin, Seattle | Mild temps, frequent rain/cloud |
| `continental` | Moscow, Chicago, Berlin | Hot summers, cold snowy winters |
| `subtropical` | Tokyo, Sydney, Buenos Aires | Warm/humid, moderate seasons |
| `subarctic` | Helsinki, Reykjavik | Very cold winters, cool summers, heavy snow |
| `equatorial` | Singapore, Jakarta | Hot and rainy year-round |

---

## Technical Plan

### 1. Database: Add `climate_type` column to `cities`

Migration adds a `climate_type` text column and populates it for all 180 cities based on latitude, region, and real-world climate data. No new tables needed -- the existing `seasonal_weather_patterns` table will be populated.

### 2. Database: Seed `seasonal_weather_patterns` for all 180 cities x 4 seasons

A migration will insert 720 rows (180 cities x 4 seasons) into the existing empty `seasonal_weather_patterns` table. Each row contains:
- Weather condition probabilities (sunny/cloudy/rainy/stormy/snowy percentages)
- Average temperature in Celsius
- Travel disruption chance

Climate-type lookup tables in the migration will map each climate to realistic seasonal values. For example:
- `continental` winter: 10% sunny, 25% cloudy, 15% rainy, 10% stormy, 40% snowy, avg -5C
- `tropical` summer: 30% sunny, 30% cloudy, 30% rainy, 10% stormy, 0% snowy, avg 32C

### 3. New Hook: `useWeather`

A React hook that fetches or generates weather for the player's current city:
- Queries `seasonal_weather_patterns` for the city + current season
- Deterministically generates today's weather using the in-game day as a seed (so weather stays consistent within the same game day for all players)
- Returns: `{ condition, temperature, emoji, description }`
- Cached with 5-minute stale time

### 4. UI: Update `LocationHeader` component

Add weather display next to the existing season/calendar line:
```
Winter -- 5C Rainy  |  Day 15, Yr 2
```

### 5. Update `weatherSystem.ts`

- Modify `generateDailyWeather` to use a seeded random based on game day (so weather is consistent per day, not random on every page load)
- Add a `getWeatherGenreModifier` function that returns a multiplier for genre streams/popularity based on current weather

### 6. Integrate weather into travel booking

Update `TravelBookingDialog` to check weather at both origin and destination cities and show disruption warnings using the existing `WeatherDisruptionAlert` component.

### 7. Version bump to v1.0.828

Update `VersionHeader` and `VersionHistory` with the weather system changes.

---

## Files to Create
- `src/hooks/useWeather.ts` -- new hook for fetching current weather

## Files to Edit
- `src/utils/weatherSystem.ts` -- seeded random, genre modifier function
- `src/components/location/LocationHeader.tsx` -- display weather inline with season
- `src/components/travel/TravelBookingDialog.tsx` -- weather disruption check
- `src/components/VersionHeader.tsx` -- version bump
- `src/pages/VersionHistory.tsx` -- changelog entry

## Database Migration
- Add `climate_type` column to `cities`
- Populate `climate_type` for all 180 cities using latitude/region mapping
- Seed all 720 rows in `seasonal_weather_patterns` with realistic climate data

