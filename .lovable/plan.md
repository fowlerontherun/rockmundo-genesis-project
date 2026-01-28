
# Multi-Bug Fix Plan - v1.0.555

## Summary

This plan addresses 7 distinct bugs reported by the user across different game systems. I've analyzed each issue and identified root causes ranging from database schema mismatches to missing activity scheduling integration.

---

## Bug 1: Songwriting Doesn't Block Players or Show in Schedule

### Root Cause
The `useSongwritingData.tsx` hook starts songwriting sessions by locking projects but **never creates entries in `player_scheduled_activities`**. The schedule system (`useScheduledActivities.ts`) only fetches from that table plus a few specific sources (gigs, rehearsals, recordings, travel), but songwriting is not included.

### Fix
Modify `startSession` mutation in `useSongwritingData.tsx` to:
1. Create a `player_scheduled_activities` entry with `activity_type: 'songwriting'`
2. Include the project details in the activity metadata
3. Set proper `scheduled_start` and `scheduled_end` times (1-hour duration)

```text
Location: src/hooks/useSongwritingData.tsx
Changes:
- In startSession mutation, after locking the project, INSERT into player_scheduled_activities
- Add conflict check using check_scheduling_conflict RPC before starting
```

---

## Bug 2: Gigs Not Showing in Schedule

### Root Cause
The gigs query in `useScheduledActivities.ts` uses timezone-based date comparison that can miss gigs. The query filters `scheduled_date` between start and end of day in UTC, but gig dates may be stored in local time.

### Current problematic code (lines 117-126):
```typescript
.gte('scheduled_date', `${dateString}T00:00:00.000Z`)
.lt('scheduled_date', `${dateString}T23:59:59.999Z`)
```

### Fix
Use PostgreSQL's date casting for reliable timezone-independent comparison:
```typescript
.gte('scheduled_date::date', dateString)
.lte('scheduled_date::date', dateString)
```

Or use a raw SQL filter with proper date casting.

---

## Bug 3: Inviting Players to Songwriting Returns No Players

### Root Cause
**Critical schema mismatch!** The `CollaboratorInviteDialog.tsx` queries the `friendships` table using columns `user_id` and `friend_id`, but the actual database schema uses:
- `requestor_id` (not `user_id`)
- `addressee_id` (not `friend_id`)

Additionally, the FK relationship hints used in the query (`friendships_friend_id_fkey`, `friendships_user_id_fkey`) don't exist because those columns don't exist.

### Fix
Update `CollaboratorInviteDialog.tsx` lines 110-127 to use correct column names:
```typescript
const { data: friendships } = await supabase
  .from("friendships")
  .select(`
    requestor_id,
    addressee_id,
    requestor_profile:profiles!friendships_requestor_id_fkey (
      id, username, avatar_url
    ),
    addressee_profile:profiles!friendships_addressee_id_fkey (
      id, username, avatar_url
    )
  `)
  .or(`requestor_id.eq.${userProfileId},addressee_id.eq.${userProfileId}`)
  .eq("status", "accepted");
```

Also need to get user's `profile.id` (not `user.id`) for the comparison.

---

## Bug 4: Company Types Have Issues/Errors

### Root Cause
The `create_subsidiary_entity()` trigger function was recently fixed but some edge cases may still exist. The trigger creates subsidiary entity records (labels, venues, studios, etc.) when a company is created, but errors in the trigger are caught and logged as warnings without failing.

### Fix
1. Verify the trigger is functioning correctly by testing company creation
2. Add explicit error handling in the frontend `useCreateCompany` hook to check if the subsidiary entity was created
3. Add a post-creation verification step that queries the subsidiary table and shows a warning if the entity wasn't created

---

## Bug 5: Cron Jobs Are Failing

### Analysis
From the cron_job_runs query, I see most jobs are succeeding but one has errors:
- `update-daily-streams`: Shows `error_count: 187` with 0 processed

### Fix
1. Check the `update-daily-streams` edge function logs for specific error messages
2. Common causes: RLS policy blocking service role, missing data, timeout issues
3. Add better error handling and batch processing to prevent timeout failures

---

## Bug 6: Admin Record Sales Options Don't Save

### Root Cause
The `game_balance_config` table query shows **no entries for category 'sales'**. The save mutation uses `upsert` with `onConflict: "category,key"`, but this requires a unique constraint on those columns.

Verified the table structure has: `id, category, key, value, description, min_value, max_value, unit, created_at, updated_at`

### Fix
1. Verify unique constraint exists on `(category, key)`
2. If missing, create the constraint via migration
3. Add RLS policy allowing authenticated admins to INSERT/UPDATE (current policy only allows `service_role`)

The current policy is:
```sql
ALL policyname:Service role can modify game balance qual:true
```

This only allows service role, not authenticated admins. Need to add admin policy.

---

## Bug 7: Elections and Mayor Rules Don't Save

### Root Cause
The `city_laws` update policy is:
```sql
UPDATE: Only mayors can update their city laws
QUAL: EXISTS (SELECT 1 FROM city_mayors cm 
  WHERE cm.id = city_laws.enacted_by_mayor_id 
  AND cm.profile_id = (profile for auth.uid()) 
  AND cm.is_current = true)
```

**The problem:** This policy checks if `enacted_by_mayor_id` matches the current mayor, but for newly created city_laws records, `enacted_by_mayor_id` might be NULL or set to a different value. A mayor can only update laws that were **already enacted by them**.

Additionally, when querying `city_laws`, there may be no active laws record (query returned empty), so there's nothing to update.

### Fix
1. Modify the RLS policy to check if the authenticated user is the current mayor of the city, regardless of who enacted the previous law:
```sql
EXISTS (SELECT 1 FROM city_mayors cm 
  WHERE cm.city_id = city_laws.city_id 
  AND cm.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) 
  AND cm.is_current = true)
```

2. Ensure default city laws are created for cities that don't have any

---

## Implementation Order

1. **Bug 3 (Collaborator Invite)** - Simple column name fix
2. **Bug 7 (Mayor Laws)** - RLS policy fix via migration
3. **Bug 6 (Sales Config)** - RLS policy + constraint fix via migration
4. **Bug 1 (Songwriting Schedule)** - Add scheduled activity creation
5. **Bug 2 (Gigs Schedule)** - Fix date comparison
6. **Bug 4 & 5 (Company/Cron)** - Verify and add error handling

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/songwriting/CollaboratorInviteDialog.tsx` | Fix column names: `requestor_id`/`addressee_id` instead of `user_id`/`friend_id` |
| `src/hooks/useSongwritingData.tsx` | Add `player_scheduled_activities` insert in `startSession` |
| `src/hooks/useScheduledActivities.ts` | Fix gig date filtering for timezone robustness |
| New migration file | Fix `city_laws` UPDATE policy, add `game_balance_config` admin policy, add unique constraint |
| `src/components/VersionHeader.tsx` | Update to v1.0.555 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Migration SQL for RLS fixes:
```sql
-- Fix city_laws UPDATE policy
DROP POLICY IF EXISTS "Only mayors can update their city laws" ON city_laws;
CREATE POLICY "Current mayors can update city laws" ON city_laws
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM city_mayors cm 
    WHERE cm.city_id = city_laws.city_id 
    AND cm.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) 
    AND cm.is_current = true
  )
);

-- Add unique constraint for game_balance_config if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'game_balance_config_category_key_key'
  ) THEN
    ALTER TABLE game_balance_config 
    ADD CONSTRAINT game_balance_config_category_key_key UNIQUE (category, key);
  END IF;
END $$;

-- Add admin write policy for game_balance_config
CREATE POLICY "Admins can write game balance config" ON game_balance_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);
```

---

## Expected Outcome

After implementation:
- Songwriting sessions appear in the schedule and properly block conflicting activities
- Gigs show reliably regardless of timezone differences
- Collaborator invitations show band members and friends correctly
- Mayors can successfully save law changes
- Admin sales balance configuration persists correctly
- Company subsidiary creation is more robust with proper error feedback
