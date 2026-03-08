

# Plan: Injuries, Sickness & Expanded Mental Health (v1.0.917)

## Overview

This is a large feature spanning three areas: (1) a new **player conditions** system for injuries and sicknesses, (2) **travel hazards** that can trigger these conditions, and (3) expanded **mental health conditions** (depression, anxiety, burnout, insomnia) as trackable conditions with gameplay effects. The hospital and therapy systems get upgraded to treat these conditions.

## Database Changes (1 migration)

### New: `player_conditions` table
Unified table for injuries, sickness, and mental health conditions.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK auth.users | |
| condition_type | text | 'injury', 'sickness', 'mental_health' |
| condition_name | text | e.g. 'sprained_wrist', 'flu', 'depression' |
| severity | integer 1-100 | |
| status | text | 'active', 'treating', 'recovered' |
| cause | text | 'travel', 'overwork', 'gig', 'random_event', 'lifestyle' |
| effects | jsonb | e.g. `{health_drain: 5, energy_cap: 70, xp_penalty: 10, blocks_gigs: true}` |
| treatment_type | text nullable | 'hospital', 'therapy', 'medication', 'rest' |
| treatment_started_at | timestamptz nullable | |
| estimated_recovery_at | timestamptz nullable | |
| recovered_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

RLS: Full CRUD for own user_id.

### Modify `player_hospitalizations`
- Add `reason TEXT DEFAULT 'health_collapse'` — now tracks admission reason (health_collapse, injury, sickness)
- Add `condition_id UUID REFERENCES player_conditions(id)` — links to the condition being treated

### Seed: Travel hazard random events
Insert ~10 new random_events with category `'travel_hazard'`:
- "Food Poisoning Abroad" — sickness
- "Bus Accident" — injury (sprained_ankle)
- "Tropical Illness" — sickness (tropical_fever)
- "Jet Lag Crisis" — sickness (severe_jetlag)
- "Back Injury from Luggage" — injury (back_strain)
- "Stage Equipment Fall" — injury (bruised_ribs)
- "Vocal Strain" — injury (vocal_strain, blocks singing)
- "Anxiety Attack on Flight" — mental_health (anxiety)
- "Touring Burnout" — mental_health (burnout)
- "Homesick Depression" — mental_health (depression)

### Seed: Mental health random events (category `'mental_health'`)
- "Insomnia Hits" — mental_health (insomnia)
- "Creative Block Depression" — mental_health (depression)
- "Performance Anxiety" — mental_health (anxiety)

## New Files

### `src/utils/conditionSystem.ts`
Core definitions for all conditions:

```text
INJURIES: sprained_wrist, sprained_ankle, back_strain, bruised_ribs, vocal_strain, concussion, hand_fracture
SICKNESSES: flu, food_poisoning, tropical_fever, severe_jetlag, cold, stomach_bug
MENTAL_HEALTH: depression, anxiety, burnout, insomnia

Each has: label, defaultSeverity, effects{}, treatmentOptions[], recoveryDays{min,max}
```

Effects per condition type:
- **Injuries**: blocks_gigs, xp_penalty (10-30%), energy_cap reduction
- **Sicknesses**: health_drain per hour, energy_cap, blocks_travel
- **Mental health**: xp_penalty, songwriting_penalty or bonus (depression can boost creativity), energy_cap, happiness_drain

Treatment mapping:
- Injuries → hospital (fast) or rest (slow)
- Sickness → hospital or medication ($) or rest
- Mental health → therapy sessions ($50-150 each, 3-8 needed) or medication ($) or rest (very slow)

### `src/hooks/useConditions.ts`
- Fetch active conditions for current user
- `treatCondition(conditionId, treatmentType)` mutation — starts treatment, deducts cash if needed
- `checkConditionRecovery()` — checks if any treating conditions have passed estimated_recovery_at, marks recovered
- `getActiveEffects()` — aggregates all active condition effects into a single modifier object

### `src/components/wellness/ConditionsPanel.tsx`
- Lists active injuries, sicknesses, mental health conditions
- Shows severity bar, estimated recovery time, treatment options
- For mental health: therapy session button, medication option
- Visual icons per type (🦴 injury, 🤒 sickness, 🧠 mental)

### `src/utils/travelHazards.ts`
- `rollForTravelHazard(transportMode, distanceKm, behaviorSettings)` — calculates chance of injury/sickness during travel
- Bus: 4% base, Train: 2%, Plane: 1.5%, Ship: 3%, Private Jet: 0.5%
- Long distance (>5000km) adds +2%
- Returns `{triggered, conditionName, conditionType, severity}` or null

## Modified Files

### `src/pages/Wellness.tsx`
- Add new "Conditions" tab (6th tab) showing `ConditionsPanel`
- Update overview cards to show active condition count
- Hospital tab: show option to admit for injury/sickness treatment (not just health < 30)
- Therapy section: show mental health conditions with dedicated treatment buttons

### `src/hooks/useHospitalization.ts`
- Update `checkInMutation` to accept optional `conditionId` and `reason` params
- Allow hospital check-in for injuries/sickness even if health > 30
- Recovery calculation factors in condition severity

### `supabase/functions/trigger-random-events/index.ts`
- Add travel hazard check: if player `is_traveling`, boost chance for `travel_hazard` category events
- Add mental health check: if player has low mental_focus attribute, boost `mental_health` category events

### `src/hooks/useHealthImpact.ts`
- `checkHealthForActivity` now also checks for blocking conditions (e.g. sprained_wrist blocks guitar gigs, vocal_strain blocks singing)
- Returns condition-specific messages

### `src/utils/addictionSystem.ts`
- Add new addiction type: `"shopping"` (triggered by excessive gear/skin purchases)
- Expand mental health interaction: active addictions increase mental health condition risk

### `src/components/VersionHeader.tsx` → v1.0.917
### `src/pages/VersionHistory.tsx` → add entry

## Condition Effects on Gameplay

```text
INJURY EFFECTS:
  sprained_wrist  → blocks_guitar_gigs, xp_penalty: 15%, recovery: 3-7 days
  vocal_strain    → blocks_singing, xp_penalty: 20%, recovery: 2-5 days
  back_strain     → energy_cap: 60, xp_penalty: 10%, recovery: 5-10 days
  concussion      → blocks_all_gigs, xp_penalty: 30%, recovery: 7-14 days

SICKNESS EFFECTS:
  flu             → health_drain: 3/hr, energy_cap: 50, recovery: 2-4 days
  food_poisoning  → health_drain: 5/hr, energy_cap: 30, recovery: 1-2 days
  tropical_fever  → health_drain: 4/hr, blocks_travel, recovery: 5-10 days

MENTAL HEALTH EFFECTS:
  depression      → xp_penalty: 20%, songwriting_quality: +10% (bittersweet boost), energy_cap: 60
  anxiety         → gig_score_penalty: 15%, fan_interaction_penalty: 20%
  burnout         → blocks_gigs, xp_penalty: 25%, recovery: 7-14 days (rest only)
  insomnia        → rest_effectiveness: -50%, energy_cap: 70, health_recovery: -30%
```

## Travel Hazard Trigger Flow

1. When `complete-travel` edge function runs → call `rollForTravelHazard()`
2. If triggered → insert into `player_conditions` + create inbox notification
3. Player sees condition on Wellness page with treatment options
4. Treatment via hospital (fast, costly) or rest (free, slow) or therapy (mental health)

