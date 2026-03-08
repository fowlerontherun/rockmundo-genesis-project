

# Night Clubs & DJing System — Full Review & Implementation Plan (v1.1.004)

## Current State Assessment

### What EXISTS (DB + Backend)
- **`city_night_clubs` table** — Schema complete with JSONB columns for guest_actions, drink_menu, npc_profiles, dj_slot_config, metadata. RLS in place.
- **80+ clubs seeded** across ~30 cities worldwide (UK, USA, Europe, Asia, S. America, Africa, Australia) — rich data with NPCs, drinks, guest actions, DJ slots, perks
- **`nightclub_quests` table** — Quest chains seeded for London's Electric Basement (DJ Rebel quests). Schema supports one_time, repeatable, chain quest types with branching dialogue JSONB
- **`player_nightclub_quest_progress` table** — Tracks player quest state, dialogue state, rewards claimed
- **`player_dj_performances` table** — Records DJ set outcomes (score, cash, fame, fans, xp)
- **`npc_relationships` table** — Tracks affinity, trust, respect scores per NPC per profile
- **`normalizeNightClubRecord()`** in worldEnvironment.ts — Transforms raw DB rows into typed `CityNightClub` objects

### What EXISTS (Frontend)
- **`CityNightClubsSection`** — Renders club cards on City page with DJ slot button, guest visit button, drink menu, NPC list, performance outcome dialog
- **`useDjPerformance` hook** — Full DJ set flow: checks fame/energy → calculates performance score → rolls addiction → updates profile → awards XP → records performance
- **`useNightlifeEvents` hook** — Guest visit flow with energy/cash/fame + addiction rolls
- **`djPerformance.ts` utils** — Score calculation using skill progress, attributes, club quality, variance
- **`addictionSystem` utils** — Addiction roll mechanics tied to behavior settings
- **Admin panel** at `/admin/night-clubs` — CRUD for clubs with form builder (no JSON editing)

### What's BROKEN / MISSING
1. **Night club data normalization on City page** — Raw DB rows cast as `any` at line 407, but `CityNightClubsSection` expects normalized `CityNightClub` objects with camelCase props (`qualityLevel`, `djSlot`, etc.). The raw rows have `quality_level`, `dj_slot_config` — **clubs likely render but with missing/undefined fields**
2. **No quest UI** — `nightclub_quests` table + seed data exists, but zero frontend components for the dialogue/quest system. Players can't interact with NPCs or complete quests
3. **Guest actions not functional** — "Visit as Guest" fires a generic `guest_visit` event but doesn't use the club's specific guest actions (dance, VIP lounge, etc.)
4. **No dedicated nightclub page** — Everything is crammed into the City page. No `/nightclub/:id` route for detailed club view
5. **NPC dialogue hooks displayed but not interactive** — Shows "Topics: ..." text but no way to actually talk to NPCs
6. **Missing quest seeds for 79 other clubs** — Only London's Electric Basement has quest data

## Implementation Plan

### Phase 1: Fix Data Flow & Normalization (Critical)
**File: `src/pages/City.tsx`**
- Import `normalizeNightClubRecord` from worldEnvironment.ts (or create a thin wrapper)
- At line ~407, map raw DB rows through normalizer before setting state:
  ```tsx
  setNightClubs(nightClubsResult.value.data.map(row => normalizeNightClubRecord(row as any)));
  ```

### Phase 2: Dedicated Nightclub Detail Page
**Create: `src/pages/NightClubDetail.tsx`**
- Route: `/nightclub/:clubId`
- Full-page layout with PageLayout/PageHeader + back to city
- Sections: Club info, DJ Slot (with "Perform" button), Guest Actions (each as clickable card), Drink Menu, NPCs (clickable to start dialogue), Quest Board, Performance History
- Fetches club from `city_night_clubs` by ID

**Create: `src/components/nightclub/NightClubGuestActionCard.tsx`**
- Renders each guest action as a clickable card with energy cost
- On click: triggers `useNightlifeEvents` with the specific activity type mapped from the action

**Create: `src/components/nightclub/NightClubDrinkMenu.tsx`**
- Visual drink menu with buy buttons
- Buying a drink costs cash, applies effect (energy/mood/charisma boost)

### Phase 3: NPC Dialogue System UI
**Create: `src/components/nightclub/NPCDialoguePanel.tsx`**
- Dialog/sheet that renders branching dialogue from quest JSONB
- Shows NPC name, role, personality
- Player choice buttons that advance dialogue state
- Tracks `player_nightclub_quest_progress` — creates on first interaction, updates dialogue_state
- Awards quest rewards on completion (cash, xp, fame, skill boosts, NPC relationship changes)

**Create: `src/hooks/useNightclubQuests.ts`**
- Fetches quests for a club from `nightclub_quests`
- Fetches player progress from `player_nightclub_quest_progress`
- Provides `startQuest`, `advanceDialogue`, `completeQuest`, `claimRewards` mutations
- Handles chain quest progression (checks chain_position, chain_id)

**Create: `src/hooks/useNPCRelationship.ts`**
- Wraps existing `npc_relationships` table API from `roleplaying.ts`
- Provides relationship data per NPC for the current player
- Updates affinity/trust/respect on dialogue choices and quest completion

### Phase 4: Functional Guest Actions
**Update: `src/hooks/useNightlifeEvents.ts`**
- Extend `NightlifeActivityType` to support custom guest actions from JSONB
- Each club's guest_actions become playable: uses that action's energy cost, provides relevant rewards
- Map action labels to outcome types (dancing → fame+energy drain, VIP → cash drain+charisma, networking → fame+NPC affinity)

### Phase 5: Seed Quests for Major Cities
**Create migration** seeding ~3 quests per major city club (London already done):
- Berlin (Berghain bouncer quest chain, Tresor vinyl quest)
- New York (Marquee VIP quest, Output rooftop quest)
- Ibiza (Amnesia season quest chain)
- Tokyo (WOMB precision quest)
- ~30 quest entries across 10+ cities, each with branching dialogue

### Phase 6: Route Registration & Navigation
**Update: `src/App.tsx`**
- Add route: `/nightclub/:clubId` → `NightClubDetail`

**Update: `src/components/city/CityNightClubsSection.tsx`**
- Each club card becomes a link to `/nightclub/:clubId`
- Keep DJ/Guest buttons but also add "Enter Club" primary action

### Phase 7: Version Update
- Bump `VersionHeader.tsx` to v1.1.004
- Add changelog entry in `VersionHistory.tsx`

## Files Summary

| Action | File |
|--------|------|
| Fix | `src/pages/City.tsx` — normalize nightclub data |
| Create | `src/pages/NightClubDetail.tsx` — dedicated club page |
| Create | `src/components/nightclub/NightClubGuestActionCard.tsx` |
| Create | `src/components/nightclub/NightClubDrinkMenu.tsx` |
| Create | `src/components/nightclub/NPCDialoguePanel.tsx` |
| Create | `src/hooks/useNightclubQuests.ts` |
| Create | `src/hooks/useNPCRelationship.ts` |
| Update | `src/hooks/useNightlifeEvents.ts` — support custom actions |
| Update | `src/components/city/CityNightClubsSection.tsx` — link to detail page |
| Update | `src/App.tsx` — add nightclub route |
| Create | Migration — seed quests for major world cities |
| Update | `src/components/VersionHeader.tsx` → v1.1.004 |
| Update | `src/pages/VersionHistory.tsx` → changelog |

