
# v1.0.624 -- Nightclub NPCs, Dialogue, Quests & Reward System

## Overview
A major expansion of the nightclub system that transforms clubs from static data displays into interactive social hubs with rich NPC dialogue, multi-step quests/missions, and tangible gameplay rewards (instruments, skill boosts, money, fame, gifted songs). Currently only London (4 clubs) and Manchester (1 club) have nightclubs -- this update will also seed clubs across many more cities.

## Current State

**What exists:**
- `city_night_clubs` table with basic club data (name, quality, DJ slots, drinks, guest actions, NPC profiles)
- NPC profiles are stored as flat JSONB with name, role, personality, and dialogue hooks (just topic keywords)
- The City page renders clubs in a read-only section showing DJ slots, guest actions, drinks, and NPC names
- "Queue for DJ Slot" and "Visit as Guest" buttons exist but are non-functional
- Only 5 clubs exist (4 London, 1 Manchester) -- zero coverage for the 70+ other cities
- NPC relationship system exists (`npc_relationships` table) but is not connected to nightclub NPCs
- Narrative engine exists (`NarrativeStory`/`NarrativeNode`/`NarrativeChoice` types + state machine) but is underutilized
- Random events system with effect payloads (cash, fame, fans, energy, xp) is well-established
- Song gifting infrastructure exists (`admin_song_gifts` table)
- Equipment/gear inventory system exists (`player_equipment_inventory` table)

**What's missing:**
- No interactive dialogue system for nightclub NPCs
- No quest/mission framework
- No reward delivery from nightclub interactions
- No "Visit as Guest" experience
- Most cities have zero nightclubs seeded

---

## What's Being Built

### 1. Nightclub Quests Database Table

A new `nightclub_quests` table to store quest definitions tied to specific clubs and NPCs:

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Quest identifier |
| club_id | UUID FK | Which nightclub offers this quest |
| npc_id | TEXT | NPC ID within the club's npc_profiles |
| title | TEXT | Quest title |
| description | TEXT | Quest briefing text |
| quest_type | TEXT | 'one_time', 'repeatable', 'chain' |
| chain_position | INT | Position in a quest chain (null for standalone) |
| chain_id | TEXT | Groups quests in a chain together |
| requirements | JSONB | Prerequisites (min_fame, min_relationship_stage, completed_quest_ids, etc.) |
| dialogue | JSONB | Array of dialogue nodes with NPC lines, player responses, and branching |
| rewards | JSONB | Reward payload (cash, fame, fans, xp, skill_boost, gifted_song, equipment_id) |
| energy_cost | INT | Energy cost to attempt |
| cooldown_hours | INT | Hours before repeatable quests can be done again |
| is_active | BOOLEAN | Admin toggle |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

### 2. Player Quest Progress Table

A `player_nightclub_quest_progress` table to track per-player state:

| Column | Type | Description |
|---|---|---|
| id | UUID PK | Progress entry ID |
| profile_id | UUID FK | Player |
| quest_id | UUID FK | Which quest |
| status | TEXT | 'available', 'in_progress', 'completed', 'failed' |
| started_at | TIMESTAMPTZ | When player started |
| completed_at | TIMESTAMPTZ | When completed |
| dialogue_state | JSONB | Current dialogue node position |
| rewards_claimed | BOOLEAN | Whether rewards have been given |
| created_at | TIMESTAMPTZ | Timestamp |

### 3. NPC Dialogue System

Extend the `NightClubNPCProfile` type and create a dialogue interaction component:

- **Dialogue Structure**: Each NPC gets a structured dialogue tree stored in the quest's `dialogue` JSONB field:
```text
[
  { speaker: "npc", text: "Hey, you look like you know your way around a turntable..." },
  { speaker: "player_choice", options: [
      { label: "I've been spinning since I was 15", next: 2, affinity_change: 5 },
      { label: "Not really my thing", next: 3, affinity_change: -2 }
  ]},
  { speaker: "npc", text: "Nice! I've got a challenge for you then..." },
  ...
]
```

- **NPC Dialogue Component** (`NightClubNPCDialogue.tsx`): A modal/drawer that renders NPC conversations with typing animation, player choice buttons, and relationship impact feedback

- **NPC Types for Nightclubs**: Expand from basic roles to structured archetypes:
  - **Resident DJ** -- offers DJ technique quests, rewards: skill boosts, turntablism XP
  - **Club Owner** -- offers business/networking quests, rewards: cash, fame, exclusive venue access
  - **Promoter** -- offers promotional challenge quests, rewards: fans, fame, industry contacts
  - **Bartender** -- offers social/lore quests, rewards: morale boost, gossip/tips, drink discounts
  - **Bouncer** -- offers gatekeeper quests, rewards: VIP access, respect, equipment
  - **VIP Regular** -- offers high-society networking, rewards: sponsor connections, large cash payouts
  - **Underground Producer** -- offers creative challenges, rewards: gifted songs, recording time

### 4. Quest Reward System

A unified reward delivery function that handles all reward types:

- **Cash**: Direct deposit to player balance
- **Fame**: Fame points added to profile
- **Fans**: Fan count increase
- **XP**: Skill XP via the existing progression system
- **Skill Boost**: Temporary or permanent skill level bump (e.g., +1 Turntablism)
- **Gifted Song**: Creates a song in the player's band catalog (using existing `admin_song_gifts` pattern)
- **Equipment**: Adds an instrument/gear to `player_equipment_inventory`
- **Reputation**: Shifts on authenticity/attitude/reliability/creativity axes
- **NPC Relationship**: Affinity/trust/respect changes with the quest-giving NPC

### 5. Interactive Club Visit Experience

Transform the "Visit as Guest" button into a full interactive experience:

- **Club Visit Page/Modal** (`NightClubVisit.tsx`): Shows the club interior with:
  - NPC list with interaction buttons (Talk, Quest marker if available)
  - Current atmosphere/vibe description
  - Available activities (dance, drink, network) with energy costs and outcomes
  - Active quest indicators on NPCs
  - Relationship status badges for known NPCs

- **Activity Outcomes**: Each guest action (dance, VIP lounge, networking) produces randomised results:
  - Energy cost deducted
  - Small fame/morale/cash rewards
  - Chance to trigger NPC dialogue or quest unlock
  - Chance for random nightlife events (ties into existing random events)

### 6. Seed Data Expansion

**New Nightclubs** (3-5 per major city, ~80+ new clubs across 20+ cities):

- **UK**: Birmingham (3), Edinburgh (3), Liverpool (3), Glasgow (2), Bristol (2), Leeds (2), Brighton (2), Cardiff (2), Newcastle (2), Sheffield (2), Belfast (2), Nottingham (2)
- **USA**: New York (4), Los Angeles (4), Miami (3), Chicago (3), Nashville (2), Austin (2), Las Vegas (3), San Francisco (2), Atlanta (2), Detroit (2), Boston (2), Philadelphia (2)
- **Europe**: Berlin (4), Amsterdam (3), Barcelona (3), Paris (3), Ibiza (3), Prague (2), Dublin (2), Lisbon (2), Stockholm (2), Copenhagen (2), Vienna (2)
- **Rest of World**: Tokyo (3), Seoul (2), Bangkok (2), Rio de Janeiro (2), Buenos Aires (2), Sydney (2), Cape Town (2)

Each club gets:
- Thematically appropriate NPCs (2-4 per club) with distinct personalities and dialogue hooks
- Guest actions tailored to the venue's quality tier
- Signature drinks with gameplay effects
- DJ slot config scaled to quality level

**Seeded Quests** (2-3 per club for London clubs, 1-2 for major cities):

Example quest chains:

*The Electric Basement (London, Underground):*
- "Prove Your Chops" -- DJ Rebel challenges you to a 3-track mix. Reward: +50 Turntablism XP, $100
- "Underground Connections" -- Help DJ Rebel find a rare vinyl. Reward: Gifted song (rare underground track)

*The Velvet Room (London, Premier):*
- "Vincent's Test" -- Club owner Vincent Noir wants you to entertain his VIP guests. Reward: $2,000, +100 fame
- "Industry Insider" -- Network with 3 VIPs in one visit. Reward: Record label contact (NPC relationship unlock)
- "The Velvet Residency" -- Complete the chain for a recurring DJ residency. Reward: Recurring income, fame multiplier

*Neon Dreams (London, Boutique):*
- "Synthia's Challenge" -- Resident DJ Synthia Vega wants you to remix her latest track. Reward: Gifted song, +75 XP
- "Steel's Proposition" -- Promoter Marcus Steel offers a deal: promote the club on Twaater for cash. Reward: $500, +50 fans

---

## Technical Details

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/[ts]_nightclub_quests.sql` | New tables + seed data for clubs, NPCs, and quests |
| `src/types/nightclubQuests.ts` | TypeScript types for quests, dialogue, rewards |
| `src/hooks/useNightclubQuests.ts` | React Query hooks for fetching/managing quests and progress |
| `src/hooks/useNightclubVisit.ts` | Hook for club visit interactions and activity outcomes |
| `src/components/nightclubs/NightClubVisitModal.tsx` | Main club visit experience modal |
| `src/components/nightclubs/NightClubNPCList.tsx` | NPC roster with interaction buttons |
| `src/components/nightclubs/NightClubNPCDialogue.tsx` | Dialogue interaction component |
| `src/components/nightclubs/NightClubQuestPanel.tsx` | Quest details, requirements, and rewards display |
| `src/components/nightclubs/NightClubActivityPanel.tsx` | Guest activities with outcomes |
| `src/lib/nightclubRewards.ts` | Reward delivery logic for all reward types |

### Files to Modify

| File | Change |
|---|---|
| `src/utils/worldEnvironment.ts` | Extend `NightClubNPCProfile` with quest availability flags |
| `src/components/city/CityNightClubsSection.tsx` | Wire up "Visit as Guest" and "Queue for DJ Slot" buttons |
| `src/integrations/supabase/types.ts` | Auto-updated with new table types |
| `src/components/VersionHeader.tsx` | Bump to 1.0.624 |
| `src/pages/VersionHistory.tsx` | Changelog entry |

### Database Changes

1. Create `nightclub_quests` table with RLS (public read, admin write)
2. Create `player_nightclub_quest_progress` table with RLS (users read/write own, admin all)
3. Seed 80+ new nightclubs with NPCs across 30+ cities
4. Seed 20-30 starter quests for London clubs and major world cities

### Reward Integration Points

- Cash/fame/fans: Direct profile updates via existing supabase calls
- Skill XP: Uses existing `progression` edge function (`award_special_xp` action)
- Gifted songs: Creates entry in `admin_song_gifts` + generates song in `songs` table
- Equipment: Inserts into `player_equipment_inventory`
- NPC relationships: Uses existing `updateNPCRelationship` API
- Reputation: Uses existing `updatePlayerReputation` API

### Quest Flow Sequence

```text
Player visits city page
  -> Sees nightclub section with clubs
  -> Clicks "Visit as Guest"
  -> NightClubVisitModal opens
    -> Sees NPC list with quest markers
    -> Clicks "Talk" on an NPC
    -> NightClubNPCDialogue opens
      -> Reads NPC greeting
      -> Makes dialogue choices (affects relationship)
      -> Quest offered if requirements met
      -> Accepts quest
    -> Quest appears in active quests
    -> Completes quest objectives
    -> Returns to NPC for completion dialogue
    -> Rewards delivered automatically
    -> Relationship updated
```
