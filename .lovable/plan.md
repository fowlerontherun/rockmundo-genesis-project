

## Country & City Filter for Recording Studios + Location Validation (v1.0.676)

### Overview
Two changes: (1) Add country and city dropdown filters to the Studio selection step in the recording wizard, defaulting to the player's current city but allowing browsing studios worldwide. (2) When the recording session completes, check that all band members (or the solo player) are in the correct city -- if not, the session fails.

### Changes

#### 1. StudioSelector.tsx -- Add Country & City Filter Dropdowns
- Add two new Select dropdowns at the top: **Country** and **City**
- Fetch all countries from `cities` table (distinct country values)
- When a country is selected, fetch cities in that country from `cities` table
- Default country and city to the player's current city (derive country from `cities` table join)
- The studio query switches from `cityId` prop to the selected city's ID
- Show a warning banner if the selected city differs from the player's current city: "You are not in this city. All band members must travel here before the session starts or the recording will fail."
- Props change: receive `currentCityId` and use it for defaults, but allow override

#### 2. RecordingWizard.tsx -- Pass current city info
- Pass `currentCityId` to StudioSelector (already done)
- Store the selected studio's `city_id` so it can be passed to SessionConfigurator

#### 3. SessionConfigurator.tsx -- Store studio city on the session
- When creating the recording session, include the studio's `city_id` in the metadata so the completion function can check location

#### 4. recording_sessions table -- Add city_id column (migration)
- Add a nullable `city_id` column (uuid, references cities) to `recording_sessions` so the edge function knows which city the session is booked in

#### 5. useRecordingData.tsx -- Save city_id when creating session
- Include `city_id` from the selected studio when inserting the recording session row

#### 6. complete-recording-sessions edge function -- Add location check
- Before completing a session, look up the studio's city_id (from the new column or from city_studios)
- For band sessions: fetch all band members' `current_city_id` from profiles and check they match the studio city
- For solo sessions: check the user's `current_city_id`
- If any member is not in the correct city:
  - Set session status to `'failed'` instead of `'completed'`
  - Do NOT update song quality or award XP
  - Log which members were missing
  - No refund (cost was already paid at booking time)

#### 7. RecordingStudio.tsx -- Show failed sessions
- Add a `'failed'` status handler to `getStatusIcon` and `getStatusBadge` (red X with "Failed" badge)
- Display a reason message for failed sessions (e.g., "Band members were not in the studio city")

#### 8. Version bump
- VersionHeader.tsx: bump to 1.0.676
- VersionHistory.tsx: add changelog entry

### Technical Details

**New migration:**
```sql
ALTER TABLE recording_sessions ADD COLUMN city_id uuid REFERENCES cities(id);
```

**StudioSelector filter flow:**
1. Query `SELECT DISTINCT country FROM cities ORDER BY country` for country dropdown
2. On country change, query `SELECT id, name FROM cities WHERE country = $1 ORDER BY name` for city dropdown
3. On city change, query existing `city_studios` with the new city_id
4. Default: look up player's current city country from `cities` table using `currentCityId`

**Location check in edge function (pseudo):**
```
const studioCityId = session.city_id || studioData.city_id
if (session.band_id) {
  const members = await getActiveBandMembers(session.band_id)
  const missingMembers = members.filter(m => m.current_city_id !== studioCityId)
  if (missingMembers.length > 0) -> FAIL session
} else {
  const profile = await getProfile(session.user_id)
  if (profile.current_city_id !== studioCityId) -> FAIL session
}
```

**Files to modify:**
1. `src/components/recording/StudioSelector.tsx` -- country/city filter dropdowns
2. `src/components/recording/RecordingWizard.tsx` -- minor prop adjustments
3. `src/hooks/useRecordingData.tsx` -- pass city_id in session insert
4. `supabase/migrations/` -- add city_id column to recording_sessions
5. `supabase/functions/complete-recording-sessions/index.ts` -- location validation
6. `src/pages/RecordingStudio.tsx` -- handle failed status display
7. `src/components/VersionHeader.tsx` -- bump to 1.0.676
8. `src/pages/VersionHistory.tsx` -- changelog entry
