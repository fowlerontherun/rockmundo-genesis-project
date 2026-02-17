
# Fix: Gig Outcomes Not Reflecting Skill Growth

## Problem
Your skills and attributes are growing, but gig outcomes stay similar because the **edge function that processes gig songs** (`process-gig-song`) uses a static `skill_contribution` column (defaulting to 50) instead of reading your actual skill tree data. It also completely ignores:
- Stage presence and charisma attributes
- Genre skill bonuses
- Equipped gear bonuses
- Improvisation skill (variance reducer)

The client-side code (`gigExecution.ts`) already uses all of these correctly, but the server-side edge function that handles automated gig completions does not.

## Solution
Update the `process-gig-song` edge function to fetch live skill data, matching the client-side calculation.

## Changes

### 1. Update `supabase/functions/process-gig-song/index.ts`

**Replace the static skill lookup** with live skill tree queries:

- Fetch `skill_progress` records for each band member based on their `instrument_role` (using the same role-to-skill mapping as `skillGearPerformance.ts`)
- Fetch equipped gear bonuses from `player_equipment` joined with `equipment_items`
- Fetch player attributes (`stage_presence`, `charisma`) from `profiles`
- Add `stageSkillAverage` to the `PerformanceFactors` interface in the edge function
- Calculate `memberSkillAverage` from live skill tree levels + gear multipliers instead of static `skill_contribution`
- Calculate `stageSkillAverage` from attributes (60% stage_presence + 40% charisma)

**Key code changes:**
- Add a `ROLE_SKILL_MAP` constant mapping roles like "Lead Guitar" to skill slugs like `["guitar", "instruments_basic_electric_guitar"]`
- After fetching band members, look up each member's `profile_id` from `profiles` table
- Query `skill_progress` for matching skill slugs, take the highest level
- Query `player_equipment` for equipped gear with `stat_boosts`
- Apply gear multiplier to skill level (matching `skillGearPerformance.ts` logic)
- Add `stageSkillAverage` field to the `PerformanceFactors` interface
- Update `calculateSongPerformance` in the edge function to incorporate stage skills with a 10% weight (matching the client-side weights)

### 2. Update `supabase/functions/process-gig-song/index.ts` - Performance Calculator

Update the edge function's `calculateSongPerformance` to match the client-side version's weights and factors:

Current (edge function):
```
songQuality: 0.25, rehearsal: 0.20, chemistry: 0.15,
equipment: 0.15, crew: 0.10, memberSkills: 0.15
```

Updated to match client-side:
```
songQuality: 0.25, rehearsal: 0.20, chemistry: 0.15,
equipment: 0.12, crew: 0.08, memberSkills: 0.10, stageSkills: 0.10
```

Also add:
- Song quality normalization from 0-1000 scale to 0-100 (client-side does this, edge function doesn't)
- Member skill normalization from 0-150 to 0-100 range
- Variance, momentum, and improvisation support (matching client-side logic)

### 3. Version Bump to v1.0.829

Update `VersionHeader.tsx` and `VersionHistory.tsx` with changelog entry explaining that gig outcomes now properly scale with skill tree progress, equipped gear, and player attributes.

---

## Technical Details

**Root Cause:** Two separate performance calculators exist -- one client-side (rich, uses live data) and one in the edge function (simplified, uses static data). The edge function path is used for all automated gig completions.

**Files to modify:**
- `supabase/functions/process-gig-song/index.ts` -- main fix: live skill data + updated weights
- `src/components/VersionHeader.tsx` -- version bump
- `src/pages/VersionHistory.tsx` -- changelog

**Impact:** After this fix, every gig (both manual and automated) will reflect your actual skill levels, gear quality, and attributes. Higher skills will directly translate to better performance scores, more fame, more fans, and better grades.
