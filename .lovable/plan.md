
# Music Video System Complete Fix + Company Deposits Access

## Version: 1.0.502

## Overview
This update fixes critical bugs in the music video system preventing song detection and ensures the full video pipeline works end-to-end. Additionally, it improves access to company deposit/withdraw functionality.

---

## Issues Identified

### Music Videos - Critical Bugs

| Bug | Location | Root Cause |
|-----|----------|------------|
| "No Recorded Songs Found" always shows | `MusicVideos.tsx:126` | Using `profile.id` (profiles table PK) instead of `profile.user_id` (auth user id) when querying `band_members` table |
| Solo songs not found | `MusicVideos.tsx:156` | Same issue - `songs.user_id` expects auth user id, not profile table id |
| Releases not found | `MusicVideos.tsx:190` | Same issue - `releases.user_id` expects auth user id |
| Wrong release lookup | `MusicVideos.tsx:203` | Code matches `release.id === rs.song_id` but should be matching via `release_id` from `release_songs` table |

### Company Deposits - Accessibility
The deposit/withdraw functionality exists but is buried in the CompanyDetail page's Finances tab. Users need clearer access points.

---

## Implementation Plan

### Phase 1: Fix Music Video Song Detection (Critical)

**File: `src/pages/MusicVideos.tsx`**

Fix all occurrences of `profile.id` to use `profile.user_id`:

1. **Line 126**: Change band_members query
   ```typescript
   // BEFORE
   .eq("user_id", profile.id)
   
   // AFTER
   .eq("user_id", profile.user_id)
   ```

2. **Line 156**: Change user-owned songs query
   ```typescript
   // BEFORE
   .eq("user_id", profile.id)
   
   // AFTER
   .eq("user_id", profile.user_id)
   ```

3. **Line 190**: Change releases query
   ```typescript
   // BEFORE
   .eq("user_id", profile.id)
   
   // AFTER  
   .eq("user_id", profile.user_id)
   ```

4. **Line 197**: Include `release_id` in the select statement
   ```typescript
   // BEFORE
   .select("song_id, songs(id, title, band_id, status)")
   
   // AFTER
   .select("song_id, release_id, songs(id, title, band_id, status)")
   ```

5. **Line 203**: Fix release lookup logic
   ```typescript
   // BEFORE
   const release = userReleases.find(r => r.id === rs.song_id);
   
   // AFTER
   const release = userReleases.find(r => r.id === rs.release_id);
   ```

6. **Line 217**: Update enabled condition
   ```typescript
   // BEFORE
   enabled: !!profile?.id
   
   // AFTER
   enabled: !!profile?.user_id
   ```

### Phase 2: Verify Video Production & View Simulation

The edge functions `complete-video-production` and `simulate-video-views` are correctly implemented. They:
- Run on cron schedules to process videos
- Transition videos from "production" → "released" based on budget-time calculation
- Simulate daily views with viral chances
- Credit earnings to player cash and band balance
- Update hype scores and fame

**Verification needed**: Check if cron jobs are scheduled in the database. If not, ensure they're registered.

### Phase 3: Improve Company Finance Access

**Add quick-access finance button to CompanyCard:**

Update `src/components/company/CompanyCard.tsx` to add a "Finance" quick-action button alongside "Manage":

```typescript
<Button 
  variant="outline" 
  size="sm" 
  onClick={(e) => {
    e.stopPropagation();
    setFinanceDialogOpen(true);
  }}
>
  <Wallet className="h-4 w-4 mr-1" />
  Finance
</Button>
```

Import and render `CompanyFinanceDialog` in the card component.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MusicVideos.tsx` | Fix 6 instances of profile.id → profile.user_id, fix release_id lookup |
| `src/components/company/CompanyCard.tsx` | Add inline finance dialog access |
| `src/components/VersionHeader.tsx` | Update to v1.0.502 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Profile ID vs User ID Distinction

The `profiles` table has two important ID fields:
- `id` (UUID): Primary key of the profiles table - used for internal table relationships
- `user_id` (UUID): Foreign key to `auth.users` - this is the user's authentication ID

Most game-related tables (`band_members`, `songs`, `releases`, `activity_feed`) use `user_id` to link to users, NOT `profiles.id`.

When using `useGameData()`:
- `profile.id` = profiles table primary key (rarely needed)
- `profile.user_id` = auth user id (used for most queries)

### Video Production Timeline

| Budget | Production Time |
|--------|-----------------|
| $50,000+ | 6 hours |
| $25,000+ | 12 hours |
| $10,000+ | 24 hours |
| $5,000+ | 36 hours |
| < $5,000 | 48 hours |

Videos automatically transition to "released" status when production time elapses.

---

## Version History Entry

**v1.0.502**
- Music Videos: Fixed critical bug where no recorded songs were found - was using wrong profile ID field
- Music Videos: Fixed release song lookup to correctly match by release_id
- Music Videos: Songs with "recorded" status now properly appear in the video creation dialog
- Companies: Added quick "Finance" button to company cards for easier deposit/withdraw access
