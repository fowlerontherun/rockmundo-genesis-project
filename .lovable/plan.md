

# Rehearsal System - Level & Time Tracking Fix
**Version: 1.0.580**

## Problem Analysis

Based on code review, I've identified **5 critical issues** causing incorrect rehearsal level updates and time mismatches:

---

### Issue 1: Conflicting Threshold Systems

**Current State:** The codebase has **3 different threshold systems** that don't align:

| Location | Thresholds | Problem |
|----------|------------|---------|
| **Database Trigger** (`update_rehearsal_stage`) | 60/300/900/1800 min | Correct - used for auto-calculating stage |
| **`rehearsalLevels.ts`** (UI) | 60/300/900/1800 min | Correct - matches database |
| **`RehearsalsTab.tsx` (Manual complete)** | Uses percentage: 30%/60%/90% of 600 min | **WRONG** - uses 'mastered'/'practicing' which violate DB constraint! |

**Code with Bug (lines 274-282):**
```typescript
// RehearsalsTab.tsx - Using INVALID stage values!
let rehearsalStage = 'learning';
if (calculatedPercentage >= 90) {
  rehearsalStage = 'mastered';      // INVALID - constraint allows only 'perfected'
} else if (calculatedPercentage >= 60) {
  rehearsalStage = 'familiar';
} else if (calculatedPercentage >= 30) {
  rehearsalStage = 'practicing';    // INVALID - constraint allows only 'learning'
}
```

**Database Constraint:**
```sql
CHECK (rehearsal_stage IN ('unlearned', 'learning', 'familiar', 'well_rehearsed', 'perfected'))
```

This causes silent failures or constraint violations when manually completing rehearsals!

---

### Issue 2: User Expectation Mismatch

**User Expectation:** 
- 4 hours = Fully Learned (Familiar)
- 6 hours = Perfected

**Current Thresholds:**
- 1 hour (60 min) = Learning
- 5 hours (300 min) = Familiar  
- 15 hours (900 min) = Well Rehearsed
- 30 hours (1800 min) = Perfected

**Gap:** Current system requires **30 hours** to perfect a song, but user expects **6 hours**.

---

### Issue 3: Percentage Calculation Mismatch

**Database Generated Column:**
```sql
familiarity_percentage = LEAST(100, (familiarity_minutes * 100) / 600)
```
This makes 100% = 600 minutes (10 hours).

**But the level system uses 1800 minutes for "Perfected"!**

Songs show 100% progress but are only "Familiar" stage - confusing users.

---

### Issue 4: Setlist Rehearsal Time Split

When rehearsing a **full setlist**, time is split across all songs:
```typescript
const minutesPerSong = Math.floor(durationMinutes / songsToUpdate.length);
```

A 4-hour rehearsal with 10 songs = only 24 minutes per song, meaning songs barely progress. This may be intentional but needs clearer UI feedback.

---

### Issue 5: Multiple Completion Paths

There are **3 different code paths** for completing rehearsals:
1. `useAutoRehearsalCompletion.ts` - Auto-completion hook (uses correct stages)
2. `complete-rehearsals` edge function - Cron job (uses correct stages)
3. `RehearsalsTab.tsx` - Manual "Complete Rehearsal" button (uses WRONG stages)

Each has slightly different logic, causing inconsistencies.

---

## Proposed Solution

### Part 1: Align Thresholds to User Expectations

Update all threshold systems to match user expectations (4h learned, 6h perfected):

| Stage | Old (minutes) | New (minutes) |
|-------|---------------|---------------|
| Unlearned | 0-59 | 0-59 |
| Learning | 60-299 | 60-179 (1-3 hours) |
| Familiar | 300-899 | 180-299 (3-5 hours) |
| Well Rehearsed | 900-1799 | 300-359 (5-6 hours) |
| Perfected | 1800+ | 360+ (6+ hours) |

**Note:** This is a significant change from 30h to 6h for Perfected. If you prefer the original longer progression, I can instead update only the UI messaging to clarify the expected time investment.

### Part 2: Fix Invalid Stage Values

Update `RehearsalsTab.tsx` to use the shared utility:

```typescript
import { calculateRehearsalStage } from '@/utils/rehearsalStageCalculation';

// Replace lines 274-282 with:
const rehearsalStage = calculateRehearsalStage(newMinutes);
```

### Part 3: Align Percentage Calculation

Update the database generated column to match the stage thresholds:
- 100% should equal "Perfected" threshold (either 360 or 1800 minutes)

### Part 4: Consolidate Completion Logic

Create a single shared function for all rehearsal completion paths:

| File | Change |
|------|--------|
| `src/utils/rehearsalCompletion.ts` | New shared completion logic |
| `RehearsalsTab.tsx` | Use shared function |
| `useAutoRehearsalCompletion.ts` | Use shared function |
| `complete-rehearsals/index.ts` | Use same threshold constants |

### Part 5: Improve UI Feedback for Setlist Rehearsals

Add clearer messaging about time distribution:
- "4h rehearsal for 10-song setlist = 24 min per song"
- Show expected progress per song before booking

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/rehearsalLevels.ts` | Adjust thresholds |
| `src/utils/rehearsalStageCalculation.ts` | Adjust thresholds |
| `src/components/performance/RehearsalsTab.tsx` | Fix invalid stage values, use shared utility |
| `supabase/migrations/[new].sql` | Update DB trigger thresholds + percentage calculation |
| `supabase/functions/complete-rehearsals/index.ts` | Align with new thresholds |
| `src/components/performance/RehearsalBookingDialog.tsx` | Add setlist time-split info |
| `src/components/VersionHeader.tsx` | Version bump |
| `src/pages/VersionHistory.tsx` | Changelog |

---

## Technical Details

### New Threshold Constants

```typescript
// src/utils/rehearsalLevels.ts
export const REHEARSAL_LEVELS: RehearsalLevel[] = [
  { level: 0, name: "Unlearned", minMinutes: 0, maxMinutes: 59 },
  { level: 1, name: "Learning", minMinutes: 60, maxMinutes: 179 },      // 1-3 hours
  { level: 2, name: "Familiar", minMinutes: 180, maxMinutes: 299 },     // 3-5 hours  
  { level: 3, name: "Well Rehearsed", minMinutes: 300, maxMinutes: 359 }, // 5-6 hours
  { level: 4, name: "Perfected", minMinutes: 360, maxMinutes: null },   // 6+ hours
];
```

### Database Migration

```sql
-- Update trigger function with new thresholds
CREATE OR REPLACE FUNCTION update_rehearsal_stage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.rehearsal_stage := CASE
    WHEN NEW.familiarity_minutes >= 360 THEN 'perfected'
    WHEN NEW.familiarity_minutes >= 300 THEN 'well_rehearsed'
    WHEN NEW.familiarity_minutes >= 180 THEN 'familiar'
    WHEN NEW.familiarity_minutes >= 60 THEN 'learning'
    ELSE 'unlearned'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update percentage calculation (100% at 360 minutes = 6 hours)
ALTER TABLE band_song_familiarity 
DROP COLUMN familiarity_percentage;

ALTER TABLE band_song_familiarity 
ADD COLUMN familiarity_percentage integer 
GENERATED ALWAYS AS (LEAST(100, (familiarity_minutes * 100) / 360)) STORED;

-- Recalculate all existing records
UPDATE band_song_familiarity SET familiarity_minutes = familiarity_minutes;
```

---

## Summary

| Issue | Fix |
|-------|-----|
| Invalid stage names ('mastered', 'practicing') | Use shared `calculateRehearsalStage()` utility |
| 30h for Perfected vs user expecting 6h | Reduce thresholds to 6h for Perfected |
| Percentage shows 100% before Perfected | Align percentage calculation with stage thresholds |
| Inconsistent completion logic | Consolidate into shared utility |
| Unclear setlist time-split | Add UI feedback in booking dialog |

