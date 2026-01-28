
# Fix Songwriting Collaborator Invite - Friends Not Showing

## Problem Identified
The collaborator invite dialog in songwriting projects cannot find friends because it's using **non-existent foreign key relationships** to join the `friendships` and `profiles` tables.

### Root Cause
In `CollaboratorInviteDialog.tsx` (lines 120-137), the query uses Supabase foreign key hint syntax:
```typescript
requestor_profile:profiles!friendships_requestor_id_fkey (...)
addressee_profile:profiles!friendships_addressee_id_fkey (...)
```

However, the `friendships` table has **no foreign key constraints** to the `profiles` table (confirmed by database inspection: `Relationships: []`). This causes the profile data to return as `null`, making all friends invisible.

### Why Relationships Page Works
The Relationships page (`src/pages/Relationships.tsx`) uses a different pattern:
1. First fetches friendships (IDs only)
2. Then separately fetches profiles using `fetchProfilesByIds()` 
3. Combines the data in JavaScript

This two-query approach works because it doesn't rely on foreign key joins.

---

## Solution

Rewrite the `fetchPotentialCollaborators` function to use the same pattern as the Relationships page:

### Technical Changes

**File: `src/components/songwriting/CollaboratorInviteDialog.tsx`**

Replace the friendships query (lines 119-153) with a two-step approach:

1. **First Query**: Fetch accepted friendships (IDs only)
```typescript
const { data: friendships } = await supabase
  .from("friendships")
  .select("requestor_id, addressee_id")
  .or(`requestor_id.eq.${userProfileId},addressee_id.eq.${userProfileId}`)
  .eq("status", "accepted");
```

2. **Second Query**: Collect friend profile IDs and fetch profiles separately
```typescript
const friendProfileIds = friendships
  ?.map(f => f.requestor_id === userProfileId ? f.addressee_id : f.requestor_id)
  .filter(id => !collaboratorIds.has(id) && !existingIds.has(id)) || [];

if (friendProfileIds.length > 0) {
  const { data: friendProfiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", friendProfileIds);
  
  friendProfiles?.forEach(profile => {
    if (!collaboratorIds.has(profile.id)) {
      collaboratorIds.add(profile.id);
      results.push({
        id: profile.id,
        username: profile.username || "Unknown",
        avatar_url: profile.avatar_url,
        isBandMember: false,
      });
    }
  });
}
```

---

## Version Update

Increment to **v1.0.565** with changelog entry:
- **Fixed**: Songwriting collaborator invite now correctly shows friends (sable and others will appear when searching)

---

## Testing Verification

After implementation:
1. Open a songwriting project
2. Click "Invite" button
3. Type "sable" in search
4. Should see "sable-rebel-the-catalyst" appear in results
5. Should be able to select and invite the friend

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/songwriting/CollaboratorInviteDialog.tsx` | Fix friendships query to use two-step fetch pattern |
| `src/components/VersionHeader.tsx` | Update to v1.0.565 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |
