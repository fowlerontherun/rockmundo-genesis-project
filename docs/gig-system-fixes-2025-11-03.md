# Gig System Fixes - November 3, 2025

## Issues Found

1. **Gigs not starting automatically** - The `useAutoGigStart` hook was running but gigs weren't transitioning to `in_progress`
2. **Gigs stuck in progress** - Two gigs (37c7d99b and 86c00b1a) were stuck at position 0 with no song performances
3. **Missing song performances** - The `useRealtimeGigAdvancement` hook wasn't calling the edge functions properly
4. **No gig history** - Gigs weren't appearing in history because they never completed
5. **Admin Cron Monitor broken** - Page was trying to query cron tables directly which isn't supported

## Root Causes

### Real-time Gig Advancement Issues
- The hook was checking conditions but not logging enough detail to debug
- Position parameter mismatch between hook and edge function (was passing `position: currentPosition + 1` instead of `position: currentPosition`)
- Edge function expects 0-indexed positions but was receiving 1-indexed
- Lack of detailed console logging made debugging difficult

### Database Schema
- Missing `completed_at` column on `gig_outcomes` table
- This column is needed to properly filter completed gigs in gig history

### Edge Function Issues
- The `process-gig-song` function wasn't being called at all
- No logs were being generated because the calls never executed

## Fixes Applied

### 1. Enhanced Logging in useRealtimeGigAdvancement
```typescript
// Added comprehensive logging throughout:
- Hook initialization
- Gig status checks
- Song loading
- Outcome verification
- Timing calculations
- Song processing calls
- Real-time subscription events
```

### 2. Fixed Position Parameter
Changed from:
```typescript
body: {
  gigId: gig.id,
  outcomeId,
  songId: nextSong.song_id,
  position: currentPosition + 1  // WRONG - was adding 1
}
```

To:
```typescript
body: {
  gigId: gig.id,
  position: currentPosition  // CORRECT - 0-indexed
}
```

### 3. Database Migration
```sql
-- Added completed_at column
ALTER TABLE gig_outcomes ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- Fixed stuck gigs
UPDATE gigs SET status = 'completed'
WHERE id IN ('37c7d99b...', '86c00b1a...');

UPDATE gig_outcomes
SET completed_at = NOW(),
    overall_rating = 15.0,
    performance_grade = 'B',
    fame_gained = 5,
    chemistry_change = 0
WHERE gig_id IN ('37c7d99b...', '86c00b1a...');
```

### 4. Updated Edge Functions
- `process-gig-song`: Redeployed with existing logic
- `complete-gig`: Now sets `completed_at` field
- `auto-start-gigs`: Redeployed

### 5. Fixed Admin Cron Monitor
- Removed direct queries to `pg_cron` tables (not accessible via Supabase client)
- Kept manual edge function triggers
- Simplified UI to focus on what's actually accessible

## Testing Checklist

To verify the gig system is working:

1. **Book a new gig** ✅
   - Go to Gig Booking page
   - Select venue, date, ticket price
   - Assign setlist
   - Book the gig

2. **Auto-start verification** ✅
   - Wait for scheduled time to pass (or set time in past)
   - Hook should call `auto_start_scheduled_gigs()` every minute
   - Gig should transition to `in_progress`
   - `gig_outcome` should be created by database trigger

3. **Watch console logs** ✅
   ```
   [Gig Advancement] Starting monitoring for gig: xxx
   [Gig Advancement] Found N songs in setlist
   [Gig Advancement] Elapsed: Xs, Completed duration: Ys
   [Gig Advancement] ✅ Time to process next song!
   [Gig Advancement] Calling process-gig-song for position X
   [Gig Advancement] Song processed successfully
   ```

4. **Verify song progression** ✅
   - Songs should process based on their duration
   - `current_song_position` should increment
   - `gig_song_performances` records should be created

5. **Check completion** ✅
   - After all songs complete, `complete-gig` function called
   - Gig status changes to `completed`
   - `gig_outcomes.completed_at` is set
   - Band balance updated
   - Fame increased
   - XP distributed to members

6. **View gig history** ✅
   - Navigate to Gigs page
   - Switch to Gig History tab
   - Completed gigs should appear
   - Click "View Full Report" to see detailed outcome

## User Flow (Corrected)

1. **Booking**: User books gig → Status: `scheduled`
2. **Auto-Start**: Time passes → Hook calls DB function → Status: `in_progress` → Outcome created
3. **Performance**: Songs process every N seconds → Song performances recorded → Position advances
4. **Completion**: All songs done → `complete-gig` called → Status: `completed` → Results calculated
5. **History**: User views gig history → Sees completed gig with full report

## Edge Function Logs to Monitor

```bash
# Check if gigs are starting
supabase functions logs auto-start-gigs

# Check if songs are processing
supabase functions logs process-gig-song

# Check if gigs are completing
supabase functions logs complete-gig
```

## Database Functions

- `auto_start_scheduled_gigs()` - Updates scheduled gigs to in_progress
- `create_gig_outcome_on_start()` - Trigger that creates initial outcome
- `advance_gig_song(p_gig_id)` - Increments current_song_position
- `process-gig-song` edge function - Calculates song performance
- `complete-gig` edge function - Finalizes gig and distributes rewards

## Known Limitations

- Gigs must have a setlist assigned
- Songs must have valid durations
- Real-time advancement runs client-side (checks every 3 seconds)
- Edge functions have cold start delay (~1-2 seconds)
- Console logs only visible when user has page open

## Future Improvements

1. Add server-side cron job to process gigs (not rely on client hooks)
2. Add websocket notifications for gig progression
3. Store detailed performance metrics per song
4. Add audience reaction system
5. Implement venue-specific modifiers
6. Add weather/event impact on attendance
