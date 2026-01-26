// POV Clip Variant Configuration
// MTV2 / Kerrang late-night early-2000s aesthetic

export type ClipVariantId = 
  // Guitar variants
  | 'G1' // Guitar Strumming
  | 'G2' // Guitar Solo Close-Up
  // Bass variants
  | 'B1' // Bass Groove
  // Drums variants
  | 'D1' // Drums Snare POV
  | 'D2' // Drums Overhead Toms POV
  // Vocalist variants
  | 'V1' // Vocalist Mic POV
  // Crowd variants
  | 'C1' // Crowd Small Venue
  | 'C2' // Crowd Medium/Arena
  // Overlay variants
  | 'L1' // Stage Lights Overlay
  | 'L2' // Camera Shake Overlay
  // Skin variants
  | 'H1' // Hands + Sleeves Alternate Skin
  | 'I1'; // Instrument Alternate Skin

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
  // Guitar Variants
  G1: {
    id: 'G1',
    name: 'Guitar – Strumming',
    description: 'First-person POV of hands strumming an electric guitar during a live rock concert, early 2000s MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, high contrast overexposed stage lights, energetic but raw, close-up on guitar neck and hands, visible jacket sleeves, loopable, cinematic.',
    role: 'guitarist',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'bridge'],
    loopDuration: 4,
  },
  G2: {
    id: 'G2',
    name: 'Guitar – Solo Close-Up',
    description: 'First-person POV looking down at electric guitar playing a solo, fingers moving along the fretboard, high contrast overexposed stage lights, MTV2 / Kerrang late-night aesthetic, grainy texture, energetic handheld camera, loopable, cinematic, visible sleeves.',
    role: 'guitarist',
    energyRange: [0.7, 1.0],
    songSections: ['solo', 'outro'],
    loopDuration: 6,
  },
  
  // Bass Variants
  B1: {
    id: 'B1',
    name: 'Bass – Groove',
    description: 'First-person POV of hands plucking bass strings, looking down at fretboard, MTV2 / Kerrang late-night concert style, high contrast lighting, grainy texture, energetic motion, subtle camera shake, visible sleeves and wristbands, loopable, cinematic.',
    role: 'bassist',
    energyRange: [0.3, 0.8],
    songSections: ['verse', 'chorus', 'bridge', 'intro'],
    loopDuration: 4,
  },
  
  // Drums Variants
  D1: {
    id: 'D1',
    name: 'Drums – Snare POV',
    description: 'POV from drummer on stage, looking down at snare and hi-hat, hands holding sticks, gloves and wristbands visible, MTV2 / Kerrang late-night concert style, high contrast stage lights, grainy texture, energetic motion, loopable, cinematic.',
    role: 'drummer',
    energyRange: [0.3, 0.7],
    songSections: ['verse', 'chorus', 'intro'],
    loopDuration: 4,
  },
  D2: {
    id: 'D2',
    name: 'Drums – Overhead Toms POV',
    description: 'POV from drummer angled slightly forward at toms, hands holding sticks, MTV2 / Kerrang late-night concert style, energetic, high contrast stage lighting, grainy texture, loopable, cinematic.',
    role: 'drummer',
    energyRange: [0.6, 1.0],
    songSections: ['solo', 'chorus', 'outro', 'fill'],
    loopDuration: 3,
  },
  
  // Vocalist Variants
  V1: {
    id: 'V1',
    name: 'Vocalist – Mic POV',
    description: 'First-person POV of a singer holding a microphone, hands visible, overexposed stage lights in background, dark crowd in distance, MTV2 / Kerrang late-night aesthetic, grainy handheld camera feel, energetic performance, visible clothing on arms, loopable, cinematic.',
    role: 'vocalist',
    energyRange: [0.2, 1.0],
    songSections: ['verse', 'chorus', 'bridge', 'intro', 'outro'],
    loopDuration: 5,
  },
  
  // Crowd Variants
  C1: {
    id: 'C1',
    name: 'Crowd – Small Venue',
    description: 'Stage POV of a small concert audience, hands in the air, clapping and waving, silhouettes only, backlit by bright stage lights, MTV2 / Kerrang late-night early-2000s aesthetic, grainy texture, energetic, loopable.',
    role: 'crowd',
    energyRange: [0.2, 0.6],
    songSections: ['verse', 'bridge', 'intro'],
    loopDuration: 4,
  },
  C2: {
    id: 'C2',
    name: 'Crowd – Medium/Arena',
    description: 'Stage POV of a medium to large concert audience, hands waving and clapping, silhouettes, backlit by stage lights, MTV2 / Kerrang early-2000s aesthetic, grainy, energetic, loopable.',
    role: 'crowd',
    energyRange: [0.5, 1.0],
    songSections: ['chorus', 'solo', 'outro'],
    loopDuration: 4,
  },
  
  // Overlay Variants
  L1: {
    id: 'L1',
    name: 'Stage Lights Overlay',
    description: 'Transparent overlay of dynamic stage lights flashing in sync with energetic rock music, MTV2 / Kerrang late-night aesthetic, grainy overexposed lighting, subtle motion blur, cinematic handheld camera feel, loopable.',
    role: 'overlay',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 2,
  },
  L2: {
    id: 'L2',
    name: 'Camera Shake Overlay',
    description: 'Cinematic handheld camera shake effect, subtle motion blur, MTV2 / Kerrang late-night concert aesthetic, loopable, designed to simulate dynamic performance energy.',
    role: 'overlay',
    energyRange: [0.4, 1.0],
    songSections: ['chorus', 'solo', 'outro'],
    loopDuration: 1,
  },
  
  // Skin Variants
  H1: {
    id: 'H1',
    name: 'Hands + Sleeves Alternate Skin',
    description: 'Close-up first-person POV of hands playing guitar or bass, wearing leather jacket sleeve, gloves, wristbands, or alternate clothing skin, highly detailed textures and fabric folds, MTV2 / Kerrang late-night aesthetic, loopable, cinematic, with guitar strings, frets, or drumsticks visible. Designed for compositing in a rock concert game. Player-owned skin clearly visible.',
    role: 'skin',
    energyRange: [0.0, 1.0],
    songSections: ['all'],
    loopDuration: 4,
  },
  I1: {
    id: 'I1',
    name: 'Instrument Alternate Skin',
    description: 'Close-up first-person POV of hands playing guitar, bass, or drums, instrument featuring alternate player-owned skin, highly detailed textures on instrument and strings, reflective metallic parts, MTV2 / Kerrang late-night aesthetic, loopable, cinematic, visible sleeves and hands, designed for layering on top of base POV clips in a game.',
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
