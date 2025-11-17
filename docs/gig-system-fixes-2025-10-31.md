# Gig System Fixes - October 31, 2025

## Issues Fixed

### 1. Gigs Not Auto-Starting
**Problem**: Gigs were scheduled but never automatically started at their scheduled time.

**Solution**:
- Fixed the `auto_start_scheduled_gigs()` database function to properly update gig status
- Added manual "Start Performance" button for scheduled gigs that have reached their start time
- Created `useManualGigStart` hook to trigger gig starts from the frontend
- Updated `PerformGig` page to show start button when gig is ready

### 2. Gig History Empty
**Problem**: No gig outcomes were being created, so gig history tab was blank.

**Solution**:
- The real-time gig advancement system now creates initial gig outcomes when gigs start
- `useRealtimeGigAdvancement` hook creates `gig_outcomes` with initial data
- Song performances are tracked individually in `gig_song_performances` table
- `GigHistoryTab` properly fetches and displays completed gig data with full details

### 3. Setlist Time Limits vs Song Count
**Problem**: Setlists were limited by song count (minimum 6 songs) instead of time duration.

**Solution**:
- **Removed song count limits** - setlists can now have any number of songs
- **Added time-based validation** for different slot types:
  - Kids Slot: 30 min max
  - Opening Slot: 30 min max
  - Support Slot: 45 min max
  - Headline Slot: 75 min max
- Created database functions:
  - `get_setlist_total_duration(setlist_id)` - calculates total duration
  - `validate_setlist_for_slot(setlist_id, slot_type)` - validates duration for slot
- Updated UI to display total duration prominently
- Added slot time limits to setlist manager for reference

### 4. Encore Song Support
**Problem**: No way to mark special songs as encore performances.

**Solution**:
- Added `is_encore` boolean column to `setlist_songs` table
- Maximum of 2 songs can be marked as encore
- Updated `SetlistSongManager` component with:
  - Toggle button to mark/unmark songs as encore
  - Visual highlighting for encore songs (star icon, special background)
  - Encore count badge in setlist summary
- Encore songs are included in total duration calculation

## Database Changes

```sql
-- Add encore support
ALTER TABLE setlist_songs 
ADD COLUMN is_encore BOOLEAN DEFAULT false;

-- Add slot type tracking to gigs
ALTER TABLE gigs
ADD COLUMN slot_type TEXT DEFAULT 'headline';

-- Duration calculation function
CREATE OR REPLACE FUNCTION get_setlist_total_duration(p_setlist_id UUID)
RETURNS INTEGER;

-- Validation function
CREATE OR REPLACE FUNCTION validate_setlist_for_slot(
  p_setlist_id UUID,
  p_slot_type TEXT
)
RETURNS JSONB;

-- Fixed auto-start function
CREATE OR REPLACE FUNCTION auto_start_scheduled_gigs()
RETURNS void;
```

## Frontend Changes

### New Components/Hooks
- `src/hooks/useManualGigStart.ts` - Manual gig start trigger
- Updated `src/components/setlist/SetlistSongManager.tsx` - Encore support
- Updated `src/pages/PerformGig.tsx` - Start button and better status display
- Updated `src/components/band/GigHistoryTab.tsx` - Fixed data fetching

### UI Improvements
- Setlist duration displayed as `MM:SS` format
- Slot time limits shown in setlist manager: "Kids/Opening: 30min • Support: 45min • Headline: 75min"
- Encore songs highlighted with star icon and special styling
- Gig status badges: 🔴 Live Now for in-progress gigs
- "Start Performance" button appears when gig is scheduled and time has passed

## User Flow

### Before
1. Book gig with setlist (minimum 6 songs required)
2. Navigate to gig and click "Perform Now" button
3. Manually advance through each song
4. View outcome after manually completing

### After
1. Book gig with setlist (any number of songs, validated by time)
2. Mark up to 2 songs as encore (optional)
3. Navigate to gig when scheduled time arrives
4. Click "Start Performance" button
5. Watch real-time performance automatically progress song-by-song
6. View detailed outcome with song performances, ratings, revenue, etc.
7. Access complete gig history in Gig History tab

## Testing Recommendations

1. **Create a setlist** with various song durations
2. **Mark 1-2 songs as encore** using star button
3. **Check total duration** matches sum of song durations
4. **Book a gig** with the setlist
5. **Navigate to gig page** when scheduled time passes
6. **Click "Start Performance"** and watch real-time advancement
7. **View Gig History tab** after completion to see full report

## Technical Notes

- Song durations default to 180 seconds (3 min) if not specified
- Gig advancement uses actual song duration for timing
- Real-time updates via Supabase subscriptions on `gigs` and `gig_song_performances` tables
- Initial gig outcome created with estimated attendance when gig starts
- Song performances calculated and inserted as each song plays
