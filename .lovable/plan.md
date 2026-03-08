

# Plan: Player Producer Career System (v1.0.918)

## Overview

Allow players to work as record producers for other artists/bands. Players with Record Production skills can register as producers, set their own hourly rates, and earn XP + cash when hired for recording sessions. The existing producer selector in the recording wizard gets a filter to toggle between NPC producers and player producers.

## Database Changes (1 migration)

### New: `player_producer_profiles` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK auth.users | unique |
| display_name | text | Producer alias |
| cost_per_hour | integer | Player-set rate, min $10 |
| specialty_genre | text | Primary genre |
| bio | text nullable | Short pitch |
| is_available | boolean default true | Can be hired |
| city_id | uuid FK cities nullable | Must be in same city to produce |
| quality_bonus | integer default 0 | Calculated from skills |
| mixing_skill | integer default 0 | From skill tree |
| arrangement_skill | integer default 0 | From skill tree |
| total_sessions | integer default 0 | Career stats |
| total_earnings | numeric default 0 | Career stats |
| xp_earned | integer default 0 | Lifetime producing XP |
| rating | numeric default 0 | Average client rating |
| created_at / updated_at | timestamptz | |

RLS: Read for all authenticated, full CRUD for own user_id.

### Add to `recording_sessions`
- `player_producer_id UUID REFERENCES player_producer_profiles(id)` — set when a player producer is hired (existing `producer_id` stays for NPC producers)

### New: `producer_session_reviews` table
Simple rating after completed sessions — `session_id`, `reviewer_user_id`, `producer_profile_id`, `rating` (1-5), `comment`.

## New Files

### `src/pages/ProducerCareer.tsx`
Full career management page:
- **Dashboard**: Total sessions, earnings, XP, average rating
- **Profile Setup**: Set display name, hourly rate, specialty genre, bio, toggle availability
- **Requirements Check**: Must have `songwriting_basic_record_production` skill ≥ 100 to register; higher skills unlock better quality_bonus calculations
- **Session History**: Past producing gigs with ratings
- **Skill Impact Display**: Shows how Record Production, Mixing, and DAW skills affect quality_bonus

### `src/hooks/useProducerCareer.ts`
- `useProducerProfile()` — fetch/create own profile
- `useUpdateProducerProfile()` — update rate, genre, availability
- `useAvailablePlayerProducers(cityId, genre?)` — fetch available player producers in a city
- `useProducerSessionHistory()` — past sessions as producer
- `calculateProducerStats(skillLevels)` — derive quality_bonus, mixing_skill, arrangement_skill from player's skill tree values

### `src/components/recording/PlayerProducerCard.tsx`
Similar to `ProducerCard` but shows player-specific info: avatar, player level, rating stars, session count, and "Player Producer" badge.

## Modified Files

### `src/components/recording/ProducerSelector.tsx`
- Add a toggle/filter at top: "NPC Producers" | "Player Producers" | "All"
- When "Player Producers" selected, fetch from `player_producer_profiles` where `city_id` matches current city and `is_available = true`
- Map player producers to the same `RecordingProducer` interface shape for compatibility
- Self-produce option always visible regardless of filter

### `src/hooks/useRecordingData.tsx`
- Update `CreateRecordingSessionInput` to include optional `player_producer_id`
- When a player producer is selected, pay their `cost_per_hour` to their profile's user (update their cash)
- After session completes, award producing XP to the player producer (based on session duration and quality)
- Update `player_producer_profiles` stats (total_sessions, total_earnings)

### `src/pages/hubs/CareerHub.tsx`
- Add "Producer" tile linking to `/producer-career`

### `src/components/ui/navigation.tsx` + `HorizontalNavigation.tsx`
- Add Producer Career under Career section

### `src/i18n/*.ts` (all 7 languages)
- Add `nav.producerCareer` key

### `src/App.tsx`
- Add route `/producer-career` → `ProducerCareer`

### `src/components/VersionHeader.tsx` → v1.0.918
### `src/pages/VersionHistory.tsx` → add entry

## Producer Quality Calculation

```text
quality_bonus = floor(basic_production / 20) + floor(pro_production / 10) + floor(mastery_production / 5)
mixing_skill  = floor(mixing_skill_level * 0.8) + floor(daw_skill_level * 0.2)
arrangement   = floor(composing_skill * 0.6) + floor(music_theory * 0.4)

Cap: quality_bonus max 25 (legendary NPC = 30, so players can get close but not surpass top NPCs)
```

## XP Rewards for Producing

```text
Base XP = duration_hours × 50
Quality bonus = if final_quality > 500: +25 XP, > 700: +50 XP, > 900: +100 XP
Genre match bonus = +20% XP if session genre matches specialty
Skills awarded: songwriting_basic_record_production, songwriting_professional_record_production
```

## Session Flow (Player Producer)

1. Recording artist selects "Player Producers" filter in ProducerSelector
2. Sees available player producers in the studio's city
3. Selects one → proceeds to config as normal
4. On session creation: player producer's cash increases by `cost_per_hour × duration`
5. On session completion: player producer gets XP, stats updated, review prompt shown to recording artist

