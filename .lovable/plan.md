
# Plan: Fix Rehearsal Familiarity Updates and Tour Gig Scheduling (v1.0.601)

## Problem Analysis

### Issue 1: Rehearsal Familiarity Not Updating
**Root Cause**: The `useAutoRehearsalCompletion` hook's upsert to `band_song_familiarity` is silently failing. Database analysis confirms:
- Completed rehearsals exist with `familiarity_gained: 120-480` minutes
- But `band_song_familiarity` table shows NO updates after January 30th
- The last successful update was `2026-01-25` (12 days ago)

**Technical Issue**: The Supabase JS client's `.upsert()` method may be failing because:
1. It runs on the client side, subject to RLS policies requiring the user to be a band member
2. The `onConflict: 'band_id,song_id'` syntax requires the constraint name to be exact
3. Silent failures aren't being caught properly

### Issue 2: Tour Gigs Not Showing on Schedule
**Root Cause**: Tour gigs have zero `player_scheduled_activities` entries. Analysis shows:
- All tour gigs have `schedule_count: 0` in the database
- The `useTourWizard.ts` uses `activity_type: 'tour_gig'` which isn't a valid ActivityType
- The `createBandScheduledActivities` function silently fails when activity type validation fails
- Additionally, the `useScheduledActivities` hook already fetches gigs directly from the `gigs` table (lines 112-144), meaning gigs SHOULD appear even without schedule entries

**Additional Finding**: The schedule hook already dynamically fetches gigs for the user's bands - but the display logic may be filtering incorrectly.

---

## Solution Overview

1. **Create Server-Side Edge Function** for rehearsal completion to bypass RLS
2. **Fix Tour Gig Activity Type** to use 'gig' instead of 'tour_gig'
3. **Add Redundant Fallback** for schedule display to always show gigs
4. **Add Robust Error Handling** and retry logic
5. **Create Database Trigger** as ultimate backup for familiarity updates

---

## Part 1: Server-Side Rehearsal Completion

Create an edge function `complete-rehearsals` that runs with service role privileges:

**Why This Fixes It**: 
- Bypasses RLS restrictions entirely
- Uses service role key for guaranteed write access
- Centralized logic prevents frontend inconsistencies

```typescript
// supabase/functions/complete-rehearsals/index.ts
// 1. Fetch overdue rehearsals
// 2. Update familiarity using service role (no RLS)
// 3. Update band chemistry
// 4. Return results for frontend to display
```

**Key Logic**:
```typescript
// Direct insert/update with service role - no RLS restrictions
const { error } = await supabase
  .from('band_song_familiarity')
  .upsert({
    band_id: rehearsal.band_id,
    song_id: songId,
    familiarity_minutes: newMinutes,
    rehearsal_stage: calculateRehearsalStage(newMinutes),
    last_rehearsed_at: now,
    updated_at: now,
  }, {
    onConflict: 'band_id,song_id',
  });
```

---

## Part 2: Fix useAutoRehearsalCompletion

Modify to call the edge function instead of direct database writes:

```typescript
// BEFORE: Direct upsert (fails due to RLS)
const { error } = await supabase
  .from('band_song_familiarity')
  .upsert({...}, { onConflict: 'band_id,song_id' });

// AFTER: Call edge function
const { data, error } = await supabase.functions.invoke('complete-rehearsals', {
  body: { userId }
});
```

**Fallback Logic**:
- If edge function fails, attempt direct upsert as backup
- Log all errors with full context for debugging
- Add retry mechanism with exponential backoff

---

## Part 3: Fix Tour Gig Scheduling

### 3a. Fix Activity Type in useTourWizard.ts

```typescript
// BEFORE (line 517):
activityType: 'tour_gig',

// AFTER:
activityType: 'gig',
```

### 3b. Ensure Tour Metadata is Preserved

```typescript
metadata: {
  tourId: tour.id,
  venueId: gig.venue_id,
  venueCity: venue?.cityName,
  isHeadliner: true,
  isTourGig: true, // NEW: Flag for display purposes
},
```

### 3c. Fix Existing Tour Gigs (Migration)

```sql
-- Create missing schedule entries for existing tour gigs
INSERT INTO player_scheduled_activities (
  user_id, profile_id, activity_type, scheduled_start, scheduled_end,
  title, linked_gig_id, status, metadata
)
SELECT DISTINCT
  bm.user_id,
  p.id as profile_id,
  'gig',
  g.scheduled_date,
  g.scheduled_date + INTERVAL '4 hours',
  'Tour: ' || t.name || ' - ' || v.name,
  g.id,
  'scheduled',
  jsonb_build_object('tourId', t.id, 'isTourGig', true, 'band_id', g.band_id)
FROM gigs g
JOIN tours t ON t.id = g.tour_id
JOIN venues v ON v.id = g.venue_id
JOIN band_members bm ON bm.band_id = g.band_id 
  AND bm.member_status = 'active' 
  AND bm.is_touring_member = false
  AND bm.user_id IS NOT NULL
JOIN profiles p ON p.user_id = bm.user_id
LEFT JOIN player_scheduled_activities psa ON psa.linked_gig_id = g.id
WHERE g.status = 'scheduled'
  AND g.tour_id IS NOT NULL
  AND psa.id IS NULL;
```

---

## Part 4: Database Trigger as Backup

Create a database trigger to automatically update familiarity when rehearsals complete:

```sql
CREATE OR REPLACE FUNCTION update_song_familiarity_on_rehearsal_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_minutes INTEGER;
  v_song_id UUID;
  v_setlist_songs RECORD;
  v_minutes_per_song INTEGER;
  v_new_minutes INTEGER;
  v_stage TEXT;
BEGIN
  -- Only run when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Calculate duration
    v_duration_minutes := EXTRACT(EPOCH FROM (NEW.scheduled_end - NEW.scheduled_start)) / 60;
    
    -- Handle single song rehearsal
    IF NEW.selected_song_id IS NOT NULL THEN
      -- Upsert familiarity
      INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at)
      VALUES (NEW.band_id, NEW.selected_song_id, v_duration_minutes, 
              CASE 
                WHEN v_duration_minutes >= 360 THEN 'perfected'
                WHEN v_duration_minutes >= 300 THEN 'well_rehearsed'
                WHEN v_duration_minutes >= 180 THEN 'familiar'
                WHEN v_duration_minutes >= 60 THEN 'learning'
                ELSE 'unlearned'
              END,
              NOW())
      ON CONFLICT (band_id, song_id) DO UPDATE SET
        familiarity_minutes = band_song_familiarity.familiarity_minutes + v_duration_minutes,
        rehearsal_stage = CASE 
          WHEN band_song_familiarity.familiarity_minutes + v_duration_minutes >= 360 THEN 'perfected'
          WHEN band_song_familiarity.familiarity_minutes + v_duration_minutes >= 300 THEN 'well_rehearsed'
          WHEN band_song_familiarity.familiarity_minutes + v_duration_minutes >= 180 THEN 'familiar'
          WHEN band_song_familiarity.familiarity_minutes + v_duration_minutes >= 60 THEN 'learning'
          ELSE 'unlearned'
        END,
        last_rehearsed_at = NOW(),
        updated_at = NOW();
        
    -- Handle setlist rehearsal
    ELSIF NEW.setlist_id IS NOT NULL THEN
      -- Count songs in setlist
      SELECT COUNT(*) INTO v_minutes_per_song 
      FROM setlist_songs WHERE setlist_id = NEW.setlist_id AND song_id IS NOT NULL;
      
      IF v_minutes_per_song > 0 THEN
        v_minutes_per_song := v_duration_minutes / v_minutes_per_song;
        
        FOR v_setlist_songs IN 
          SELECT song_id FROM setlist_songs 
          WHERE setlist_id = NEW.setlist_id AND song_id IS NOT NULL
        LOOP
          INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at)
          VALUES (NEW.band_id, v_setlist_songs.song_id, v_minutes_per_song,
                  CASE 
                    WHEN v_minutes_per_song >= 360 THEN 'perfected'
                    WHEN v_minutes_per_song >= 300 THEN 'well_rehearsed'
                    WHEN v_minutes_per_song >= 180 THEN 'familiar'
                    WHEN v_minutes_per_song >= 60 THEN 'learning'
                    ELSE 'unlearned'
                  END,
                  NOW())
          ON CONFLICT (band_id, song_id) DO UPDATE SET
            familiarity_minutes = band_song_familiarity.familiarity_minutes + v_minutes_per_song,
            rehearsal_stage = CASE 
              WHEN band_song_familiarity.familiarity_minutes + v_minutes_per_song >= 360 THEN 'perfected'
              WHEN band_song_familiarity.familiarity_minutes + v_minutes_per_song >= 300 THEN 'well_rehearsed'
              WHEN band_song_familiarity.familiarity_minutes + v_minutes_per_song >= 180 THEN 'familiar'
              WHEN band_song_familiarity.familiarity_minutes + v_minutes_per_song >= 60 THEN 'learning'
              ELSE 'unlearned'
            END,
            last_rehearsed_at = NOW(),
            updated_at = NOW();
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_familiarity_on_rehearsal_complete
  AFTER UPDATE ON band_rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION update_song_familiarity_on_rehearsal_complete();
```

**Why SECURITY DEFINER**: Runs with table owner privileges, bypassing RLS entirely.

---

## Part 5: Enhanced Error Handling

Add comprehensive logging and retry logic:

```typescript
// In useAutoRehearsalCompletion.ts
const MAX_RETRIES = 3;

async function updateFamiliarityWithRetry(params, retries = 0) {
  try {
    const { error } = await supabase.functions.invoke('complete-rehearsals', {
      body: params
    });
    
    if (error) throw error;
  } catch (err) {
    console.error(`[AutoRehearsal] Attempt ${retries + 1} failed:`, err);
    
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
      return updateFamiliarityWithRetry(params, retries + 1);
    }
    
    // Fallback: try direct database write
    console.log('[AutoRehearsal] Falling back to direct write');
    // ... direct upsert logic
  }
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/complete-rehearsals/index.ts` | Create | Server-side rehearsal completion with service role |
| `supabase/migrations/XXX_rehearsal_familiarity_trigger.sql` | Create | Database trigger for guaranteed updates |
| `supabase/migrations/XXX_fix_tour_gig_schedules.sql` | Create | Backfill missing tour gig schedules |
| `src/hooks/useAutoRehearsalCompletion.ts` | Modify | Call edge function, add retry logic |
| `src/hooks/useTourWizard.ts` | Modify | Fix activity type to 'gig' |
| `src/components/VersionHeader.tsx` | Modify | Bump to v1.0.601 |
| `src/pages/VersionHistory.tsx` | Modify | Add changelog |

---

## Testing Plan

1. **Rehearsal Flow**:
   - Book a rehearsal
   - Wait for it to complete
   - Verify `band_song_familiarity` is updated
   - Check familiarity level displays correctly in UI

2. **Tour Gig Flow**:
   - Book a new tour
   - Verify all tour gigs appear on each band member's schedule
   - Confirm existing tours now show gigs on schedule

3. **Edge Cases**:
   - Rehearsal for song without band_id (should handle gracefully)
   - Setlist rehearsal with mix of familiar and new songs
   - Tour with band members who join after booking

---

## Expected Outcomes

- Rehearsal familiarity updates will **always work** via database trigger
- Tour gigs will appear on player schedules immediately
- Existing tour gigs will be backfilled into schedules
- All errors will be logged with full context for debugging
- System is resilient with multiple fallback mechanisms

---

## Version: 1.0.601
