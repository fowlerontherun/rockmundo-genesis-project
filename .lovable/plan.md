

# Fix Gig Performance: Use Skill Tree + Migrate Song Quality (v1.0.661)

## The Problem

Your gigs are stuck at C/B grades because of three compounding issues:

1. **Band skill calculator reads from the wrong table** -- `bandSkillCalculator.ts` pulls from `player_skills` (legacy table where your levels are 1) instead of `skill_progress` (the skill tree where you've actually been training). This means your `skill_contribution` on band members is nearly zero.

2. **All existing songs are scored 0-100 instead of 0-1000** -- Songs written before v1.0.660 have quality scores like 80, 100 etc. The gig formula divides by 1000, so a song scored 100 only contributes 10% of its potential. Song quality is weighted at 25% of the performance score.

3. **Player attributes (stage presence, charisma, etc.) are ignored** -- You've nearly maxed these but they don't factor into gig calculations at all.

---

## What Will Change

### 1. Rewrite `bandSkillCalculator.ts` to use `skill_progress`

Replace the legacy `player_skills` table lookup with `skill_progress` (the skill tree). Use `ROLE_SKILL_MAP` from `skillGearPerformance.ts` to find the right skills for each band member's instrument role.

- For player members: query `skill_progress` by profile_id, find best matching skill for their `instrument_role`
- For touring members: keep the existing tier-based random skill system
- Role mismatch detection stays but uses skill tree data
- Update `skill_contribution` on `band_members` with the new values

### 2. Migrate existing song quality scores to 0-1000 scale

A one-time database migration that scales all existing songs:
- `quality_score = quality_score * 10` for all songs where `quality_score <= 100`
- This brings old songs in line with the new 1000-point scale

### 3. Add player attributes to gig performance

Update `gigExecution.ts` to fetch player attributes (`stage_presence`, `charisma`, `energy`, `resilience`) from `profiles` and factor them into the performance calculation:

- **Stage presence** feeds into `stageSkillAverage` (currently hardcoded to 50)
- **Charisma** adds a crowd engagement bonus
- These are averaged across band members and applied as modifiers

### 4. Connect `gigExecution.ts` to `skillGearPerformance.ts`

Replace the current approach where `memberSkillAverage` comes from the static `skill_contribution` column. Instead, call `calculateBandSkillAverage()` from `skillGearPerformance.ts` during gig execution to get live skill+gear data.

This means:
- `memberSkillAverage` reflects actual skill tree progress
- `stageSkillAverage` gets real data instead of defaulting to 50
- Gear bonuses are already calculated by this utility

---

## Technical Details

### Files to Modify

**`src/utils/bandSkillCalculator.ts`**
- Replace `player_skills` query with `skill_progress` query
- Use `ROLE_SKILL_MAP` from `skillGearPerformance.ts` for role-to-skill mapping
- Look up profile_id from user_id before querying skill_progress

**`src/utils/gigExecution.ts`**
- Import and call `calculateBandSkillAverage()` instead of reading `skill_contribution` from `band_members`
- Fetch player attributes from `profiles` for all band members
- Calculate `stageSkillAverage` from stage_presence + relevant performance skills
- Pass real skill data to `PerformanceFactors` instead of defaults

**Database migration**
- `UPDATE songs SET quality_score = quality_score * 10 WHERE quality_score IS NOT NULL AND quality_score <= 100;`

**`src/components/VersionHeader.tsx`** -- Bump to v1.0.661

**`src/pages/VersionHistory.tsx`** -- Add changelog entry

### Impact on Grades

With these fixes, the performance formula inputs change dramatically:
- `songQuality`: 100 becomes 1000 (25% weight -- from ~10% effective to ~100%)
- `memberSkillAverage`: 1 becomes your actual skill tree level (10% weight)
- `stageSkillAverage`: 50 default becomes real attribute data (10% weight)
- Combined effect: scores should jump from C/B range into A/S territory for well-prepared gigs with trained skills

