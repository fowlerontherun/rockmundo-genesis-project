

# Song Quality Scale Fix, Instrument Integration, and Skill Impact Overhaul (v1.0.660)

## Overview

Three core changes to make skills meaningfully impact song quality across songwriting, recording, and gigs:

1. **Fix quality scale**: The database function caps quality at 100 while the frontend system uses a 0-1000 scale. All quality scores will be unified to 0-1000.
2. **Instrument selection in songwriting**: Players pick which instruments are featured in a song project. The skill levels of those instruments directly affect the song quality calculation.
3. **Skill-driven quality everywhere**: Every skill level increase should visibly improve songwriting output, recording quality, and gig performance.

---

## 1. Fix Quality Scale (0-100 to 0-1000)

### The Problem
The database function `auto_complete_songwriting_sessions()` calculates quality on a 0-100 scale (line 137: `GREATEST(20, LEAST(100, v_quality_score))`), but the frontend `songQuality.ts` and `songRatings.ts` both use a 0-1000 scale. This mismatch means all auto-completed songs show quality around 100 or below, while the rating system expects values up to 1000.

Several UI components also display `/100` instead of `/1000`.

### Changes

**Database migration** -- Update `auto_complete_songwriting_sessions()`:
- Scale the quality calculation to produce 0-1000 values instead of 0-100
- Replace `GREATEST(20, LEAST(100, ...))` with `GREATEST(50, LEAST(1000, ...))`
- Multiply skill and attribute contributions by ~10x to fill the 1000-point range
- Factor in the instruments used on the project (stored in new `instruments` column)

**Fix UI displays** showing `/100`:
- `src/components/radio/SubmitSongDialog.tsx` -- change `/100` to `/1000`
- `src/components/jam-sessions/JamOutcomeReportDialog.tsx` -- change `/100` to `/1000`
- Any other places displaying quality out of 100

**CompleteSongDialog.tsx** -- When converting a project to a song, use the frontend `calculateSongQuality()` function (which already produces 0-1000) instead of just passing through the DB-calculated score. This ensures the detailed breakdown (melody, lyrics, rhythm, arrangement, production) drives the final quality.

---

## 2. Instrument Selection in Songwriting Projects

### How It Works
When creating or editing a songwriting project, players will select which instruments are featured in the song (e.g., Electric Guitar, Bass Guitar, Drums, Vocals, Piano). These instruments come from the existing skill tree instrument categories.

The selected instruments affect quality in two ways:
- **Instrument skill bonus**: The player's skill level in each selected instrument contributes to the song's arrangement and production scores
- **Instrument count bonus**: More instruments = richer arrangement potential (diminishing returns)

### Changes

**Database migration** -- Add `instruments` column to `songwriting_projects`:
- Type: `text[]` (array of instrument skill slugs)
- Nullable, defaults to empty array

**New component**: `InstrumentSelector.tsx`
- Multi-select component listing all instruments from the skill tree (filtered to the `Instruments & Performance` category)
- Shows the player's current skill level next to each instrument
- Displays a preview of how each instrument's skill level will affect quality
- Used in the songwriting project creation/edit flow

**Update songwriting project creation** to include instrument selection

**Update `songQuality.ts`**:
- Add new input field: `instrumentSkills: { slug: string; level: number }[]`
- New sub-calculation: `calculateInstrumentBonus()` that sums skill contributions from selected instruments
- Instrument bonus feeds into arrangement strength and adds a new "Instrumentation" quality area
- Each instrument contributes up to ~30 points based on skill level, with diminishing returns after 4-5 instruments

---

## 3. Skill Impact on Recording and Gigs

### Recording Quality
The existing `skillGearPerformance.ts` already maps band roles to instrument skills and calculates modifiers. This utility will be integrated more directly into recording quality:

- When recording, the instruments selected during songwriting determine which band member skills are checked
- Higher instrument skills = higher recording quality multiplier (already partially implemented via `calculateSkillModifier`)
- The recording quality calculation will incorporate the song's instrument list to match against band member skills

### Gig Performance
The existing `LiveGigPerformance.tsx` uses `quality_score / 100` for base scoring. This will be updated to:
- Use `quality_score / 1000` to match the new scale
- Continue using `skillGearPerformance.ts` for live performance modifiers

### Continuous Improvement Loop
Every skill level increase already improves the values returned by:
- `songQuality.ts` (composing, lyrics, beatmaking, mixing, DAW, etc.)
- `skillGearPerformance.ts` (instrument skills for gigs/recording)
- `auto_complete_songwriting_sessions()` (DB-side quality calc)

By adding instrument skills to the songwriting quality formula, players will see tangible improvement from training any relevant skill.

---

## Technical Changes Summary

### Database Migration
1. Add `instruments text[]` column to `songwriting_projects`
2. Rewrite `auto_complete_songwriting_sessions()` to use 0-1000 scale and factor in project instruments

### Files to Create
- `src/components/songwriting/InstrumentSelector.tsx` -- multi-select instrument picker with skill levels

### Files to Modify
- `src/utils/songQuality.ts` -- add instrument bonus calculation, new `instrumentSkills` input
- `src/components/songwriting/SongQualityBreakdown.tsx` -- add "Instrumentation" area to breakdown display
- `src/components/songwriting/CompleteSongDialog.tsx` -- use `calculateSongQuality()` for proper 0-1000 scoring
- `src/components/radio/SubmitSongDialog.tsx` -- fix `/100` to `/1000`
- `src/components/jam-sessions/JamOutcomeReportDialog.tsx` -- fix `/100` to `/1000`
- `src/components/gig/LiveGigPerformance.tsx` -- fix `quality_score / 100` to `/ 1000`
- `src/components/VersionHeader.tsx` -- bump to v1.0.660
- `src/pages/VersionHistory.tsx` -- add changelog entry
- Songwriting project creation/edit forms -- integrate InstrumentSelector

### Instrument List (from skill tree)
The selector will pull all instruments from the `Instruments & Performance` category in the skill tree, including: Acoustic Guitar, Classical Guitar, Electric Guitar, Bass Guitar, Upright Bass, Violin, Viola, Cello, Banjo, Mandolin, Ukulele, Harp, 12-String Guitar, Pedal Steel, Lap Steel, Dobro, Classical Piano, Jazz Piano, Hammond Organ, Pipe Organ, Rhodes, Rock Drums, Jazz Drums, and many more (60+ instruments total).

