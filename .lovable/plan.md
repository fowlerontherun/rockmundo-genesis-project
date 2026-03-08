

# Expand & Enhance Top-Down Gig Viewer — Multi-Phase Plan

## Current State

The viewer has 6 components: a basic stage with colored rectangles as band members, a dot-grid crowd, a HUD, commentary overlay, member popover, and main viewer. The stage is a flat dark gradient with wood-plank lines. No venue theming, no stage equipment, no lighting rigs, no effects, no barriers, no sound booth — just colored boxes on a dark background.

## Plan Overview

This expansion adds **themed venue stages**, **detailed stage furniture/equipment**, **dynamic lighting rigs**, **animated effects**, **crowd features** (barriers, merch booth, sound desk), **song-genre visual reactions**, and **an enhanced HUD with controls**. Split across 7 tasks.

---

### Task 1: Venue-Themed Stage Backgrounds

Create a `StageTheme` system mapping `venue_type` (from the venues table: `indie_venue`, `rock_club`, `concert_hall`, `arena`, `stadium`, `bar`, `festival_ground`, `outdoor`) to distinct visual themes.

**New file: `src/components/gig-viewer/StageThemes.ts`**
- Define theme configs: floor color/pattern, wall color, side curtain style, stage edge material, ambient glow color
- Examples: `bar` = sticky wooden floor, exposed brick back wall, dim amber glow; `arena` = polished black floor, massive LED backdrop, sweeping spotlights; `festival_ground` = open-air with sky gradient backdrop, grass edges; `concert_hall` = elegant wood, red curtains

**Modify: `TopDownStage.tsx`**
- Accept `venueType` prop
- Apply theme-specific CSS gradients, patterns, and colors instead of hardcoded zinc gradients
- Add side walls/curtains rendered as div elements with theme-appropriate styling

**Modify: `TopDownGigViewer.tsx`**
- Pass `gig.venues.venue_type` down to TopDownStage

---

### Task 2: Stage Equipment & Furniture

Add visible pixel-art-style equipment on stage rendered as styled divs with emoji/unicode icons.

**New file: `src/components/gig-viewer/StageEquipment.tsx`**
- **Monitor wedges** — small trapezoid shapes along front of stage
- **Amp stacks** — rectangles with grille pattern on sides
- **Drum riser** — elevated platform behind drummer position
- **Mic stands** — thin lines at vocalist positions
- **Speaker stacks** — large rectangles at stage edges (scale with venue size)
- **Cable/pedalboard details** — small colored dots near guitarist feet
- Equipment scales with `venueType`: bars get minimal, arenas get massive PA stacks

**Modify: `TopDownStage.tsx`**
- Render `<StageEquipment>` behind band members layer

---

### Task 3: Dynamic Lighting Rig System

Create an animated lighting system that reacts to song energy and crowd mood.

**New file: `src/components/gig-viewer/StageLighting.tsx`**
- **Spotlight cones** — CSS conic-gradient divs pointing down from top, animated sweep
- **Moving head lights** — divs that rotate/pan based on energy (framer-motion)
- **Wash lights** — large soft color overlays synced to `lightingColor`
- **Strobe effect** — rapid opacity flash during `ecstatic` mood
- **Laser beams** — thin colored lines sweeping during high-energy songs (CSS transforms)
- **LED bar strips** — colored bars along stage front edge, cycling through colors
- Venue scaling: bars get 2 spots, arenas get 8+ spots with moving heads and lasers

**Modify: `TopDownStage.tsx`**
- Layer `<StageLighting>` on top of equipment, below member sprites

---

### Task 4: Enhanced Band Member Sprites

Replace the simple colored box sprites with more detailed pixel-art characters.

**Modify: `TopDownStage.tsx`**
- Larger sprites (w-10 h-12) with distinct body parts: head, torso, arms, legs
- **Instrument-specific animations**: guitarist arm strumming motion, drummer arms alternating up/down, vocalist bouncing more dramatically, bassist subtle sway, keyboardist hands moving side to side
- **Performance glow**: members with high scores get a subtle radiant glow ring
- **Vocal indicator**: animated "♪" notes floating up from vocalist when singing
- **Solo spotlight**: when `SPECIAL_MOMENTS` triggers guitar solo, spotlight focuses on guitarist

**Modify: `TopDownMemberPopover.tsx`**
- Add gear info display, current song contribution bar chart
- Show real-time energy state (playing, soloing, resting)

---

### Task 5: Detailed Crowd Area & Venue Features

Expand the crowd zone with venue furniture and interactive crowd behaviors.

**New file: `src/components/gig-viewer/VenueFeatures.tsx`**
- **Barrier/fence line** between stage and crowd (with security guard dots for larger venues)
- **Sound desk** — rectangle in the middle-back of crowd area with operator dot
- **Merch booth** — small labeled area on one side
- **Bar area** — dots clustered at back with different color (not bouncing)
- **Photo pit** — narrow gap between barrier and crowd for arena+ venues
- **VIP section** — slightly different colored area for prestige venues

**Modify: `TopDownCrowd.tsx`**
- Different crowd dot sizes (some larger = closer, some smaller = further)
- **Phone flashlights** — white dots that flicker on during ballads/low-energy songs
- **Crowd surfer** — occasional dot that moves across the top of crowd during ecstatic
- **Circle pit** — rotating ring of dots during ecstatic + high-energy (metal/punk genres)
- **Wave effect** — sequential row-by-row bounce for engaged crowds
- Crowd density zones: packed front, moderate middle, sparse back

---

### Task 6: Genre-Reactive Visuals

Different music genres trigger different visual palettes and effects.

**New file: `src/components/gig-viewer/GenreVisuals.ts`**
- Config mapping genre → color palette, particle style, crowd behavior, lighting style
- `rock/metal`: red/orange tones, aggressive crowd, strobe, mosh pit
- `pop`: bright multi-color, phone lights, smooth sweeps
- `jazz/blues`: warm amber/gold, subtle sway, minimal lighting changes
- `electronic/edm`: neon cyan/magenta, rapid color cycling, laser beams
- `punk`: green/black, circle pit, minimal stage setup
- `country/folk`: warm yellow/brown, gentle sway, lantern-style lighting
- `hip-hop/rap`: purple/gold, bass pulse effect (stage border throbs), hype crowd

**Modify: `TopDownGigViewer.tsx`**
- Detect genre from current song data, pass to stage/crowd/lighting
- Genre affects lighting color palette, crowd animation style, stage ambiance

---

### Task 7: Enhanced HUD & Viewer Controls

Upgrade the HUD with more information and player controls.

**Modify: `TopDownHUD.tsx`**
- **Song progress bar** — thin bar showing elapsed time within current song
- **Momentum meter** — small visual showing current momentum (-3 to +3)
- **Setlist mini-view** — expandable list showing played/current/upcoming songs with scores
- **Performance grade** — running letter grade (S/A/B/C/D) based on average scores

**New file: `src/components/gig-viewer/ViewerControls.tsx`**
- **Speed control** — 1x/2x/4x playback speed (adjusts poll interval)
- **Camera toggle** — switch between "full venue" and "stage close-up" views (CSS zoom)
- **Stats overlay toggle** — show/hide detailed per-member stats floating on stage
- **Screenshot button** — capture current viewer state

**Modify: `TopDownCommentary.tsx`**
- Color-coded commentary types with icons (🎸 song start, 👥 crowd, ⭐ special, etc.)
- Commentary speed matches playback speed

---

### Version & History
- Bump to **v1.0.902** in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx`

### Files Summary
- **New** (5): `StageThemes.ts`, `StageEquipment.tsx`, `StageLighting.tsx`, `VenueFeatures.tsx`, `GenreVisuals.ts`, `ViewerControls.tsx`
- **Modified** (6): `TopDownGigViewer.tsx`, `TopDownStage.tsx`, `TopDownCrowd.tsx`, `TopDownHUD.tsx`, `TopDownCommentary.tsx`, `TopDownMemberPopover.tsx`, `VersionHeader.tsx`, `VersionHistory.tsx`

I will implement these task by task, starting with Task 1.

