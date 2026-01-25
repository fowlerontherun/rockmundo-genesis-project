
# Rehearsal System Bug Fixes

## Version: 1.0.506

## Overview
This update fixes three critical issues with the rehearsal system: the post-rehearsal report not displaying, song familiarity not being updated, and improved error messaging for scheduling conflicts.

---

## Issues Found

### 1. Rehearsal Completion Report Not Showing
The `RehearsalCompletionReport` component exists but is **never rendered**. The `useAutoRehearsalCompletion` hook in `Layout.tsx` returns `pendingReport` data but nothing displays it.

### 2. Song Familiarity Not Updating
Despite rehearsals completing, the `band_song_familiarity` table isn't being updated. The client-side hook attempts updates but they fail silently. The edge function also runs but doesn't appear to be creating/updating records.

Root causes identified:
- The client-side hook may be failing due to RLS policies (INSERT policy has no `qual` check which could be an issue)
- The edge function logs show success but no actual database changes occur

### 3. Scheduling Conflict Messages
The current system correctly filters out touring members, but doesn't clearly explain when the user themselves has a conflict. The error message could be clearer.

---

## Implementation Plan

### Phase 1: Render the Rehearsal Completion Report

**File: `src/components/Layout.tsx`**

Update to actually use the `pendingReport` from `useAutoRehearsalCompletion` and render the `RehearsalCompletionReport` dialog:

```typescript
// Get the pending report data from the hook
const { pendingReport, clearPendingReport } = useAutoRehearsalCompletion(user?.id || null);

// ... in the JSX return:
{pendingReport && (
  <RehearsalCompletionReport
    open={!!pendingReport}
    onClose={clearPendingReport}
    results={pendingReport.results}
    chemistryGain={pendingReport.chemistryGain}
    xpGained={pendingReport.xpGained}
    durationHours={pendingReport.durationHours}
  />
)}
```

### Phase 2: Fix Familiarity Updates in Edge Function

**File: `supabase/functions/complete-rehearsals/index.ts`**

The edge function logic looks correct but may have silent failures. Add more robust error handling and logging:

1. Add detailed logging for each familiarity update attempt
2. Add explicit error checking after upsert operations
3. Ensure the upsert uses the correct conflict resolution

Also verify the columns match the table schema exactly:
- `band_id`, `song_id`, `familiarity_minutes`, `last_rehearsed_at`, `updated_at`, `rehearsal_stage`

### Phase 3: Fix Client-Side Familiarity Updates

**File: `src/hooks/useAutoRehearsalCompletion.ts`**

The client-side hook has issues with the upsert logic. Problems identified:
1. Using `update` by `id` requires fetching the existing record's ID first
2. Upsert may be failing due to constraint issues

Fix by using proper upsert with conflict resolution:

```typescript
// Instead of separate update/insert, use upsert properly
const { error: upsertError } = await supabase
  .from('band_song_familiarity')
  .upsert(
    {
      band_id: rehearsal.band_id,
      song_id: songId,
      familiarity_minutes: newMinutes,
      last_rehearsed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'band_id,song_id',
      ignoreDuplicates: false,
    }
  );
```

### Phase 4: Improve Conflict Error Messages

**File: `src/utils/bandActivityScheduling.ts`**

Update `formatConflictMessage` to be clearer when the user themselves is the one with a conflict:

```typescript
export function formatConflictMessage(conflicts: ConflictInfo[], currentUserName?: string): string {
  if (conflicts.length === 0) return '';
  
  if (conflicts.length === 1) {
    const conflict = conflicts[0];
    // Highlight if it's the current user
    const isYou = conflict.userName === currentUserName;
    const name = isYou ? 'You have' : `${conflict.userName} has`;
    return `${name} "${conflict.activityTitle}" scheduled at this time.`;
  }
  
  const names = conflicts.map(c => c.userName).join(', ');
  return `Multiple band members have scheduling conflicts: ${names}`;
}
```

### Phase 5: Add Database RLS Policy Fix

**New Migration File**

Ensure the INSERT policy for `band_song_familiarity` has proper conditions:

```sql
-- Drop existing insert policy and recreate with proper conditions
DROP POLICY IF EXISTS "Band members can update their song familiarity" ON band_song_familiarity;

CREATE POLICY "Band members can insert song familiarity"
ON band_song_familiarity
FOR INSERT
TO public
WITH CHECK (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Layout.tsx` | Render RehearsalCompletionReport when pendingReport exists |
| `src/hooks/useAutoRehearsalCompletion.ts` | Fix upsert logic for familiarity updates |
| `supabase/functions/complete-rehearsals/index.ts` | Add better error logging, verify upsert logic |
| `src/utils/bandActivityScheduling.ts` | Improve conflict message clarity |
| `supabase/migrations/xxx_fix_familiarity_rls.sql` | Fix INSERT policy |
| `src/components/VersionHeader.tsx` | Update to v1.0.506 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Why Familiarity Updates Fail
The current client-side logic does:
1. Fetch existing record by `band_id` + `song_id`
2. If exists, update by `id`
3. If not exists, insert new

This should work, but if the upsert is failing, it's likely because:
- The RLS INSERT policy's missing `WITH CHECK` clause
- The upsert `onConflict` isn't matching the actual unique constraint name

### Database Constraint
The `band_song_familiarity` table has a unique constraint on `(band_id, song_id)`. Upsert operations need to specify this correctly.

---

## Version History Entry

**v1.0.506**
- Rehearsals: Fixed post-rehearsal completion report not displaying - now shows song progress and level-up information
- Rehearsals: Fixed song familiarity not updating after rehearsals - corrected upsert logic and RLS policies
- Rehearsals: Improved scheduling conflict error messages for clearer feedback
- Rehearsals: Added detailed logging to edge function for debugging familiarity updates
