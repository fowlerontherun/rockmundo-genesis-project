// POV Clip Variant Configuration
// MTV2 / Kerrang late-night early-2000s aesthetic

export type ClipVariantId = 
  // Guitar variants with angle variations
  | 'G1' | 'G1A' | 'G1B' // Guitar Strumming (legacy, Angle A, Angle B)
  | 'G2' // Guitar Solo Close-Up
  // Bass variants with angle variations
  | 'B1' | 'B1A' | 'B1B' // Bass Groove (legacy, Angle A, Angle B)
  // Drums variants with angle variations
  | 'D1' | 'D1A' | 'D1B' // Drums Snare POV (legacy, Angle A, Angle B)
  | 'D2' // Drums Overhead Toms POV
  // Vocalist variants with angle variations
  | 'V1' | 'V1A' | 'V1B' // Vocalist Mic POV (legacy, Angle A, Angle B)
  // Crowd variants
  | 'C1' // Crowd Small Venue
  | 'C2' // Crowd Medium/Arena
  // Overlay variants with intensity variations
  | 'L1' | 'L1A' | 'L1B' // Stage Lights Overlay (legacy, Version A, Version B)
  | 'L2' | 'L2A' | 'L2B' // Camera Shake Overlay (legacy, Mild, Intense)
  // Skin variants with angle variations
  | 'H1' | 'H1A' | 'H1B' // Hands + Sleeves Alternate Skin (legacy, Angle A, Angle B)
  | 'I1' | 'I1A' | 'I1B'; // Instrument Alternate Skin (legacy, Angle A, Angle B)

export interface ClipVariant {
  id: ClipVariantId;
  name: string;
  description: string;
  role: 'guitarist' | 'bassist' | 'drummer' | 'vocalist' | 'crowd' | 'overlay' | 'skin';
  energyRange: [number, number]; // 0-1 range when this clip is most appropriate
  songSections: string[]; // Which song sections this works best with
  loopDuration: number; // Suggested loop duration in seconds
}

export const clipVariants: Record<ClipVariantId, ClipVariant> = {
  // Guitar Strumming Variants
  G1: {
    id: 'G1',
    name: 'Guitar – Strumming (Legacy)',
    description: 'First-person POV of hands strumming an electric guitar, MTV2 / Kerrang late-night aesthetic, grainy handheld camera, loopable.',
    role: 'guitarist',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'bridge'],
    loopDuration: 4,
  },
  G1A: {
    id: 'G1A',
    name: 'Guitar – Strumming – Angle A',
    description: 'First-person POV of hands strumming, close-up cinematic angle tilted left, MTV2 / Kerrang aesthetic, highly detailed textures on hands, fingernails, strings, frets, pick, metallic parts, leather jacket sleeve, wristbands, loopable.',
    role: 'guitarist',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'bridge'],
    loopDuration: 4,
  },
  G1B: {
    id: 'G1B',
    name: 'Guitar – Strumming – Angle B',
    description: 'First-person POV of hands strumming, close-up cinematic angle tilted right, tighter on fretboard emphasizing finger positions and hand movement, MTV2 / Kerrang aesthetic, loopable.',
    role: 'guitarist',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'bridge'],
    loopDuration: 4,
  },
  G2: {
    id: 'G2',
    name: 'Guitar – Solo Close-Up',
    description: 'First-person POV looking down at guitar during solo, zoomed in on fretboard, highly detailed textures on fingers, strings, frets, metallic hardware, leather jacket sleeve, loopable.',
    role: 'guitarist',
    energyRange: [0.7, 1.0],
    songSections: ['solo', 'outro'],
    loopDuration: 6,
  },
  
  // Bass Groove Variants
  B1: {
    id: 'B1',
    name: 'Bass – Groove (Legacy)',
    description: 'First-person POV of hands plucking bass strings, MTV2 / Kerrang aesthetic, grainy, energetic, loopable.',
    role: 'bassist',
    energyRange: [0.3, 0.8],
    songSections: ['verse', 'chorus', 'bridge', 'intro'],
    loopDuration: 4,
  },
  B1A: {
    id: 'B1A',
    name: 'Bass – Groove – Angle A',
    description: 'First-person POV of hands plucking bass, cinematic angle tilted left, highly detailed textures on fingers, strings, frets, wristbands, fabric folds, metallic reflections, loopable.',
    role: 'bassist',
    energyRange: [0.3, 0.8],
    songSections: ['verse', 'chorus', 'bridge', 'intro'],
    loopDuration: 4,
  },
  B1B: {
    id: 'B1B',
    name: 'Bass – Groove – Angle B',
    description: 'First-person POV of hands plucking bass, cinematic angle tilted right, tighter on fretboard emphasizing finger motion, loopable.',
    role: 'bassist',
    energyRange: [0.3, 0.8],
    songSections: ['verse', 'chorus', 'bridge', 'intro'],
    loopDuration: 4,
  },
  
  // Drums Variants
  D1: {
    id: 'D1',
    name: 'Drums – Snare POV (Legacy)',
    description: 'POV from drummer looking down at snare and hi-hat, MTV2 / Kerrang aesthetic, grainy, high contrast, loopable.',
    role: 'drummer',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'intro'],
    loopDuration: 4,
  },
  D1A: {
    id: 'D1A',
    name: 'Drums – Snare POV – Angle A',
    description: 'POV from drummer looking down at snare and hi-hat, cinematic angle slightly left, highly detailed textures on sticks, gloves, wristbands, drum heads, metallic reflections, loopable.',
    role: 'drummer',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'intro'],
    loopDuration: 4,
  },
  D1B: {
    id: 'D1B',
    name: 'Drums – Snare POV – Angle B',
    description: 'POV from drummer looking down at snare, cinematic angle slightly right with more focus on hi-hat and cymbals, cymbal metallic reflections, loopable.',
    role: 'drummer',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'intro'],
    loopDuration: 4,
  },
  D2: {
    id: 'D2',
    name: 'Drums – Overhead Toms POV',
    description: 'POV from drummer angled forward at toms, hands holding sticks, highly detailed textures on sticks, gloves, wristbands, drum heads, chrome hardware, loopable.',
    role: 'drummer',
    energyRange: [0.6, 1.0],
    songSections: ['solo', 'chorus', 'outro', 'fill'],
    loopDuration: 3,
  },
  
  // Vocalist Variants
  V1: {
    id: 'V1',
    name: 'Vocalist – Mic POV (Legacy)',
    description: 'First-person POV of singer holding microphone, MTV2 / Kerrang aesthetic, grainy handheld camera, loopable.',
    role: 'vocalist',
    energyRange: [0.2, 1.0],
    songSections: ['verse', 'chorus', 'bridge', 'intro', 'outro'],
    loopDuration: 5,
  },
  V1A: {
    id: 'V1A',
    name: 'Vocalist – Mic POV – Angle A',
    description: 'First-person POV of singer holding mic, cinematic angle slightly left, highly detailed textures on hands, fingers, fingernails, microphone mesh, metallic reflections, sleeves, wristbands, crowd silhouetted, loopable.',
    role: 'vocalist',
    energyRange: [0.2, 1.0],
    songSections: ['verse', 'chorus', 'bridge', 'intro', 'outro'],
    loopDuration: 5,
  },
  V1B: {
    id: 'V1B',
    name: 'Vocalist – Mic POV – Angle B',
    description: 'First-person POV of singer holding mic, cinematic angle slightly right, tighter on hands and mic, highly detailed textures, loopable.',
    role: 'vocalist',
    energyRange: [0.2, 1.0],
    songSections: ['verse', 'chorus', 'bridge', 'intro', 'outro'],
    loopDuration: 5,
  },
  
  // Crowd Variants
  C1: {
    id: 'C1',
    name: 'Crowd – Small Venue (Detailed)',
    description: 'Stage POV of small venue concert audience, close enough to see individual hands and fingers with bracelets, rings, wristbands, heads with varied hair styles, MTV2 / Kerrang aesthetic, high contrast stage lights reflecting on arms and hair, energetic, loopable. Foreground hands detailed, background stylized silhouettes for depth.',
    role: 'crowd',
    energyRange: [0.2, 0.6],
    songSections: ['verse', 'bridge', 'intro'],
    loopDuration: 4,
  },
  C2: {
    id: 'C2',
    name: 'Crowd – Medium/Arena (Detailed)',
    description: 'Stage POV of medium to large arena audience, foreground hands highly detailed with bracelets, rings, different skin tones, visible head shapes and varied hair styles, MTV2 / Kerrang aesthetic, phone lights and lighters visible, loopable. Background stylized silhouettes, dynamic stage lighting.',
    role: 'crowd',
    energyRange: [0.5, 1.0],
    songSections: ['chorus', 'solo', 'outro'],
    loopDuration: 4,
  },
  
  // Stage Lights Overlay Variants
  L1: {
    id: 'L1',
    name: 'Stage Lights Overlay (Legacy)',
    description: 'Transparent overlay of dynamic stage lights, MTV2 / Kerrang aesthetic, loopable, designed to composite on POV clips.',
    role: 'overlay',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 2,
  },
  L1A: {
    id: 'L1A',
    name: 'Stage Lights Overlay – Version A',
    description: 'Transparent overlay of dynamic stage lights, warm orange and white tones, lens flares, light beams through smoke, loopable.',
    role: 'overlay',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 2,
  },
  L1B: {
    id: 'L1B',
    name: 'Stage Lights Overlay – Version B',
    description: 'Transparent overlay of dynamic stage lights, cool blue and purple tones with bright white strobes, different flash pattern, loopable.',
    role: 'overlay',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 2,
  },
  
  // Camera Shake Overlay Variants
  L2: {
    id: 'L2',
    name: 'Camera Shake Overlay (Legacy)',
    description: 'Cinematic handheld camera shake effect, MTV2 / Kerrang aesthetic, loopable, designed to layer on POV clips.',
    role: 'overlay',
    energyRange: [0.4, 1.0],
    songSections: ['chorus', 'solo', 'outro'],
    loopDuration: 1,
  },
  L2A: {
    id: 'L2A',
    name: 'Camera Shake Overlay – Mild',
    description: 'Subtle handheld camera shake, mild motion blur, for verse and bridge sections, loopable.',
    role: 'overlay',
    energyRange: [0.2, 0.6],
    songSections: ['verse', 'bridge', 'intro'],
    loopDuration: 1,
  },
  L2B: {
    id: 'L2B',
    name: 'Camera Shake Overlay – Intense',
    description: 'Pronounced handheld camera shake, intense motion blur for solo or chorus peaks, high-energy performance intensity, loopable.',
    role: 'overlay',
    energyRange: [0.7, 1.0],
    songSections: ['chorus', 'solo', 'outro'],
    loopDuration: 1,
  },
  
  // Hands + Sleeves Skin Variants
  H1: {
    id: 'H1',
    name: 'Hands + Sleeves Alternate Skin (Legacy)',
    description: 'Close-up first-person POV of hands playing instrument, MTV2 / Kerrang aesthetic, loopable, player-owned skin visible.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  H1A: {
    id: 'H1A',
    name: 'Hands + Sleeves Skin – Angle A',
    description: 'Close-up first-person POV of hands playing guitar or bass, leather jacket sleeve, gloves, highly detailed textures on hands, fingers, fingernails, fabric folds, leather grain, metal studs, loopable.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  H1B: {
    id: 'H1B',
    name: 'Hands + Sleeves Skin – Angle B',
    description: 'Close-up first-person POV of hands playing, slightly different angle for variety, leather jacket sleeve, gloves, highly detailed textures, loopable.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  
  // Instrument Skin Variants
  I1: {
    id: 'I1',
    name: 'Instrument Alternate Skin (Legacy)',
    description: 'Close-up first-person POV of hands playing with alternate player-owned instrument skin, MTV2 / Kerrang aesthetic, loopable.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  I1A: {
    id: 'I1A',
    name: 'Instrument Skin – Angle A',
    description: 'Close-up first-person POV of hands playing guitar, bass, or drums with alternate player-owned skin, highly detailed textures on instrument body, strings, frets, reflective metallic parts, loopable.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  I1B: {
    id: 'I1B',
    name: 'Instrument Skin – Angle B',
    description: 'Close-up first-person POV of hands playing with alternate player-owned instrument skin, slightly different angle for variety, highly detailed textures, loopable.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
};

// Available instrument skin IDs
export const GUITAR_SKIN_IDS = ['classic-sunburst', 'midnight-black', 'arctic-white', 'cherry-red', 'ocean-blue', 'neon-green', 'purple-haze'] as const;
export const BASS_SKIN_IDS = ['natural-wood', 'jet-black', 'vintage-sunburst', 'blood-red', 'electric-blue'] as const;
export const SLEEVE_STYLE_IDS = ['leather', 'denim', 'hoodie', 'bare', 'band-tee'] as const;

export type GuitarSkinId = typeof GUITAR_SKIN_IDS[number];
export type BassSkinId = typeof BASS_SKIN_IDS[number];
export type SleeveStyleId = typeof SLEEVE_STYLE_IDS[number];

// Get appropriate clips for a given role and context
export function getClipsForRole(
  role: 'guitarist' | 'bassist' | 'drummer' | 'vocalist',
  intensity: number,
  songSection: string
): ClipVariantId[] {
  const clips = Object.values(clipVariants).filter(clip => {
    if (clip.role !== role) return false;
    if (intensity < clip.energyRange[0] || intensity > clip.energyRange[1]) return false;
    if (!clip.songSections.includes('all') && !clip.songSections.includes(songSection)) return false;
    return true;
  });
  
  return clips.map(c => c.id);
}

// Get crowd clip based on venue size
export function getCrowdClip(venueCapacity: number): ClipVariantId {
  return venueCapacity < 500 ? 'C1' : 'C2';
}

// Get active overlays based on intensity
export function getActiveOverlays(intensity: number): ClipVariantId[] {
  const overlays: ClipVariantId[] = ['L1']; // Always show stage lights
  if (intensity > 0.5) overlays.push('L2'); // Add camera shake at higher intensity
  return overlays;
}
