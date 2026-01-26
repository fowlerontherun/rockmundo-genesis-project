

# Rehearsal System Complete Fix

## Version: 1.0.508

## Overview
This update fixes multiple critical issues in the rehearsal system: song familiarity not updating due to database constraint mismatch, enhances the post-rehearsal completion report, and retroactively fixes affected rehearsals from the past week.

---

## Issues Identified

### 1. CRITICAL: `rehearsal_stage` Value Mismatch (Root Cause)
The code uses incorrect stage values that violate the database CHECK constraint:

| Code Uses | Database Expects |
|-----------|------------------|
| `'learning'` | `'learning'` ✅ |
| `'practicing'` | ❌ INVALID |
| `'familiar'` | `'familiar'` ✅ |
| `'mastered'` | ❌ INVALID |
| - | `'unlearned'` |
| - | `'well_rehearsed'` |
| - | `'perfected'` |

**Effect**: Every upsert fails silently because `'practicing'` and `'mastered'` violate the CHECK constraint `valid_rehearsal_stage`, so no familiarity records are created or updated.

### 2. Stage Thresholds Mismatch
The code calculates stages based on a 600-minute scale (100%), but the actual REHEARSAL_LEVELS use different thresholds:
- Unlearned: 0-59 min
- Learning: 60-299 min  
- Familiar: 300-899 min
- Well Rehearsed: 900-1799 min
- Perfected: 1800+ min

### 3. Missing Familiarity Records
28+ rehearsals completed in the last 7 days have NULL familiarity records, including:
- "revolution call" - 6 rehearsals totaling ~12 hours
- "Fight them on beaches fight them in the pubs" - 2 rehearsals 
- "Blue - Twelve" - 2 rehearsals (12 hours each)
- Full setlist rehearsal (16 songs) - 4 hours

### 4. Post-Rehearsal Report Enhancement Needed
Current report works but could be enhanced with:
- Better time display for hours remaining to next level
- Color-coded progress bars by level
- Summary of total minutes added across all songs

---

## Implementation Plan

### Phase 1: Fix Stage Calculation Function

**Create new utility file: `src/utils/rehearsalStageCalculation.ts`**

Create a shared function that maps minutes to correct database stage values:

```typescript
export const STAGE_THRESHOLDS = {
  unlearned: { min: 0, max: 59 },
  learning: { min: 60, max: 299 },
  familiar: { min: 300, max: 899 },
  well_rehearsed: { min: 900, max: 1799 },
  perfected: { min: 1800, max: Infinity },
};

export type RehearsalStage = 'unlearned' | 'learning' | 'familiar' | 'well_rehearsed' | 'perfected';

export function calculateRehearsalStage(totalMinutes: number): RehearsalStage {
  if (totalMinutes >= 1800) return 'perfected';
  if (totalMinutes >= 900) return 'well_rehearsed';
  if (totalMinutes >= 300) return 'familiar';
  if (totalMinutes >= 60) return 'learning';
  return 'unlearned';
}
```

### Phase 2: Fix Client-Side Hook

**File: `src/hooks/useAutoRehearsalCompletion.ts`**

Update the stage calculation to use correct values:

```typescript
import { calculateRehearsalStage } from '@/utils/rehearsalStageCalculation';

// Replace the incorrect stage calculation (lines 168-177):
const rehearsalStage = calculateRehearsalStage(newMinutes);
```

### Phase 3: Fix Edge Function

**File: `supabase/functions/complete-rehearsals/index.ts`**

Update the stage calculation to match database constraints:

```typescript
// Replace lines 180-188 with:
function calculateRehearsalStage(totalMinutes: number): string {
  if (totalMinutes >= 1800) return 'perfected';
  if (totalMinutes >= 900) return 'well_rehearsed';
  if (totalMinutes >= 300) return 'familiar';
  if (totalMinutes >= 60) return 'learning';
  return 'unlearned';
}

// Then use:
const rehearsalStage = calculateRehearsalStage(newMinutes);
```

### Phase 4: Retroactively Fix Affected Rehearsals

**New Migration: Backfill missing familiarity records**

Create a migration that processes all completed rehearsals that have NULL familiarity:

```sql
-- Fix missing familiarity records from completed rehearsals
DO $$
DECLARE
  r RECORD;
  song_record RECORD;
  current_minutes INTEGER;
  new_minutes INTEGER;
  minutes_per_song INTEGER;
  calc_stage TEXT;
BEGIN
  -- Process each completed rehearsal with selected_song_id
  FOR r IN 
    SELECT br.id, br.band_id, br.selected_song_id, br.duration_hours
    FROM band_rehearsals br
    LEFT JOIN band_song_familiarity bsf ON bsf.song_id = br.selected_song_id AND bsf.band_id = br.band_id
    WHERE br.status = 'completed'
    AND br.scheduled_end > NOW() - INTERVAL '14 days'
    AND br.selected_song_id IS NOT NULL
    AND bsf.id IS NULL
  LOOP
    minutes_per_song := FLOOR(r.duration_hours * 60);
    
    -- Calculate stage
    IF minutes_per_song >= 1800 THEN calc_stage := 'perfected';
    ELSIF minutes_per_song >= 900 THEN calc_stage := 'well_rehearsed';
    ELSIF minutes_per_song >= 300 THEN calc_stage := 'familiar';
    ELSIF minutes_per_song >= 60 THEN calc_stage := 'learning';
    ELSE calc_stage := 'unlearned';
    END IF;
    
    INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at)
    VALUES (r.band_id, r.selected_song_id, minutes_per_song, calc_stage, NOW())
    ON CONFLICT (band_id, song_id) DO UPDATE SET
      familiarity_minutes = band_song_familiarity.familiarity_minutes + EXCLUDED.familiarity_minutes,
      rehearsal_stage = EXCLUDED.rehearsal_stage,
      last_rehearsed_at = EXCLUDED.last_rehearsed_at,
      updated_at = NOW();
  END LOOP;
  
  -- Process setlist rehearsals
  FOR r IN 
    SELECT br.id, br.band_id, br.setlist_id, br.duration_hours
    FROM band_rehearsals br
    WHERE br.status = 'completed'
    AND br.scheduled_end > NOW() - INTERVAL '14 days'
    AND br.setlist_id IS NOT NULL
  LOOP
    -- Get song count for this setlist
    SELECT COUNT(*) INTO minutes_per_song FROM setlist_songs WHERE setlist_id = r.setlist_id;
    IF minutes_per_song > 0 THEN
      minutes_per_song := FLOOR((r.duration_hours * 60) / minutes_per_song);
    END IF;
    
    -- Process each song in the setlist
    FOR song_record IN 
      SELECT song_id FROM setlist_songs WHERE setlist_id = r.setlist_id AND song_id IS NOT NULL
    LOOP
      -- Get current familiarity
      SELECT COALESCE(familiarity_minutes, 0) INTO current_minutes 
      FROM band_song_familiarity 
      WHERE band_id = r.band_id AND song_id = song_record.song_id;
      
      IF current_minutes IS NULL THEN current_minutes := 0; END IF;
      new_minutes := current_minutes + minutes_per_song;
      
      -- Calculate stage
      IF new_minutes >= 1800 THEN calc_stage := 'perfected';
      ELSIF new_minutes >= 900 THEN calc_stage := 'well_rehearsed';
      ELSIF new_minutes >= 300 THEN calc_stage := 'familiar';
      ELSIF new_minutes >= 60 THEN calc_stage := 'learning';
      ELSE calc_stage := 'unlearned';
      END IF;
      
      INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, rehearsal_stage, last_rehearsed_at)
      VALUES (r.band_id, song_record.song_id, new_minutes, calc_stage, NOW())
      ON CONFLICT (band_id, song_id) DO UPDATE SET
        familiarity_minutes = EXCLUDED.familiarity_minutes,
        rehearsal_stage = EXCLUDED.rehearsal_stage,
        last_rehearsed_at = EXCLUDED.last_rehearsed_at,
        updated_at = NOW();
    END LOOP;
  END LOOP;
END $$;
```

### Phase 5: Enhance Post-Rehearsal Report

**File: `src/components/rehearsal/RehearsalCompletionReport.tsx`**

Add enhancements:
1. Color-coded progress bars by level tier
2. Show hours remaining (not just minutes) for longer waits
3. Add summary footer showing total minutes gained
4. Improve level-up animation

```typescript
// Enhanced time formatting
const formatTimeRemaining = (minutes: number): string => {
  if (minutes >= 120) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

// Color-coded progress bars
const getProgressColor = (levelName: string): string => {
  switch (levelName) {
    case "Perfected": return "bg-purple-500";
    case "Well Rehearsed": return "bg-blue-500";
    case "Familiar": return "bg-green-500";
    case "Learning": return "bg-yellow-500";
    default: return "bg-gray-500";
  }
};

// Add summary footer
const totalMinutesAdded = results.reduce((sum, r) => sum + r.addedMinutes, 0);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/rehearsalStageCalculation.ts` | NEW - Shared stage calculation utility |
| `src/hooks/useAutoRehearsalCompletion.ts` | Fix stage values to use correct DB enum |
| `supabase/functions/complete-rehearsals/index.ts` | Fix stage calculation function |
| `src/components/rehearsal/RehearsalCompletionReport.tsx` | Enhance with color-coding and time formatting |
| `supabase/migrations/xxx_backfill_missing_familiarity.sql` | NEW - Retroactively fix missing records |
| `src/components/VersionHeader.tsx` | Update to v1.0.508 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Database Constraint Verification
The `valid_rehearsal_stage` CHECK constraint only allows:
```sql
CHECK ((rehearsal_stage = ANY (ARRAY[
  'unlearned'::text, 
  'learning'::text, 
  'familiar'::text, 
  'well_rehearsed'::text, 
  'perfected'::text
])))
```

### Level Thresholds (from `rehearsalLevels.ts`)
| Level | Name | Min Minutes | Max Minutes |
|-------|------|-------------|-------------|
| 0 | Unlearned | 0 | 59 |
| 1 | Learning | 60 | 299 |
| 2 | Familiar | 300 | 899 |
| 3 | Well Rehearsed | 900 | 1799 |
| 4 | Perfected | 1800 | ∞ |

### Affected Rehearsals to Backfill
At least 28 rehearsals from the past 7 days need familiarity records created:
- 6 rehearsals for "revolution call" (~12 hours total)
- 2 rehearsals for "Fight them on beaches fight them in the pubs" (~4 hours)
- 12+ rehearsals for "Mr. Blue" band songs (~72 hours)
- 1 full setlist rehearsal with 16 songs (4 hours)

---

## Version History Entry

**v1.0.508**
- Rehearsals: CRITICAL FIX - Song familiarity now updates correctly after rehearsals (fixed database constraint mismatch)
- Rehearsals: Full setlist rehearsals now properly update familiarity for ALL songs in the setlist
- Rehearsals: Enhanced post-rehearsal report with color-coded progress bars, improved time formatting, and summary totals
- Rehearsals: Retroactively fixed ~28 completed rehearsals from the past 2 weeks that were missing familiarity data
- Rehearsals: Added shared stage calculation utility for consistency between client and edge functions

