

## Fix Recording Session Completion & AI Song Generation Failures

### Problem 1: Recording Sessions Never Complete

**Root Cause Found**: The `complete-recording-sessions` edge function checks `band_members.current_city_id` (lines 85-93) to verify members are in the studio's city. However, `band_members.current_city_id` is **always NULL** for every member in the database. The actual city data lives on `profiles.current_city_id`.

This means the location check always finds a mismatch (`null !== "studio-city-uuid"`), marking every band recording session as "failed" due to "members not in the studio city" — even though they are.

**7 recording sessions** are currently stuck as `in_progress` with past `scheduled_end` dates, affecting songs: "Going up and out", "Coração", "Carinho", "Kvina 2", "My Lovely Horse".

**Fix**: Update the `complete-recording-sessions` edge function to look up each band member's city from `profiles.current_city_id` via `user_id` instead of using the always-null `band_members.current_city_id`.

---

### Problem 2: AI Song Generation Failures

Two separate issues:

**A) Songs with audio but status="failed" (3 songs)**: "When I needed some one to talk to", "My Lovely Horse", "Rare Polluon" — these have valid `audio_url` but `audio_generation_status` is stuck at `failed`. The generate function already has auto-recovery logic for this (lines 49-63), but it only triggers on a regeneration attempt. These need a data fix to set status to `completed`.

**B) Songs that genuinely failed (4 songs)**: "Ballad of the Rebel", "Nunca mais" (stuck generating since Feb 14), "Blue", "Red", "Violet" — these have no audio. They should have their status reset to allow retry.

**Fix**: 
- Data repair: Update the 3 songs with audio to `completed` status; reset the stuck/failed ones to allow retry
- The `generate-song-audio` function itself is working correctly — these are stale state issues

---

### Plan

#### 1. Fix `complete-recording-sessions` location check
**File: `supabase/functions/complete-recording-sessions/index.ts`**

Replace the band member location check (lines 83-94) to look up cities from `profiles` instead of `band_members`:

```
// Instead of:
const { data: members } = await supabase
  .from('band_members')
  .select('user_id, current_city_id')
  ...

// Do:
const { data: members } = await supabase
  .from('band_members')
  .select('user_id')
  .eq('band_id', session.band_id)
  .in('member_status', ['active'])
  .eq('is_touring_member', false)

// Then for each member with a user_id, look up their city from profiles
const memberCities = await Promise.all(
  members.filter(m => m.user_id).map(async (m) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_city_id')
      .eq('user_id', m.user_id)
      .eq('is_active', true)
      .is('died_at', null)
      .maybeSingle()
    return { user_id: m.user_id, current_city_id: profile?.current_city_id }
  })
)
```

Then check `memberCities` for mismatches instead of the old `members` array.

#### 2. Data repair via SQL insert tool
- Set `audio_generation_status = 'completed'` for 3 songs that have audio but show failed
- Reset `audio_generation_status = NULL, audio_generation_started_at = NULL` for "Nunca mais" (stuck generating since Feb 14)
- Complete the 7 stuck recording sessions manually or let the fixed function handle them on next cron run

#### 3. Version bump
Update to v1.1.120.

### Files to edit
- `supabase/functions/complete-recording-sessions/index.ts` — fix location lookup
- `src/components/VersionHeader.tsx` — version bump
- `src/pages/VersionHistory.tsx` — changelog
- Database data repairs via insert tool

