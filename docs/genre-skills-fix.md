# Genre Skills System - Fixed

## Problem Summary
Music genres were broken throughout the game because:
1. **Genre skills didn't exist in the database** - The `skill_definitions` table was empty of genre skills
2. **Duplicate creation potential** - University attendance used `INSERT` instead of `UPSERT` for skill progress
3. **No validation** - No way to verify genre skills were properly configured

## Solutions Implemented

### 1. Database Migration - Genre Skills Population
Created migration to populate all 93 genre skills (31 genres × 3 tiers):
- Basic tier: 10+ skill level unlocks genre for songwriting
- Professional tier: 50+ skill level for advanced production
- Mastery tier: 100+ skill level for genre innovation

**Genre Skills Created:**
- Rock, Pop, Hip Hop, Jazz, Blues, Country, Reggae, Heavy Metal
- Classical, Electronica, Latin, World Music, R&B, Punk Rock
- Flamenco, African Music, Modern Rock, EDM, Trap, Drill
- Lo-Fi Hip Hop, K-Pop/J-Pop, Afrobeats/Amapiano, Synthwave
- Indie/Bedroom Pop, Hyperpop, Metalcore/Djent, Alt R&B/Neo-Soul

Each genre has 3 skill tiers with proper parent-child relationships:
- `genres_basic_{genre}` → `genres_professional_{genre}` → `genres_mastery_{genre}`

### 2. Fixed Duplicate Skill Creation
**Fixed `university-attendance` edge function:**
- Changed `INSERT` to `UPSERT` with conflict resolution on `(profile_id, skill_slug)`
- Prevents duplicate skill progress entries

**Already Correct:**
- ✅ `book-reading-attendance` - uses `upsert`
- ✅ `progression/handlers.ts` - uses `upsert`

### 3. Created Validation Utilities
**New file: `src/utils/genreValidation.ts`**
- `validateGenreSkills()` - Checks all genre skills exist in database
- `hasGenreSkill()` - Helper to check player genre skill levels

## How It Works Now

### Songwriting System
1. Player learns a genre through University, Books, or Mentors
2. Skill progress is tracked in `skill_progress` table  
3. `canWriteGenre()` checks if player has `genres_basic_{genre}` at level 10+
4. Available genres filter automatically based on player skills
5. Song quality calculation uses genre skill level as multiplier

### University/Book Learning
1. Courses/Books target specific genre skills (e.g., `genres_basic_rock`)
2. Attendance/Reading sessions award XP to that skill
3. Skill progress uses `UPSERT` - no duplicates created
4. XP accumulates, levels up skill, unlocks higher tiers

### Venues & Radio Stations
1. Admin can configure venues with supported genres
2. Genres come from `MUSIC_GENRES` constant
3. All genres map to their skill slugs via `getGenreSkillSlug()`
4. Genre skills properly track player proficiency

## Verification

Run this to check genre skills in database:
\`\`\`sql
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN slug LIKE 'genres_basic_%' THEN 1 END) as basic,
       COUNT(CASE WHEN slug LIKE 'genres_professional_%' THEN 1 END) as professional,
       COUNT(CASE WHEN slug LIKE 'genres_mastery_%' THEN 1 END) as mastery
FROM skill_definitions 
WHERE slug LIKE 'genres_%';
\`\`\`

Expected: ~84-93 total genre skills (28-31 per tier)

## Migrations Applied
1. **Genre Skills Population** - `20251028-060406-083977`
   - Tables modified: `skill_definitions`, `skill_parent_links`
   - Status: ✅ Deployed and Active

2. **Duplicate Cleanup & Constraint** - `20251029-[timestamp]`
   - Removed duplicate skill progress entries
   - Added unique constraint: `skill_progress_profile_skill_unique`
   - Prevents future duplicates at database level
   - Status: ✅ Deployed and Active
