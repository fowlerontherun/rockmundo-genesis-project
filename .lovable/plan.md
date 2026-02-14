
# Recording Tiers: Demo vs. Professional Recording (v1.0.655)

## Overview

Introduce a **Recording Type** step in the Recording Wizard that distinguishes between **Demo** and **Professional** recordings. Demos are cheap and quick but quality-capped. Professional recordings cost more, take longer, and benefit greatly from label backing -- though independent artists can still access them at higher cost and difficulty, with the penalty diminishing as fame/level grows.

## How It Works

### Recording Types

| Aspect | Demo | Professional |
|--------|------|-------------|
| Cost | Standard studio rate | 2.5x studio rate |
| Duration | 1 slot (4 hrs) | 2 slots (8 hrs) |
| Quality Cap | Capped at studio quality (max ~60 for low-end studios) | No cap |
| Quality Multiplier | 0.7x base multiplier | 1.0x (or 1.15x if label-signed) |
| Independent Penalty | None | -15% quality penalty (fades with fame/level) |
| Label Bonus | None | +15% quality bonus from label support |
| Availability | Any studio | Any studio (but low-quality studios still limit output) |

### Independent Artist Penalty (Professional only)

When recording professionally **without** an active label contract:
- Base penalty: **-15%** quality multiplier
- Reduced by **fame**: every 100k fame reduces penalty by 3%
- Reduced by **level**: every 10 levels reduces penalty by 3%
- At **500k+ fame** OR **level 50+**, penalty is fully removed
- This models the real-world difficulty of self-funding studio time, promotion, and distribution without label infrastructure

### Demo Quality Cap

Demo recordings are hard-capped: `finalQuality = min(finalQuality, studioQuality * 0.6)`. This means a studio with quality 50 caps demos at 30. Higher-quality studios still produce better demos, but they'll never match professional output.

## Technical Changes

### 1. New Database Column

Add `recording_type` column to `recording_sessions` table:
- Type: `text`, default `'professional'`
- Values: `'demo'` or `'professional'`

### 2. New Wizard Step: Recording Type Selector

Create `src/components/recording/RecordingTypeSelector.tsx`:
- Two cards: "Demo" and "Professional"
- Each card shows cost multiplier, duration, quality info
- Professional card shows a label status indicator (signed vs independent)
- If independent, shows the penalty and how close the player is to overcoming it

### 3. Updated Recording Wizard Flow

Modify `RecordingWizard.tsx`:
- Insert a **"Type"** tab after Studio selection: Studio -> Type -> Song -> (Version) -> Producer -> Config
- Store `recordingType` state ('demo' | 'professional')
- Pass `recordingType` to `SessionConfigurator`

### 4. Updated Session Configurator

Modify `SessionConfigurator.tsx`:
- Accept `recordingType` prop
- For demos: lock duration to 4 hrs, apply 0.7x multiplier, cap quality at `studioQuality * 0.6`
- For professional: set duration to 8 hrs, apply 2.5x cost multiplier to studio rate
- Check label contract status via `artist_label_contracts` (where `band_id` matches and `status = 'active'`)
- Calculate and display independent penalty (if applicable) with explanation of how to reduce it
- Show clear breakdown of type-specific modifiers in the quality preview

### 5. Updated Quality Calculation

Modify `calculateRecordingQuality` in `useRecordingData.tsx`:
- Add new parameters: `recordingType`, `isLabelSigned`, `fame`, `level`
- Apply demo cap logic
- Apply independent penalty (for professional, unsigned)
- Apply label bonus (for professional, signed)

### 6. Label Contract Check

Add a helper that queries `artist_label_contracts` to determine if the band/artist has an active label deal. This is used to toggle the label bonus vs. independent penalty in the quality calculation.

### 7. Version and History

- Bump to **v1.0.655**
- Add version history entry describing the demo vs. professional recording tier system

## Files to Create/Modify

- **Create**: `src/components/recording/RecordingTypeSelector.tsx`
- **Modify**: `src/components/recording/RecordingWizard.tsx` (add Type tab)
- **Modify**: `src/components/recording/SessionConfigurator.tsx` (type-aware costs/quality)
- **Modify**: `src/hooks/useRecordingData.tsx` (quality calc + session creation updates)
- **Modify**: `src/components/VersionHeader.tsx`
- **Modify**: `src/pages/VersionHistory.tsx`
- **Create**: Migration adding `recording_type` column to `recording_sessions`
