

# Replace 3D Gig Viewers with AI-Generated POV Video Clips

## Overview

Remove the existing parallax/3D gig viewer and POV overlay system, and replace it with a video-based gig viewer that plays pre-generated AI video clips from the perspective of each musician on stage. Clips are generated using the Replicate API (already configured) and stored in Supabase Storage, then played back during gigs with dynamic cutting between camera angles.

## What Gets Removed

- `ParallaxGigViewer` (the 2D parallax stage with avatar images)
- `POVGigViewer` (the overlay-based POV system)
- All POV scene components (`GuitaristPOV`, `DrummerPOV`, `VocalistPOV`, `BassistPOV`, `KeyboardistPOV`, `CrowdPOV`)
- `StageLightsOverlay`, `InstrumentSkinOverlay`
- `POVPostProcessing`, `POVOverlays`, `CameraShake`
- `SimpleStageBackground`, `StageSpotlights`, `InstrumentSilhouettes`
- `CharacterAvatarImage`, `InstrumentOverlay`
- All `procedural-equipment/` components
- `Stage3DEquipment`
- Related hooks: `usePOVClipCycler`, `usePOVClipGenerator`

## Clip Categories and Counts

Based on the full skill tree, clips are needed for these instrument families, plus universal clips:

### Instrument POV Clips (~120 clips)

Each instrument gets 2-3 clip variants (looking down at instrument, looking at crowd, close-up hands):

| Family | Instruments | Clips Each | Total |
|--------|------------|------------|-------|
| Guitar family | Electric, Acoustic, Classical, 12-String, Pedal Steel, Lap Steel, Dobro, Bass, Upright Bass | 3 | ~27 |
| Keys family | Piano, Organ, Rhodes, Wurlitzer, Accordion, Harpsichord, Clavinet, Mellotron, Celesta | 2 | ~18 |
| Drums/Percussion | Rock Kit, Jazz Kit, Latin Perc, African, Tabla, Marimba, Vibes, Timpani, Snare, Steelpan, Taiko, Cajon, more | 3 | ~40 |
| Wind | Flute, Clarinet, Sax (alto/tenor/soprano/bari), Harmonica, Bagpipes, etc. | 2 | ~24 |
| Brass | Trumpet, Trombone, French Horn, Tuba, Euphonium, etc. | 2 | ~16 |
| Electronic | Turntables, Launchpad, Eurorack, Theremin, Keytar, MPC, Synths | 2 | ~14 |
| World/Folk | Sitar, Oud, Kora, Erhu, Shamisen, Bouzouki, etc. | 2 | ~24 |
| Vocals/Rap | Vocalist mic, Rapper, Freestyle | 3 | ~9 |

### Universal Stage Clips (~30 clips)

| Type | Description | Count |
|------|-------------|-------|
| Crowd (small venue) | POV from stage looking at 50-200 people, hands raised, moshing | 4 |
| Crowd (medium venue) | 500-2000 people, phone lights, lighters | 4 |
| Crowd (arena) | 5000+ people, massive production | 4 |
| Crowd (festival outdoor) | Daylight outdoor festival crowd | 4 |
| Walking backstage | POV walking through backstage corridors toward stage | 3 |
| Walking onto stage | POV stepping onto stage, lights hitting, crowd cheering | 3 |
| Bowing/exit | POV bowing to crowd, waving, walking off | 3 |
| Between songs | Looking across stage at bandmates, adjusting gear | 3 |
| Stage lights/atmosphere | Smoke, strobes, overhead rigs (overlay loops) | 2 |

### Total: ~150 unique clips

## Architecture

### Database Changes

1. **Expand `pov_clip_templates` table** -- add columns:
   - `video_url` (text) -- Supabase Storage URL of the generated clip
   - `thumbnail_url` (text) -- Still frame for loading
   - `instrument_family` (text) -- guitar, keys, drums, wind, brass, electronic, world, vocals, universal
   - `instrument_track` (text) -- matches skill tree track name (e.g. "Electric Guitar")
   - `variant` (text) -- "hands_down", "crowd_look", "close_up", "entrance", "exit", etc.
   - `venue_size` (text) -- small, medium, arena, festival, any
   - `generation_status` (text) -- pending, generating, completed, failed
   - `generation_prompt` (text) -- the AI prompt used
   - `generation_error` (text)

2. **Create Supabase Storage bucket** `pov-clips` for the video files

### Edge Function: `generate-pov-clips`

A batch generation function (admin-only) that:
1. Reads all instrument tracks from a config
2. For each, constructs a detailed prompt (MTV2/Kerrang aesthetic, first-person POV, specific instrument, ~5 second loop)
3. Generates a still image via Gemini (`google/gemini-2.5-flash-image`)
4. Sends the still to Replicate MiniMax for a short video (~5s)
5. Uploads the result to `pov-clips` storage bucket
6. Updates `pov_clip_templates` with the URL and status

Generation is batched and rate-limited (e.g., 5 concurrent) to avoid API overload. An admin UI page triggers and monitors progress.

### New Component: `VideoGigViewer`

Replaces `ParallaxGigViewer`. Core behavior:
- On load, fetches the band's instrument roles
- Queries `pov_clip_templates` for matching clips (by instrument_track or family)
- Builds a "cut list" -- a sequence of clips to play:
  - **Intro**: Backstage walk + onto-stage clip
  - **Per song**: Cycles through each band member's instrument POV (4-6 seconds each), interspersed with crowd shots
  - **Between songs**: Crowd reaction clips
  - **Outro**: Bowing + walk-off clip
- Plays clips back in a `<video>` element with crossfade transitions (CSS opacity)
- Syncs with song audio (existing `GigAudioPlayer`)
- Shows current song info, crowd response, and progress HUD overlay

### Cut Logic

```text
[Backstage Walk] -> [Walk On Stage] -> 
  Song 1: [Guitarist POV 5s] -> [Crowd 3s] -> [Drummer POV 5s] -> [Vocalist POV 5s] -> [Crowd 3s] ->
  [Between Songs Clip] ->
  Song 2: [Bassist POV 5s] -> [Guitarist POV 5s] -> [Crowd 3s] -> [Vocalist POV 5s] -> ...
  ...
[Bowing] -> [Walk Off]
```

The cut sequence is randomized per gig but weighted by:
- Song energy (higher energy = more crowd cuts, faster switching)
- Crowd response (ecstatic = more crowd shots)
- Instrument roles present in the band

### Admin Page: `/admin/pov-clips`

- Shows all clip templates with generation status
- "Generate All" button to kick off batch generation
- Individual "Regenerate" per clip
- Preview player for completed clips
- Progress bar for batch operations

### Fallback

If a specific instrument doesn't have a generated clip yet, fall back to the nearest family match (e.g., "Pedal Steel Guitar" falls back to any guitar POV clip). If no clips exist at all, show a stylized "audio only" mode similar to the music video viewer fallback.

## Technical Details

### Files to Create
- `src/components/gig-viewer/VideoGigViewer.tsx` -- main viewer
- `src/components/gig-viewer/VideoClipPlayer.tsx` -- handles dual-video crossfade
- `src/components/gig-viewer/GigCutSequencer.tsx` -- builds cut list from band + clips
- `src/components/gig-viewer/VideoGigHUD.tsx` -- overlay with song info, progress
- `src/hooks/useGigClipSequence.ts` -- manages clip cycling and transitions
- `src/hooks/usePOVClips.ts` -- fetches available clips for a band's instruments
- `src/data/instrumentClipConfig.ts` -- maps skill tree instruments to clip prompts
- `supabase/functions/generate-pov-clips/index.ts` -- batch generation
- `src/pages/admin/POVClipAdmin.tsx` -- admin management page
- `supabase/migrations/xxx_expand_pov_clips.sql` -- schema changes

### Files to Delete
- `src/components/gig-viewer/POVGigViewer.tsx`
- `src/components/gig-viewer/POVOverlays.tsx`
- `src/components/gig-viewer/POVPostProcessing.tsx`
- `src/components/gig-viewer/CameraShake.tsx`
- `src/components/gig-viewer/SimpleStageBackground.tsx`
- `src/components/gig-viewer/StageSpotlights.tsx`
- `src/components/gig-viewer/InstrumentSilhouettes.tsx`
- `src/components/gig-viewer/InstrumentOverlay.tsx`
- `src/components/gig-viewer/CharacterAvatarImage.tsx`
- `src/components/gig-viewer/Stage3DEquipment.tsx`
- `src/components/gig-viewer/POVClipPreview.tsx`
- `src/components/gig-viewer/ParallaxGigViewer.tsx`
- All files in `src/components/gig-viewer/pov-scenes/`
- All files in `src/components/gig-viewer/procedural-equipment/`
- `src/hooks/usePOVClipCycler.ts`
- `src/hooks/usePOVClipGenerator.ts`

### Files to Modify
- `src/pages/PerformGig.tsx` -- swap `ParallaxGigViewer` for `VideoGigViewer`
- `src/components/band/GigHistoryTab.tsx` -- same swap
- `src/components/gig/GigViewerModeSelector.tsx` -- update mode labels
- `src/components/VersionHeader.tsx` -- bump version
- `src/pages/VersionHistory.tsx` -- log changes

### Version
This will be **v1.0.815**.

