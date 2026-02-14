

# Clubs & DJing System + DJ Skill Tree Expansion -- v1.0.691

## What's Being Built

Currently, "Queue for DJ Slot" is a single button click that gives a flat +8 fame and costs 25 energy -- no skill checks, no scheduling, no performance outcome, no payouts from the club data. This update turns DJing into a full gameplay loop and adds a dedicated DJ/Club Performance skill category to the skill tree.

---

## Part A: DJ Skill Tree (New Category)

Add a new **"DJ & Club Performance"** skill category with 7 tracks, each with Basic/Professional/Mastery tiers (21 new skills total):

| Track | Description |
|---|---|
| Beatmatching | Manual beat alignment, tempo reading, phrase matching |
| DJ Mixing | Transitions, EQing, harmonic mixing, creative blends |
| Crowd Reading | Gauging energy, track selection instinct, floor management |
| Set Building | Opening, peaking, cool-down arcs, dynamic set construction |
| DJ Scratching | Scratch techniques layered into DJ sets (cross-prereq with Turntablism) |
| Live Remixing | On-the-fly mashups, loop layering, effects chains during live sets |
| Club Promotion | Self-promotion, flyer culture, building a DJ brand and following |

The DJ Scratching track will have a cross-prerequisite on the existing `instruments_basic_turntablism` skill, connecting the two trees. This new category joins the existing `electronicConfigs` section of `skillTree.ts`.

---

## Part B: DJ Performance System

Replace the flat "Queue for DJ Slot" button with a proper performance flow:

### Flow
1. **Queue for DJ Slot** -- checks fame requirement from the club's `dj_slot_config.fameRequirement`, checks energy, checks for scheduling conflicts
2. **Performance Calculation** -- runs a DJ performance score based on:
   - DJ skill levels (Beatmatching, Mixing, Crowd Reading, Set Building average)
   - Player attributes (Charisma 40%, Stage Presence 60%)
   - Club quality level (higher quality = harder crowd to impress)
   - Variance roll (+/-8, like gigs)
   - Gear bonuses (if applicable)
3. **Outcome** -- generates a DJ performance report:
   - Performance rating (0-100)
   - Cash payout (from `dj_slot_config.payout`, scaled by performance)
   - Fame gain (scaled by club quality and performance)
   - Fan gain (small, local)
   - XP gain for DJ skills (based on set length)
   - Addiction roll (already wired via `useNightlifeEvents`)
   - Possible outcomes: "Crowd went wild", "Solid set", "Rough night", "Cleared the floor"
4. **Cooldown** -- cannot DJ at the same club for 24 hours (in-game time)

### Database
- **New table: `player_dj_performances`** -- tracks DJ set history
  - `id`, `user_id`, `profile_id`, `club_id`, `performance_score`, `cash_earned`, `fame_gained`, `fans_gained`, `xp_gained`, `outcome_text`, `set_length_minutes`, `created_at`

### Key Integration Points
- Fame requirement check reads from the club's `dj_slot_config.fameRequirement`
- Payout reads from `dj_slot_config.payout`
- Set length from `dj_slot_config.setLengthMinutes`
- Scheduling uses `player_scheduled_activities` + `check_scheduling_conflict`
- XP gains feed into `skill_progress` for DJ skills
- Addiction roll remains wired through `useNightlifeEvents`

---

## Part C: Enhanced Club UI

Update `CityNightClubsSection.tsx` to support the new DJ flow:

1. **Pre-DJ Check** -- "Queue for DJ Slot" now shows:
   - Fame requirement vs player's fame (red/green indicator)
   - Energy requirement
   - Expected payout range
   - "You need X more fame" message if under requirement
2. **DJ Performance Dialog** -- after clicking queue, a dialog shows:
   - Set building progress (simulated)
   - Performance outcome with score, earnings, and flavor text
   - XP gains breakdown
   - "Play Again" cooldown indicator
3. **DJ History** -- small section showing recent DJ performances at this club

---

## Part D: DJ Performance Utility

New utility file `src/utils/djPerformance.ts`:
- `calculateDjPerformanceScore(skills, attributes, clubQuality)` -- mirrors gig performance logic
- `generateDjOutcome(score, clubData)` -- produces fame/cash/fan/xp results
- `getDjSkillAverage(skillProgress)` -- averages relevant DJ skills

---

## Part E: Version Update
- Bump to v1.0.691
- Changelog entry for DJ skills and club performance system

---

## Technical Details

### Files to Create
- `src/utils/djPerformance.ts` -- DJ performance calculation and outcome generation
- `src/hooks/useDjPerformance.ts` -- hook wrapping the DJ flow (queue, perform, record)

### Files to Modify
- `src/data/skillTree.ts` -- add `djClubConfigs` array (7 tracks x 3 tiers = 21 skills), add to build export
- `src/hooks/useNightlifeEvents.ts` -- update `dj_slot` handling to use the new performance system instead of flat outcomes
- `src/components/city/CityNightClubsSection.tsx` -- add fame check, DJ performance dialog, and outcome display
- `src/components/VersionHeader.tsx` -- bump to 1.0.691
- `src/pages/VersionHistory.tsx` -- changelog

### Database Migration
- Create `player_dj_performances` table with RLS (user can only read/write own records)

### DJ Performance Formula

```text
baseScore = (beatmatchingLevel + mixingLevel + crowdReadingLevel + setBuildingLevel) / 4
attributeBonus = (stagePresence * 0.6 + charisma * 0.4) / 100 * 15
difficultyPenalty = clubQualityLevel * 3
varianceRoll = random(-8, +8)
finalScore = clamp(baseScore + attributeBonus - difficultyPenalty + varianceRoll, 0, 100)

cashEarned = clubPayout * (finalScore / 70)  // 70 = "expected" score
fameGain = clubQuality * 2 * (finalScore / 50)
xpGain = setLengthMinutes * 0.5
```

