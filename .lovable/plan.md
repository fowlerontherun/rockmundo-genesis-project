

# v1.0.625 -- Skill Hierarchy Cleanup, New Skills & Gameplay Integration

## Part 1: Duplicate & Overlap Analysis

After reviewing all 470+ skill definitions across 12 categories, I found these duplicates and overlaps:

### Confirmed Duplicates to Merge/Remove

| Duplicate Pair | Category A | Category B | Action |
|---|---|---|---|
| **Singing** vs **Vocal Performance** | Legacy (`instruments_basic_singing`) | Legacy (`instruments_basic_vocal_performance`) | Remove "Singing" (only 2 tiers, no Mastery). "Vocal Performance" already covers Basic/Professional/Mastery and is referenced in capstone prerequisites. Update `ROLE_SKILL_MAP` to remove singing references. |
| **Live Looping** vs **Loop Station** | Songwriting (`songwriting_basic_live_looping`) | Electronic (`instruments_basic_loop_station`) | Remove "Live Looping" from Songwriting category. The Loop Station instrument track is a better fit as a performance skill. Keep Loop Station (3 tiers). |
| **Vocal Production** vs **Vocal Effects & Technology** | Songwriting (`songwriting_basic_vocal_processing`) | Legacy (`instruments_basic_vocal_fx`) | Remove "Vocal Effects & Technology" from Legacy. "Vocal Production" in the Songwriting category is more comprehensive and better named. Update capstone prerequisites. |
| **Sound Design & Synthesis** vs **Analog/Digital Synth** | Songwriting (`songwriting_basic_sound_design`) | Electronic instruments | Keep both -- different scopes. Songwriting version is about production sound design, Electronic is about performing on synth instruments. No action needed. |

### Rapping Track (Missing Mastery)
"Rapping" only has Basic + Professional tiers with no Mastery. Add a Mastery tier for consistency since it's a prerequisite for the Lead Vocals capstone.

---

## Part 2: Suggested New Skill Categories

### A. Music Theory & Ear Training (3 tiers)
Skills that improve ALL musical activities. Currently no theoretical foundation skills exist.
- **Basic**: Sight reading, intervals, basic harmony
- **Professional**: Advanced harmony, counterpoint, analysis
- **Mastery**: Composition theory, orchestration, modal mastery

**Impact**: Bonus multiplier on songwriting quality, improved rehearsal efficiency, better recording outcomes.

### B. Music Business & Industry (3 tiers)
Currently no business-related skills despite the game having labels, venues, and companies.
- **Basic**: Contract basics, royalty understanding, booking knowledge
- **Professional**: Negotiation, marketing strategy, distribution knowledge
- **Mastery**: Industry leadership, brand management, deal structuring

**Impact**: Better contract terms from labels, higher gig pay negotiation, improved company operations.

### C. Improvisation (3 tiers)
A performance skill for live situations not covered by instrument-specific skills.
- **Basic**: Basic improv over chord changes, call-and-response
- **Professional**: Extended improvisation, genre-crossing spontaneity
- **Mastery**: Legendary improvisational command in any setting

**Impact**: Higher gig performance variance (upside), better jam session outcomes, emergency recovery during bad rolls.

### D. Audience Psychology & Marketing (3 tiers)
Distinct from Stage Showmanship -- this is about understanding and growing your fanbase.
- **Basic**: Fan engagement basics, social media strategy
- **Professional**: Audience segmentation, viral content creation
- **Mastery**: Cultural trendsetting, brand empire building

**Impact**: Faster fan growth, higher merch sales, better streaming numbers.

### E. Music Health & Endurance (3 tiers)
Physical stamina for touring and performing.
- **Basic**: Warm-up routines, posture, hearing protection
- **Professional**: Touring stamina, vocal health, injury prevention
- **Mastery**: Peak physical conditioning for marathon performances

**Impact**: Energy cost reduction for activities, longer gig endurance, reduced health penalties from touring.

---

## Part 3: How Skills Should Affect Each System

### Current State vs Proposed

| System | Current Skill Integration | Issues | Proposed Fix |
|---|---|---|---|
| **Songwriting** | Uses composing, lyrics, beatmaking, production, mixing, DAW, genre skills + 3 attributes | Works well | Add Music Theory bonus multiplier (0-10% boost) |
| **Gigs** | Uses `memberSkillAverage` (15% weight) via `ROLE_SKILL_MAP` for instrument skills + gear | Stage/Showmanship skills are NOT used despite existing | Add showmanship, crowd engagement, and stage tech as factors in gig performance |
| **Recording** | Uses ONLY studio quality, producer bonus, duration, orchestra, and rehearsal level | Player instrument and production skills are completely ignored | Add player skill factor: mixing/mastering, DAW, record production, and relevant instrument skills should boost recording quality |
| **Rehearsals** | Purely time-based (minutes practiced). No skill impact at all | A skilled drummer should learn faster than a beginner | Add skill-based efficiency: higher instrument skill = faster familiarity gain. Music Theory adds additional efficiency bonus |

### Detailed Implementation

#### 3A. Recording Quality -- Add Skill Factor

Currently `calculateRecordingQuality()` in `useRecordingData.tsx` only considers:
- Base song quality
- Studio quality (0-20% bonus)
- Producer bonus (1-30% bonus)
- Duration (2h=-5%, 3h=0%, 4h=+5%)
- Orchestra bonus
- Rehearsal bonus

**Add**: A `playerSkillMultiplier` that factors in:
- Relevant instrument skill for the song's primary instrument (0-10% bonus)
- Mixing & Mastering skill level (0-8% bonus)
- DAW Production skill level (0-5% bonus)
- Record Production skill level (0-7% bonus)
- Total max skill bonus: ~30%

This means a player with high production skills will produce noticeably better recordings than one with none, even at the same studio with the same producer.

#### 3B. Gig Performance -- Add Stage Skills

Currently `gigPerformanceCalculator.ts` weights:
- Song Quality: 25%
- Rehearsal: 20%
- Chemistry: 15%
- Equipment: 15%
- Crew: 10%
- Member Skills: 15% (instrument only)

**Change**: Split "Member Skills" into two factors:
- Instrument Skills: 10% (current, narrowed)
- Stage & Performance Skills: 10% (NEW)

Stage skills factor pulls from:
- `stage_*_showmanship` (primary contributor)
- `stage_*_crowd` (crowd engagement)
- `stage_*_tech` (stage tech reduces equipment failures)

Also add the new Improvisation skill as a variance reducer (higher skill = less chance of bad rolls, more chance of great moments).

#### 3C. Rehearsal Efficiency -- Add Skill Scaling

Currently familiarity is purely `minutes practiced`. A complete beginner and a master musician gain familiarity at the same rate.

**Add**: Skill-based efficiency multiplier to `completeRehearsalDirectly()` in `useRehearsalBooking.ts`:
- Calculate relevant instrument skill level for the song being rehearsed
- Apply efficiency multiplier: `1.0 + (skillLevel / 200)` (range 1.0x to 1.5x)
- Music Theory bonus: additional 0-10% efficiency
- Chemistry system's `rehearsalEfficiency` bonus (already calculated but not applied)
- Net effect: A skilled musician can reach "Perfected" in ~4 hours instead of 6

---

## Technical Details

### Files to Create

| File | Purpose |
|---|---|
| `src/utils/skillRecordingBonus.ts` | Calculate player skill bonus for recording quality |
| `src/utils/skillRehearsalEfficiency.ts` | Calculate skill-based rehearsal speed multiplier |

### Files to Modify

| File | Change |
|---|---|
| `src/data/skillTree.ts` | Remove 3 duplicate tracks (Singing, Live Looping, Vocal FX). Add Mastery tier to Rapping. Add 5 new skill categories (Music Theory, Music Business, Improvisation, Audience Psychology, Music Health). |
| `src/utils/skillGearPerformance.ts` | Update `ROLE_SKILL_MAP` to remove references to deleted "singing" slug. Add stage skill lookups. |
| `src/hooks/useRecordingData.tsx` | Update `calculateRecordingQuality` to accept and use player skill levels as a new parameter. |
| `src/components/recording/SessionConfigurator.tsx` | Fetch player skill progress and pass to quality calculation. Display skill bonus in breakdown. |
| `src/utils/gigPerformanceCalculator.ts` | Add `stageSkillAverage` to `PerformanceFactors`. Split member skills weight. Add improvisation variance modifier. |
| `src/utils/gigExecution.ts` | Fetch stage/showmanship skills and improvisation level. Pass to calculator. |
| `src/hooks/useRehearsalBooking.ts` | Apply skill-based efficiency multiplier to familiarity gain. Wire in chemistry rehearsal efficiency bonus. |
| `src/utils/rehearsalStageCalculation.ts` | Add optional efficiency multiplier parameter to `calculateRehearsalStage`. |
| `src/components/VersionHeader.tsx` | Bump to 1.0.625 |
| `src/pages/VersionHistory.tsx` | Changelog entry |

### Dependency & Sequencing

1. First: Clean up duplicates in `skillTree.ts` and update all references
2. Second: Add new skill categories to `skillTree.ts`
3. Third: Implement recording skill bonus (`skillRecordingBonus.ts` + wire into `useRecordingData.tsx`)
4. Fourth: Implement rehearsal efficiency (`skillRehearsalEfficiency.ts` + wire into `useRehearsalBooking.ts`)
5. Fifth: Implement gig stage skill integration (update calculator + execution)
6. Last: Version bump and changelog

### Edge Cases

- Players with zero skills should not be penalized below current baseline (multipliers start at 1.0, not below)
- Legacy "singing" skill progress rows in the database will be orphaned but harmless -- no migration needed since `skill_progress` uses `skill_slug` text
- The `ROLE_SKILL_MAP` fallback matching ensures new roles still get reasonable defaults

