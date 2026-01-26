
# First-Person POV Live Concert System

## Version: 1.0.512

## Overview
Create an immersive first-person POV concert viewer that places the player on stage as if they are the performer. Features a gritty, handheld MTV2/Kerrang early-2000s aesthetic with high contrast lighting, film grain, and energetic visual effects.

---

## Core Concept

The POV system shows what the player sees while performing:
- **Guitarist POV**: Looking down at fretboard, picking hand, sleeve visible
- **Bassist POV**: Bass neck, fingers on strings, crowd glimpses
- **Drummer POV**: Sticks hitting drums, cymbals, crowd through kit
- **Vocalist POV**: Microphone, hand gestures, crowd faces
- **Keyboardist POV**: Keys, hands moving, stage monitors

---

## Visual Aesthetic

### MTV2/Kerrang Late-Night Style
| Element | Implementation |
|---------|----------------|
| Film Grain | Animated noise overlay (15-25% opacity) |
| High Contrast | CSS filter: contrast(1.3) |
| Overexposed Highlights | White bloom overlay on bright areas |
| Desaturation | CSS filter: saturate(0.7) |
| Handheld Feel | Subtle random camera shake animation |
| Scan Lines | Optional CRT-style horizontal lines |
| Vignette | Dark corners gradient overlay |

---

## Implementation Plan

### Phase 1: Database Schema

**New Table: `pov_clip_templates`**

Stores metadata for POV clip configurations per instrument/moment:

```sql
CREATE TABLE pov_clip_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_role text NOT NULL, -- guitarist, bassist, drummer, vocalist, keyboardist
  clip_type text NOT NULL, -- 'playing', 'crowd_look', 'stage_scan', 'solo_focus'
  description text,
  camera_position jsonb, -- { x, y, z, lookAt }
  duration_range int[] DEFAULT ARRAY[3, 8], -- min/max seconds
  energy_level text DEFAULT 'medium', -- low, medium, high, climax
  overlays text[] DEFAULT '{}', -- which overlay effects to use
  created_at timestamptz DEFAULT now()
);
```

### Phase 2: POV Viewer Component

**New File: `src/components/gig-viewer/POVGigViewer.tsx`**

Main component that renders the first-person view:

```typescript
interface POVGigViewerProps {
  gigId: string;
  playerRole: 'guitarist' | 'bassist' | 'drummer' | 'vocalist' | 'keyboardist';
  intensity: number;
  songSection: string;
  crowdMood: number;
}
```

Features:
- Role-specific POV rendering
- Automatic clip cycling based on song section
- Intensity-reactive effects

### Phase 3: Post-Processing Effects Layer

**New File: `src/components/gig-viewer/POVPostProcessing.tsx`**

Applies the MTV2/Kerrang aesthetic:

```typescript
interface POVPostProcessingProps {
  intensity: number;
  grainAmount: number; // 0.15-0.25
  contrast: number; // 1.2-1.4
  saturation: number; // 0.6-0.8
  enableScanLines: boolean;
  vignetteStrength: number;
}
```

CSS Filter Stack:
```css
.pov-container {
  filter: 
    contrast(1.3) 
    saturate(0.7) 
    brightness(1.1);
}

.grain-overlay {
  background-image: url('/textures/effects/film-grain.png');
  animation: grain-shift 0.1s steps(10) infinite;
  opacity: 0.2;
  mix-blend-mode: overlay;
}

.vignette {
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(0,0,0,0.6) 100%
  );
}
```

### Phase 4: Camera Shake System

**New File: `src/components/gig-viewer/CameraShake.tsx`**

Handheld camera simulation:

```typescript
const useHandheldShake = (intensity: number, songSection: string) => {
  // Base micro-movement (always present)
  const microShake = { x: random(-1, 1), y: random(-0.5, 0.5) };
  
  // Energy bursts during chorus/solo
  const energyShake = songSection === 'chorus' 
    ? { x: random(-3, 3), y: random(-2, 2) }
    : { x: 0, y: 0 };
  
  // Occasional larger movements (looking around)
  const lookShake = useInterval(() => ({ 
    x: random(-8, 8), 
    y: random(-4, 4) 
  }), 3000);
  
  return combine(microShake, energyShake, lookShake);
};
```

### Phase 5: Instrument POV Scenes

**New Directory: `src/components/gig-viewer/pov-scenes/`**

Each instrument gets its own POV component:

**GuitaristPOV.tsx**
- Fretboard in lower frame
- Picking hand visible
- Sleeve/wrist detail
- Occasional crowd glimpses through hair flick
- Solo sections: faster hand movement, face close-up to neck

**DrummerPOV.tsx**
- Sticks in frame, blurred motion
- Drum heads and cymbals
- Crowd visible through gaps in kit
- Hi-hat foot visible bottom frame
- Fills: rapid view switching

**VocalistPOV.tsx**
- Microphone center frame
- Hand gestures
- Crowd faces (blurred, lit by phones)
- Stage monitors
- Between songs: band member glances

**BassistPOV.tsx**
- Bass neck diagonal in frame
- Fingers on frets
- Amp stack visible side
- Groove sections: subtle head bob

**KeyboardistPOV.tsx**
- Keys stretching across frame
- Hands moving
- Synth displays
- Side stage view

### Phase 6: Overlay System

**New File: `src/components/gig-viewer/POVOverlays.tsx`**

Layered effects that enhance the concert feel:

```typescript
type OverlayType = 
  | 'lens_flare'      // Bright light bursts
  | 'stage_lights'    // Colored beams
  | 'sweat_drops'     // Subtle moisture effect
  | 'crowd_hands'     // Arms reaching up
  | 'pyro_flash'      // Climax moments
  | 'strobe'          // High energy
  | 'haze'            // Atmospheric fog
  | 'confetti';       // Celebration moments
```

Overlay behavior by song section:
| Section | Active Overlays |
|---------|-----------------|
| Intro | haze, stage_lights (dim) |
| Verse | stage_lights, subtle lens_flare |
| Chorus | lens_flare, crowd_hands, strobe (if high energy) |
| Bridge | haze (heavy), stage_lights (moody) |
| Solo | lens_flare (intense), sweat_drops |
| Outro | confetti (if good show), crowd_hands |

### Phase 7: AI-Generated POV Images

**New Edge Function: `supabase/functions/generate-pov-clip/index.ts`**

Uses the Lovable AI image generation API to create custom POV frames:

```typescript
const generatePOVImage = async (
  instrument: string,
  clipType: string,
  energy: 'low' | 'medium' | 'high'
) => {
  const prompt = buildPOVPrompt(instrument, clipType, energy);
  // "First-person POV from drummer on stage, looking down at snare drum, 
  //  drumsticks in motion, blurred crowd visible through cymbals, 
  //  high contrast stage lighting, film grain, MTV2 late night aesthetic,
  //  gritty, handheld camera feel, overexposed highlights"
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    // ... generate image
  });
  
  // Store in Supabase storage
  return imageUrl;
};
```

### Phase 8: Integration with Existing Viewer

**Modify: `src/components/gig-viewer/ParallaxGigViewer.tsx`**

Add POV mode toggle:

```typescript
const [viewMode, setViewMode] = useState<'stage' | 'pov'>('stage');
const [povRole, setPovRole] = useState<string>('vocalist');

// In render:
{viewMode === 'pov' ? (
  <POVGigViewer
    gigId={gigId}
    playerRole={povRole}
    intensity={intensity}
    songSection={songSection}
    crowdMood={crowdMood}
  />
) : (
  // Existing stage view
)}
```

### Phase 9: Texture Assets

**New Textures to Create:**

| Texture | Purpose |
|---------|---------|
| `film-grain.png` | Animated grain overlay |
| `scan-lines.png` | CRT effect |
| `lens-dirt.png` | Realistic lens imperfections |
| `sweat-drops.png` | Intensity effect |
| `crowd-silhouette-pov.png` | Blurred crowd from stage |
| `stage-light-beam.png` | Light ray overlay |
| `pyro-flash.png` | Explosion effect |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_pov_clips.sql` | CREATE | POV clip template table |
| `src/components/gig-viewer/POVGigViewer.tsx` | CREATE | Main POV viewer |
| `src/components/gig-viewer/POVPostProcessing.tsx` | CREATE | Visual effects layer |
| `src/components/gig-viewer/CameraShake.tsx` | CREATE | Handheld simulation |
| `src/components/gig-viewer/POVOverlays.tsx` | CREATE | Stage light/effect overlays |
| `src/components/gig-viewer/pov-scenes/GuitaristPOV.tsx` | CREATE | Guitar POV |
| `src/components/gig-viewer/pov-scenes/DrummerPOV.tsx` | CREATE | Drums POV |
| `src/components/gig-viewer/pov-scenes/VocalistPOV.tsx` | CREATE | Vocals POV |
| `src/components/gig-viewer/pov-scenes/BassistPOV.tsx` | CREATE | Bass POV |
| `src/components/gig-viewer/pov-scenes/KeyboardistPOV.tsx` | CREATE | Keys POV |
| `src/hooks/usePOVClipCycler.ts` | CREATE | Clip rotation logic |
| `supabase/functions/generate-pov-clip/index.ts` | CREATE | AI image generation |
| `src/components/gig-viewer/ParallaxGigViewer.tsx` | MODIFY | Add POV mode toggle |
| `src/assets/textures/effects/film-grain.png` | CREATE | Grain texture |
| `src/components/VersionHeader.tsx` | MODIFY | v1.0.512 |
| `src/pages/VersionHistory.tsx` | MODIFY | Changelog |

---

## UI Controls

### POV Mode Selector
Add to HUD controls:
- **View Toggle**: Stage View / POV Mode
- **Role Selector**: Choose which band member's POV (default: player's role)
- **Effect Intensity**: Slider for grain/contrast amount

---

## Performance Considerations

1. **CSS-based effects** preferred over canvas/WebGL for mobile compatibility
2. **Preload textures** for overlay effects
3. **Debounce camera shake** calculations
4. **Lazy load POV scenes** based on current role
5. **Cache AI-generated images** in Supabase storage

---

## Version History Entry

**v1.0.512**
- NEW: First-Person POV Concert Mode - experience gigs from the performer's perspective
- POV: Instrument-specific views (guitarist, drummer, vocalist, bassist, keyboardist)
- POV: MTV2/Kerrang late-night aesthetic with film grain, high contrast, desaturation
- POV: Handheld camera shake simulation synced to song energy
- POV: Dynamic overlay system (lens flares, stage lights, crowd hands, pyro)
- POV: Post-processing effects layer with vignette and scan lines
- POV: Role selector to view from any band member's perspective
- POV: AI-generated POV clip frames for variety
