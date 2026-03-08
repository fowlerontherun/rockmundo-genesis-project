

# Multi-Character Slots, Permadeath & Legacy System

## Overview

Introduce a multi-character system where each user can own multiple profiles. Free players get 1 slot (upgradeable to 2 via in-game milestone or purchase). VIP players get 2 slots, can buy up to 5 total at £5 each. Characters can die from neglect (health drain on missed logins → hospitalization → death after 10 days). Dead characters enter a "Hall of Immortals" with a full bio. Surviving players can start fresh or play as the child of the deceased, inheriting 10% skills and 50% cash.

---

## Database Changes (Migrations)

### 1. `character_slots` table
Tracks how many slots a user has purchased/earned.

```sql
create table public.character_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  max_slots integer not null default 1,
  extra_slots_purchased integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.character_slots enable row level security;
```

### 2. `active_character` column on profiles
Add a flag to know which profile is active per user, plus a `died_at` and `death_cause` column.

```sql
alter table public.profiles 
  add column if not exists is_active boolean default true,
  add column if not exists died_at timestamptz,
  add column if not exists death_cause text,
  add column if not exists last_login_at timestamptz default now(),
  add column if not exists slot_number integer default 1;
```

### 3. `hall_of_immortals` table
Separate from `hall_of_fame` (retirement). This is for dead characters.

```sql
create table public.hall_of_immortals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_id uuid not null,
  character_name text not null,
  avatar_url text,
  bio text,
  cause_of_death text not null default 'neglect',
  died_at timestamptz not null default now(),
  age_at_death integer,
  years_active integer,
  total_fame integer default 0,
  total_cash_at_death numeric default 0,
  total_songs integer default 0,
  total_gigs integer default 0,
  total_albums integer default 0,
  peak_chart_position integer,
  final_skills jsonb default '{}',
  final_attributes jsonb default '{}',
  notable_achievements jsonb default '[]',
  band_history jsonb default '[]',
  generation_number integer default 1,
  created_at timestamptz default now()
);
alter table public.hall_of_immortals enable row level security;
```

---

## Edge Function: `check-character-health-decay`

A scheduled cron job (runs daily) that:

1. Queries all profiles where `last_login_at < now() - interval '1 day'` and `died_at IS NULL` and `health > 0`
2. For each, calculates days since last login, drains `5 * days_missed` health (capped, only applies new drain since last check)
3. If health reaches 0 → triggers hospitalization (existing system)
4. If hospitalized AND `last_login_at < now() - interval '10 days'` → kills the character:
   - Sets `died_at = now()`, `death_cause = 'neglect'`
   - Creates `hall_of_immortals` entry with full bio/stats snapshot
   - Marks profile `is_active = false`

---

## Frontend Changes

### Character Switcher Component
- New `CharacterSwitcher.tsx` in the sidebar/nav area
- Shows current active character with avatar + name
- Dropdown lists all living profiles for the user
- "Create New Character" button (greyed out if at slot limit)
- Slot count indicator: "2/3 slots used"

### Character Creation Flow
- When a character dies and user logs in → intercept at `Index.tsx`
- Show a "Your character has died" memorial screen with:
  - Option A: "Create Random New Character" → fresh start
  - Option B: "Play as Child of [Name]" → inherit 10% skills, 50% cash
- Both options create a new profile row linked to the same user

### VIP Slot Logic
- Free players: 1 slot base, can earn 2nd via milestone (TBD)
- VIP players: 2 slots base
- Additional slots: £5 each via Stripe, up to 5 total
- `character_slots.max_slots = base + extra_slots_purchased`
- Base is computed from VIP status at runtime

### Hall of Immortals Page
- New route `/hall-of-immortals`
- Similar layout to Hall of Fame but with death-themed styling (darker, memorial aesthetic)
- Each entry shows: name, cause of death, age, career highlights, band history, skills radar
- Clicking an entry opens a full memorial bio page

### Login Health Check
- On each login (in `AuthProvider` or `Index.tsx`), update `last_login_at = now()` on the active profile
- Check if any characters have died while offline → show memorial/inheritance flow

---

## Files Summary

| Action | File |
|--------|------|
| Create | Migration: `character_slots`, `hall_of_immortals` tables, profile columns |
| Create | Edge function: `check-character-health-decay` (cron daily) |
| Create | `src/components/character/CharacterSwitcher.tsx` |
| Create | `src/components/character/CharacterDeathScreen.tsx` |
| Create | `src/pages/HallOfImmortals.tsx` |
| Create | `src/hooks/useCharacterSlots.ts` |
| Create | `src/hooks/useCharacterDeath.ts` |
| Update | `src/pages/Index.tsx` — death check on login, `last_login_at` update |
| Update | `src/utils/retirement.ts` — adjust inheritance to 10% skills (was 20%), keep 50% cash |
| Update | `src/components/ui/navigation.tsx` — add Hall of Immortals link, character switcher |
| Update | `src/pages/hubs/CharacterHub.tsx` — add Hall of Immortals tile |
| Update | `src/App.tsx` — register `/hall-of-immortals` route |
| Update | `src/components/VersionHeader.tsx` → version bump |
| Update | `src/pages/VersionHistory.tsx` → changelog |

