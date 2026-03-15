

## Plan: Profile-Based Character Isolation Audit

### Problem
Most game data queries filter by `user_id` (the auth user), meaning all characters under one account share the same data — schedules, bands, achievements, addictions, songs, hospitalizations, etc. Only a handful of tables have been migrated to use `profile_id`.

### Scope Assessment
There are **73 hook files**, **34 component files**, and **30 page files** that query character-specific tables using `user_id`. This is a ~200-file refactor.

### Two Categories of Queries

**Category A — Queries on `profiles` table by `user_id`**: These are correct in principle, but many are missing `is_active` and `died_at` filters, so they may return the wrong character's profile data. These need the active profile filter added.

**Category B — Queries on character-specific tables by `user_id`**: These need to be changed to filter by `profile_id` instead. Many of these tables may not yet have a `profile_id` column in the database.

### Implementation Strategy

Due to the massive scope, this will be done in **prioritized phases**. Each phase focuses on the most impactful systems.

---

#### Phase 1: Create a shared `useActiveProfile()` helper hook
A small hook that returns the active profile for the current user. This avoids repeating the `profiles` lookup in every file.

```text
useActiveProfile() → { profileId, profile, isLoading }
  └─ SELECT id FROM profiles WHERE user_id = ? AND is_active = true AND died_at IS NULL
```

#### Phase 2: Database migration — Add `profile_id` to tables that lack it
Add `profile_id` column (with FK to `profiles.id`) to these critical tables (checking which already have it):

- `player_scheduled_activities` (may already have it)
- `activity_feed` (may already have it)
- `band_members` (done)
- `player_achievements`
- `player_addictions`
- `player_conditions`
- `player_hospitalizations`
- `player_imprisonments` / `player_criminal_record`
- `songs`
- `music_videos`
- `radio_submissions`
- `player_events`
- `lottery_tickets`
- `player_skill_books`
- `player_housing`
- `media_facilities` / `media_shows`
- `underworld_purchases`
- `player_investments` / `player_loans`
- `festival_attendance`
- `twaats`
- `song_auctions`

Backfill existing rows by joining on `user_id` → active profile.

#### Phase 3: Update hooks (highest-impact files first)

**Tier 1 — Core gameplay hooks** (most visible to player):
- `useGameData.tsx` — activity_feed queries
- `useScheduledActivities.ts` — already partially done
- `usePrimaryBand.ts` / `useUserBand.ts` — already done
- `useHospitalization.ts`
- `useAddictions.ts` / `useConditions.ts`
- `usePlayerEvents.ts`
- `useLottery.ts`
- `useMusicVideos.ts`
- `useFinances.ts`
- `useTravelStatus.ts`

**Tier 2 — Social/content hooks**:
- `useRadioStations.ts` / `useRadioSubmissions.ts`
- `useTwaats.ts` / `useTwaaterAccount.ts`
- `useSongwritingData.tsx`
- `useRecordingData.tsx`
- `useHousing.ts`
- `useCasino.ts`

**Tier 3 — Secondary systems**:
- `usePrisonStatus.ts`
- `useSkillBooksInventory.ts`
- `useUnderworldInventory.ts` / `useUnderworldStore.ts`
- `useMediaFacilities.ts`
- `useFestivalAttendance.ts`
- `useVipStatus.ts`
- Remaining hooks

#### Phase 4: Update components and pages
Apply the same `profile_id` pattern to:
- `DashboardOverviewTabs.tsx`, `CareerStats.tsx`, `MusicStats.tsx`
- `FestivalBrowser.tsx`, `BuskingTab.tsx`
- `TwaaterComposer.tsx`, link dialogs
- `PerformanceBooking.tsx`, `SongwritingBooking.tsx`
- `SongManager.tsx`, `Radio.tsx`, `Travel.tsx`
- Finance components (`LoansTab`, `InvestmentsTab`)
- All remaining components querying by `user_id`

#### Phase 5: Update utility functions
- `bandMembers.ts` — `leaveBand()`, `transferLeadership()` still use `user_id`
- `bandRoyalties.ts`
- `gameCalendar.ts`
- Other utils

### Pattern for each file change

Before:
```typescript
const { data } = await supabase
  .from("some_table")
  .select("*")
  .eq("user_id", user.id);
```

After (using the shared helper):
```typescript
const { profileId } = useActiveProfile();
const { data } = await supabase
  .from("some_table")
  .select("*")
  .eq("profile_id", profileId);
```

For `profiles` table queries that fetch cash/health/etc., replace:
```typescript
.from("profiles").select("cash").eq("user_id", user.id).single()
```
With:
```typescript
.from("profiles").select("cash").eq("id", profileId).single()
```

### Risk Mitigation
- Tables without `profile_id` column will error — the migration MUST run first
- Backfill uses active profile, so historical data for dead characters may be lost (acceptable)
- RLS policies on new `profile_id` columns need review

### Estimated scope
- 1 new hook (`useActiveProfile`)
- 1 large database migration (20+ tables)
- ~100+ file edits across hooks, components, pages, and utils

