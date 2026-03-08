

# Plan: Expand Stage Behavior System & Full Integration (v1.0.910)

## Current State Analysis

The stage behavior system exists but has several gaps:

1. **No behavior recorded on gig outcomes** — the behavior used during a gig is not saved, so post-gig reports can't show which behavior was active
2. **Fame/fan multipliers not applied** — `gigExecution.ts` calculates `fameGained` and calls `calculateFanConversion` without applying the behavior's `fameMultiplier` or `fanConversionMultiplier`
3. **Edge function parity incomplete** — `process-gig-song` has behavior modifiers for score calculation but the `complete-gig` flow doesn't apply fame/fan multipliers from behavior
4. **No behavior impact shown in GigOutcomeReport** — players can't see how their behavior affected the gig
5. **No unlock checking logic** — `player_unlocked_behaviors` table exists but nothing checks/awards unlocks
6. **Behavior narrative missing** — no post-gig commentary about how the behavior affected the performance

## Changes

### 1. Database Migration
- Add `stage_behavior_used TEXT` column to `gig_outcomes` table — records which behavior was active during the gig

### 2. `gigExecution.ts` — Apply Behavior to Fame & Fan Conversion
- Import `getBehaviorModifiers` from `stageBehaviors`
- Apply `fameMultiplier` to `fameGained` calculation (line ~292)
- Apply `fanConversionMultiplier` when building fan conversion input
- Store `stageBehavior` in the gig outcome insert/update as `stage_behavior_used`
- Return `stageBehavior` in the result object

### 3. `fanConversionCalculator.ts` — Accept Behavior Multiplier
- Add optional `behaviorFanMultiplier` to `FanConversionInput`
- Apply it to the conversion rate calculation

### 4. `GigOutcomeReport.tsx` — Show Behavior Impact
- Accept optional `stageBehaviorUsed` prop
- Display a small card/badge showing the behavior emoji + name and key modifiers that affected the outcome

### 5. Behavior Unlock Checker — New Utility
- Create `src/utils/behaviorUnlockChecker.ts`
- Function `checkAndGrantBehaviorUnlocks(userId)` that:
  - Fetches player fame, gig count, skill levels, player level
  - Compares against each unlockable behavior's `unlockRequirement`
  - Inserts newly qualified behaviors into `player_unlocked_behaviors`
  - Returns list of newly unlocked behaviors
- Call this after gig completion in `gigExecution.ts`

### 6. `GigHistoryTab.tsx` & `PerformGig.tsx` — Pass Behavior to Report
- Read `stage_behavior_used` from gig outcome data
- Pass it through to `GigOutcomeReport`

### 7. Edge Function Parity (`process-gig-song`)
- The edge function already applies behavior modifiers to song scores — no changes needed there
- Crowd response thresholds in the edge function should use `crowdMult` (currently not applied to thresholds) — fix this for parity

### 8. Version Update
- Bump to `v1.0.910` in `VersionHeader.tsx` and `VersionHistory.tsx`

## Summary of Files

| Action | File |
|--------|------|
| Create | `src/utils/behaviorUnlockChecker.ts` |
| Create | Migration: add `stage_behavior_used` to `gig_outcomes` |
| Modify | `src/utils/gigExecution.ts` — fame/fan multipliers, store behavior, call unlock checker |
| Modify | `src/utils/fanConversionCalculator.ts` — accept behavior multiplier |
| Modify | `src/components/gig/GigOutcomeReport.tsx` — display behavior used |
| Modify | `src/components/band/GigHistoryTab.tsx` — pass behavior to report |
| Modify | `src/pages/PerformGig.tsx` — pass behavior to report |
| Modify | `supabase/functions/process-gig-song/index.ts` — fix crowd threshold parity |
| Modify | `src/components/VersionHeader.tsx` |
| Modify | `src/pages/VersionHistory.tsx` |

