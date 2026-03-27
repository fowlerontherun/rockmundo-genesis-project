

## Fix Dead Player Login Flow & Add Resurrection System (v1.1.122)

### Root Cause

117 out of 121 players are dead from inactivity. The resurrection system migration **was never applied** to the database — the `resurrection_lives` column doesn't exist on `profiles`, and `lives_remaining_at_death` doesn't exist on `hall_of_immortals`. This causes:

1. **Dead characters query crashes** — `useCharacterDeath` selects `lives_remaining_at_death` from `hall_of_immortals`, but that column doesn't exist. The query throws an error, so `deadCharacters` stays empty.
2. **Death screen never shows** — Since `deadCharacters.length === 0`, the death screen in Index.tsx is skipped.
3. **Navigation stalls** — The redirect logic on line 51 requires `profile` to be truthy, but dead players have no active profile. Players get stuck on a spinner or somehow reach CreateCharacter which fails due to slot limits.

### Plan

#### 1. Database migration — add resurrection columns and backfill
Create a new migration that:
- Adds `resurrection_lives` (integer, default 3) to `profiles`
- Adds `lives_remaining_at_death` (integer, default 0) to `hall_of_immortals`
- **Backfills all 117 dead profiles** with `resurrection_lives = 3` so every dead player can resurrect
- Creates the `resurrect_character()` RPC function (security definer) that: clears `died_at`, restores health/energy to 50, deducts 1 life, sets `is_active = true`
- Grants execute to authenticated users

#### 2. Fix `useCharacterDeath.ts` — handle missing column gracefully
- Remove `lives_remaining_at_death` from the `hall_of_immortals` select query initially (use a safe fallback)
- Instead, query `resurrection_lives` directly from the dead profile in `profiles` table (since the profile still exists with `died_at` set)
- Update the `DeadCharacter` interface to source lives from the profile, not hall_of_immortals
- Fix the TypeScript error by removing the non-existent column reference

#### 3. Fix `Index.tsx` — handle dead players with no living profile
- Remove the `profile` requirement from the navigation effect condition
- When `!hasLivingCharacter` and `deadCharacters.length > 0`, show death screen (already works once query is fixed)
- When `!hasLivingCharacter` and `deadCharacters.length === 0`, check if user has any dead profiles directly and show a fallback "start fresh" screen

#### 4. Fix `CharacterDeathScreen.tsx` — source lives from profile
- Update to use `resurrection_lives` from the profile record rather than `lives_remaining_at_death` from hall_of_immortals

#### 5. Version bump to 1.1.122

### Files to edit
- New SQL migration (add columns, backfill, create RPC)
- `src/hooks/useCharacterDeath.ts` — fix query and types
- `src/pages/Index.tsx` — fix navigation for dead players
- `src/components/character/CharacterDeathScreen.tsx` — minor prop update
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

### Technical detail
The `resurrect_character` RPC will:
```sql
-- Check user owns the profile
-- Check profile has died_at set
-- Check resurrection_lives > 0
-- Deactivate other active profiles
-- Clear died_at, set health=50, energy=50, is_active=true
-- Decrement resurrection_lives by 1
```

Dead profiles query will change from querying `hall_of_immortals` (which may not have entries for all deaths) to querying `profiles WHERE died_at IS NOT NULL` directly, joined with hall_of_immortals for optional memorial data.

