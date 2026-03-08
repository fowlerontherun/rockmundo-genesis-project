

## Remove Existing Gig Viewers & Build Top-Down 2D Pixel Art Gig Viewer

### What we're removing
All existing gig viewing modes — the **VideoGigViewer** (POV cam/3D clips), the **TextGigViewer** (commentary-only), the **GigViewerModeSelector** toggle, and related imports in `PerformGig.tsx` and `GigHistoryTab.tsx`.

Files/components to remove or gut:
- `src/components/gig-viewer/VideoGigViewer.tsx` — delete
- `src/components/gig-viewer/VideoClipPlayer.tsx` — delete
- `src/components/gig-viewer/VideoGigHUD.tsx` — delete
- `src/components/gig-viewer/LoadingScreen.tsx` — delete
- `src/components/gig/GigViewerModeSelector.tsx` — delete
- `src/components/gig/TextGigViewer.tsx` — delete
- `src/hooks/usePOVClips.ts` — delete
- `src/hooks/useGigClipSequence.ts` — delete
- `src/hooks/useCrowdSounds.ts` — delete
- `src/utils/crowdSoundMixer.ts` — delete

**Keep**: `GigAudioPlayer.tsx` (audio playback), `GigReviewViewer.tsx` (used in history tab post-gig review).

---

### What we're building: Top-Down 2D Pixel Art Gig Viewer

A single `<TopDownGigViewer>` component rendered via HTML Canvas (or layered divs with CSS pixel-art scaling), replacing both the video and text viewers.

#### Visual layout (top-down view)

```text
┌──────────────────────────────────┐
│           STAGE AREA             │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐    │
│  │ G │  │ V │  │ B │  │ D │    │  ← Band member sprites
│  └───┘  └───┘  └───┘  └───┘    │
│  ═══════════════════════════     │  ← Stage edge
├──────────────────────────────────┤
│  ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○  │
│  ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○    │  ← Crowd (density based
│  ○ ○ ○ ○ ○ ○ ○ ○ ○ ○           │     on attendance %)
│  ○ ○ ○ ○ ○ ○ ○                  │
└──────────────────────────────────┘
│ 🎵 Song: "Fire Walk" (3/8)      │  ← HUD overlay
│ 📊 Crowd: Hyped | 👥 85% full   │
│ 💬 Commentary text scrolling...  │  ← Commentary overlay
└──────────────────────────────────┘
```

#### Components to create

1. **`src/components/gig-viewer/TopDownGigViewer.tsx`** — Main container. Fetches gig data (same queries as old TextGigViewer: gig status, setlist songs, song performances). Manages song progression state. Renders the stage canvas + HUD + commentary overlay.

2. **`src/components/gig-viewer/TopDownStage.tsx`** — The pixel-art stage rendered as layered `<div>`s with CSS `image-rendering: pixelated`. Includes:
   - Stage floor (colored rectangle with pixel border)
   - Band member sprites positioned by instrument role (Guitar left, Vocals center, Bass right, Drums back-center)
   - Simple pixel-art instrument icons per role
   - Lighting effect overlays (colored divs with opacity changes based on song energy)
   - Animated "bobbing" on sprites when performing (CSS keyframes)

3. **`src/components/gig-viewer/TopDownCrowd.tsx`** — Crowd section below the stage:
   - Dot grid representing audience, count based on `attendancePercentage`
   - Color-coded by mood (green = hyped, yellow = engaged, red = bored)
   - Animated reactions: dots "jump" (translateY) during high-energy moments, wave effects during crowd chants
   - Mosh pit zone forms when crowd response is "enthusiastic"

4. **`src/components/gig-viewer/TopDownHUD.tsx`** — Overlay showing:
   - Current song title + progress (X/Y)
   - Crowd mood label + percentage
   - Venue name + attendance
   - Minimizable like the old VideoGigHUD

5. **`src/components/gig-viewer/TopDownCommentary.tsx`** — Scrolling commentary overlay (bottom or side panel):
   - Reuses the enhanced commentary generator (`src/utils/enhancedCommentaryGenerator.ts`)
   - Same commentary types: arrival, song_start, crowd_reaction, special_moment, etc.
   - Semi-transparent background, auto-scrolls

6. **`src/components/gig-viewer/TopDownMemberPopover.tsx`** — Click a band member sprite to see:
   - Name, instrument role, vocal role
   - Current song performance score
   - Skill contribution breakdown

#### Data flow
- Same as old TextGigViewer: polls `gigs` table for status/current_song_position, fetches `setlist_songs` with song details, watches `gig_song_performances` for per-song results
- Band members fetched from `band_members` table (instrument_role, vocal_role, profiles.display_name)
- No new database tables needed

#### Integration points
- **`src/pages/PerformGig.tsx`** — Replace the mode selector + dual viewer with single `<TopDownGigViewer>`. Remove `viewerMode` state, `GigViewerModeSelector`, `VideoGigViewer`, `TextGigViewer` imports.
- **`src/components/band/GigHistoryTab.tsx`** — Replace `VideoGigViewer` with `TopDownGigViewer` for replay. Keep `GigReviewViewer` as-is (it's a different post-gig breakdown UI).

#### Pixel art style
- CSS-based, no canvas API needed. Use `image-rendering: pixelated` on scaled-up small elements
- Tailwind for layout, inline styles for pixel scaling
- Sprite "characters" are simple colored div compositions (head circle + body rectangle + instrument icon) with pixel borders
- Stage uses gradient backgrounds with pixel-art border patterns
- Framer Motion for smooth transitions between songs

### Files to modify
- `src/pages/PerformGig.tsx` — swap viewers
- `src/components/band/GigHistoryTab.tsx` — swap viewers
- `src/components/gig-viewer/GigAudioPlayer.tsx` — keep as-is
- `src/components/VersionHeader.tsx` — bump version
- `src/pages/VersionHistory.tsx` — changelog

### Files to create
- `src/components/gig-viewer/TopDownGigViewer.tsx`
- `src/components/gig-viewer/TopDownStage.tsx`
- `src/components/gig-viewer/TopDownCrowd.tsx`
- `src/components/gig-viewer/TopDownHUD.tsx`
- `src/components/gig-viewer/TopDownCommentary.tsx`
- `src/components/gig-viewer/TopDownMemberPopover.tsx`

### Files to delete
- `src/components/gig-viewer/VideoGigViewer.tsx`
- `src/components/gig-viewer/VideoClipPlayer.tsx`
- `src/components/gig-viewer/VideoGigHUD.tsx`
- `src/components/gig-viewer/LoadingScreen.tsx`
- `src/components/gig/GigViewerModeSelector.tsx`
- `src/components/gig/TextGigViewer.tsx`
- `src/hooks/usePOVClips.ts`
- `src/hooks/useGigClipSequence.ts`
- `src/hooks/useCrowdSounds.ts`
- `src/utils/crowdSoundMixer.ts`

