
# Improved Gig Outcome Insights and Equipment Warnings (v1.0.661)

## Overview

Add detailed performance insight cards to the gig outcome report that explain **what boosted and what hurt** the score, plus a pre-gig warning system that alerts players when band members are assigned instrument roles but don't have matching gear equipped.

---

## 1. Performance Insights Card (Post-Gig)

A new component `PerformanceInsightsCard` displayed in `GigOutcomeReport.tsx` that analyzes the gig execution data and generates human-readable insight lines.

### Insight Categories

**Skill-based insights** (per band member):
- Low skill warning: "Alex played Lead Guitar with only Level 12 guitar skill -- this dragged down performance"
- Average skill note: "Jordan had moderate Drums skill (Level 45) -- room to improve"
- High skill praise: "Sam's vocal mastery (Level 88) elevated the entire set"

**Gear-based insights** (per band member):
- Gear boost: "Alex has a Rare electric guitar equipped, boosting Lead Guitar performance by +18%"
- Missing gear warning: "Jordan is assigned Drums but has no drum kit equipped -- no gear bonus applied"
- Gear mismatch: "Sam has a keyboard equipped but plays Vocals -- gear bonus doesn't apply"

**Other factor insights** (from existing breakdown data):
- Low rehearsal: "3 of 6 songs were under-rehearsed, costing you up to 20% on those tracks"
- Chemistry impact: "Band chemistry at 82% gave a +10% synergy boost"
- Crew contribution: "Your 3-person crew averaged skill level 65, providing solid support"
- Equipment quality: "Stage equipment quality was 78/100"

### Data Flow

During gig execution (`gigExecution.ts`), the code already fetches band members but doesn't include `instrument_role`. The change will:

1. Update the `band_members` query in `gigExecution.ts` to also select `instrument_role`
2. For each member, call `calculatePerformanceModifiers()` from `skillGearPerformance.ts` to get their skill level, gear multiplier, and effective level
3. Store these per-member breakdowns in the gig outcome's existing `breakdown_data` JSON field as a new `member_insights` array
4. The `PerformanceInsightsCard` component reads this data and renders categorized insight lines with icons

### Insight Generation Logic

```text
For each band member:
  1. Get their instrument_role (e.g., "Lead Guitar")
  2. Look up their skill level for that role via ROLE_SKILL_MAP
  3. Check equipped gear via doesCategoryMatchRole()
  4. Generate insight based on thresholds:
     - skill < 25: "danger" (red) -- severely hurting performance
     - skill 25-50: "warning" (yellow) -- below average
     - skill 50-75: "neutral" (gray) -- decent
     - skill 75+: "boost" (green) -- actively helping
  5. Check gear match:
     - Has matching gear: "boost" with rarity bonus noted
     - No matching gear: "warning" -- missing out on bonuses
     - Wrong category gear: "info" -- gear doesn't help this role
```

---

## 2. Pre-Gig Equipment Warning

Add an "Instrument Gear Check" section to the existing `GigPreparationChecklist.tsx` component.

### How It Works

Before a gig, the checklist already shows rehearsal status, equipment, crew, and chemistry. The new section will:

1. Fetch band members with their `instrument_role`
2. Fetch each member's equipped gear from `player_equipment` joined with `equipment_items`
3. Use `doesCategoryMatchRole()` from `skillGearPerformance.ts` to check if any equipped item matches their role
4. Display warnings for mismatches:
   - "Jordan (Drums) has no drum equipment equipped -- performance will suffer!"
   - "Alex (Lead Guitar) has matching gear: Fender Stratocaster (Rare) -- +18% bonus"

### UI

A list of band members with their role, showing a green check if they have matching gear or a red warning if they don't. This adds to the existing readiness score calculation.

---

## Technical Changes

### New File
- `src/components/gig/PerformanceInsightsCard.tsx` -- Component that renders categorized boost/penalty insight lines with color-coded icons

### Modified Files
- `src/utils/gigExecution.ts` -- Update band_members query to include `instrument_role`; after calculating performance, run per-member skill+gear analysis and store `member_insights` array in `breakdown_data`
- `src/components/gig/GigOutcomeReport.tsx` -- Import and render `PerformanceInsightsCard` using `breakdown_data.member_insights`
- `src/components/gig/GigPreparationChecklist.tsx` -- Add new prop for band members with roles; add "Instrument Gear Check" section showing per-member equipment match status
- `src/utils/skillGearPerformance.ts` -- Export `doesCategoryMatchRole` (currently not exported) so it can be reused
- `src/components/VersionHeader.tsx` -- Bump to v1.0.661
- `src/pages/VersionHistory.tsx` -- Add changelog entry

### Data Structure for `member_insights`

Stored in `breakdown_data.member_insights` on gig_outcomes:

```text
[
  {
    memberId: "uuid",
    displayName: "Alex",
    role: "Lead Guitar",
    skillLevel: 35,
    gearMultiplier: 1.18,
    effectiveLevel: 41,
    hasMatchingGear: true,
    gearName: "Fender Stratocaster",
    gearRarity: "rare",
    insightType: "warning",  // danger | warning | neutral | boost
    message: "Played Lead Guitar with below-average guitar skill (Level 35)"
  }
]
```

No database migration needed -- `breakdown_data` is already a JSONB column.
